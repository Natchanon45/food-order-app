import "./public-i18n-bootstrap.js?v=20260903-245";

import { toast } from "./ui.js?v=20260903-231";
import { t, formatNumber } from "./i18n.js?v=20260903-202";
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
const deliveryFreeGiftList = document.querySelector("#deliveryFreeGiftList");
const slug = decodeURIComponent(location.pathname.match(/^\/s\/([^/]+)/i)?.[1] || "shop");
const draftKey = `delivery_checkout_draft:${slug}`;
const QR_DOWNLOAD_SIZE = 640;

let paymentLocked = false;
let lockedSnapshot = null;
let restoringDraft = false;
let saveTimer = null;

function requiresPaymentLock() {
  return paymentMethod?.value === "promptpay";
}

function downloadIcon() {
  return iconMarkup("download");
}

function amountText(value) {
  return `${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t("delivery.checkout.units.baht")}`;
}

function dataUrlBlob(dataUrl) {
  const source = String(dataUrl || "");
  const commaIndex = source.indexOf(",");
  if (!source.startsWith("data:") || commaIndex < 0) throw new Error("QR_DATA_URL_INVALID");

  const metadata = source.slice(5, commaIndex);
  const encoded = source.slice(commaIndex + 1);
  const mimeType = metadata.split(";")[0] || "image/svg+xml";
  const bytes = metadata.includes(";base64")
    ? Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(encoded));

  return new Blob([bytes], { type: mimeType });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("QR_IMAGE_LOAD_FAILED"));
    image.src = source;
  });
}

async function qrPngBlob(source) {
  let sourceObjectUrl = "";
  try {
    const imageSource = source.startsWith("data:")
      ? (sourceObjectUrl = URL.createObjectURL(dataUrlBlob(source)))
      : source;
    const image = await loadImage(imageSource);
    const sourceWidth = Number(image.naturalWidth || image.width || 320);
    const sourceHeight = Number(image.naturalHeight || image.height || 320);
    const scale = Math.min(QR_DOWNLOAD_SIZE / sourceWidth, QR_DOWNLOAD_SIZE / sourceHeight);
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const offsetX = Math.round((QR_DOWNLOAD_SIZE - drawWidth) / 2);
    const offsetY = Math.round((QR_DOWNLOAD_SIZE - drawHeight) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = QR_DOWNLOAD_SIZE;
    canvas.height = QR_DOWNLOAD_SIZE;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("QR_CANVAS_UNAVAILABLE");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, QR_DOWNLOAD_SIZE, QR_DOWNLOAD_SIZE);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    return await new Promise((resolve, reject) => {
      if (typeof canvas.toBlob !== "function") {
        try {
          resolve(dataUrlBlob(canvas.toDataURL("image/png")));
        } catch (error) {
          reject(error);
        }
        return;
      }
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("QR_PNG_ENCODE_FAILED"));
      }, "image/png");
    });
  } finally {
    if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
  }
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

// DELIVERY_PAYMENT_EDIT_GIFT_STATE_20260829_001
function selectedFreeGiftIds() {
  if (!deliveryFreeGiftList) return [];

  return [...deliveryFreeGiftList.querySelectorAll(
    "[data-delivery-free-gift-input]:checked"
  )]
    .map(input => String(input.dataset.deliveryFreeGiftInput || input.value || "").trim())
    .filter(Boolean);
}

async function restoreFreeGiftIds(ids = []) {
  if (!deliveryFreeGiftList || !Array.isArray(ids) || !ids.length) return;

  const desired = [...new Set(ids.map(value => String(value || "").trim()).filter(Boolean))];
  if (!desired.length) return;

  for (
    let attempt = 0;
    attempt < 30 && !deliveryFreeGiftList.querySelector("[data-delivery-free-gift-input]");
    attempt += 1
  ) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  for (const id of desired) {
    const input = deliveryFreeGiftList.querySelector(
      `[data-delivery-free-gift-input="${CSS.escape(id)}"]`
    );
    if (!input || input.checked) continue;

    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  }
}

function manualDeliveryFeeFallback() {
  return deliveryZone?.dataset.deliveryFeeMode === "manual-fallback";
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
      freeGiftMenuIds: selectedFreeGiftIds(),
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
      <strong>${t("delivery.checkout.payment_lock.unlocked_title")}</strong>
      <span>${t("delivery.checkout.payment_lock.unlocked_help")}</span>
    </div>
    <div class="payment-lock-summary" id="paymentLockSummary" hidden>
      <div><span>${t("delivery.checkout.summary.food_subtotal")}</span><strong id="lockedSubtotal">${amountText(0)}</strong></div>
      <div><span>${t("delivery.checkout.summary.delivery_fee")}</span><strong id="lockedDeliveryFee">${amountText(0)}</strong></div>
      <div class="payment-lock-total"><span>${t("delivery.checkout.payment_lock.locked_total")}</span><strong id="lockedTotal">${amountText(0)}</strong></div>
    </div>
    <div class="payment-lock-actions">
      <button type="button" class="btn btn-dark" id="downloadPaymentQr" hidden>${downloadIcon()}<span>${t("delivery.checkout.payment_lock.download_qr")}</span></button>
      <button type="button" class="btn" id="editLockedOrder" hidden>${t("delivery.checkout.payment_lock.edit_items")}</button>
    </div>`;
  promptPaySection?.insertBefore(panel, paymentSlipWrap || null);
  panel.querySelector("#downloadPaymentQr")?.addEventListener("click", downloadPaymentQr);
  panel.querySelector("#editLockedOrder")?.addEventListener("click", unlockPayment);
}

function setEditingDisabled(disabled) {
  document.body.classList.toggle("delivery-payment-locked", disabled);
  menuGrid?.querySelectorAll("[data-add]").forEach(button => { button.disabled = disabled; });
  cartList?.querySelectorAll("[data-inc], [data-dec], [data-note]").forEach(control => { control.disabled = disabled; });
  if (deliveryZone) deliveryZone.disabled = disabled || !manualDeliveryFeeFallback();
  if (paymentMethod) paymentMethod.disabled = disabled;
}

function updateUi() {
  const panel = document.querySelector("#paymentLockPanel");
  if (!panel) return;
  if (!requiresPaymentLock() && paymentLocked) {
    paymentLocked = false;
    lockedSnapshot = null;
    setEditingDisabled(false);
  }
  document.body.classList.toggle("delivery-payment-unlocked", !paymentLocked);
  panel.querySelector("#paymentLockState").hidden = paymentLocked;
  panel.querySelector("#paymentLockSummary").hidden = !paymentLocked;
  panel.querySelector("#editLockedOrder").hidden = !paymentLocked;
  panel.querySelector("#downloadPaymentQr").hidden = !paymentLocked || paymentMethod?.value !== "promptpay" || !promptPayQr?.src;

  if (paymentLocked && lockedSnapshot) {
    panel.querySelector("#lockedSubtotal").textContent = amountText(lockedSnapshot.subtotal);
    panel.querySelector("#lockedDeliveryFee").textContent = amountText(lockedSnapshot.deliveryFee);
    panel.querySelector("#lockedTotal").textContent = amountText(lockedSnapshot.total);
  }

  submitButton.textContent = paymentLocked || !requiresPaymentLock()
    ? t("delivery.checkout.summary.submit_order")
    : t("delivery.checkout.summary.review_and_pay");
}

function lockPayment() {
  if (!requiresPaymentLock()) {
    paymentLocked = false;
    lockedSnapshot = null;
    setEditingDisabled(false);
    updateUi();
    return;
  }
  if (!cartQuantity()) {
    toast(t("delivery.checkout.validation.add_items_first"), "error");
    return;
  }
  if (!requiredDataReady()) {
    toast(t("delivery.checkout.validation.delivery_details_required"), "error");
    return;
  }
  if (paymentMethod?.value === "promptpay" && (!promptPayQr?.src || promptPayQr.hidden)) {
    toast(t("delivery.checkout.payment_lock.qr_unavailable"), "error");
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
  toast(t("delivery.checkout.payment_lock.locked_done", { total: amountText(lockedSnapshot.total) }));
}

function unlockPayment() {
  const preservedFreeGiftIds = selectedFreeGiftIds();

  paymentLocked = false;
  lockedSnapshot = null;
  if (removePaymentSlip && !removePaymentSlip.hidden) removePaymentSlip.click();
  setEditingDisabled(false);
  updateUi();

  restoreFreeGiftIds(preservedFreeGiftIds).finally(saveDraft);
  toast(t("delivery.checkout.payment_lock.unlock_done"));
}

async function downloadPaymentQr() {
  if (!paymentLocked || !lockedSnapshot || !promptPayQr?.src) {
    toast(t("delivery.checkout.payment_lock.download_before_lock"), "error");
    return;
  }

  const source = String(promptPayQr.src || "");
  const fileName = `promptpay-${slug}-${lockedSnapshot.total.toFixed(2)}.png`;
  let objectUrl = "";

  try {
    const pngBlob = await qrPngBlob(source);
    objectUrl = URL.createObjectURL(pngBlob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    toast(t("delivery.checkout.payment_lock.download_done"));
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    console.error("PAYMENT_QR_DOWNLOAD_FAILED", error);
    const newTab = window.open(source, "_blank", "noopener,noreferrer");
    toast(newTab
      ? t("delivery.checkout.payment_lock.open_new_tab")
      : t("delivery.checkout.payment_lock.download_failed"), "error");
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

  await restoreFreeGiftIds(
    Array.isArray(draft.freeGiftMenuIds) ? draft.freeGiftMenuIds : []
  );

  paymentLocked = Boolean(draft.paymentLocked && draft.lockedSnapshot && draft.cart.length && paymentMethod?.value === "promptpay");
  lockedSnapshot = paymentLocked ? draft.lockedSnapshot : null;
  setEditingDisabled(paymentLocked);
  updateUi();

  delete document.body.dataset.restoringDeliveryDraft;
  restoringDraft = false;
  saveDraft();
  if (draft.cart.length) toast(t("delivery.checkout.payment_lock.draft_restored"));
}

submitButton?.addEventListener("click", event => {
  if (!requiresPaymentLock()) {
    if (paymentLocked) {
      paymentLocked = false;
      lockedSnapshot = null;
      setEditingDisabled(false);
      updateUi();
      saveDraft();
    }
    return;
  }
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
      toast(t("delivery.checkout.payment_lock.amount_changed"), "error");
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
document.addEventListener("change", event => {
  if (event.target === paymentMethod) updateUi();
  saveDraft();
}, true);
document.addEventListener("delivery-fee-mode-changed", () => {
  setEditingDisabled(paymentLocked);
});
window.addEventListener("pagehide", saveDraft);

mountPanel();
setEditingDisabled(false);
updateUi();
await restoreDraft();
