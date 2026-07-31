import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";
import { toast } from "./ui.js?v=20260731-080";
import { getStoredTenant } from "./tenant-context.js";
import { sweetPrompt } from "./sweet-dialog.js?v=20260731-080";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function takeawayUrl() {
  const tenant = getStoredTenant?.();
  const path = tenant?.slug ? `/s/${encodeURIComponent(tenant.slug)}/takeaway/` : "/takeaway/";
  return new URL(path, location.origin).toString();
}

function qrImage(url) {
  return `https://quickchart.io/qr?size=260&margin=2&text=${encodeURIComponent(url)}`;
}

async function copyTakeawayLink(url) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) throw new Error("COPY_NOT_SUPPORTED");
    }
    toast("คัดลอกลิงก์ Take Away แล้ว");
  } catch {
    await sweetPrompt("เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ กรุณาคัดลอกลิงก์ด้านล่าง", url, {
      title: "คัดลอกลิงก์สั่งกลับบ้าน",
      confirmText: "ปิด",
      readOnly: true
    });
  }
}

function ensureModal(url) {
  let modal = document.querySelector("#takeawayQrModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "takeawayQrModal";
  modal.hidden = true;
  modal.innerHTML = `<div class="takeaway-qr-backdrop" data-close-takeaway-qr></div><section class="takeaway-qr-card" role="dialog" aria-modal="true" aria-labelledby="takeawayQrTitle"><button class="takeaway-qr-close" type="button" data-close-takeaway-qr aria-label="ปิด"><i class="bi bi-x-lg" aria-hidden="true"></i></button><h2 id="takeawayQrTitle">QR สั่งกลับบ้าน</h2><p>ให้ลูกค้า Walk-in สแกนเพื่อสั่งกลับบ้าน</p><img src="${qrImage(url)}" alt="QR สำหรับสั่งกลับบ้าน"><input readonly value="${escapeHtml(url)}" aria-label="ลิงก์สั่งกลับบ้าน"><div class="order-actions"><button class="btn btn-warning" type="button" id="copyTakeawayQrUrl">${iconMarkup("copy")}<span>คัดลอกลิงก์</span></button><a class="btn btn-primary" href="${escapeHtml(url)}" target="_blank" rel="noopener">${iconMarkup("view")}<span>เปิดหน้าสั่ง</span></a></div></section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close-takeaway-qr]").forEach(el => el.addEventListener("click", () => modal.hidden = true));
  modal.querySelector("#copyTakeawayQrUrl")?.addEventListener("click", () => copyTakeawayLink(url));
  return modal;
}

function mountTools() {
  const url = takeawayUrl();
  const orderLink = document.querySelector("#openTakeawayOrder");
  if (orderLink) orderLink.href = url;
  document.querySelector("#showTakeawayQr")?.addEventListener("click", () => { ensureModal(url).hidden = false; });
  document.querySelector("#copyTakeawayUrl")?.addEventListener("click", () => copyTakeawayLink(url));
}

mountTools();
