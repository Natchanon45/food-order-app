// Match PENGUIN's existing Firebase-uploaded platform favicon in print tabs.
export function printFaviconLink(sourceDocument = typeof document !== "undefined" ? document : null) {
  const raw = String(sourceDocument?.getElementById?.("platformDynamicFavicon")?.href
    || sourceDocument?.querySelector?.('link[rel="icon"]')?.href || "").trim();
  if (!raw) return "";
  let url;
  try { url = new URL(raw, sourceDocument?.baseURI || "https://example.invalid/"); }
  catch { return ""; }
  if (!["https:", "http:"].includes(url.protocol)) return "";
  const escaped = url.href.replace(/[&"<>']/g, ch =>
    ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;", "'": "&#39;" })[ch]);
  return '<link rel="icon" href="' + escaped + '">';
}
