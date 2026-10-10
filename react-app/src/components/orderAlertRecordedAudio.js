// Spoken fallback assembled from cached, locally generated Thai WAV segments.
// Use the same already-unlocked AudioContext as the working order chime.
const ROOT = "/assets/audio/order-alert-th";
export const ORDER_ALERT_SEGMENTS = [
  "intro", "delivery", "takeaway", "walkin", "table", "amount", "baht", "satang",
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "yee", "et", "hundred", "thousand", "ten_thousand", "hundred_thousand", "million", "welcome",
];
const DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const PLACE = [null, null, "hundred", "thousand", "ten_thousand", "hundred_thousand"];

function chunkTokens(n) {
  if (!n) return [];
  const tokens = [];
  for (let place = 5; place >= 0; place--) {
    const divisor = 10 ** place;
    const digit = Math.floor(n / divisor) % 10;
    if (!digit) continue;
    if (place === 1) {
      if (digit === 1) tokens.push("ten");
      else if (digit === 2) tokens.push("yee", "ten");
      else tokens.push(DIGITS[digit], "ten");
    } else if (place === 0) {
      tokens.push(digit === 1 && n > 1 ? "et" : DIGITS[digit]);
    } else {
      tokens.push(DIGITS[digit], PLACE[place]);
    }
  }
  return tokens;
}

// Correct Thai baht/satang numbers, including million-level values, instead
// of reading each digit in the amount separately.
export function thaiNumberAudioTokens(value) {
  if (!Number.isSafeInteger(value) || value < 0) return null;
  if (value === 0) return ["zero"];
  let n = value;
  const groups = [];
  while (n > 0) {
    groups.unshift(n % 1000000);
    n = Math.floor(n / 1000000);
  }
  if (groups.length > 3) return null;
  const tokens = [];
  groups.forEach((chunk, index) => {
    if (chunk) tokens.push(...chunkTokens(chunk));
    const millionExponent = groups.length - 1 - index;
    for (let i = 0; i < millionExponent; i++) tokens.push("million");
  });
  return tokens;
}

export function orderAlertAudioTokens(order, amount) {
  const type = String(order?.orderType || order?.channel || "").trim().toLowerCase();
  const channel = type === "delivery" ? "delivery"
    : type === "takeaway" || type === "take_away" ? "takeaway"
      : type === "walkin" || type === "walk-in" || type === "walking" ? "walkin" : "table";
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999) return null;
  const satangValue = Math.round(amount * 100);
  if (!Number.isSafeInteger(satangValue)) return null;
  const baht = Math.floor(satangValue / 100);
  const satang = satangValue % 100;
  const bahtTokens = thaiNumberAudioTokens(baht);
  const satangTokens = satang ? thaiNumberAudioTokens(satang) : [];
  if (!bahtTokens || !satangTokens) return null;
  return ["intro", channel, "amount", ...bahtTokens, "baht", ...satangTokens, ...(satang ? ["satang"] : [])];
}

export function createRecordedOrderAlert() {
  let decoded = new Map();
  let loading = null;
  const activeSources = new Set();
  let generation = 0;

  const preload = context => {
    if (!context?.decodeAudioData) return Promise.resolve(false);
    if (decoded.size === ORDER_ALERT_SEGMENTS.length) return Promise.resolve(true);
    if (loading) return loading;
    loading = Promise.all(ORDER_ALERT_SEGMENTS.map(async key => {
      const response = await fetch(ROOT + "/" + key + ".wav", { cache: "force-cache" });
      if (!response.ok) throw new Error("ORDER_ALERT_CLIP_HTTP_" + response.status + ":" + key);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (!buffer?.duration) throw new Error("ORDER_ALERT_CLIP_EMPTY:" + key);
      return [key, buffer];
    })).then(entries => {
      decoded = new Map(entries);
      return true;
    }).catch(error => {
      console.warn("ORDER_ALERT_RECORDED_LOAD_FAILED", error);
      return false;
    }).finally(() => { loading = null; });
    return loading;
  };

  const stop = () => {
    generation++;
    for (const source of activeSources) {
      try { source.stop(); } catch {}
    }
    activeSources.clear();
  };

  const play = async (context, tokens) => {
    if (!context || context.state !== "running" || !Array.isArray(tokens) || !tokens.length) return false;
    if (!(await preload(context))) return false;
    if (context.state !== "running") return false;
    if (!tokens.every(t => decoded.has(t))) return false;
    const current = generation;
    const master = context.createGain();
    master.gain.value = 0.9;
    master.connect(context.destination);
    let at = context.currentTime + 0.05;
    let last = null;
    try {
      for (const token of tokens) {
        const source = context.createBufferSource();
        source.buffer = decoded.get(token);
        source.connect(master);
        source.onended = () => activeSources.delete(source);
        activeSources.add(source);
        source.start(at);
        at += source.buffer.duration + 0.055;
        last = source;
      }
      if (!last) return false;
      return await new Promise(resolve => {
        const watchdog = window.setTimeout(() => resolve(false), Math.min(60000, Math.max(1000, (at - context.currentTime) * 1000 + 2000)));
        const prior = last.onended;
        last.onended = () => {
          prior?.();
          window.clearTimeout(watchdog);
          resolve(current === generation);
        };
      });
    } catch (error) {
      console.warn("ORDER_ALERT_RECORDED_PLAY_FAILED", error);
      stop();
      return false;
    }
  };

  return {
    preload,
    play,
    stop,
    ready: () => decoded.size === ORDER_ALERT_SEGMENTS.length,
    clipCount: () => decoded.size,
  };
}
