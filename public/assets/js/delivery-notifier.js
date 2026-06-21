import { money, toast } from "./ui.js";

const ENABLED_KEY = "food_order_delivery_alerts_enabled";
const originalTitle = document.title;
let initialized = false;
let knownDeliveryIds = new Set();
let audioContext = null;
let titleTimer = null;

function isEnabled() {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

function setEnabled(enabled) {
  localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ||= new AudioContextClass();
  return audioContext;
}

async function unlockAudio() {
  const context = ensureAudioContext();
  if (context?.state === "suspended") await context.resume();
}

function playTone(frequency, start, duration, volume = 0.18) {
  const context = ensureAudioContext();
  if (!context || context.state !== "running") return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration + 0.03);
}

function playDeliverySound() {
  playTone(880, 0, 0.18);
  playTone(1175, 0.24, 0.18);
  playTone(1568, 0.48, 0.3);
}

function flashTitle(count) {
  clearInterval(titleTimer);
  let showAlert = true;
  const alertTitle = count > 1 ? `มี Delivery ใหม่ ${count} รายการ` : "มี Delivery ใหม่";
  document.title = alertTitle;

  titleTimer = setInterval(() => {
    document.title = showAlert ? originalTitle : alertTitle;
    showAlert = !showAlert;
  }, 900);

  setTimeout(() => {
    clearInterval(titleTimer);
    document.title = originalTitle;
  }, 12000);
}

function showDesktopNotification(order, count) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = count > 1 ? `มีออเดอร์ Delivery ใหม่ ${count} รายการ` : "มีออเดอร์ Delivery ใหม่";
  const body = `${order.recipientName || "ลูกค้า"} • ${money(order.totalAmount || 0)} บาท`;
  const notification = new Notification(title, {
    body,
    tag: `delivery-${order.id}`,
    renotify: true
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

async function enableNotifications(button) {
  try {
    await unlockAudio();
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    setEnabled(true);
    updateButton(button);
    playDeliverySound();
    toast("เปิดเสียงแจ้งเตือน Delivery แล้ว");
  } catch (error) {
    console.error("Unable to enable Delivery notifications", error);
    toast("เปิดเสียงแจ้งเตือนไม่สำเร็จ", "error");
  }
}

function updateButton(button) {
  if (!button) return;
  const enabled = isEnabled();
  button.textContent = enabled ? "เสียงแจ้งเตือน: เปิด" : "เปิดเสียงแจ้งเตือน";
  button.classList.toggle("btn-primary", enabled);
  button.classList.toggle("btn-dark", !enabled);
}

function installEnableButton() {
  const header = document.querySelector(".app-header");
  if (!header || document.querySelector("#deliveryAlertButton")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.id = "deliveryAlertButton";
  button.className = "btn btn-dark btn-sm";
  updateButton(button);
  button.addEventListener("click", () => enableNotifications(button));
  header.appendChild(button);

  if (isEnabled()) {
    const unlockOnce = async () => {
      await unlockAudio();
      document.removeEventListener("pointerdown", unlockOnce);
      document.removeEventListener("keydown", unlockOnce);
    };
    document.addEventListener("pointerdown", unlockOnce, { once: true });
    document.addEventListener("keydown", unlockOnce, { once: true });
  }
}

export function observeDeliveryOrders(orders = []) {
  const activeDeliveries = orders.filter(order =>
    order.orderType === "delivery" && !["paid", "cancelled"].includes(order.status)
  );
  const currentIds = new Set(activeDeliveries.map(order => order.id));

  if (!initialized) {
    initialized = true;
    knownDeliveryIds = currentIds;
    return;
  }

  const newOrders = activeDeliveries.filter(order => !knownDeliveryIds.has(order.id));
  knownDeliveryIds = currentIds;
  if (!newOrders.length) return;

  const newest = newOrders[0];
  const message = newOrders.length > 1
    ? `มีออเดอร์ Delivery ใหม่ ${newOrders.length} รายการ`
    : `มี Delivery ใหม่จาก ${newest.recipientName || "ลูกค้า"} ยอด ${money(newest.totalAmount || 0)} บาท`;

  toast(message);
  flashTitle(newOrders.length);
  if (isEnabled()) {
    playDeliverySound();
    showDesktopNotification(newest, newOrders.length);
  }
}

installEnableButton();
