import { createRecordedOrderAlert, orderAlertAudioTokens } from "./orderAlertRecordedAudio.js";

const CHIME_NOTES = [[659.25, 0, .36], [783.99, .24, .36], [987.77, .48, .36], [783.99, .72, .48]];
const FEMALE_THAI_VOICE = /kanya|กันยา|premwadee|เปรมวดี|narisa|นริศา|ploy|พลอย|thanya|ธัญญา|female|ผู้หญิง|google.*ไทย/i;
const MALE_THAI_VOICE = /niwat|นิวัฒน์|male|ผู้ชาย/i;
const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));

export function orderAlertChannelLabel(order = {}) {
  const type = String(order?.orderType || order?.channel || "").trim().toLowerCase();
  if (type === "delivery") return "จัดส่งเดลิเวอรี่";
  if (type === "takeaway" || type === "take_away") return "สั่งกลับบ้าน";
  if (type === "walkin" || type === "walk-in" || type === "walking") return "สั่งที่หน้าร้าน";
  return "สั่งที่โต๊ะ";
}
export function orderAlertAmount(order = {}) {
  for (const value of [order?.totalAmount, order?.total, order?.netTotal]) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  const subtotal = Number(order?.subtotalAmount ?? order?.subtotal);
  if (Number.isFinite(subtotal) && subtotal >= 0) {
    const deliveryFee = Math.max(0, Number(order?.deliveryFee || 0) || 0);
    const discount = Math.max(0, Number(order?.discountAmount ?? order?.discount ?? 0) || 0);
    return Math.max(0, subtotal + deliveryFee - discount);
  }
  const itemsTotal = (Array.isArray(order?.items) ? order.items : [])
    .filter(item => !item?.cancelled)
    .reduce((sum, item) => sum + (Number(item?.qty || 0) * Number(item?.price || 0)), 0);
  return Math.max(0, itemsTotal + Math.max(0, Number(order?.deliveryFee || 0) || 0));
}
export function orderAlertSpeechText(order = {}) {
  const amount = orderAlertAmount(order).toLocaleString("th-TH", {
    useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 2,
  });
  return "มีรายการสั่งซื้อใหม่ " + orderAlertChannelLabel(order) + " ยอด " + amount + " บาท";
}
export function chooseThaiFemaleVoice(voices = []) {
  const thai = voices.filter(voice => /^th(?:-|_)/i.test(String(voice?.lang || "")));
  // OS/browser voices have no gender field. Use only positively identified
  // female voices: silently taking an unknown Thai voice could select a man.
  return thai.find(voice => FEMALE_THAI_VOICE.test(String(voice?.name || ""))
    && !MALE_THAI_VOICE.test(String(voice?.name || ""))) || null;
}
export function isIOSSpeechBrowser(navigatorLike = typeof navigator === "undefined" ? null : navigator) {
  const ua = String(navigatorLike?.userAgent || "");
  return /iPad|iPhone|iPod/i.test(ua)
    || (/Macintosh/i.test(ua) && Number(navigatorLike?.maxTouchPoints || 0) > 1);
}

export function createOrderAlertAudioController() {
  const recorded = createRecordedOrderAlert();
  const listeners = new Set();
  let audioContext = null;
  let cancelled = false;
  let generation = 0;
  let webSpeechStarted = false;
  let speechIssue = "";
  let mode = "checking";
  let priming = null;
  let primingInProgress = false;

  const voiceState = () => {
    const chimeReady = audioContext?.state === "running";
    return {
      chimeReady,
      speechReady: Boolean(chimeReady && (webSpeechStarted || recorded.ready())),
      mode: !chimeReady ? "locked" : mode === "web" && webSpeechStarted ? "web"
        : recorded.ready() ? "recorded" : "checking",
      error: speechIssue,
    };
  };
  const report = () => { for (const fn of listeners) { try { fn(voiceState()); } catch {} } };
  const ensureContext = async () => {
    const Class = window.AudioContext || window.webkitAudioContext;
    if (!Class) { report(); return null; }
    if (!audioContext || audioContext.state === "closed") audioContext = new Class();
    if (audioContext.state === "suspended") {
      try { await audioContext.resume(); } catch { speechIssue = "audio-resume-failed"; }
    }
    report();
    return audioContext;
  };
  const prepareRecorded = async () => {
    try {
      const context = await ensureContext();
      if (!context) return false;
      const ok = await recorded.preload(context);
      if (!ok) speechIssue = "recorded-voice-unavailable";
      report();
      return ok;
    } catch {
      speechIssue = "recorded-voice-unavailable";
      report();
      return false;
    }
  };
  const loadVoices = async () => {
    if (!window.speechSynthesis?.getVoices) return [];
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) return voices;
    return new Promise(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        window.speechSynthesis.removeEventListener?.("voiceschanged", done);
        resolve(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.addEventListener?.("voiceschanged", done, { once: true });
      window.setTimeout(done, 900);
    });
  };

  // Must execute synchronously in a direct user event to unlock Web Speech on iOS.
  const primeWebSpeech = () => {
    if (primingInProgress) return priming;
    if (!window.speechSynthesis?.speak || !window.SpeechSynthesisUtterance) {
      speechIssue = "speech-api-unavailable";
      report();
      return Promise.resolve(false);
    }
    primingInProgress = true;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const thai = chooseThaiFemaleVoice(voices);
    if (!thai) {
      speechIssue = "thai-female-voice-unavailable";
      report();
      return Promise.resolve(false);
    }
    // Prime silently on a real staff gesture. Never play a test sentence and
    // never allow the system-default male voice to be selected implicitly.
    const utterance = new window.SpeechSynthesisUtterance("พร้อม");
    utterance.voice = thai;
    utterance.lang = "th-TH";
    utterance.rate = .96;
    utterance.volume = 0;
    priming = new Promise(resolve => {
      let complete = false;
      const done = ok => {
        if (complete) return;
        complete = true;
        window.clearTimeout(timer);
        primingInProgress = false;
        if (ok) { webSpeechStarted = true; mode = "web"; speechIssue = ""; }
        else { speechIssue = "speech-gesture-blocked"; mode = "checking"; }
        report();
        resolve(ok);
      };
      const timer = window.setTimeout(() => done(false), 8000);
      utterance.onstart = () => { webSpeechStarted = true; mode = "web"; report(); };
      utterance.onend = () => done(true);
      utterance.onerror = event => { speechIssue = "speech-" + (event?.error || "failed"); done(false); };
      try { window.speechSynthesis.speak(utterance); } catch { done(false); }
    });
    return priming;
  };
  const arm = async ({ speechGesture = false } = {}) => {
    cancelled = false;
    // Prime on an actual gesture before any asynchronous work, including when
    // the chime AudioContext was already unlocked earlier.
    if (speechGesture && !webSpeechStarted) void primeWebSpeech();
    else if (!speechGesture) void loadVoices(); // preload Chrome voice inventory
    const ctx = await ensureContext();
    void prepareRecorded();
    return ctx?.state === "running";
  };
  const playChime = async () => {
    const context = await ensureContext();
    if (!context || context.state !== "running") return false;
    const start = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(.72, start);
    master.connect(context.destination);
    for (const [frequency, offset, duration] of CHIME_NOTES) {
      const at = start + offset;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(.18, at + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(at);
      oscillator.stop(at + duration + .02);
    }
    await delay(1320);
    return true;
  };
  const speakWeb = async text => {
    if (!text || !window.speechSynthesis?.speak || !window.SpeechSynthesisUtterance) return false;
    const voices = await loadVoices();
    if (cancelled) return false;
    const voice = chooseThaiFemaleVoice(voices);
    if (!voice) {
      speechIssue = "thai-female-voice-unavailable";
      report();
      return false;
    }
    return new Promise(resolve => {
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = "th-TH";
      utterance.rate = .96;
      utterance.pitch = 1.03;
      utterance.volume = 1;
      let finished = false;
      const done = success => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        if (!success) {
          speechIssue = "speech-synthesis-failed";
          try { window.speechSynthesis.cancel(); } catch {}
        }
        report();
        resolve(success);
      };
      // 6.5 seconds incorrectly cancelled many complete Thai announcements,
      // leading to an eSpeak replay even when the female native voice worked.
      const maxSpeechMs = Math.min(30000, Math.max(15000, 2500 + text.length * 420));
      const timeout = window.setTimeout(() => done(false), maxSpeechMs);
      utterance.onstart = () => { webSpeechStarted = true; mode = "web"; speechIssue = ""; report(); };
      utterance.onend = () => done(true);
      utterance.onerror = event => { speechIssue = "speech-" + (event?.error || "failed"); done(false); };
      try { window.speechSynthesis.speak(utterance); } catch { done(false); }
    });
  };
  const speakRecorded = async (order = null) => {
    const context = await ensureContext();
    const tokens = order ? orderAlertAudioTokens(order, orderAlertAmount(order)) : ["welcome"];
    if (!tokens) { speechIssue = "speech-amount-out-of-range"; report(); return false; }
    const ok = await recorded.play(context, tokens);
    if (ok) { mode = "recorded"; speechIssue = ""; }
    else speechIssue = "recorded-playback-failed";
    report();
    return ok;
  };
  const announce = async order => {
    const serial = ++generation;
    cancelled = false;
    const chimePlayed = await playChime();
    if (cancelled || serial !== generation) return { chimePlayed, spoken: false };
    // Use the reliable, unlocked Web Audio fallback first on iOS until TTS has
    // started successfully during a real tap. Keep Web Speech on macOS.
    if (!isIOSSpeechBrowser() || webSpeechStarted) {
      const ok = await speakWeb(orderAlertSpeechText(order));
      if (ok) return { chimePlayed, spoken: true, mode: "web" };
    }
    if (cancelled || serial !== generation) return { chimePlayed, spoken: false };
    const spoken = await speakRecorded(order);
    return { chimePlayed, spoken, mode: spoken ? "recorded" : "unavailable" };
  };
  const cancel = () => {
    cancelled = true;
    generation++;
    recorded.stop();
    try { window.speechSynthesis?.cancel?.(); } catch {}
  };
  return {
    arm, announce, playChime, cancel,
    subscribe: fn => { listeners.add(fn); fn(voiceState()); return () => listeners.delete(fn); },
    voiceState,
    state: () => audioContext?.state || "unavailable",
  };
}
