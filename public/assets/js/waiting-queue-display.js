import { watchPublicQueueBoard } from "./waiting-queue-core.js?v=20260802-016";

const params = new URLSearchParams(location.search);
const tenantId = String(params.get("tenantId") || "").trim();
const RECORDED_VOICE_BASE = "/assets/audio/waiting-queue-th";
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
let activeUtterance = null;
let speechRequestId = 0;
let activeRecordedSource = null;
let recordedAnnouncementId = 0;
const recordedBufferCache = new Map();
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
    || voices.find(voice => voice.localService && /^en-/i.test(String(voice.lang || "")))
    || voices.find(voice => voice.localService)
    || voices[0]
    || null;
  return thaiVoice;
}

function supportsSpeech() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

async function recordedBuffer(src, context) {
  if (!recordedBufferCache.has(src)) {
    recordedBufferCache.set(src, (async () => {
      const response = await fetch(src, { cache: "force-cache" });
      if (!response.ok) throw new Error(`RECORDED_AUDIO_HTTP_${response.status}`);
      return context.decodeAudioData(await response.arrayBuffer());
    })());
  }
  return recordedBufferCache.get(src);
}

async function playAudioFile(src, announcementId) {
  if (announcementId !== recordedAnnouncementId || !soundEnabled || !soundArmed) return false;
  try {
    const context = await ensureAudioContext();
    if (!context || context.state !== "running") return false;
    const buffer = await recordedBuffer(src, context);
    if (announcementId !== recordedAnnouncementId || !soundEnabled || !soundArmed) return false;
    return await new Promise(resolve => {
      const source = context.createBufferSource();
      activeRecordedSource = source;
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        if (activeRecordedSource === source) activeRecordedSource = null;
        resolve(true);
      };
      source.start();
    });
  } catch (error) {
    console.warn("[waiting-queue-display] recorded voice failed", src, error);
    return false;
  }
}

async function playRecordedAnnouncement(queueNumber) {
  const digits = String(queueNumber || "").replace(/\D/g, "").split("");
  if (!digits.length) return false;
  const announcementId = ++recordedAnnouncementId;
  if (activeRecordedSource) {
    try { activeRecordedSource.stop(); } catch {}
    activeRecordedSource = null;
  }
  const files = [
    `${RECORDED_VOICE_BASE}/intro.m4a`,
    ...digits.map(digit => `${RECORDED_VOICE_BASE}/${digit}.m4a`),
    `${RECORDED_VOICE_BASE}/outro.m4a`,
  ];
  for (const file of files) {
    if (!await playAudioFile(file, announcementId)) return false;
  }
  return true;
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
    const master = context.createGain();
    master.gain.setValueAtTime(0.72, start);
    master.connect(context.destination);

    // A calm four-note service chime suitable for a mall or bank announcement.
    [659.25, 783.99, 987.77, 783.99].forEach((frequency, index) => {
      const noteStart = start + (index * 0.24);
      const duration = index === 3 ? 0.48 : 0.36;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + duration + 0.02);
    });
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
    const requestId = ++speechRequestId;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.rate = 0.78;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (resolveThaiVoice()) utterance.voice = thaiVoice;
    activeUtterance = utterance;
    const release = () => {
      if (requestId === speechRequestId) activeUtterance = null;
    };
    utterance.onend = release;
    utterance.onerror = release;
    window.setTimeout(() => {
      if (requestId !== speechRequestId || !soundEnabled || !soundArmed) return;
      try {
        speechSynthesis.resume();
        speechSynthesis.speak(utterance);
      } catch {
        release();
      }
    }, 120);
    return true;
  } catch {
    activeUtterance = null;
    return false;
  }
}

async function announce(queueNumber) {
  if (!soundEnabled || !soundArmed) return;
  await playChime();
  window.setTimeout(async () => {
    if (!soundEnabled || !soundArmed) return;
    const recorded = await playRecordedAnnouncement(queueNumber);
    if (!recorded && soundEnabled && soundArmed) {
      const message =
        `ขอเชิญคิว, ${spokenQueueNumber(queueNumber)}, กรุณามาที่จุดรับโต๊ะค่ะ`;
      speakText(message);
    }
  }, 1320);
}

function audioCapabilityText() {
  if (!soundArmed || !soundEnabled) return "เสียงยังไม่เปิด";
  return "เสียงเตือน + อ่านหมายเลขคิว";
}

function renderAudioState() {
  const ready = soundArmed && soundEnabled;
  const speech = true;
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
  els.audioNotice.innerHTML = '<i class="bi bi-check-circle" aria-hidden="true"></i><span>เสียงพร้อมใช้งาน: เล่นเสียงเตือน แล้วอ่านหมายเลขคิวด้วยเสียงบันทึกภาษาไทย</span>';
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
    const signature = `${primary.waitingQueueId}:${primary.calledAtMs || primary.updatedAtMs}:${primary.recallSignalAtMs || 0}`;
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
  recordedAnnouncementId += 1;
  if (activeRecordedSource) {
    try { activeRecordedSource.stop(); } catch {}
    activeRecordedSource = null;
  }
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
  activeUtterance = null;
  recordedAnnouncementId += 1;
  try { activeRecordedSource?.stop(); } catch {}
  activeRecordedSource = null;
  try { audioContext?.close(); } catch {}
}, { once: true });

initialize();
