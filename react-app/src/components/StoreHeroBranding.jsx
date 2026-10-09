import React from "react";

// Reuse tenant settings on public and cashier ordering surfaces.
export function brandedHeroStyle(settings = {}) {
  const url = String(settings.shopHeroImageUrl || settings.heroImageUrl || "").trim();
  if (!/^https:\/\//i.test(url)) return undefined;
  return {
    backgroundImage: `linear-gradient(90deg, rgba(6, 30, 20, .88), rgba(8, 55, 33, .63) 55%, rgba(0, 43, 27, .34)), url(${JSON.stringify(url)})`,
  };
}

export function StoreBrandMark({ settings = {}, className = "" }) {
  const logoUrl = String(settings.shopLogoUrl || settings.logoUrl || "").trim();
  return (
    <span className={"store-hero-brand-mark " + className} aria-hidden="true">
      {/^https:\/\//i.test(logoUrl)
        ? <img key={logoUrl} src={logoUrl} alt="" draggable={false} onError={event => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add("is-fallback"); }} />
        : null}
      <i className="bi bi-shop-window store-hero-fallback-icon" aria-hidden="true"></i>
    </span>
  );
}
