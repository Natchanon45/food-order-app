import { dataService } from "./data-service.js";
import { toast } from "./ui.js?v=20260701-002";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

function icon(name) {
  return iconMarkup(name);
}

function downloadIcon() {
  return iconMarkup("download");
}

function mountQrSection() {
  const main = document.querySelector("main.container");
  if (!main || document.querySelector("#deliveryQrSection")) return;

  const section = document.createElement("section");
  section.id = "deliveryQrSection";
  section.className = "card";
  section.style.marginBottom = "16px";
  section.innerHTML = `
    <div class="section-title" style="margin-top:0">
      <div>
        <h2>QR สำหรับสั่ง Delivery</h2>
        <div class="menu-category">QR ประจำร้านจะสร้างให้อัตโนมัติตาม slug ของร้าน</div>
      </div>
    </div>
    <div class="delivery-qr-manager">
      <div class="delivery-qr-preview" id="deliveryQrPreview" hidden>
        <div class="delivery-qr-paper">
          <div class="delivery-qr-brand">Food Order/Delivery With QR</div>
          <strong id="deliveryQrShopName">ร้านอาหาร</strong>
          <div class="delivery-qr-title">สแกนเพื่อสั่ง Delivery</div>
          <img id="deliveryQrImage" width="280" height="280" alt="QR สำหรับสั่ง Delivery">
          <small>QR นี้ใช้สำหรับร้านนี้โดยเฉพาะ</small>
        </div>
      </div>
      <div class="delivery-qr-tools">
        <div class="field">
          <label for="deliveryQrLink">ลิงก์สั่ง Delivery</label>
          <input class="input" id="deliveryQrLink" readonly>
        </div>
        <div class="order-actions">
          <button type="button" class="btn" id="copyDeliveryQrLink"><span>คัดลอกลิงก์</span></button>
          <button type="button" class="btn btn-dark" id="downloadDeliveryQr">${downloadIcon()}<span>ดาวน์โหลด QR</span></button>
          <button type="button" class="btn" id="printDeliveryQr">${icon("print")}<span>พิมพ์</span></button>
        </div>
        <div class="menu-category">เมื่อร้านถูกระงับ QR นี้จะเปิดหน้าสั่งซื้อไม่ได้โดยอัตโนมัติ</div>
      </div>
    </div>`;

  const firstCard = main.querySelector("section.card");
  if (firstCard) firstCard.insertAdjacentElement("afterend", section);
  else main.appendChild(section);

  if (!document.querySelector("#deliveryQrStyles")) {
    const style = document.createElement("style");
    style.id = "deliveryQrStyles";
    style.textContent = `
      .delivery-qr-manager{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:20px;align-items:center}
      .delivery-qr-preview{text-align:center}
      .delivery-qr-paper{padding:18px;border:1px dashed var(--line);border-radius:18px;background:#fff;display:grid;justify-items:center;gap:8px}
      .delivery-qr-paper img{width:min(280px,100%);height:auto;aspect-ratio:1;object-fit:contain}
      .delivery-qr-brand{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
      .delivery-qr-title{font-size:18px;font-weight:800;color:var(--green-dark)}
      .delivery-qr-tools{display:grid;gap:14px;min-width:0}
      .delivery-qr-tools .order-actions .btn{display:inline-flex;align-items:center;gap:6px;border-radius:10px}
      @media(max-width:760px){.delivery-qr-manager{grid-template-columns:1fr}}
      @media print{
        body.delivery-qr-printing *{visibility:hidden!important}
        body.delivery-qr-printing #deliveryQrPreview,
        body.delivery-qr-printing #deliveryQrPreview *{visibility:visible!important}
        body.delivery-qr-printing #deliveryQrPreview{position:absolute;inset:0;display:grid!important;place-items:start center;padding-top:12mm}
        body.delivery-qr-printing .delivery-qr-paper{width:80mm;border:0}
      }`;
    document.head.appendChild(style);
  }
}

mountQrSection();

const preview = document.querySelector("#deliveryQrPreview");
const image = document.querySelector("#deliveryQrImage");
const linkInput = document.querySelector("#deliveryQrLink");
const copyButton = document.querySelector("#copyDeliveryQrLink");
const downloadButton = document.querySelector("#downloadDeliveryQr");
const printButton = document.querySelector("#printDeliveryQr");
const shopLabel = document.querySelector("#deliveryQrShopName");

function qrImageUrl(value) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(value)}&size=720&margin=2&ecLevel=H`;
}

function deliveryUrl() {
  const tenant = dataService.getActiveShop();
  if (!tenant?.slug) throw new Error("TENANT_SLUG_MISSING");
  return `${location.origin}/s/${encodeURIComponent(tenant.slug)}/delivery`;
}

async function generateQr() {
  const tenant = dataService.getActiveShop();
  const url = deliveryUrl();
  const settings = await dataService.getStoreSettings();
  linkInput.value = url;
  shopLabel.textContent = settings.shopName || tenant.name || "ร้านอาหาร";
  image.src = qrImageUrl(url);
  preview.hidden = false;
}

function legacyCopy(value) {
  linkInput.focus();
  linkInput.select();
  linkInput.setSelectionRange(0, value.length);
  const copied = document.execCommand("copy");
  window.getSelection()?.removeAllRanges();
  if (!copied) throw new Error("CLIPBOARD_COPY_FAILED");
}

async function copyLink() {
  if (!linkInput.value) await generateQr();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(linkInput.value);
    } else {
      legacyCopy(linkInput.value);
    }
    toast("คัดลอกลิงก์ Delivery แล้ว");
  } catch (error) {
    console.error(error);
    linkInput.focus();
    linkInput.select();
    toast("เลือกข้อความลิงก์แล้ว กรุณากด Command + C", "error");
  }
}

async function downloadQr() {
  if (!image.src) await generateQr();
  try {
    const response = await fetch(image.src, { mode: "cors" });
    if (!response.ok) throw new Error("QR_DOWNLOAD_FAILED");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `delivery-qr-${dataService.getActiveShop().slug || "shop"}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    toast("ดาวน์โหลด QR Delivery แล้ว");
  } catch (error) {
    console.error(error);
    window.open(image.src, "_blank", "noopener");
    toast("เปิดรูป QR แล้ว กรุณาบันทึกรูปจากหน้าที่เปิด", "error");
  }
}

function printQr() {
  if (!linkInput.value) return void generateQr().then(printQr);
  document.body.classList.add("delivery-qr-printing");
  const printNow = () => requestAnimationFrame(() => window.print());
  if (image.complete) printNow();
  else image.addEventListener("load", printNow, { once: true });
}

copyButton?.addEventListener("click", copyLink);
downloadButton?.addEventListener("click", downloadQr);
printButton?.addEventListener("click", printQr);
window.addEventListener("afterprint", () => document.body.classList.remove("delivery-qr-printing"));

await generateQr();
