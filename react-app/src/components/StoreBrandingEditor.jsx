import { useEffect, useRef, useState } from "react";
import { heroFocusPosition, pointerHeroFocus } from "@/utils/storeHeroFocus";

export function StoreBrandingEditor({ values, files, busy, t, onChange, onFile }) {
  const [previewUrls, setPreviewUrls] = useState({ logo: "", cover: "" });
  const dragging = useRef(false);
  useEffect(() => {
    const logo = files.logo ? URL.createObjectURL(files.logo) : "";
    const cover = files.cover ? URL.createObjectURL(files.cover) : "";
    setPreviewUrls({ logo, cover });
    return () => {
      if (logo) URL.revokeObjectURL(logo);
      if (cover) URL.revokeObjectURL(cover);
    };
  }, [files.logo, files.cover]);

  const focus = heroFocusPosition(values);
  const updateFocus = point => onChange({
    shopHeroFocusX: point.x,
    shopHeroFocusY: point.y,
  });
  const onFocusPointerDown = event => {
    if (busy || !event.isPrimary) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFocus(pointerHeroFocus(event, event.currentTarget));
  };
  const onFocusPointerMove = event => {
    if (!dragging.current || busy || !event.isPrimary) return;
    updateFocus(pointerHeroFocus(event, event.currentTarget));
  };
  const stopFocusDrag = event => {
    if (!dragging.current) return;
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const onFocusKeyDown = event => {
    if (busy) return;
    const step = event.shiftKey ? 10 : 2;
    let x = focus.x;
    let y = focus.y;
    if (event.key === "ArrowLeft") x -= step;
    else if (event.key === "ArrowRight") x += step;
    else if (event.key === "ArrowUp") y -= step;
    else if (event.key === "ArrowDown") y += step;
    else if (event.key === "Home") { x = 50; y = 50; }
    else return;
    event.preventDefault();
    updateFocus({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  const fields = [
    { kind: "logo", key: "shopLogoUrl", caption: t("admin.store_branding.logo_title"), help: t("admin.store_branding.logo_help") },
    { kind: "cover", key: "shopHeroImageUrl", caption: t("admin.store_branding.cover_title"), help: t("admin.store_branding.cover_help") },
  ];

  return (
    <div className="admin-store-branding-editor" id="storeBrandingEditor">
      {fields.map(field => {
        const src = previewUrls[field.kind] || values[field.key] || "";
        return <div key={field.kind} className="admin-store-branding-field">
          <div className="admin-store-branding-field-heading">
            <strong>{field.caption}</strong>
            <small>{field.help}</small>
          </div>
          <div className={"admin-store-branding-preview is-" + field.kind}>
            {src ? <img src={src} alt={field.caption} draggable={false}
              style={field.kind === "cover" ? { objectPosition: focus.css } : undefined}
              onError={event => { event.currentTarget.hidden = true; }} />
              : <span className="admin-store-branding-placeholder"><i className={field.kind === "logo" ? "bi bi-shop-window" : "bi bi-image"} aria-hidden="true"></i>{t("admin.store_branding.none")}</span>}
          </div>
          {field.kind === "cover" && src ? <div className="admin-cover-focus-editor" data-cover-focus-editor>
            <div className="admin-cover-focus-heading">
              <strong><i className="bi bi-crosshair" aria-hidden="true"></i>{t("admin.store_branding.focus_title")}</strong>
              <span className="admin-cover-focus-coordinates" data-cover-focus-coordinates>{Math.round(focus.x)}% · {Math.round(focus.y)}%</span>
            </div>
            <small className="admin-cover-focus-help">{t("admin.store_branding.focus_help")}</small>
            <div className="admin-cover-focus-stage">
              <div className="admin-cover-focus-image-frame"
                role="button" tabIndex={busy ? -1 : 0}
                aria-label={t("admin.store_branding.focus_aria")}
                aria-disabled={busy ? "true" : "false"}
                data-cover-focus-stage
                onPointerDown={onFocusPointerDown}
                onPointerMove={onFocusPointerMove}
                onPointerUp={stopFocusDrag}
                onPointerCancel={stopFocusDrag}
                onLostPointerCapture={() => { dragging.current = false; }}
                onKeyDown={onFocusKeyDown}>
                <img src={src} alt="" draggable={false} />
                <span className="admin-cover-focus-marker" data-cover-focus-marker
                  style={{ left: focus.x + "%", top: focus.y + "%" }} aria-hidden="true">
                  <i className="bi bi-crosshair" aria-hidden="true"></i>
                </span>
              </div>
            </div>
            <div className="admin-cover-focus-actions">
              <button type="button" className="btn btn-sm" disabled={busy} data-cover-focus-reset
                onClick={() => updateFocus({ x: 50, y: 50 })}>
                <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                <span>{t("admin.store_branding.focus_reset")}</span>
              </button>
            </div>
          </div> : null}
          <div className="admin-store-branding-controls">
            <label className="btn btn-sm admin-store-branding-pick">
              <i className="bi bi-upload" aria-hidden="true"></i>
              <span>{t("admin.store_branding.choose")}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
                data-store-brand-file={field.kind}
                onChange={event => {
                  const file = event.currentTarget.files?.[0] || null;
                  if (file) {
                    onFile(field.kind, file);
                    if (field.kind === "cover") updateFocus({ x: 50, y: 50 });
                  }
                  event.currentTarget.value = "";
                }} />
            </label>
            {src ? <button type="button" className="btn btn-sm" disabled={busy}
              data-store-brand-remove={field.kind} onClick={() => {
                onFile(field.kind, null);
                onChange(field.kind === "cover"
                  ? { [field.key]: "", shopHeroFocusX: 50, shopHeroFocusY: 50 }
                  : { [field.key]: "" });
              }}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>{t("admin.store_branding.remove")}
            </button> : null}
          </div>
        </div>;
      })}
    </div>
  );
}
