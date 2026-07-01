import { toast } from "./ui.js?v=20260701-002";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

const submitButton = document.querySelector("#submitOrder");
const paymentMethod = document.querySelector("#paymentMethod");
const deliveryZone = document.querySelector("#deliveryZone");
const promptPaySection = document.querySelector("#promptPaySection");
const promptPayQr = document.querySelector("#promptPayQr");
const paymentSlipWrap = document.querySelector("#paymentSlipWrap");
const removePaymentSlip = document.querySelector("#removePaymentSlip");
const cartList = document.querySelector("#cartList");
const menuGrid = document.querySelector("#menuGrid");
const slug = decodeURIComponent(location.pathname.match(/^\/s\/([^/]+)/i)?.[1] || "shop");
const draftKey = `delivery_checkout_draft:${slug}`;

let paymentLocked = false;
let lockedSnapshot = null;
let restoringDraft = false;
let saveTimer = null;

function downloadIcon() {
  return iconMarkup("download");
}

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function amountValue(selector) {
  return Number(String(document.querySelector(selector)?.textContent || "0").replace(/,/g, "")) || 0;
}

function cartQuantity() {
  return Number.parseInt(document.querySelector("#cartCount")?.textContent || "0", 10) || 0;
}

function requiredDataReady() {
  return ["#recipientName", "#recipientPhone", "#deliveryAddress"].every(selector => document.querySelector(selector)?.value.trim());
}

function readCartRows() {
  return [...cartList.querySelectorAll(".cart-row")].map(row => {
    const inc = row.querySelector("[data-inc]");
    const dec = row.querySelector("[data-dec]");
    const id = inc?.dataset.inc || dec?.dataset.dec || "";
    const qty = Number.parseInt(row.querySelector(".qty strong")?.textContent || "1", 10) || 1;
    const note = row.querySelector("[data-note]")?.value || "";
    return id ? { id, qty, note } : null;
  }).filter(Boolean);
}

function saveDraft() {
  if (restoringDraft) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const draft = {
      cart: readCartRows(),
      recipientName: document.querySelector("#recipientName")?.value || "",
      recipientPhone: document.querySelector("#recipientPhone")?.value || "",
      deliveryAddress: document.querySelector("#deliveryAddress")?.value || "",
      orderNote: document.querySelector("#orderNote")?.value || "",
      deliveryZone: deliveryZone?.value || "",
      paymentMethod: paymentMethod?.value || "",
      paymentLocked,
      lockedSnapshot,
      savedAt: Date.now()
    };
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }, 80);
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
      <button type="button" class="btn btn-dark" id="downloadPaymentQr" hidden>${downloadIcon()}<span>ดาวน์โหลด QR ชำระเงิน</span></button>
      <button type="button" class="btn" id="editLockedOrder" hidden>แก้ไขรายการอาหาร</button>
    </div>`;
  promptPaySection?.insertBefore(panel, paymentSlipWrap || null);
  panel.querySelector("#downloadPaymentQr")?.addEventListener("click", downloadPaymentQr);
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
  panel.querySelector("#downloadPaymentQr").hidden = !paymentLocked || paymentMethod?.value !== "promptpay" || !promptPayQr?.src;

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
  saveDraft();
  promptPaySection?.scrollIntoView({ behavior: "smooth", block: "center" });
  toast(`ล็อกยอด ${lockedSnapshot.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาทแล้ว`);
}

async function unlockPayment() {
  const ok = await askConfirm("การแก้ไขรายการจะยกเลิก QR และสลิปที่แนบไว้\nต้องการแก้ไขรายการหรือไม่?", {
    title: "แก้ไขรายการอาหาร",
    confirmText: "ตกลง",
    cancelText: "ยกเลิก",
    type: "warning"
  });
  if (!ok) return;
  paymentLocked = false;
  lockedSnapshot = null;
  if (removePaymentSlip && !removePaymentSlip.hidden) removePaymentSlip.click();
  setEditingDisabled(false);
  updateUi();
  saveDraft();
  toast("ปลดล็อกยอดแล้ว กรุณาตรวจสอบและชำระเงินใหม่");
}

async function downloadPaymentQr() {
  if (!paymentLocked || !lockedSnapshot || !promptPayQr?.src) {
    toast("กรุณาล็อกยอดก่อนดาวน์โหลด QR", "error");
    return;
  }

  const fileName = `promptpay-${slug}-${lockedSnapshot.total.toFixed(2)}.png`;
  try {
    const response = await fetch(promptPayQr.src, { mode: "cors", cache: "no-store" });
    if (!response.ok) throw new Error("QR_DOWNLOAD_FAILED");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    toast("ดาวน์โหลด QR ชำระเงินแล้ว");
  } catch (error) {
    console.error("PAYMENT_QR_DOWNLOAD_FAILED", error);
    const newTab = window.open(promptPayQr.src, "_blank", "noopener,noreferrer");
    toast(newTab ? "เปิด QR ในแท็บใหม่แล้ว หน้าสั่งซื้อยังคงอยู่" : "ไม่สามารถดาวน์โหลด QR ได้ กรุณาลองใหม่", "error");
  }
}

async function restoreDraft() {
  const raw = sessionStorage.getItem(draftKey);
  if (!raw) return;
  let draft;
  try {
    draft = JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(draftKey);
    return;
  }

  if (!Array.isArray(draft.cart) || Date.now() - Number(draft.savedAt || 0) > 6 * 60 * 60 * 1000) {
    sessionStorage.removeItem(draftKey);
    return;
  }

  restoringDraft = true;
  document.body.dataset.restoringDeliveryDraft = "true";

  for (let attempt = 0; attempt < 50 && !menuGrid.querySelector("[data-add]"); attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  for (const item of draft.cart) {
    const addButton = menuGrid.querySelector(`[data-add="${CSS.escape(item.id)}"]`);
    if (!addButton) continue;
    addButton.click();
    for (let qty = 1; qty < Number(item.qty || 1); qty += 1) {
      cartList.querySelector(`[data-inc="${CSS.escape(item.id)}"]`)?.click();
    }
    const note = cartList.querySelector(`[data-note="${CSS.escape(item.id)}"]`);
    if (note) {
      note.value = item.note || "";
      note.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  const fieldValues = {
    recipientName: draft.recipientName,
    recipientPhone: draft.recipientPhone,
    deliveryAddress: draft.deliveryAddress,
    orderNote: draft.orderNote
  };
  for (const [id, value] of Object.entries(fieldValues)) {
    const field = document.querySelector(`#${id}`);
    if (field && value != null) field.value = value;
  }
  if (draft.deliveryZone && deliveryZone) {
    deliveryZone.value = draft.deliveryZone;
    deliveryZone.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (draft.paymentMethod && paymentMethod) {
    paymentMethod.value = draft.paymentMethod;
    paymentMethod.dispatchEvent(new Event("change", { bubbles: true }));
  }

  paymentLocked = Boolean(draft.paymentLocked && draft.lockedSnapshot && draft.cart.length);
  lockedSnapshot = paymentLocked ? draft.lockedSnapshot : null;
  setEditingDisabled(paymentLocked);
  updateUi();

  delete document.body.dataset.restoringDeliveryDraft;
  restoringDraft = false;
  saveDraft();
  if (draft.cart.length) toast("กู้คืนรายการสั่งซื้อเดิมแล้ว");
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
      saveDraft();
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
  saveDraft();
}).observe(cartList, { childList: true, subtree: true, characterData: true });

document.addEventListener("input", saveDraft, true);
document.addEventListener("change", saveDraft, true);
window.addEventListener("pagehide", saveDraft);

mountPanel();
setEditingDisabled(false);
updateUi();
await restoreDraft();
