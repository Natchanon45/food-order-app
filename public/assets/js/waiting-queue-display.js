import { watchPublicQueueBoard } from "./waiting-queue-core.js?v=20260802-001";

const params = new URLSearchParams(location.search);
const tenantId = String(params.get("tenantId") || "").trim();
const els = {
  clock: document.querySelector("#waitingDisplayClock"),
  called: document.querySelector("#waitingDisplayCalled"),
  calledWrap: document.querySelector("#waitingDisplayCalledWrap"),
  calledEmpty: document.querySelector("#waitingDisplayCalledEmpty"),
  calledTimer: document.querySelector("#waitingDisplayCalledTimer"),
  next: document.querySelector("#waitingDisplayNext"),
  status: document.querySelector("#waitingDisplayStatus"),
  sound: document.querySelector("#waitingDisplaySound"),
  audioNotice: document.querySelector("#waitingDisplayAudioNotice"),
  audioMode: document.querySelector("#waitingDisplayAudioMode"),
  fullscreen: document.querySelector("#waitingDisplayFullscreen"),
};

let rows = [];
let lastCalledSignature = "";
const savedSoundPreference = localStorage.getItem("waiting_queue_display_sound");
let soundEnabled = savedSoundPreference !== "off";
let soundArmed = soundEnabled;
let audioContext = null;
let thaiVoice = null;
let unsubscribe = () => {};
let clockTimer = null;

if (savedSoundPreference === null) {
  localStorage.setItem("waiting_queue_display_sound", "on");
}

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

function resolveThaiVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices();
  const thaiVoices = voices.filter(voice =>
    String(voice.lang || "").toLowerCase().startsWith("th")
  );
  thaiVoice = thaiVoices.find(voice => voice.localService)
    || thaiVoices[0]
    || null;
  return thaiVoice;
}

function supportsSpeech() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

async function ensureAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContext || audioContext.state === "closed") audioContext = new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
  return audioContext;
}

async function playChime() {
  try {
    const context = await ensureAudioContext();
    if (!context) return false;
    const start = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(784, start);
    oscillator.frequency.setValueAtTime(988, start + 0.22);
    oscillator.frequency.setValueAtTime(1175, start + 0.44);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.74);
    return true;
  } catch {
    return false;
  }
}

function spokenQueueNumber(queueNumber) {
  const raw = String(queueNumber || "").trim().toUpperCase();
  const prefixMatch = raw.match(/^[A-Z]+/);
  const prefix = prefixMatch?.[0] === "W"
    ? "ดับเบิ้ลยู"
    : (prefixMatch?.[0] || "คิว");
  const digitWords = {
    "0": "ศูนย์",
    "1": "หนึ่ง",
    "2": "สอง",
    "3": "สาม",
    "4": "สี่",
    "5": "ห้า",
    "6": "หก",
    "7": "เจ็ด",
    "8": "แปด",
    "9": "เก้า",
  };
  const digits = raw
    .replace(/^[A-Z]+/, "")
    .replace(/\D/g, "")
    .split("")
    .map(digit => digitWords[digit] || digit)
    .join(" ");
  return [prefix, digits].filter(Boolean).join(" ");
}

function speakText(text) {
  if (!supportsSpeech()) return false;
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.rate = 0.74;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (resolveThaiVoice()) utterance.voice = thaiVoice;
    speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

async function announce(queueNumber) {
  if (!soundEnabled || !soundArmed) return;
  await playChime();
  window.setTimeout(() => {
    if (!soundEnabled || !soundArmed) return;
    const message =
      `ขอเชิญคิว, ${spokenQueueNumber(queueNumber)}, กรุณามาที่จุดรับโต๊ะค่ะ`;
    speakText(message);
  }, 680);
}

function audioCapabilityText() {
  if (!soundArmed || !soundEnabled) return "เสียงยังไม่เปิด";
  return supportsSpeech() ? "เสียงเตือน + อ่านหมายเลขคิว" : "เสียงเตือนเท่านั้น";
}

function renderAudioState() {
  const ready = soundArmed && soundEnabled;
  const speech = supportsSpeech();
  els.sound.classList.toggle("is-armed", ready && speech);
  els.sound.classList.toggle("is-fallback", ready && !speech);
  els.audioNotice.classList.toggle("is-ready", ready);
  els.audioMode.classList.toggle("is-ready", ready && speech);
  els.audioMode.classList.toggle("is-fallback", ready && !speech);
  els.audioMode.textContent = audioCapabilityText();

  if (!ready) {
    els.sound.innerHTML = '<i class="bi bi-volume-mute" aria-hidden="true"></i><span>เปิดเสียงเรียก</span>';
    els.audioNotice.innerHTML = '<i class="bi bi-volume-up" aria-hidden="true"></i><span>กด “เปิดเสียงเรียก” หนึ่งครั้งก่อนใช้งาน ระบบจะเล่นเสียงเตือนและอ่านหมายเลขคิว</span>';
    return;
  }

  els.sound.innerHTML = '<i class="bi bi-volume-up" aria-hidden="true"></i><span>ปิดเสียงเรียก</span>';
  els.audioNotice.innerHTML = supportsSpeech()
    ? '<i class="bi bi-check-circle" aria-hidden="true"></i><span>เสียงพร้อมใช้งาน: เล่นเสียงเตือน แล้วอ่านหมายเลขคิวเป็นภาษาไทย</span>'
    : '<i class="bi bi-exclamation-circle" aria-hidden="true"></i><span>เบราว์เซอร์นี้ไม่รองรับเสียงพูด ระบบจะเล่นเสียงเตือนเท่านั้น</span>';
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
  els.calledWrap.hidden = !primary;

  if (primary) {
    els.called.textContent = primary.queueNumber || "-";
    els.calledTimer.textContent = countdownText(primary);
    els.calledTimer.classList.toggle("overdue", Number(primary.responseDeadlineAtMs || 0) > 0 && Number(primary.responseDeadlineAtMs) <= Date.now());
    const signature = `${primary.waitingQueueId}:${primary.calledAtMs || primary.updatedAtMs}`;
    if (signature !== lastCalledSignature) {
      lastCalledSignature = signature;
      announce(primary.queueNumber);
    }
  } else {
    lastCalledSignature = "";
  }

  const nextRows = upcoming();
  els.next.innerHTML = nextRows.length
    ? nextRows.map((row, index) => `<article><span>${index + 1}</span><strong>${String(row.queueNumber || "-")}</strong><small>${Number(row.partySize || 1).toLocaleString("th-TH")} คน</small></article>`).join("")
    : '<div class="waiting-display-next-empty">ยังไม่มีคิวรอเรียก</div>';

  els.status.textContent = navigator.onLine ? "เชื่อมต่อระบบเรียกคิวแล้ว" : "ออฟไลน์ — กำลังรอการเชื่อมต่อ";
  els.status.classList.toggle("offline", !navigator.onLine);
  renderAudioState();
}

function updateClock() {
  els.clock.textContent = new Date().toLocaleString("th-TH", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const primary = activeCalled()[0];
  if (primary) {
    els.calledTimer.textContent = countdownText(primary);
    els.calledTimer.classList.toggle("overdue", Number(primary.responseDeadlineAtMs || 0) > 0 && Number(primary.responseDeadlineAtMs) <= Date.now());
  }
}

async function toggleSound() {
  if (!soundArmed || !soundEnabled) {
    soundEnabled = true;
    soundArmed = true;
    localStorage.setItem("waiting_queue_display_sound", "on");
    await ensureAudioContext();
    renderAudioState();
    const currentQueue = activeCalled()[0];
    if (currentQueue) await announce(currentQueue.queueNumber);
    else await playChime();
    return;
  }

  soundEnabled = false;
  localStorage.setItem("waiting_queue_display_sound", "off");
  try { speechSynthesis.cancel(); } catch {}
  renderAudioState();
}

async function unlockDefaultSound() {
  if (!soundEnabled) return;
  soundArmed = true;
  try { await ensureAudioContext(); } catch {}
  renderAudioState();
}

function initialize() {
  resolveThaiVoice();
  if ("speechSynthesis" in window) speechSynthesis.addEventListener?.("voiceschanged", resolveThaiVoice);

  if (!tenantId) {
    els.calledEmpty.innerHTML = '<span class="waiting-display-empty-icon" aria-hidden="true"><i class="bi bi-link-45deg"></i></span><strong>ลิงก์จอเรียกคิวไม่ครบ</strong><span>กรุณาเปิดจอจากหน้าพนักงานอีกครั้ง</span>';
    els.status.textContent = "ไม่พบ Tenant ของร้าน";
    els.status.classList.add("offline");
    renderAudioState();
    return;
  }

  els.sound.addEventListener("click", toggleSound);
  window.addEventListener("pointerdown", unlockDefaultSound, { once: true, passive: true });
  window.addEventListener("keydown", unlockDefaultSound, { once: true });
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
  renderAudioState();
  clockTimer = setInterval(updateClock, 1000);
}

window.addEventListener("beforeunload", () => {
  unsubscribe();
  clearInterval(clockTimer);
  try { speechSynthesis.cancel(); } catch {}
  try { audioContext?.close(); } catch {}
}, { once: true });

initialize();
