import { getIntlLocale, getLocale, t } from "./i18n.js?v=20260903-202";
import { watchPublicQueueBoard } from "./waiting-queue-core.js?v=20260903-229";

const params = new URLSearchParams(location.search);
const tenantId = String(params.get("tenantId") || "").trim();
const locale = getLocale();
const intlLocale = getIntlLocale();
const RECORDED_VOICE_BASES = Object.freeze({
  th: "/assets/audio/waiting-queue-th",
  en: "/assets/audio/waiting-queue-en",
});
const RECORDED_AUDIO_VERSION = "20260813-145";
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
// Browsers require a user gesture before AudioContext can play. Keep the saved
// preference enabled, but only mark audio as armed after that gesture succeeds.
let soundArmed = false;
let audioContext = null;
let activeRecordedSource = null;
let recordedAudioElement = null;
let recordedAnnouncementId = 0;
let recordedVoiceAvailable = Boolean(RECORDED_VOICE_BASES[locale]);
const recordedBufferCache = new Map();
let unsubscribe = () => {};
let clockTimer = null;

if (savedSoundPreference === null) {
  localStorage.setItem("waiting_queue_display_sound", "on");
}

function tr(key, replacements = {}) {
  return t(`waiting_queue_display.${key}`, replacements);
}

function applyStaticTranslations(root = document) {
  document.documentElement.lang = locale;
  root.querySelectorAll?.("[data-wqd-i18n]").forEach(node => {
    node.textContent = tr(node.dataset.wqdI18n);
  });
  root.querySelectorAll?.("[data-wqd-aria]").forEach(node => {
    node.setAttribute("aria-label", tr(node.dataset.wqdAria));
  });
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

function supportsLocalizedVoice() {
  return recordedVoiceAvailable && Boolean(RECORDED_VOICE_BASES[locale]);
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
    if (!context || context.state !== "running") throw new Error("AUDIO_CONTEXT_NOT_RUNNING");
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
    try {
      recordedAudioElement ||= new Audio();
      const audio = recordedAudioElement;
      audio.pause();
      audio.src = `${src}?v=${RECORDED_AUDIO_VERSION}`;
      audio.currentTime = 0;
      audio.volume = 1;
      await audio.play();
      return await new Promise(resolve => {
        const finish = success => {
          audio.onended = null;
          audio.onerror = null;
          resolve(success);
        };
        audio.onended = () => finish(announcementId === recordedAnnouncementId);
        audio.onerror = () => finish(false);
      });
    } catch (fallbackError) {
      console.warn("[waiting-queue-display] audio element fallback failed", src, fallbackError);
      return false;
    }
  }
}

async function playRecordedAnnouncement(queueNumber) {
  const base = RECORDED_VOICE_BASES[locale];
  if (!base || !recordedVoiceAvailable) return false;
  const digits = String(queueNumber || "").replace(/\D/g, "").split("");
  if (!digits.length) return false;
  const announcementId = ++recordedAnnouncementId;
  if (activeRecordedSource) {
    try { activeRecordedSource.stop(); } catch {}
    activeRecordedSource = null;
  }
  const files = [
    `${base}/intro.wav`,
    ...digits.map(digit => `${base}/${digit}.wav`),
    `${base}/outro.wav`,
  ];
  for (const file of files) {
    if (!await playAudioFile(file, announcementId)) {
      if (announcementId === recordedAnnouncementId) {
        recordedVoiceAvailable = false;
        renderAudioState();
      }
      return false;
    }
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

async function announce(queueNumber) {
  if (!soundEnabled || !soundArmed) return;
  await playChime();
  window.setTimeout(async () => {
    if (!soundEnabled || !soundArmed) return;
    await playRecordedAnnouncement(queueNumber);
  }, 1320);
}

function audioCapabilityText() {
  if (!soundArmed || !soundEnabled) return tr("audio.off");
  return supportsLocalizedVoice() ? tr("audio.mode_voice") : tr("audio.mode_chime");
}

function renderAudioState() {
  const ready = soundArmed && soundEnabled;
  const voiceAvailable = supportsLocalizedVoice();
  els.sound.classList.toggle("is-armed", ready && voiceAvailable);
  els.sound.classList.toggle("is-fallback", ready && !voiceAvailable);
  els.audioNotice.classList.toggle("is-ready", ready);
  els.audioMode.classList.toggle("is-ready", ready && voiceAvailable);
  els.audioMode.classList.toggle("is-fallback", ready && !voiceAvailable);
  els.audioMode.textContent = audioCapabilityText();

  if (!ready) {
    els.sound.setAttribute("aria-label", tr("controls.sound_on_aria"));
    els.sound.innerHTML = `<i class="bi bi-volume-mute" aria-hidden="true"></i><span>${tr("controls.sound_on")}</span>`;
    els.audioNotice.innerHTML = `<i class="bi bi-volume-up" aria-hidden="true"></i><span>${tr("audio.prompt")}</span>`;
    return;
  }

  els.sound.setAttribute("aria-label", tr("controls.sound_off_aria"));
  els.sound.innerHTML = `<i class="bi bi-volume-up" aria-hidden="true"></i><span>${tr("controls.sound_off")}</span>`;
  const readyMessage = voiceAvailable
    ? tr("audio.ready_recorded")
    : tr("audio.ready_chime");
  els.audioNotice.innerHTML = `<i class="bi bi-check-circle" aria-hidden="true"></i><span>${readyMessage}</span>`;
}

function countdownText(row) {
  const deadline = Number(row?.responseDeadlineAtMs || 0);
  if (!deadline) return tr("called.instruction");
  const seconds = Math.ceil((deadline - Date.now()) / 1000);
  if (seconds <= 0) return tr("called.overdue");
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return tr("called.countdown", {
    time: `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`,
  });
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
    ? nextRows.map((row, index) => `<article><span>${index + 1}</span><strong>${String(row.queueNumber || "-")}</strong><small>${tr("next.party", { count: Number(row.partySize || 1).toLocaleString(intlLocale) })}</small></article>`).join("")
    : `<div class="waiting-display-next-empty">${tr("next.empty")}</div>`;

  els.status.textContent = navigator.onLine ? tr("status.online") : tr("status.offline");
  els.status.classList.toggle("offline", !navigator.onLine);
  renderAudioState();
}

function updateClock() {
  els.clock.textContent = new Date().toLocaleString(intlLocale, {
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
    try { await ensureAudioContext(); } catch {}
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
  try {
    recordedAudioElement?.pause();
    if (recordedAudioElement) recordedAudioElement.currentTime = 0;
  } catch {}
  renderAudioState();
}

async function unlockDefaultSound(event) {
  if (!soundEnabled) return;
  if (event?.target?.closest?.("#waitingDisplaySound")) return;
  soundArmed = true;
  try {
    const context = await ensureAudioContext();
    if (context && context.state !== "running") soundArmed = false;
  } catch {
    soundArmed = false;
  }
  renderAudioState();
  if (!soundArmed) return;
  const currentQueue = activeCalled()[0];
  if (currentQueue) await announce(currentQueue.queueNumber);
  else await playChime();
}

function initialize() {
  applyStaticTranslations();

  if (!tenantId) {
    els.calledEmpty.innerHTML = `<span class="waiting-display-empty-icon" aria-hidden="true"><i class="bi bi-link-45deg"></i></span><strong>${tr("errors.missing_link_title")}</strong><span>${tr("errors.missing_link_description")}</span>`;
    els.status.textContent = tr("errors.missing_tenant");
    els.status.classList.add("offline");
    renderAudioState();
    updateClock();
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
    els.status.textContent = tr("errors.connection_failed");
    els.status.classList.add("offline");
  });

  updateClock();
  renderAudioState();
  clockTimer = setInterval(updateClock, 1000);
}

window.addEventListener("beforeunload", () => {
  unsubscribe();
  clearInterval(clockTimer);
  recordedAnnouncementId += 1;
  try { activeRecordedSource?.stop(); } catch {}
  activeRecordedSource = null;
  try { recordedAudioElement?.pause(); } catch {}
  recordedAudioElement = null;
  try { audioContext?.close(); } catch {}
}, { once: true });

initialize();
