import { useMemo, useRef } from "react";
import { AdminCollapsibleCard } from "@/components/AdminCollapsibleCard";

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `app-toast ${type === "error" ? "error" : "success"}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `<span class="app-toast-icon" aria-hidden="true"><i class="bi bi-${type === "error" ? "x-circle" : "check-circle"} app-icon"></i></span><span class="app-toast-message"></span>`;
  el.querySelector(".app-toast-message").textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  window.setTimeout(() => {
    el.classList.remove("show");
    window.setTimeout(() => el.remove(), 250);
  }, 3200);
}

function qrImageUrl(value) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(value)}&size=720&margin=2&ecLevel=H`;
}

function legacyCopy(input, value) {
  input.focus();
  input.select();
  input.setSelectionRange(0, value.length);
  const copied = document.execCommand("copy");
  window.getSelection()?.removeAllRanges();
  if (!copied) throw new Error("CLIPBOARD_COPY_FAILED");
}

async function copyText(input, value, label, t) {
  if (!value) return;
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
    else legacyCopy(input, value);
    toast(t("admin.delivery_qr.copy_success", { label }));
  } catch (error) {
    console.error("ADMIN_QR_COPY_FAILED", error);
    input?.focus();
    input?.select();
    toast(t("admin.delivery_qr.copy_fallback"), "error");
  }
}

async function downloadQr(src, filename, label, t) {
  try {
    const response = await fetch(src, { mode: "cors" });
    if (!response.ok) throw new Error("QR_DOWNLOAD_FAILED");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    toast(t("admin.delivery_qr.download_success", { label }));
  } catch (error) {
    console.error("ADMIN_QR_DOWNLOAD_FAILED", error);
    window.open(src, "_blank", "noopener");
    toast(t("admin.delivery_qr.download_fallback"), "error");
  }
}

function waitForImage(image) {
  return new Promise(resolve => {
    if (!image || (image.complete && image.naturalWidth > 0)) return resolve();
    const finish = () => resolve();
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  });
}

function printHtml(paper, title) {
  const clone = paper.cloneNode(true);
  clone.removeAttribute("style");
  clone.querySelectorAll("[hidden]").forEach(node => node.removeAttribute("hidden"));
  const cloneImage = clone.querySelector("img");
  cloneImage?.removeAttribute("width");
  cloneImage?.removeAttribute("height");
  const origin = location.origin;
  const lang = document.documentElement.lang || "th";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
@font-face{font-family:"TH Sarabun PSK Local";src:url("${origin}/assets/fonts/THSarabun.ttf") format("truetype");font-weight:400;font-display:block}
@font-face{font-family:"TH Sarabun PSK Local";src:url("${origin}/assets/fonts/THSarabun-Bold.ttf") format("truetype");font-weight:700;font-display:block}
@page{size:80mm 128mm;margin:4mm}*{box-sizing:border-box}html,body{width:72mm;margin:0;padding:0;color:#102f1e;background:#fff;overflow:visible}body{font-family:"TH Sarabun PSK Local","TH Sarabun New","Sarabun",sans-serif}
.delivery-qr-paper{width:72mm;min-height:112mm;display:grid;justify-items:center;align-content:start;gap:3mm;margin:0;padding:6mm 4mm;border:0;border-radius:0;color:#102f1e;background:#fff;text-align:center;break-inside:avoid;page-break-inside:avoid}
.delivery-qr-paper::before,.delivery-qr-paper::after,.delivery-qr-paper *::before,.delivery-qr-paper *::after{content:none!important;display:none!important}
.delivery-qr-brand{margin:0;font-size:12pt;font-weight:700;line-height:1.1;letter-spacing:.03em;text-transform:uppercase}.delivery-qr-paper>strong{margin:0;font-size:18pt;font-weight:700;line-height:1.1}.delivery-qr-title{margin:0;color:#087443;font-size:20pt;font-weight:700;line-height:1.1}.delivery-qr-paper img{width:52mm;height:52mm;display:block;margin:1mm auto 0;object-fit:contain}.delivery-qr-paper small{margin:0;color:#53685b;font-size:11pt;line-height:1.2}
@media print{html,body{width:72mm!important;background:#fff!important}.delivery-qr-paper{width:72mm!important;margin:0!important;box-shadow:none!important}}
</style></head><body>${clone.outerHTML}</body></html>`;
}

async function printTarget(paper, image, t, printName = "delivery-qr-print") {
  const popup = window.open("", printName, "width=560,height=760");
  if (!popup) {
    toast(t("admin.delivery_qr.popup_blocked"), "error");
    return;
  }
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="${document.documentElement.lang || "th"}"><meta charset="utf-8"><title>${t("admin.delivery_qr.preparing_title")}</title><body style="font-family:sans-serif;padding:24px">${t("admin.delivery_qr.preparing")}</body></html>`);
  popup.document.close();
  try {
    await waitForImage(image);
    const title = paper.querySelector(".delivery-qr-title")?.textContent?.trim() || t("admin.delivery_qr.print_title_fallback");
    popup.document.open();
    popup.document.write(printHtml(paper, title));
    popup.document.close();
    await Promise.all([waitForImage(popup.document.querySelector("img")), popup.document.fonts?.ready || Promise.resolve()]);
    popup.addEventListener("afterprint", () => popup.close(), { once: true });
    window.setTimeout(() => {
      popup.focus();
      popup.print();
    }, 180);
  } catch (error) {
    console.error("ADMIN_QR_PRINT_FAILED", error);
    popup.close();
    toast(t("admin.delivery_qr.print_failed"), "error");
  }
}

function QrCard({ id, path, title, subtitle, paperTitle, linkLabel, label, filenamePrefix, shopName, slug, t }) {
  const inputRef = useRef(null);
  const imageRef = useRef(null);
  const paperRef = useRef(null);
  const url = useMemo(() => `${location.origin}/s/${encodeURIComponent(slug)}/${path}`, [slug, path]);
  const imageUrl = useMemo(() => qrImageUrl(url), [url]);
  const buttonPrefix = id === "deliveryQr" ? "DeliveryQr" : "TakeawayQr";
  return (
    <AdminCollapsibleCard
      className="admin-qr-card"
      id={`${id}Section`}
      cardKey={id}
      icon={id === "takeawayQr" ? "bag-check" : "qr-code-scan"}
      accent="blue"
      sectionTitleStyle={{ marginTop: 0 }}
      heading={<div><h2>{title}</h2><div className="menu-category">{subtitle}</div></div>}
      t={t}
    >
      <div className="delivery-qr-manager">
        <div className="delivery-qr-preview" id={`${id}Preview`}>
          <div className="delivery-qr-paper" ref={paperRef}>
            <div className="delivery-qr-brand">PENGUIN</div>
            <strong id={`${id}ShopName`}>{shopName || t("admin.delivery_qr.brand_shop_fallback")}</strong>
            <div className="delivery-qr-title">{paperTitle}</div>
            <img id={`${id}Image`} ref={imageRef} src={imageUrl} width="280" height="280" alt={title} />
            <small>{t("admin.delivery_qr.shop_only")}</small>
          </div>
        </div>
        <div className="delivery-qr-tools">
          <div className="field"><label htmlFor={`${id}Link`}>{linkLabel}</label><input className="input" id={`${id}Link`} ref={inputRef} readOnly value={url} /></div>
          <div className="order-actions">
            <button type="button" className="btn btn-primary" id={`copy${buttonPrefix}Link`} data-admin-button-icon="clipboard" onClick={() => copyText(inputRef.current, url, label, t)}><i className="bi bi-clipboard app-icon admin-button-icon" aria-hidden="true"></i><span className="admin-button-label">{t("admin.delivery_qr.copy_link")}</span></button>
            <button type="button" className="btn" id={`download${buttonPrefix}`} onClick={() => downloadQr(imageUrl, `${filenamePrefix}-${slug || "shop"}.png`, label, t)}><i className="bi bi-download app-icon" aria-hidden="true"></i><span>{t("admin.delivery_qr.download_qr")}</span></button>
            <button type="button" className="btn" id={`print${buttonPrefix}`} onClick={() => printTarget(paperRef.current, imageRef.current, t, id === "takeawayQr" ? "takeaway-qr-print" : "delivery-qr-print")}><i className="bi bi-printer app-icon" aria-hidden="true"></i><span>{t("admin.delivery_qr.print")}</span></button>
          </div>
          <div className="menu-category">{t("admin.delivery_qr.suspended_help")}</div>
        </div>
      </div>
    </AdminCollapsibleCard>
  );
}

export function AdminDeliveryQr({ tenant, shopName, t }) {
  if (!tenant?.slug) return null;
  return (
    <>
      <style id="deliveryQrStyles">{`.admin-qr-card{margin-bottom:16px}.delivery-qr-manager{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:20px;align-items:center}.delivery-qr-preview{text-align:center}.delivery-qr-paper{padding:18px;border:1px dashed var(--line);border-radius:18px;background:#fff;display:grid;justify-items:center;gap:8px}.delivery-qr-paper img{width:min(280px,100%);height:auto;aspect-ratio:1;object-fit:contain}.delivery-qr-brand{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.delivery-qr-title{font-size:18px;font-weight:800;color:var(--green-dark)}.delivery-qr-tools{display:grid;gap:14px;min-width:0}.delivery-qr-tools .order-actions .btn{display:inline-flex;align-items:center;gap:6px;border-radius:10px}@media(max-width:760px){.delivery-qr-manager{grid-template-columns:1fr}}`}</style>
      <QrCard id="deliveryQr" path="delivery" title={t("admin.delivery_qr.delivery_title")} subtitle={t("admin.delivery_qr.delivery_subtitle")} paperTitle={t("admin.delivery_qr.delivery_paper_title")} linkLabel={t("admin.delivery_qr.delivery_link")} label="Delivery" filenamePrefix="delivery-qr" shopName={shopName} slug={tenant.slug} t={t} />
      <QrCard id="takeawayQr" path="takeaway" title={t("admin.delivery_qr.takeaway_title")} subtitle={t("admin.delivery_qr.takeaway_subtitle")} paperTitle={t("admin.delivery_qr.takeaway_paper_title")} linkLabel={t("admin.delivery_qr.takeaway_link")} label={t("admin.delivery_qr.takeaway_label")} filenamePrefix="takeaway-qr" shopName={shopName} slug={tenant.slug} t={t} />
    </>
  );
}
