import { toast } from "./ui.js";

const submitButton = document.querySelector("#submitOrder");
const paymentMethod = document.querySelector("#paymentMethod");
const deliveryZone = document.querySelector("#deliveryZone");
const promptPaySection = document.querySelector("#promptPaySection");
const promptPayQr = document.querySelector("#promptPayQr");
const paymentSlipWrap = document.querySelector("#paymentSlipWrap");
const removePaymentSlip = document.querySelector("#removePaymentSlip");
const cartList = document.querySelector("#cartList");
const menuGrid = document.querySelector("#menuGrid");

let paymentLocked = false;
let lockedSnapshot = null;

function amountValue(selector) {
  return Number(String(document.querySelector(selector)?.textContent || "0").replace(/,/g, "")) || 0;
}

function cartQuantity() {
  return Number.parseInt(document.querySelector("#cartCount")?.textContent || "0", 10) || 0;
}

function requiredDataReady() {
  return ["#recipientName", "#recipientPhone", "#deliveryAddress"].every(selector => document.querySelector(selector)?.value.trim());
}

function mountPanel() {
  if (document.querySelector("#paymentLockPanel")) return;
  const panel = document.createElement("div");
  panel.id = "paymentLockPanel";
  panel.className = "payment-lock-panel";
  panel.innerHTML = `
    <div class="payment-lock-state" id="paymentLockState">
      <strong>ยอดยังไม่ถูกล็อก</strong>
      <span>ตรวจสอบรายการและข้อมูลจัดส่ง แล้วกดตรวจสอบและชำระเงิน</span>
    </div>
    <div class="payment-lock-summary" id="paymentLockSummary" hidden>
      <div><span>ค่าอาหาร</span><strong id="lockedSubtotal">0.00 บาท</strong></div>
      <div><span>ค่าจัดส่ง</span><strong id="lockedDeliveryFee">0.00 บาท</strong></div>
      <div class="payment-lock-total"><span>ยอดที่ล็อกแล้ว</span><strong id="lockedTotal">0.00 บาท</strong></div>
    </div>
    <div class="payment-lock-actions">
      <a class="btn btn-dark" id="downloadPaymentQr" hidden>ดาวน์โหลด QR ชำระเงิน</a>
      <button type="button" class="btn" id="editLockedOrder" hidden>แก้ไขรายการอาหาร</button>
    </div>`;
  promptPaySection?.insertBefore(panel, paymentSlipWrap || null);
  panel.querySelector("#editLockedOrder")?.addEventListener("click", unlockPayment);
}

function setEditingDisabled(disabled) {
  document.body.classList.toggle("delivery-payment-locked", disabled);
  menuGrid?.querySelectorAll("[data-add]").forEach(button => { button.disabled = disabled; });
  cartList?.querySelectorAll("[data-inc], [data-dec], [data-note]").forEach(control => { control.disabled = disabled; });
  if (deliveryZone) deliveryZone.disabled = disabled;
  if (paymentMethod) paymentMethod.disabled = disabled;
}

function updateUi() {
  const panel = document.querySelector("#paymentLockPanel");
  if (!panel) return;
  document.body.classList.toggle("delivery-payment-unlocked", !paymentLocked);
  panel.querySelector("#paymentLockState").hidden = paymentLocked;
  panel.querySelector("#paymentLockSummary").hidden = !paymentLocked;
  panel.querySelector("#editLockedOrder").hidden = !paymentLocked;

  const download = panel.querySelector("#downloadPaymentQr");
  download.hidden = !paymentLocked || paymentMethod?.value !== "promptpay" || !promptPayQr?.src;
  if (!download.hidden) {
    const slug = location.pathname.match(/^\/s\/([^/]+)/i)?.[1] || "shop";
    download.href = promptPayQr.src;
    download.download = `promptpay-${decodeURIComponent(slug)}-${lockedSnapshot.total.toFixed(2)}.png`;
  }

  if (paymentLocked && lockedSnapshot) {
    panel.querySelector("#lockedSubtotal").textContent = `${lockedSnapshot.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
    panel.querySelector("#lockedDeliveryFee").textContent = `${lockedSnapshot.deliveryFee.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
    panel.querySelector("#lockedTotal").textContent = `${lockedSnapshot.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
  }

  submitButton.textContent = paymentLocked ? "ยืนยันคำสั่งซื้อ" : "ตรวจสอบและชำระเงิน";
}

function lockPayment() {
  if (!cartQuantity()) {
    toast("กรุณาเพิ่มรายการอาหารก่อน", "error");
    return;
  }
  if (!requiredDataReady()) {
    toast("กรุณากรอกชื่อผู้รับ ที่อยู่ และเบอร์โทรศัพท์", "error");
    return;
  }
  if (paymentMethod?.value === "promptpay" && (!promptPayQr?.src || promptPayQr.hidden)) {
    toast("ไม่สามารถสร้าง QR ชำระเงินได้", "error");
    return;
  }

  lockedSnapshot = {
    subtotal: amountValue("#deliverySubtotal"),
    deliveryFee: amountValue("#deliveryFeeDisplay"),
    total: amountValue("#cartTotal"),
    method: paymentMethod?.value || "",
    zone: deliveryZone?.value || ""
  };
  paymentLocked = true;
  setEditingDisabled(true);
  updateUi();
  promptPaySection?.scrollIntoView({ behavior: "smooth", block: "center" });
  toast(`ล็อกยอด ${lockedSnapshot.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาทแล้ว`);
}

function unlockPayment() {
  if (!confirm("การแก้ไขรายการจะยกเลิก QR และสลิปที่แนบไว้\nต้องการแก้ไขรายการหรือไม่?")) return;
  paymentLocked = false;
  lockedSnapshot = null;
  if (removePaymentSlip && !removePaymentSlip.hidden) removePaymentSlip.click();
  setEditingDisabled(false);
  updateUi();
  toast("ปลดล็อกยอดแล้ว กรุณาตรวจสอบและชำระเงินใหม่");
}

submitButton?.addEventListener("click", event => {
  if (paymentLocked) {
    const changed = Math.abs(amountValue("#cartTotal") - Number(lockedSnapshot?.total || 0)) > 0.001
      || paymentMethod?.value !== lockedSnapshot?.method
      || deliveryZone?.value !== lockedSnapshot?.zone;
    if (changed) {
      event.preventDefault();
      event.stopImmediatePropagation();
      paymentLocked = false;
      lockedSnapshot = null;
      setEditingDisabled(false);
      updateUi();
      toast("ยอดเปลี่ยน กรุณาล็อกยอดใหม่", "error");
    }
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  lockPayment();
}, true);

new MutationObserver(() => {
  if (paymentLocked) setEditingDisabled(true);
}).observe(document.body, { childList: true, subtree: true });

mountPanel();
setEditingDisabled(false);
updateUi();
