import { sweetAlert, sweetConfirm } from "./sweet-dialog.js?v=20260801-002";
import {
  callCountdownSeconds,
  updatePublicCustomerResponse,
  waitingQueueStatusLabel,
  watchPublicQueue,
} from "./waiting-queue-core.js?v=20260801-005";

const params = new URLSearchParams(location.search);
const tenantId = String(params.get("tenantId") || "").trim();
const token = String(params.get("token") || "").trim();

const els = {
  loading: document.querySelector("#waitingCustomerLoading"),
  card: document.querySelector("#waitingCustomerCard"),
  error: document.querySelector("#waitingCustomerError"),
  queueNumber: document.querySelector("#waitingCustomerQueueNumber"),
  partySize: document.querySelector("#waitingCustomerPartySize"),
  status: document.querySelector("#waitingCustomerStatus"),
  groupsAhead: document.querySelector("#waitingCustomerGroupsAhead"),
  estimate: document.querySelector("#waitingCustomerEstimate"),
  progress: document.querySelector("#waitingCustomerProgress"),
  countdownWrap: document.querySelector("#waitingCustomerCountdownWrap"),
  countdown: document.querySelector("#waitingCustomerCountdown"),
  callMessage: document.querySelector("#waitingCustomerCallMessage"),
  confirmArrival: document.querySelector("#waitingCustomerConfirmArrival"),
  cancelQueue: document.querySelector("#waitingCustomerCancelQueue"),
  notification: document.querySelector("#waitingCustomerNotification"),
  updated: document.querySelector("#waitingCustomerUpdated"),
};

let current = null;
let lastStatus = "";
let unsubscribe = () => {};
let countdownTimer = null;

function statusStep(status) {
  return ({
    waiting: 1,
    deferred: 1,
    called: 2,
    acknowledged: 3,
    preparing_table: 4,
    seated: 5,
    no_show: 5,
    cancelled: 5,
  })[status] || 1;
}

function formatUpdated(ms) {
  if (!Number(ms)) return "-";
  return new Date(Number(ms)).toLocaleString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

function notifyCalled(row) {
  if (lastStatus === row.status || row.status !== "called") return;
  try {
    if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
  } catch {}
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(`กำลังเรียกคิว ${row.queueNumber}`, {
      body: "กรุณามาที่จุดรับโต๊ะภายในเวลาที่กำหนด",
      icon: "/assets/images/icon-192.png",
      tag: `waiting-${row.waitingQueueId}`,
      renotify: true,
    });
  }
}

function renderCountdown() {
  clearInterval(countdownTimer);
  const update = () => {
    if (!current || current.status !== "called") {
      els.countdownWrap.hidden = true;
      return;
    }
    const remaining = callCountdownSeconds(current);
    els.countdownWrap.hidden = false;
    if (remaining === null) {
      els.countdown.textContent = "กรุณามาที่จุดรับโต๊ะ";
      return;
    }
    if (remaining <= 0) {
      els.countdown.textContent = "พ้นเวลาตอบรับ กรุณาติดต่อพนักงาน";
      els.countdownWrap.classList.add("overdue");
      return;
    }
    els.countdownWrap.classList.remove("overdue");
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.max(0, remaining % 60);
    els.countdown.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

function render(row) {
  current = row;
  els.loading.hidden = true;
  els.error.hidden = true;
  els.card.hidden = false;
  notifyCalled(row);
  els.queueNumber.textContent = row.queueNumber || "-";
  els.partySize.textContent = `${Number(row.partySize || 1).toLocaleString("th-TH")} คน`;
  els.status.textContent = waitingQueueStatusLabel(row.status);
  els.status.dataset.status = row.status;
  els.groupsAhead.textContent = Number(row.groupsAhead || 0).toLocaleString("th-TH");
  const min = Number(row.estimatedWaitMin || 0);
  const max = Number(row.estimatedWaitMax || 0);
  els.estimate.textContent = row.status === "seated"
    ? `โต๊ะ ${row.tableLabel || "พร้อมแล้ว"}`
    : `${min}–${Math.max(min, max)} นาที`;
  els.updated.textContent = `อัปเดต ${formatUpdated(row.updatedAtMs)}`;
  const step = statusStep(row.status);
  els.progress.querySelectorAll("[data-waiting-step]").forEach(element => {
    element.classList.toggle("active", Number(element.dataset.waitingStep) <= step);
    element.classList.toggle("current", Number(element.dataset.waitingStep) === step);
  });
  els.callMessage.hidden = row.status !== "called";
  els.confirmArrival.hidden = !["called", "acknowledged"].includes(row.status);
  els.confirmArrival.disabled = row.customerResponse === "on_the_way";
  els.confirmArrival.textContent = row.customerResponse === "on_the_way" ? "ยืนยันแล้วว่ากำลังมา" : "ยืนยันว่ากำลังมาที่จุดรับโต๊ะ";
  els.cancelQueue.hidden = !row.active;
  if (row.customerResponse === "cancel_requested") {
    els.cancelQueue.disabled = true;
    els.cancelQueue.textContent = "ส่งคำขอยกเลิกแล้ว";
  } else {
    els.cancelQueue.disabled = false;
    els.cancelQueue.textContent = "ยกเลิกคิว";
  }
  renderCountdown();
  lastStatus = row.status;
}

function showError(message) {
  els.loading.hidden = true;
  els.card.hidden = true;
  els.error.hidden = false;
  els.error.textContent = message;
}

async function confirmArrival() {
  if (!current) return;
  els.confirmArrival.disabled = true;
  try {
    await updatePublicCustomerResponse(token, "on_the_way");
  } catch (error) {
    els.confirmArrival.disabled = false;
    await sweetAlert(error?.message || "ส่งคำตอบไม่สำเร็จ", { title: "ส่งคำตอบไม่สำเร็จ", type: "error" });
  }
}

async function cancelQueue() {
  if (!current) return;
  const confirmed = await sweetConfirm("ยืนยันยกเลิกคิวรอโต๊ะหรือไม่? เมื่อลูกค้าขอยกเลิกแล้ว กรุณาติดต่อพนักงานหากต้องการรับคิวใหม่", {
    title: `ยกเลิกคิว ${current.queueNumber}`,
    confirmText: "ยกเลิกคิว",
    cancelText: "กลับ",
    type: "warning",
  });
  if (!confirmed) return;
  els.cancelQueue.disabled = true;
  try {
    await updatePublicCustomerResponse(token, "cancel_requested");
  } catch (error) {
    els.cancelQueue.disabled = false;
    await sweetAlert(error?.message || "ส่งคำขอยกเลิกไม่สำเร็จ", { title: "ยกเลิกไม่สำเร็จ", type: "error" });
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    return sweetAlert("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน", { title: "เปิดการแจ้งเตือนไม่ได้", type: "warning" });
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    els.notification.textContent = "เปิดการแจ้งเตือนแล้ว";
    els.notification.disabled = true;
    await sweetAlert("เมื่อหน้านี้ยังเปิดอยู่ ระบบจะแจ้งเมื่อถึงคิว ทั้งนี้ควรติดตามจอเรียกคิวของร้านร่วมด้วย", {
      title: "เปิดการแจ้งเตือนแล้ว",
      type: "success",
    });
  } else {
    await sweetAlert("เบราว์เซอร์ไม่ได้รับอนุญาตให้แจ้งเตือน กรุณาติดตามสถานะบนหน้านี้หรือจอของร้าน", {
      title: "ไม่ได้เปิดการแจ้งเตือน",
      type: "warning",
    });
  }
}

function initialize() {
  if (!token || token.length < 12) {
    showError("ลิงก์ติดตามคิวไม่ถูกต้อง กรุณาขอลิงก์ใหม่จากพนักงาน");
    return;
  }
  els.confirmArrival.addEventListener("click", confirmArrival);
  els.cancelQueue.addEventListener("click", cancelQueue);
  els.notification.addEventListener("click", enableNotifications);
  if ("Notification" in window && Notification.permission === "granted") {
    els.notification.textContent = "เปิดการแจ้งเตือนแล้ว";
    els.notification.disabled = true;
  }
  unsubscribe = watchPublicQueue(token, row => {
    if (!row || (tenantId && row.tenantId !== tenantId)) {
      showError("ไม่พบคิวนี้ หรือคิวหมดอายุแล้ว");
      return;
    }
    render(row);
  }, error => {
    console.error("[waiting-queue-customer] watch failed", error);
    showError(navigator.onLine ? "โหลดสถานะคิวไม่สำเร็จ กรุณาลองใหม่" : "อุปกรณ์ออฟไลน์ กรุณาเชื่อมต่ออินเทอร์เน็ต");
  });
}

window.addEventListener("beforeunload", () => {
  unsubscribe();
  clearInterval(countdownTimer);
}, { once: true });

initialize();
