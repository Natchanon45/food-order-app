import { watchPublicQueueBoard } from "./waiting-queue-core.js?v=20260801-001";

const params = new URLSearchParams(location.search);
const tenantId = String(params.get("tenantId") || "").trim();
const els = {
  clock: document.querySelector("#waitingDisplayClock"),
  called: document.querySelector("#waitingDisplayCalled"),
  calledEmpty: document.querySelector("#waitingDisplayCalledEmpty"),
  calledTimer: document.querySelector("#waitingDisplayCalledTimer"),
  next: document.querySelector("#waitingDisplayNext"),
  status: document.querySelector("#waitingDisplayStatus"),
  sound: document.querySelector("#waitingDisplaySound"),
  fullscreen: document.querySelector("#waitingDisplayFullscreen"),
};

let rows = [];
let lastCalledSignature = "";
let soundEnabled = localStorage.getItem("waiting_queue_display_sound") !== "off";
let unsubscribe = () => {};
let clockTimer = null;

function activeCalled() {
  return rows
    .filter(row => ["called", "acknowledged", "preparing_table"].includes(row.status))
    .sort((a, b) => Number(b.calledAtMs || b.updatedAtMs || 0) - Number(a.calledAtMs || a.updatedAtMs || 0));
}

function upcoming() {
  return rows
    .filter(row => ["waiting", "deferred"].includes(row.status))
    .sort((a, b) => Number(a.effectiveQueuedAtMs || a.queuedAtMs || 0) - Number(b.effectiveQueuedAtMs || b.queuedAtMs || 0))
    .slice(0, 3);
}

function beep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
    const oscillator = context.createOscillator();
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(1046, context.currentTime + 0.25);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.62);
    oscillator.addEventListener("ended", () => context.close());
  } catch {}
}

function announce(queueNumber) {
  if (!soundEnabled || !queueNumber) return;
  beep();
  if (!("speechSynthesis" in window)) return;
  setTimeout(() => {
    try {
      speechSynthesis.cancel();
      const spoken = String(queueNumber).replace(/^W/i, "ดับเบิลยู ").split("").join(" ");
      const utterance = new SpeechSynthesisUtterance(`ขอเชิญคิว ${spoken} ที่จุดรับโต๊ะ`);
      utterance.lang = "th-TH";
      utterance.rate = 0.85;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    } catch {}
  }, 420);
}

function countdownText(row) {
  const deadline = Number(row?.responseDeadlineAtMs || 0);
  if (!deadline) return "กรุณามาที่จุดรับโต๊ะ";
  const seconds = Math.ceil((deadline - Date.now()) / 1000);
  if (seconds <= 0) return "พ้นเวลาตอบรับ — กรุณาติดต่อพนักงาน";
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `เวลาตอบรับ ${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

function render() {
  const called = activeCalled();
  const primary = called[0] || null;
  els.calledEmpty.hidden = Boolean(primary);
  els.called.hidden = !primary;
  if (primary) {
    els.called.textContent = primary.queueNumber || "-";
    els.calledTimer.textContent = countdownText(primary);
    els.calledTimer.classList.toggle("overdue", Number(primary.responseDeadlineAtMs || 0) > 0 && Number(primary.responseDeadlineAtMs) <= Date.now());
    const signature = `${primary.waitingQueueId}:${primary.calledAtMs || primary.updatedAtMs}`;
    if (signature !== lastCalledSignature) {
      lastCalledSignature = signature;
      announce(primary.queueNumber);
    }
  }
  const nextRows = upcoming();
  els.next.innerHTML = nextRows.length
    ? nextRows.map((row, index) => `<article><span>${index + 1}</span><strong>${String(row.queueNumber || "-")}</strong><small>${Number(row.partySize || 1).toLocaleString("th-TH")} คน</small></article>`).join("")
    : '<div class="waiting-display-next-empty">ยังไม่มีคิวถัดไป</div>';
  els.status.textContent = navigator.onLine ? "เชื่อมต่อระบบเรียกคิวแล้ว" : "ออฟไลน์ — กำลังรอการเชื่อมต่อ";
  els.status.classList.toggle("offline", !navigator.onLine);
  els.sound.innerHTML = `<i class="bi bi-volume-${soundEnabled ? "up" : "mute"}" aria-hidden="true"></i><span>${soundEnabled ? "เสียงเปิด" : "เสียงปิด"}</span>`;
}

function updateClock() {
  els.clock.textContent = new Date().toLocaleString("th-TH", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const primary = activeCalled()[0];
  if (primary) els.calledTimer.textContent = countdownText(primary);
}

function initialize() {
  if (!tenantId) {
    els.calledEmpty.textContent = "ไม่พบ Tenant ของร้าน กรุณาเปิดลิงก์จากหน้าพนักงาน";
    els.status.textContent = "ลิงก์ไม่ถูกต้อง";
    return;
  }
  els.sound.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem("waiting_queue_display_sound", soundEnabled ? "on" : "off");
    if (soundEnabled) beep();
    render();
  });
  els.fullscreen.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  });
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
  unsubscribe = watchPublicQueueBoard(tenantId, nextRows => {
    rows = nextRows;
    render();
  }, error => {
    console.error("[waiting-queue-display] watch failed", error);
    els.status.textContent = "เชื่อมต่อข้อมูลคิวไม่สำเร็จ";
    els.status.classList.add("offline");
  });
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
}

window.addEventListener("beforeunload", () => {
  unsubscribe();
  clearInterval(clockTimer);
}, { once: true });

initialize();
