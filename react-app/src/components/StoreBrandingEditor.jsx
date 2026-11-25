import { useEffect, useRef, useState } from "react";
import { dragCoverFocusY, heroFocusPosition } from "@/utils/storeHeroFocus";
// Only HTTPS image URLs may reach the preview; local uploaded files use
// object URLs created by this component, never arbitrary stored schemes.
const isPublicImageUrl = value => /^https:\/\//i.test(String(value || "").trim());

export function StoreBrandingEditor({ values, files, busy, t, onChange, onFile }) {
  const [previewUrls, setPreviewUrls] = useState({ logo: "", cover: "" });
  const drag = useRef(null);
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
  const updateFocus = y => onChange({ shopHeroFocusX: 50, shopHeroFocusY: y });
  const onFocusPointerDown = event => {
    if (busy || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    const frame = event.currentTarget;
    const image = frame.querySelector("img");
    const width = frame.clientWidth, height = frame.clientHeight;
    const naturalWidth = image?.naturalWidth || 0, naturalHeight = image?.naturalHeight || 0;
    const coverHeight = width && height && naturalWidth && naturalHeight
      ? Math.max(height, width * naturalHeight / naturalWidth) : height;
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startFocusY: focus.y,
      overflow: Math.max(0, coverHeight - height),
    };
    frame.setPointerCapture(event.pointerId);
  };
  const onFocusPointerMove = event => {
    const active = drag.current;
    if (!active || busy || !event.isPrimary || active.pointerId !== event.pointerId) return;
    updateFocus(dragCoverFocusY(active.startFocusY, active.startY, event.clientY,
      active.overflow));
  };
  const stopFocusDrag = event => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const onFocusKeyDown = event => {
    if (busy) return;
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowUp") updateFocus(Math.max(0, focus.y - step));
    else if (event.key === "ArrowDown") updateFocus(Math.min(100, focus.y + step));
    else if (event.key === "Home") updateFocus(50);
    else if (event.key === "End") updateFocus(100);
    else return;
    event.preventDefault();
  };

  const fields = [
    { kind: "logo", key: "shopLogoUrl", caption: t("admin.store_branding.logo_title"), help: t("admin.store_branding.logo_help") },
    { kind: "cover", key: "shopHeroImageUrl", caption: t("admin.store_branding.cover_title"), help: t("admin.store_branding.cover_help") },
  ];

  return (
    <div className="admin-store-branding-editor" id="storeBrandingEditor">
      {fields.map(field => {
        const src = previewUrls[field.kind] || (isPublicImageUrl(values[field.key]) ? values[field.key] : "");
        return <div key={field.kind} className="admin-store-branding-field">
          <div className="admin-store-branding-field-heading">
            <strong>{field.caption}</strong>
            <small>{field.help}</small>
          </div>
          {field.kind === "cover" ? <div className="admin-cover-focus-editor" data-cover-focus-editor>
            <div className="admin-cover-focus-image-frame"
              role="slider" tabIndex={busy || !src ? -1 : 0}
              aria-label={t("admin.store_branding.focus_aria")}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(focus.y)}
              aria-orientation="vertical" aria-disabled={busy || !src ? "true" : "false"}
              data-cover-focus-stage data-cover-focus-y={focus.y}
              onPointerDown={onFocusPointerDown}
              onPointerMove={onFocusPointerMove}
              onPointerUp={stopFocusDrag}
              onPointerCancel={stopFocusDrag}
              onLostPointerCapture={() => { drag.current = null; }}
              onKeyDown={onFocusKeyDown}>
              {src ? <img src={src} alt={field.caption} draggable={false}
                style={{ objectPosition: "50% " + focus.y + "%" }}
                onError={event => { event.currentTarget.hidden = true; }} />
                : <span className="admin-store-branding-placeholder"><i className="bi bi-image" aria-hidden="true"></i>{t("admin.store_branding.none")}</span>}
              {src ? <span className="admin-cover-focus-position-hint" aria-hidden="true">
                <i className="bi bi-arrows-vertical" aria-hidden="true"></i>
                <span>ลากภาพขึ้น–ลงเพื่อจัดตำแหน่ง</span>
              </span> : null}
            </div>
            {src ? <div className="admin-cover-focus-actions">
              <span className="admin-cover-focus-coordinates" data-cover-focus-coordinates>Y {Math.round(focus.y)}%</span>
              <button type="button" className="btn btn-sm" disabled={busy} data-cover-focus-reset
                onClick={() => updateFocus(50)}>
                <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                <span>{t("admin.store_branding.focus_reset")}</span>
              </button>
            </div> : null}
          </div> : <div className={"admin-store-branding-preview is-" + field.kind}>
            {src ? <img src={src} alt={field.caption} draggable={false}
              onError={event => { event.currentTarget.hidden = true; }} />
              : <span className="admin-store-branding-placeholder"><i className="bi bi-shop-window" aria-hidden="true"></i>{t("admin.store_branding.none")}</span>}
          </div>}
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
                    if (field.kind === "cover") updateFocus(50);
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
