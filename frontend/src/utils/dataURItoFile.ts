import uploadMultipleFiles from "./uploadFile";

/* eslint-disable no-useless-escape */
export function findDataUrisInHtml(html: string): string[] {
  const found = new Set<string>();
  if (!html) return [];
  // matches data:<mime>;base64,.... (non-greedy)
  const dataUriRegex = /data:([a-zA-Z0-9/+\-\.]+);base64,[A-Za-z0-9+/=\n\r]+/g;
  let m;
  while ((m = dataUriRegex.exec(html)) !== null) {
    found.add(m[0]);
  }
  return Array.from(found);
}

// Helper: konversi dataURI ke File object (but give a filename)
function dataURItoFile(dataURI: string, filename = "attachment"): File {
  const arr = dataURI.split(",");
  const meta = arr[0]; // data:[<mime>;base64
  const base64 = arr[1] || "";
  const mimeMatch = meta.match(/data:([^;]+);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const byteString = atob(base64.replace(/\s/g, ""));
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  // determine extension from mime if possible
  let ext = "";
  if (mime.includes("/")) {
    ext = mime.split("/")[1].split("+")[0];
    // sanitize ext
    ext = ext.replace(/[^a-zA-Z0-9]/g, "");
    if (ext.length > 6) ext = ext.slice(0, 6);
  }
  const safeName = `${filename}${ext ? "." + ext : ""}`;
  const blob = new Blob([ab], { type: mime });
  // File constructor widely supported in modern browsers
  return new File([blob], safeName, { type: mime });
}

// Helper: replace data: URIs inside a single HTML string and upload them.
// Returns { html: string, attachments: Array<{url,name,mime}> }
export async function replaceDataUrisInHtmlAndUpload(html: string) {
  if (!html || typeof html !== "string") return { html: "", attachments: [] };

  const dataUris = findDataUrisInHtml(html);
  if (dataUris.length === 0) return { html, attachments: [] };

  // Convert to File[]
  const files = dataUris.map((duri, i) => {
    // try to give a meaningful filename: extract ext or fallback to idx+timestamp
    const extGuess =
      (duri.match(/data:([^;]+);base64/)?.[1] || "application/octet-stream")
        .split("/")[1]
        ?.split("+")[0]
        ?.replace(/[^a-zA-Z0-9]/g, "") || "";
    const filename = `upload_${Date.now()}_${i}${
      extGuess ? "." + extGuess : ""
    }`;
    return dataURItoFile(duri, filename);
  });

  let uploadedUrls: string[] = [];
  try {
    uploadedUrls = await uploadMultipleFiles(files, "attachments");
  } catch (err: any) {
    throw new Error(`Failed uploading embedded files: ${err?.message || err}`);
  }

  // Map dataUri -> uploadedUrl and build attachments metadata
  const dataUriToUrl = new Map<string, string>();
  const attachments: Array<{ url: string; name?: string; mime?: string }> = [];
  dataUris.forEach((duri, idx) => {
    const url = uploadedUrls[idx];
    dataUriToUrl.set(duri, url);
    attachments.push({ url, name: files[idx].name, mime: files[idx].type });
  });

  // Replace URIs in html
  let updatedHtml = html;
  for (const [duri, url] of dataUriToUrl.entries()) {
    if (updatedHtml.includes(duri)) {
      updatedHtml = updatedHtml.split(duri).join(url);
    }
  }

  return { html: updatedHtml, attachments };
}

// Helper: proses array komentar (yang mungkin HTML strings)
// - cari semua data: URIs
// - konversi ke File
// - upload batch (satu uploadMultipleFiles untuk semua files di semua comments supaya parallel)
// - ganti dataURIs di setiap comment HTML dengan url uploaded
// Returns newComments (cloned) with comments' HTML updated and also adds attachments metadata if you want.
export async function replaceDataUrisInCommentsAndUpload(comments: any[] = []) {
  if (!Array.isArray(comments) || comments.length === 0) return comments;

  // mapping dataUri -> { file, owners: [indexes] }
  const dataUriToInfo = new Map<
    string,
    { file: File; places: Array<{ commentIdx: number; original: string }> }
  >();

  // detect and collect data URIs
  comments.forEach((c, ci) => {
    // we expect comment content in some field, adapt if your comment shape differs
    // common shapes: { id, html, text, content, body } - adjust accordingly
    const html = c.html ?? c.content ?? c.body ?? "";
    const uris = findDataUrisInHtml(html);
    for (const u of uris) {
      if (!dataUriToInfo.has(u)) {
        // create a filename hint from comment or original filename not available — use timestamp + idx
        const filenameHint = `comment_${ci}_${Date.now()}`;
        dataUriToInfo.set(u, {
          file: dataURItoFile(u, filenameHint),
          places: [{ commentIdx: ci, original: u }],
        });
      } else {
        dataUriToInfo.get(u)!.places.push({ commentIdx: ci, original: u });
      }
    }
  });

  if (dataUriToInfo.size === 0) {
    // nothing to upload
    return comments;
  }

  // Prepare File[] for upload; keep consistent order to map back.
  const dataUris = Array.from(dataUriToInfo.keys());
  const filesToUpload: File[] = dataUris.map(
    (duri) => dataUriToInfo.get(duri)!.file
  );

  // uploadMultipleFiles can accept folder param, e.g. `comments/${projectId}` - pass blank or adapt
  let uploadedUrls: string[] = [];
  try {
    uploadedUrls = await uploadMultipleFiles(filesToUpload, "attachments");
    // uploadedUrls index matches filesToUpload index
    if (
      !Array.isArray(uploadedUrls) ||
      uploadedUrls.length !== filesToUpload.length
    ) {
      throw new Error("Upload returned unexpected result");
    }
  } catch (err: any) {
    // bubble up to caller or handle gracefully
    throw new Error(`Failed uploading embedded files: ${err?.message || err}`);
  }

  // Create mapping dataUri -> uploadedUrl
  const dataUriToUrl = new Map<string, string>();
  dataUris.forEach((duri, idx) => {
    dataUriToUrl.set(duri, uploadedUrls[idx]);
  });

  // Build new comments array with replacements
  const newComments = comments.map((c) => {
    const next = { ...c };
    const html = next.html ?? next.content ?? next.body ?? "";
    if (!html) return next;

    let updatedHtml = html;
    // replace every dataUri in this comment with uploaded url
    for (const [duri, url] of dataUriToUrl.entries()) {
      if (updatedHtml.includes(duri)) {
        // if it's an image tag, keep <img src="url"> - replacement of the dataURI string is enough.
        updatedHtml = updatedHtml.split(duri).join(url);
      }
    }

    // Optionally, add attachments metadata in comment object so import/readers can show icons:
    // e.g. next.attachments = [{ url, name, mime }]
    // We'll detect urls inserted that were uploaded from this pass
    const attachments: Array<{ url: string; name?: string; mime?: string }> =
      [];

    for (const [duri, info] of dataUriToInfo.entries()) {
      if (updatedHtml.includes(dataUriToUrl.get(duri)!)) {
        const file = info.file;
        attachments.push({
          url: dataUriToUrl.get(duri)!,
          name: file.name,
          mime: file.type,
        });
      }
    }

    if (attachments.length > 0) {
      // preserve existing attachments array if present
      next.attachments = Array.isArray(next.attachments)
        ? [...next.attachments, ...attachments]
        : attachments;
    }

    // put updated HTML back to the same field if exists, else update `content`
    if (next.html !== undefined) next.html = updatedHtml;
    else if (next.content !== undefined) next.content = updatedHtml;
    else if (next.body !== undefined) next.body = updatedHtml;
    else next.content = updatedHtml;

    return next;
  });

  return newComments;
}
