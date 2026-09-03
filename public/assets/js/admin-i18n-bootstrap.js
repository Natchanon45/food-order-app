import translations from "./admin-translations.js?v=20260903-203";
import { configureI18n, getLocale, t } from "./i18n.js?v=20260903-202";

configureI18n(translations);
document.documentElement.lang = getLocale();
document.title = t("admin.meta.title");

function flatten(source, prefix = "", result = {}) {
  Object.entries(source || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, path, result);
    else if (typeof value === "string") result[path] = value;
  });
  return result;
}

const thai = flatten(translations.th || {});
const english = flatten(translations.en || {});
const locale = getLocale();
const textMap = new Map();

if (locale === "en") {
  const candidates = new Map();
  Object.entries(thai).forEach(([key, value]) => {
    const translated = english[key];
    if (!translated || value.includes(":")) return;
    const label = value.trim();
    if (!candidates.has(label)) candidates.set(label, new Set());
    candidates.get(label).add(translated);
  });
  candidates.forEach((values, label) => {
    if (values.size === 1) textMap.set(label, [...values][0]);
  });
}

const manual = locale === "en" ? new Map([
  ["ตำแหน่งร้าน", "Store location"],
  ["ใช้เป็นจุดเริ่มต้นสำหรับคำนวณระยะทาง Delivery", "Used as the starting point for Delivery distance calculations"],
  ["ใช้ตำแหน่งปัจจุบัน", "Use current location"],
  ["ยังไม่ได้กำหนดตำแหน่งร้าน", "Store location has not been set"],
]) : new Map();

function translateTextNode(node) {
  const raw = node.nodeValue || "";
  const value = raw.trim();
  if (!value) return;
  const next = textMap.get(value) || manual.get(value);
  if (!next) return;
  node.nodeValue = raw.replace(value, next);
}

function translateAttributes(root = document) {
  root.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach(node => {
    for (const name of ["placeholder", "title", "aria-label", "alt"]) {
      if (!node.hasAttribute(name)) continue;
      const value = node.getAttribute(name)?.trim() || "";
      const next = textMap.get(value) || manual.get(value);
      if (next) node.setAttribute(name, next);
    }
  });
}

if (locale === "en") {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest("script,style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) translateTextNode(walker.currentNode);
  translateAttributes();
}
