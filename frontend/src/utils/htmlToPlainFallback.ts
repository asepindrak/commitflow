export function htmlToPlainFallback(html: string): string {
  if (!html) return "";
  // replace <br> and </p> with newlines
  let out = html.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/p>/gi, "\n\n");
  // list items -> bullets
  out = out.replace(/<li[^>]*>/gi, "• ");
  out = out.replace(/<\/li>/gi, "\n");
  // remove all tags
  out = out.replace(/<[^>]+>/g, "");
  // decode basic entities
  out = out.replace(/&nbsp;/g, " ");
  out = out.replace(/&amp;/g, "&");
  out = out.replace(/&lt;/g, "<");
  out = out.replace(/&gt;/g, ">");
  out = out.replace(/&quot;/g, '"');
  // collapse whitespace and trim
  return out
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
