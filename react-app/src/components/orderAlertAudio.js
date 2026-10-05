const CHIME_NOTES = [
  [659.25, 0.00, 0.36],
  [783.99, 0.24, 0.36],
  [987.77, 0.48, 0.36],
  [783.99, 0.72, 0.48],
];

const FEMALE_THAI_VOICE = /kanya|premwadee|narisa|ploy|thanya|female|ผู้หญิง|google.*ไทย/i;
const MALE_THAI_VOICE = /niwat|male|ผู้ชาย/i;
const delay = ms => new Promise(resolve => window.setTimeout(resolve, ms));

export function orderAlertChannelLabel(order = {}) {
  const type = String(order?.orderType || order?.channel || "").trim().toLowerCase();
  if (type === "delivery") return "เดลิเวอรี่";
  if (type === "takeaway" || type === "take_away") return "เทคอะเวย์";
  if (type === "walkin" || type === "walk-in" || type === "walking") return "วอล์กอิน";
  return "ออเดอร์";
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
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `มียอดสั่งซื้อใหม่ ${orderAlertChannelLabel(order)} ${amount} บาท`;
}

export function chooseThaiFemaleVoice(voices = []) {
  const thai = voices.filter(voice => /^th(?:-|_)/i.test(String(voice?.lang || "")));
  return thai.find(voice => FEMALE_THAI_VOICE.test(String(voice?.name || "")))
    || thai.find(voice => !MALE_THAI_VOICE.test(String(voice?.name || "")))
    || thai[0]
    || null;
}

export function createOrderAlertAudioController() {
  let audioContext = null;
  let cancelled = false;

  const ensureContext = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext || audioContext.state === "closed") audioContext = new AudioContextClass();
    if (audioContext.state === "suspended") {
      try { await audioContext.resume(); } catch {}
    }
    return audioContext;
  };

  const loadVoices = async () => {
    if (!("speechSynthesis" in window)) return [];
    let voices = window.speechSynthesis.getVoices();
    if (voices.length) return voices;

    voices = await new Promise(resolve => {
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
    return voices;
  };

  const arm = async () => {
    cancelled = false;
    const context = await ensureContext();
    void loadVoices();
    return Boolean(context?.state === "running");
  };

  const playChime = async () => {
    const context = await ensureContext();
    if (!context || context.state !== "running") return false;

    const start = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.72, start);
    master.connect(context.destination);

    CHIME_NOTES.forEach(([frequency, offset, duration]) => {
      const at = start + offset;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
    });

    await delay(1320);
    return true;
  };

  const speak = async text => {
    if (!text || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
    const voices = await loadVoices();
    if (cancelled) return false;

    return await new Promise(resolve => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = chooseThaiFemaleVoice(voices);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "th-TH";
      utterance.rate = 0.96;
      utterance.pitch = 1.03;
      utterance.volume = 1;

      let finished = false;
      const done = success => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        resolve(success);
      };
      const timeout = window.setTimeout(() => done(false), 10000);
      utterance.onend = () => done(true);
      utterance.onerror = () => done(false);
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        done(false);
      }
    });
  };

  const announce = async order => {
    cancelled = false;
    const chimePlayed = await playChime();
    if (cancelled) return { chimePlayed, spoken: false };
    const spoken = await speak(orderAlertSpeechText(order));
    return { chimePlayed, spoken };
  };

  const cancel = () => {
    cancelled = true;
    try { window.speechSynthesis?.cancel?.(); } catch {}
  };

  return {
    arm,
    announce,
    playChime,
    cancel,
    state: () => audioContext?.state || "unavailable",
  };
}
