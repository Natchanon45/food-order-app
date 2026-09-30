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
    ".brand-mark.platform-brand-image-target::after{content:none!important}" +
    ".brand-mark.platform-brand-image-target,.login-logo.platform-brand-image-target{padding:0!important;background:transparent!important;overflow:hidden!important}" +
    ".platform-brand-image-target>img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}";
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

function applyLogo(logoUrl = "") {
  document.querySelectorAll(".brand-mark, .login-logo").forEach(target => {
    if (!target.dataset.brandingFallbackHtml) target.dataset.brandingFallbackHtml = target.innerHTML;
    const applied = target.dataset.brandingLogoUrl || "";
    if (applied === logoUrl) return;

    target.dataset.brandingLogoUrl = logoUrl;
    if (!logoUrl) {
      target.classList.remove("platform-brand-image-target");
      target.innerHTML = target.dataset.brandingFallbackHtml;
      return;
    }
    target.classList.add("platform-brand-image-target");
    target.textContent = "";
    const image = document.createElement("img");
    image.src = logoUrl;
    image.alt = "LUKKAJA";
    image.decoding = "async";
    target.appendChild(image);
  });
}

export function applyPlatformBranding(branding = {}) {
  ensureStyles();
  applyLogo(branding.logoUrl || "");
  const favicon = branding.faviconUrl || branding.appIconUrl || "";
  upsertLink("icon", favicon, "platformDynamicFavicon");
  upsertLink("apple-touch-icon", branding.appIconUrl || favicon, "platformAppleTouchIcon");
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
    const observer = new MutationObserver(() => {
      if (alive) applyPlatformBranding(branding);
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
