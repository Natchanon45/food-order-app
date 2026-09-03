import { getIntlLocale, getLocale, t } from "./i18n.js?v=20260812-099";

const locale = getLocale();
const intlLocale = getIntlLocale();
const isEnglish = locale === "en";
const PRINT_WINDOW_NAME = "waiting-queue-ticket-print";

function tr(key, replacements = {}) {
  return t(`waiting_queue_print.${key}`, replacements);
}

const exactTextKeys = new Map([
  ["บัตรคิวรอโต๊ะ", "brand"],
  ["โปรดรอเรียกหมายเลขคิวของท่าน", "wait_call"],
  ["จำนวนลูกค้า", "party_size"],
  ["เวลารอประมาณ", "estimate"],
  ["คิวที่เหมาะสมก่อนหน้า", "ahead"],
  ["สแกนเพื่อติดตามสถานะคิว", "instruction"],
  ["บัตรนี้ไม่แสดงชื่อหรือเบอร์โทรของลูกค้า", "privacy"],
  ["โปรดเก็บบัตรนี้ไว้จนกว่าจะได้รับโต๊ะ", "keep_until_seated"],
  ["QR Code ติดตามคิว", "qr_aria"],
]);

const thaiMonthIndexes = new Map([
  ["ม.ค.", 0],
  ["ก.พ.", 1],
  ["มี.ค.", 2],
  ["เม.ย.", 3],
  ["พ.ค.", 4],
  ["มิ.ย.", 5],
  ["ก.ค.", 6],
  ["ส.ค.", 7],
  ["ก.ย.", 8],
  ["ต.ค.", 9],
  ["พ.ย.", 10],
  ["ธ.ค.", 11],
]);

function translateThaiDateTime(value) {
  const match = String(value || "").trim().match(
    /^(\d{1,2})\s+(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s+(\d{4})\s+(\d{1,2}):(\d{2})$/
  );
  if (!match) return null;

  const month = thaiMonthIndexes.get(match[2]);
  if (month === undefined) return null;

  const date = new Date(
    Number(match[3]) - 543,
    month,
    Number(match[1]),
    Number(match[4]),
    Number(match[5]),
  );
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function translateText(value) {
  if (!isEnglish) return value;
  const text = String(value || "");
  const trimmed = text.trim();
  if (!trimmed) return text;

  const exactKey = exactTextKeys.get(trimmed);
  if (exactKey) return text.replace(trimmed, tr(exactKey));

  let match = trimmed.match(/^บัตรคิว\s+(\S+)$/);
  if (match) return text.replace(trimmed, tr("document_title", { queue: match[1] }));

  match = trimmed.match(/^รับคิวเมื่อ\s+(.+)$/);
  if (match) {
    const time = translateThaiDateTime(match[1]) || match[1];
    return text.replace(trimmed, tr("issued_at", { time }));
  }

  match = trimmed.match(/^(\d+)\s+คน$/);
  if (match) return text.replace(trimmed, tr("people", { count: match[1] }));

  match = trimmed.match(/^(\d+)–(\d+)\s+นาที$/);
  if (match) {
    return text.replace(trimmed, tr("wait_range", { min: match[1], max: match[2] }));
  }

  match = trimmed.match(/^(\d+)\s+คิว$/);
  if (match) return text.replace(trimmed, tr("queues", { count: match[1] }));

  const localizedDate = translateThaiDateTime(trimmed);
  if (localizedDate) return text.replace(trimmed, localizedDate);

  return text;
}

function translateNode(node) {
  if (!isEnglish || !node) return;

  if (node.nodeType === 3) {
    const translated = translateText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    return;
  }

  if (node.nodeType !== 1) return;

  ["alt", "title", "aria-label"].forEach(attribute => {
    if (!node.hasAttribute?.(attribute)) return;
    const current = node.getAttribute(attribute);
    const translated = translateText(current);
    if (translated !== current) node.setAttribute(attribute, translated);
  });

  node.childNodes?.forEach(translateNode);
}

function localizePrintDocument(doc) {
  if (!isEnglish || !doc?.documentElement) return;
  doc.documentElement.lang = locale;
  doc.documentElement.dir = "ltr";
  translateNode(doc.documentElement);
}

function installPrintLocaleBridge() {
  if (!isEnglish || typeof window.open !== "function") return;

  const nativeOpen = window.open.bind(window);
  window.open = function localizedWindowOpen(url = "", target = "", features = "") {
    const popup = nativeOpen(url, target, features);
    if (!popup || String(target) !== PRINT_WINDOW_NAME) return popup;

    const patchPrint = () => {
      try {
        const nativePrint = popup.print.bind(popup);
        popup.print = () => {
          localizePrintDocument(popup.document);
          return nativePrint();
        };
      } catch (error) {
        console.warn("[waiting-queue-print-i18n] unable to patch print", error);
      }
    };

    patchPrint();

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (popup.closed || Date.now() - startedAt > 3000) {
        window.clearInterval(timer);
        return;
      }
      try {
        if (!popup.document?.querySelector?.(".ticket")) return;
        localizePrintDocument(popup.document);
        patchPrint();
        window.clearInterval(timer);
      } catch {}
    }, 10);

    return popup;
  };
}

installPrintLocaleBridge();
