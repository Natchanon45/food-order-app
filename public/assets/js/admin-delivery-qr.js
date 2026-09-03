import { dataService } from "./data-service.js?v=20260903-203";
import { toast } from "./ui.js?v=20260805-081";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";
import { t } from "./i18n.js?v=20260903-202";

function icon(name) { return iconMarkup(name); }
function downloadIcon() { return iconMarkup("download"); }
function qrImageUrl(value) { return `https://quickchart.io/qr?text=${encodeURIComponent(value)}&size=720&margin=2&ecLevel=H`; }
function tenantUrl(path) { const tenant = dataService.getActiveShop(); if (!tenant?.slug) throw new Error("TENANT_SLUG_MISSING"); return `${location.origin}/s/${encodeURIComponent(tenant.slug)}/${path}`; }
function legacyCopy(input, value) { input.focus(); input.select(); input.setSelectionRange(0, value.length); const copied = document.execCommand("copy"); window.getSelection()?.removeAllRanges(); if (!copied) throw new Error("CLIPBOARD_COPY_FAILED"); }
async function copyText(input, label) { if (!input.value) return; try { if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(input.value); else legacyCopy(input, input.value); toast(t("admin.delivery_qr.copy_success", { label })); } catch (error) { console.error(error); input.focus(); input.select(); toast(t("admin.delivery_qr.copy_fallback"), "error"); } }
async function downloadQr(image, filename, label) { try { const response = await fetch(image.src, { mode: "cors" }); if (!response.ok) throw new Error("QR_DOWNLOAD_FAILED"); const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(objectUrl); toast(t("admin.delivery_qr.download_success", { label })); } catch (error) { console.error(error); window.open(image.src, "_blank", "noopener"); toast(t("admin.delivery_qr.download_fallback"), "error"); } }
// ADMIN_QR_ISOLATED_PRINT_20260805_090
function waitForQrImage(image) {
  return new Promise(resolve => {
    if (!image) {
      resolve();
      return;
    }

    if (image.complete && image.naturalWidth > 0) {
      resolve();
      return;
    }

    const finish = () => resolve();
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  });
}

function isolatedQrPrintHtml(paper, title) {
  const clone = paper.cloneNode(true);
  clone.removeAttribute("style");
  clone.querySelectorAll("[hidden]").forEach(node => {
    node.removeAttribute("hidden");
  });

  const cloneImage = clone.querySelector("img");
  if (cloneImage) {
    cloneImage.removeAttribute("width");
    cloneImage.removeAttribute("height");
  }

  const origin = location.origin;
  const lang = document.documentElement.lang || "th";

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    @font-face {
      font-family: "TH Sarabun PSK Local";
      src: url("${origin}/assets/fonts/THSarabun.ttf") format("truetype");
      font-style: normal;
      font-weight: 400;
      font-display: block;
    }

    @font-face {
      font-family: "TH Sarabun PSK Local";
      src: url("${origin}/assets/fonts/THSarabun-Bold.ttf") format("truetype");
      font-style: normal;
      font-weight: 700;
      font-display: block;
    }

    @page {
      size: 80mm 128mm;
      margin: 4mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 72mm;
      margin: 0;
      padding: 0;
      color: #102f1e;
      background: #fff;
      overflow: visible;
    }

    body {
      font-family:
        "TH Sarabun PSK Local",
        "TH Sarabun New",
        "Sarabun",
        sans-serif;
    }

    .delivery-qr-paper {
      width: 72mm;
      min-height: 112mm;
      display: grid;
      justify-items: center;
      align-content: start;
      gap: 3mm;
      margin: 0;
      padding: 6mm 4mm;
      border: 0;
      border-radius: 0;
      color: #102f1e;
      background: #fff;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .delivery-qr-paper::before,
    .delivery-qr-paper::after,
    .delivery-qr-paper *::before,
    .delivery-qr-paper *::after {
      content: none !important;
      display: none !important;
    }

    .delivery-qr-brand {
      margin: 0;
      font-size: 12pt;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: .03em;
      text-transform: uppercase;
    }

    .delivery-qr-paper > strong {
      margin: 0;
      font-size: 18pt;
      font-weight: 700;
      line-height: 1.1;
    }

    .delivery-qr-title {
      margin: 0;
      color: #087443;
      font-size: 20pt;
      font-weight: 700;
      line-height: 1.1;
    }

    .delivery-qr-paper img {
      width: 52mm;
      height: 52mm;
      display: block;
      margin: 1mm auto 0;
      object-fit: contain;
    }

    .delivery-qr-paper small {
      margin: 0;
      color: #53685b;
      font-size: 11pt;
      line-height: 1.2;
    }

    @media print {
      html,
      body {
        width: 72mm !important;
        background: #fff !important;
      }

      .delivery-qr-paper {
        width: 72mm !important;
        margin: 0 !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`;
}

async function printTarget(printClass, image, generate) {
  document.body.classList.remove(
    "delivery-qr-printing",
    "takeaway-qr-printing"
  );

  const printName = printClass === "takeaway-qr-printing"
    ? "takeaway-qr-print"
    : "delivery-qr-print";

  const popup = window.open(
    "",
    printName,
    "width=560,height=760"
  );

  if (!popup) {
    toast(t("admin.delivery_qr.popup_blocked"), "error");
    return;
  }

  popup.document.open();
  popup.document.write(
    `<!doctype html><html lang="${document.documentElement.lang || "th"}"><meta charset="utf-8">` +
    `<title>${t("admin.delivery_qr.preparing_title")}</title>` +
    `<body style="font-family:sans-serif;padding:24px">${t("admin.delivery_qr.preparing")}</body></html>`
  );
  popup.document.close();

  try {
    if (!image.src) {
      await generate();
    }

    await waitForQrImage(image);

    const paper = image.closest(".delivery-qr-paper");
    if (!paper) {
      throw new Error("QR_PRINT_PAPER_NOT_FOUND");
    }

    const title =
      paper.querySelector(".delivery-qr-title")?.textContent?.trim()
      || t("admin.delivery_qr.print_title_fallback");

    popup.document.open();
    popup.document.write(isolatedQrPrintHtml(paper, title));
    popup.document.close();

    const popupImage = popup.document.querySelector("img");
    const fontReady = popup.document.fonts?.ready || Promise.resolve();

    await Promise.all([
      waitForQrImage(popupImage),
      fontReady,
    ]);

    popup.addEventListener(
      "afterprint",
      () => popup.close(),
      { once: true }
    );

    window.setTimeout(() => {
      popup.focus();
      popup.print();
    }, 180);
  } catch (error) {
    console.error("[admin-delivery-qr] isolated print failed", error);
    popup.close();
    toast(t("admin.delivery_qr.print_failed"), "error");
  }
}

function qrBlock({ id, title, subtitle, paperTitle, linkLabel, buttonPrefix }) { return `<section class="card admin-qr-card" id="${id}Section"><div class="section-title" style="margin-top:0"><div><h2>${title}</h2><div class="menu-category">${subtitle}</div></div></div><div class="delivery-qr-manager"><div class="delivery-qr-preview" id="${id}Preview" hidden><div class="delivery-qr-paper"><div class="delivery-qr-brand">Food Order/Delivery With QR</div><strong id="${id}ShopName">${t("admin.delivery_qr.brand_shop_fallback")}</strong><div class="delivery-qr-title">${paperTitle}</div><img id="${id}Image" width="280" height="280" alt="${title}"><small>${t("admin.delivery_qr.shop_only")}</small></div></div><div class="delivery-qr-tools"><div class="field"><label for="${id}Link">${linkLabel}</label><input class="input" id="${id}Link" readonly></div><div class="order-actions"><button type="button" class="btn" id="copy${buttonPrefix}Link"><span>${t("admin.delivery_qr.copy_link")}</span></button><button type="button" class="btn btn-dark" id="download${buttonPrefix}">${downloadIcon()}<span>${t("admin.delivery_qr.download_qr")}</span></button><button type="button" class="btn" id="print${buttonPrefix}">${icon("print")}<span>${t("admin.delivery_qr.print")}</span></button></div><div class="menu-category">${t("admin.delivery_qr.suspended_help")}</div></div></div></section>`; }
function ensureStyles() { if (document.querySelector("#deliveryQrStyles")) return; const style = document.createElement("style"); style.id = "deliveryQrStyles"; style.textContent = `.admin-qr-card{margin-bottom:16px}.delivery-qr-manager{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:20px;align-items:center}.delivery-qr-preview{text-align:center}.delivery-qr-paper{padding:18px;border:1px dashed var(--line);border-radius:18px;background:#fff;display:grid;justify-items:center;gap:8px}.delivery-qr-paper img{width:min(280px,100%);height:auto;aspect-ratio:1;object-fit:contain}.delivery-qr-brand{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.delivery-qr-title{font-size:18px;font-weight:800;color:var(--green-dark)}.delivery-qr-tools{display:grid;gap:14px;min-width:0}.delivery-qr-tools .order-actions .btn{display:inline-flex;align-items:center;gap:6px;border-radius:10px}@media(max-width:760px){.delivery-qr-manager{grid-template-columns:1fr}}@media print{body.delivery-qr-printing *,body.takeaway-qr-printing *{visibility:hidden!important}body.delivery-qr-printing #deliveryQrPreview,body.delivery-qr-printing #deliveryQrPreview *,body.takeaway-qr-printing #takeawayQrPreview,body.takeaway-qr-printing #takeawayQrPreview *{visibility:visible!important}body.delivery-qr-printing #deliveryQrPreview,body.takeaway-qr-printing #takeawayQrPreview{position:absolute;inset:0;display:grid!important;place-items:start center;padding-top:12mm}.delivery-qr-paper,.delivery-qr-paper *{font-family:var(--print-font,'TH Sarabun PSK Local','TH Sarabun New','Sarabun',sans-serif)!important}.delivery-qr-paper{width:80mm;border:0;font-size:22px;line-height:1.12}.delivery-qr-brand{font-size:15px!important}.delivery-qr-title{font-size:24px!important}.delivery-qr-paper small{font-size:16px!important}}`; document.head.appendChild(style); }
function mountQrSection() { const main = document.querySelector("main.container"); if (!main) return; ensureStyles(); const firstCard = main.querySelector("section.card"); const deliveryExists = document.querySelector("#deliveryQrSection"); if (!deliveryExists) { const wrap = document.createElement("div"); wrap.innerHTML = qrBlock({ id: "deliveryQr", title: t("admin.delivery_qr.delivery_title"), subtitle: t("admin.delivery_qr.delivery_subtitle"), paperTitle: t("admin.delivery_qr.delivery_paper_title"), linkLabel: t("admin.delivery_qr.delivery_link"), buttonPrefix: "DeliveryQr" }); firstCard ? firstCard.insertAdjacentElement("afterend", wrap.firstElementChild) : main.prepend(wrap.firstElementChild); } if (!document.querySelector("#takeawayQrSection")) { const wrap = document.createElement("div"); wrap.innerHTML = qrBlock({ id: "takeawayQr", title: t("admin.delivery_qr.takeaway_title"), subtitle: t("admin.delivery_qr.takeaway_subtitle"), paperTitle: t("admin.delivery_qr.takeaway_paper_title"), linkLabel: t("admin.delivery_qr.takeaway_link"), buttonPrefix: "TakeawayQr" }); const deliverySection = document.querySelector("#deliveryQrSection"); deliverySection ? deliverySection.insertAdjacentElement("afterend", wrap.firstElementChild) : (firstCard ? firstCard.insertAdjacentElement("afterend", wrap.firstElementChild) : main.prepend(wrap.firstElementChild)); } }
function setupQr({ id, path, label, filenamePrefix, printClass, buttonPrefix }) { const preview = document.querySelector(`#${id}Preview`); const image = document.querySelector(`#${id}Image`); const linkInput = document.querySelector(`#${id}Link`); const shopLabel = document.querySelector(`#${id}ShopName`); if (!preview || !image || !linkInput || linkInput.dataset.qrReady === "true") return; linkInput.dataset.qrReady = "true"; async function generate() { const tenant = dataService.getActiveShop(); const settings = await dataService.getStoreSettings(); const url = tenantUrl(path); linkInput.value = url; shopLabel.textContent = settings.shopName || tenant.name || t("admin.delivery_qr.brand_shop_fallback"); image.src = qrImageUrl(url); preview.hidden = false; } document.querySelector(`#copy${buttonPrefix}Link`)?.addEventListener("click", async () => { if (!linkInput.value) await generate(); await copyText(linkInput, label); }); document.querySelector(`#download${buttonPrefix}`)?.addEventListener("click", async () => { if (!image.src) await generate(); await downloadQr(image, `${filenamePrefix}-${dataService.getActiveShop().slug || "shop"}.png`, label); }); document.querySelector(`#print${buttonPrefix}`)?.addEventListener("click", () => printTarget(printClass, image, generate)); generate(); }
mountQrSection();
setupQr({ id: "deliveryQr", path: "delivery", label: "Delivery", filenamePrefix: "delivery-qr", printClass: "delivery-qr-printing", buttonPrefix: "DeliveryQr" });
setupQr({ id: "takeawayQr", path: "takeaway", label: t("admin.delivery_qr.takeaway_label"), filenamePrefix: "takeaway-qr", printClass: "takeaway-qr-printing", buttonPrefix: "TakeawayQr" });
window.addEventListener("afterprint", () => document.body.classList.remove("delivery-qr-printing", "takeaway-qr-printing"));