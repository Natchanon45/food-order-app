import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "@/firebase/client";

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
    ".login-logo.platform-brand-image-target{box-sizing:border-box!important;width:min(220px,84%)!important;max-width:220px!important;height:110px!important;padding:0!important;background:transparent!important;overflow:hidden!important;border-radius:0!important}" +
    ".platform-brand-image-target>img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center center!important;margin:auto!important}" +
    ".brand-mark.platform-brand-image-target>img{border-radius:9px!important}" +
    ".login-logo.platform-brand-image-target>img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;border-radius:0!important}" +
    "@media(max-width:760px){.brand-mark.platform-brand-image-target{width:36px!important;min-width:36px!important;height:36px!important;padding:2px!important;border-radius:10px!important}.login-logo.platform-brand-image-target{width:min(190px,86%)!important;max-width:190px!important;height:95px!important}}";
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

export function applyPlatformBranding(branding = {}) {
  ensureStyles();

  const logoUrl = String(branding.logoUrl || "").trim();
  const appIconUrl = String(branding.appIconUrl || "").trim();

  // Header mark is the application icon. Use the uploaded App Icon first.
  applyBrandImage(".brand-mark", appIconUrl || logoUrl, "PENGUIN");

  // Login/large brand areas are logo surfaces. Keep Logo as the primary asset.
  applyBrandImage(".login-logo", logoUrl || appIconUrl, "PENGUIN");

  const favicon = branding.faviconUrl || appIconUrl || logoUrl || "";
  upsertLink("icon", favicon, "platformDynamicFavicon");
  upsertLink("apple-touch-icon", appIconUrl || favicon, "platformAppleTouchIcon");
}

async function resolvedBranding(data = {}) {
  const result = {};
  for (const [pathKey, urlKey] of [
    ["logoPath", "logoUrl"],
    ["faviconPath", "faviconUrl"],
    ["appIconPath", "appIconUrl"],
  ]) {
    const path = String(data[pathKey] || "").trim();
    result[urlKey] = path ? await getDownloadURL(ref(storage, path)).catch(() => "") : "";
  }
  return result;
}

export function PlatformBrandingRuntime() {
  useEffect(() => {
    let alive = true;
    let branding = {};
    const hasBrandTarget = node => node instanceof Element && (
      node.matches?.(".brand-mark, .login-logo")
      || node.querySelector?.(".brand-mark, .login-logo")
    );
    const observer = new MutationObserver(records => {
      if (!alive) return;
      for (const record of records) {
        if ([...record.addedNodes].some(hasBrandTarget)) {
          applyPlatformBranding(branding);
          return;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const stop = onSnapshot(doc(db, "platformSettings", "branding"), async snapshot => {
      const next = await resolvedBranding(snapshot.exists() ? snapshot.data() : {});
      if (!alive) return;
      branding = next;
      applyPlatformBranding(branding);
    }, error => {
      console.warn("[platform-branding] unable to load branding", error);
    });

    return () => {
      alive = false;
      observer.disconnect();
      stop();
    };
  }, []);

  return null;
}
