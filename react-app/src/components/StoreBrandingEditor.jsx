import { useEffect, useState } from "react";

export function StoreBrandingEditor({ values, files, busy, t, onChange, onFile }) {
  const [previewUrls, setPreviewUrls] = useState({ logo: "", cover: "" });
  useEffect(() => {
    const logo = files.logo ? URL.createObjectURL(files.logo) : "";
    const cover = files.cover ? URL.createObjectURL(files.cover) : "";
    setPreviewUrls({ logo, cover });
    return () => {
      if (logo) URL.revokeObjectURL(logo);
      if (cover) URL.revokeObjectURL(cover);
    };
  }, [files.logo, files.cover]);
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
            {src ? <img src={src} alt={field.caption} draggable={false} onError={event => { event.currentTarget.hidden = true; }} />
              : <span className="admin-store-branding-placeholder"><i className={field.kind === "logo" ? "bi bi-shop-window" : "bi bi-image"} aria-hidden="true"></i>{t("admin.store_branding.none")}</span>}
          </div>
          <div className="admin-store-branding-controls">
            <label className="btn btn-sm admin-store-branding-pick">
              <i className="bi bi-upload" aria-hidden="true"></i>
              <span>{t("admin.store_branding.choose")}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
                data-store-brand-file={field.kind}
                onChange={event => {
                  const file = event.currentTarget.files?.[0] || null;
                  if (file) onFile(field.kind, file);
                  event.currentTarget.value = "";
                }} />
            </label>
            {src ? <button type="button" className="btn btn-sm" disabled={busy}
              data-store-brand-remove={field.kind} onClick={() => { onFile(field.kind, null); onChange({ [field.key]: "" }); }}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>{t("admin.store_branding.remove")}
            </button> : null}
          </div>
        </div>;
      })}
    </div>
  );
}
