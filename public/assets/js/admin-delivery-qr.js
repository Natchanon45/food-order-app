import { dataService } from "./data-service.js?v=20260701-009";
import { toast } from "./ui.js?v=20260701-010";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

function icon(name) { return iconMarkup(name); }
function downloadIcon() { return iconMarkup("download"); }
function qrImageUrl(value) { return `https://quickchart.io/qr?text=${encodeURIComponent(value)}&size=720&margin=2&ecLevel=H`; }
function tenantUrl(path) {
  const tenant = dataService.getActiveShop();
  if (!tenant?.slug) throw new Error("TENANT_SLUG_MISSING");
  return `${location.origin}/s/${encodeURIComponent(tenant.slug)}/${path}`;
}
function legacyCopy(input, value) {
  input.focus(); input.select(); input.setSelectionRange(0, value.length);
  const copied = document.execCommand("copy");
  window.getSelection()?.removeAllRanges();
  if (!copied) throw new Error("CLIPBOARD_COPY_FAILED");
}
async function copyText(input, label) {
  if (!input.value) return;
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(input.value);
    else legacyCopy(input, input.value);
    toast(`คัดลอกลิงก์ ${label} แล้ว`);
  } catch (error) {
    console.error(error);
    input.focus(); input.select();
    toast("เลือกข้อความลิงก์แล้ว กรุณากด Command + C", "error");
  }
}
async function downloadQr(image, filename, label) {
  try {
    const response = await fetch(image.src, { mode: "cors" });
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
    toast(`ดาวน์โหลด QR ${label} แล้ว`);
  } catch (error) {
    console.error(error);
    window.open(image.src, "_blank", "noopener");
    toast("เปิดรูป QR แล้ว กรุณาบันทึกรูปจากหน้าที่เปิด", "error");
  }
}
function printTarget(printClass, image, generate) {
  if (!image.src) return void generate().then(() => printTarget(printClass, image, generate));
  document.body.classList.add(printClass);
  const printNow = () => requestAnimationFrame(() => window.print());
  if (image.complete) printNow(); else image.addEventListener("load", printNow, { once: true });
}

function qrBlock({ id, title, subtitle, paperTitle, linkLabel, urlPath, printClass, buttonPrefix }) {
  return `
    <section class="card admin-qr-card" id="${id}Section">
      <div class="section-title" style="margin-top:0">
        <div><h2>${title}</h2><div class="menu-category">${subtitle}</div></div>
      </div>
      <div class="delivery-qr-manager">
        <div class="delivery-qr-preview" id="${id}Preview" hidden>
          <div class="delivery-qr-paper">
            <div class="delivery-qr-brand">Food Order/Delivery With QR</div>
            <strong id="${id}ShopName">ร้านอาหาร</strong>
            <div class="delivery-qr-title">${paperTitle}</div>
            <img id="${id}Image" width="280" height="280" alt="${title}">
            <small>QR นี้ใช้สำหรับร้านนี้โดยเฉพาะ</small>
          </div>
        </div>
        <div class="delivery-qr-tools">
          <div class="field"><label for="${id}Link">${linkLabel}</label><input class="input" id="${id}Link" readonly></div>
          <div class="order-actions">
            <button type="button" class="btn" id="copy${buttonPrefix}Link"><span>คัดลอกลิงก์</span></button>
            <button type="button" class="btn btn-dark" id="download${buttonPrefix}">${downloadIcon()}<span>ดาวน์โหลด QR</span></button>
            <button type="button" class="btn" id="print${buttonPrefix}">${icon("print")}<span>พิมพ์</span></button>
          </div>
          <div class="menu-category">เมื่อร้านถูกระงับ QR นี้จะเปิดหน้าสั่งซื้อไม่ได้โดยอัตโนมัติ</div>
        </div>
      </div>
    </section>`;
}

function mountQrSection() {
  const main = document.querySelector("main.container");
  if (!main || document.querySelector("#deliveryQrSection")) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    ${qrBlock({ id: "deliveryQr", title: "QR สำหรับสั่ง Delivery", subtitle: "QR ประจำร้านจะสร้างให้อัตโนมัติตาม slug ของร้าน", paperTitle: "สแกนเพื่อสั่ง Delivery", linkLabel: "ลิงก์สั่ง Delivery", urlPath: "delivery", printClass: "delivery-qr-printing", buttonPrefix: "DeliveryQr" })}
    ${qrBlock({ id: "takeawayQr", title: "QR สำหรับสั่งกลับบ้าน", subtitle: "พิมพ์ QR นี้ไปแปะหน้า Counter Cashier สำหรับลูกค้า Walk-in", paperTitle: "สแกนเพื่อสั่งกลับบ้าน", linkLabel: "ลิงก์สั่งกลับบ้าน", urlPath: "takeaway", printClass: "takeaway-qr-printing", buttonPrefix: "TakeawayQr" })}`;
  const firstCard = main.querySelector("section.card");
  const nodes = [...wrapper.children];
  nodes.reverse().forEach(node => firstCard ? firstCard.insertAdjacentElement("afterend", node) : main.prepend(node));
  if (!document.querySelector("#deliveryQrStyles")) {
    const style = document.createElement("style");
    style.id = "deliveryQrStyles";
    style.textContent = `.admin-qr-card{margin-bottom:16px}.delivery-qr-manager{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:20px;align-items:center}.delivery-qr-preview{text-align:center}.delivery-qr-paper{padding:18px;border:1px dashed var(--line);border-radius:18px;background:#fff;display:grid;justify-items:center;gap:8px}.delivery-qr-paper img{width:min(280px,100%);height:auto;aspect-ratio:1;object-fit:contain}.delivery-qr-brand{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.delivery-qr-title{font-size:18px;font-weight:800;color:var(--green-dark)}.delivery-qr-tools{display:grid;gap:14px;min-width:0}.delivery-qr-tools .order-actions .btn{display:inline-flex;align-items:center;gap:6px;border-radius:10px}@media(max-width:760px){.delivery-qr-manager{grid-template-columns:1fr}}@media print{body.delivery-qr-printing *,body.takeaway-qr-printing *{visibility:hidden!important}body.delivery-qr-printing #deliveryQrPreview,body.delivery-qr-printing #deliveryQrPreview *,body.takeaway-qr-printing #takeawayQrPreview,body.takeaway-qr-printing #takeawayQrPreview *{visibility:visible!important}body.delivery-qr-printing #deliveryQrPreview,body.takeaway-qr-printing #takeawayQrPreview{position:absolute;inset:0;display:grid!important;place-items:start center;padding-top:12mm}.delivery-qr-paper{width:80mm;border:0}}`;
    document.head.appendChild(style);
  }
}

mountQrSection();

function setupQr({ id, path, label, filenamePrefix, printClass, buttonPrefix }) {
  const preview = document.querySelector(`#${id}Preview`);
  const image = document.querySelector(`#${id}Image`);
  const linkInput = document.querySelector(`#${id}Link`);
  const shopLabel = document.querySelector(`#${id}ShopName`);
  async function generate() {
    const tenant = dataService.getActiveShop();
    const settings = await dataService.getStoreSettings();
    const url = tenantUrl(path);
    linkInput.value = url;
    shopLabel.textContent = settings.shopName || tenant.name || "ร้านอาหาร";
    image.src = qrImageUrl(url);
    preview.hidden = false;
  }
  document.querySelector(`#copy${buttonPrefix}Link`)?.addEventListener("click", async () => { if (!linkInput.value) await generate(); await copyText(linkInput, label); });
  document.querySelector(`#download${buttonPrefix}`)?.addEventListener("click", async () => { if (!image.src) await generate(); await downloadQr(image, `${filenamePrefix}-${dataService.getActiveShop().slug || "shop"}.png`, label); });
  document.querySelector(`#print${buttonPrefix}`)?.addEventListener("click", () => printTarget(printClass, image, generate));
  generate();
}

setupQr({ id: "deliveryQr", path: "delivery", label: "Delivery", filenamePrefix: "delivery-qr", printClass: "delivery-qr-printing", buttonPrefix: "DeliveryQr" });
setupQr({ id: "takeawayQr", path: "takeaway", label: "สั่งกลับบ้าน", filenamePrefix: "takeaway-qr", printClass: "takeaway-qr-printing", buttonPrefix: "TakeawayQr" });
window.addEventListener("afterprint", () => document.body.classList.remove("delivery-qr-printing", "takeaway-qr-printing"));
