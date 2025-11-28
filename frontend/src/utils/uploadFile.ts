// frontend/src/utils/uploadFile.ts
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  console.warn(
    "[uploadFile] VITE_API_URL is not set. Uploads will fail until you set it in .env"
  );
}

/**
 * Upload a single file to your backend API.
 * The backend is expected to accept POST /upload (multipart/form-data)
 * and return { success: true, uploaded: [ { key, url } ] }
 */
async function uploadOne(file: File, folder = ""): Promise<string> {
  if (!API_BASE_URL) throw new Error("Missing VITE_API_URL env var");

  const endpoint = `${API_BASE_URL.replace(/\/$/, "")}/upload`;
  const form = new FormData();
  form.append("file", file);
  if (folder) form.append("folder", folder);

  const res = await fetch(endpoint, {
    method: "POST",
    body: form,
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const serverMsg = data?.message || data?.error || text || res.statusText;
    throw new Error(`Upload failed (${res.status}): ${serverMsg}`);
  }

  /**
   * The NestJS backend returns something like:
   * {
   *   success: true,
   *   count: 1,
   *   uploaded: [{ key: '...', url: 'https://...' }]
   * }
   */
  let url: string | undefined = undefined;

  // Try to extract URL from expected shape
  if (Array.isArray(data?.uploaded) && data.uploaded.length > 0) {
    url = data.uploaded[0].url;
  } else if (data?.url) {
    url = data.url;
  } else if (data?.data?.url) {
    url = data.data.url;
  }

  if (!url || typeof url !== "string") {
    throw new Error(
      `Upload succeeded but backend didn't return a valid URL. Response: ${text}`
    );
  }

  return url;
}

/**
 * Upload multiple files (parallel) to backend API.
 */
export default async function uploadMultipleFiles(
  files: File[],
  folder = ""
): Promise<string[]> {
  if (!files || files.length === 0) return [];

  const uploads = files.map((f) =>
    uploadOne(f, folder).catch((err) => {
      err.message = `Error uploading "${f.name}": ${err.message}`;
      throw err;
    })
  );

  return await Promise.all(uploads);
}
