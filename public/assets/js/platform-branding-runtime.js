import {
  db,
  storage,
  auth,
  doc,
  onSnapshot,
  ref,
  getDownloadURL,
  onAuthStateChanged,
} from "./firebase-config.js?v=20260630-073";

const STYLE_ID = "platformBrandingRuntimeStyle";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent =
    ".brand-mark{display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1!important;vertical-align:middle!important}" +
    ".brand-mark::after{display:flex!important;width:100%!important;height:100%!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important;line-height:1!important;transform:translateY(-1px)!important}" +
    ".brand-mark.platform-brand-image-target::after{content:none!important;transform:none!important}" +
    ".brand-mark.platform-brand-image-target{box-sizing:border-box!important;width:42px!important;min-width:42px!important;height:42px!important;padding:3px!important;background:transparent!important;overflow:hidden!important;border-radius:12px!important}" +
    ".platform-brand-image-target>img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center center!important;margin:auto!important}" +
    ".brand-mark.platform-brand-image-target>img{border-radius:9px!important}" +
    "@media(max-width:760px){.brand-mark.platform-brand-image-target{width:36px!important;min-width:36px!important;height:36px!important;padding:2px!important;border-radius:10px!important}}";
  document.head.appendChild(style);
}

function upsertLink(rel, href, id) {
  let link = document.getElementById(id);
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

function applyBrandImage(selector, imageUrl = "", alt = "PENGUIN") {
  document.querySelectorAll(selector).forEach(target => {
    if (!target.dataset.brandingFallbackHtml) target.dataset.brandingFallbackHtml = target.innerHTML;
    const applied = target.dataset.brandingImageUrl || "";
    if (applied === imageUrl) return;

    target.dataset.brandingImageUrl = imageUrl;
    if (!imageUrl) {
      target.classList.remove("platform-brand-image-target");
      target.innerHTML = target.dataset.brandingFallbackHtml;
      return;
    }

    target.classList.add("platform-brand-image-target");
    target.textContent = "";
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = alt;
    image.decoding = "async";
    target.appendChild(image);
  });
}

async function resolveBranding(data = {}) {
  const result = {};
  for (const [pathKey, urlKey] of [
    ["logoPath", "logoUrl"],
    ["faviconPath", "faviconUrl"],
    ["appIconPath", "appIconUrl"],
  ]) {
    const path = String(data[pathKey] || "").trim();
    result[urlKey] = path && storage
      ? await getDownloadURL(ref(storage, path)).catch(() => "")
      : "";
  }
  return result;
}

function applyBranding(branding = {}) {
  ensureStyles();
  const logoUrl = String(branding.logoUrl || "").trim();
  const appIconUrl = String(branding.appIconUrl || "").trim();
  const faviconUrl = String(branding.faviconUrl || "").trim();

  applyBrandImage(".brand-mark", appIconUrl || logoUrl, "PENGUIN");
  upsertLink("icon", faviconUrl || appIconUrl || logoUrl, "platformDynamicFavicon");
  upsertLink("apple-touch-icon", appIconUrl || faviconUrl || logoUrl, "platformAppleTouchIcon");
}

ensureStyles();

function subscribeBranding() {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, "platformSettings", "branding"),
    async snapshot => {
      const branding = await resolveBranding(snapshot.exists() ? snapshot.data() : {});
      applyBranding(branding);
    },
    error => {
      console.warn("[platform-branding-static] unable to load branding", error);
    },
  );
}

if (auth) {
  let stopBranding = null;
  let stopAuth = null;
  stopAuth = onAuthStateChanged(auth, () => {
    stopBranding ??= subscribeBranding();
    stopAuth?.();
  });
  window.addEventListener("pagehide", () => stopBranding?.(), { once: true });
} else {
  subscribeBranding();
}
