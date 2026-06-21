import { dataService } from "./data-service.js";
import { toast } from "./ui.js";

const wrap = document.querySelector("#deliveryQrSection");
const preview = document.querySelector("#deliveryQrPreview");
const image = document.querySelector("#deliveryQrImage");
const linkInput = document.querySelector("#deliveryQrLink");
const generateButton = document.querySelector("#generateDeliveryQr");
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
  wrap.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function copyLink() {
  if (!linkInput.value) await generateQr();
  await navigator.clipboard.writeText(linkInput.value);
  toast("คัดลอกลิงก์ Delivery แล้ว");
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

generateButton?.addEventListener("click", generateQr);
copyButton?.addEventListener("click", copyLink);
downloadButton?.addEventListener("click", downloadQr);
printButton?.addEventListener("click", printQr);
window.addEventListener("afterprint", () => document.body.classList.remove("delivery-qr-printing"));

await generateQr();
