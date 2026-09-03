import translations from "./retail-pos-translations.js?v=20260903-253";
import { configureI18n, getIntlLocale, getLocale, setLocale } from "./i18n.js?v=20260903-202";

configureI18n(translations, { fallbackLocale: "th" });

const locale = getLocale();
const intlLocale = getIntlLocale();
const fallbackMessages = translations.th || {};
const messages = translations[locale] || fallbackMessages;

globalThis.APP_I18N = {
  locale,
  fallbackLocale: "th",
  fallbackMessages,
  messages,
};

document.documentElement.lang = locale;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function flattenPairs(source, target, exact, templates) {
  for (const [key, value] of Object.entries(source || {})) {
    const translated = target?.[key];
    if (value && typeof value === "object") {
      flattenPairs(value, translated, exact, templates);
      continue;
    }
    if (typeof value !== "string" || typeof translated !== "string" || !value.trim()) continue;
    const markers = [...value.matchAll(/:([A-Za-z0-9_]+)/g)];
    if (!markers.length) {
      if (!exact.has(value.trim())) exact.set(value.trim(), translated);
      continue;
    }
    let cursor = 0;
    let pattern = "^";
    const names = [];
    for (const marker of markers) {
      pattern += escapeRegExp(value.slice(cursor, marker.index)) + "(.+?)";
      names.push(marker[1]);
      cursor = marker.index + marker[0].length;
    }
    pattern += escapeRegExp(value.slice(cursor)) + "$";
    templates.push({ pattern: new RegExp(pattern), names, translated });
  }
}

const legacyExact = new Map([
  ["ระบบจะนำเข้าสินค้าที่ผ่านการตรวจสอบ", "The system will import"],
  ["รายการ โดยตั้งสต็อกเป็น 0 และยังไม่แสดงบนหน้าขาย", "verified items with stock set to 0 and hidden from the sales screen."],
  ["ระบบจะจำข้อมูลนี้ไว้กับลูกค้า/บิล เพื่อใช้ซ้ำครั้งถัดไป", "These details will be saved with the customer/receipt for reuse next time."],
  ["กด DBD เพื่อค้นหาข้อมูลนิติบุคคลจาก DBD DataWarehouse+", "Select DBD to look up company information from DBD DataWarehouse+."],
  ["ผู้ใช้งานปัจจุบัน", "Current user"],
]);

const exact = new Map(legacyExact);
const templates = [];
for (const namespace of Object.keys(fallbackMessages)) {
  flattenPairs(fallbackMessages[namespace], messages?.[namespace], exact, templates);
}

function localizedDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?(?:\s*น\.)?$/);
  if (!match) return null;
  const rawYear = Number(match[3]);
  const year = rawYear > 2400 ? rawYear - 543 : rawYear;
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(intlLocale, match[4] ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function interpolateTemplate(entry, match) {
  let output = entry.translated;
  entry.names.forEach((name, index) => {
    let replacement = match[index + 1];
    if (/date|time/i.test(name)) replacement = localizedDate(replacement) || replacement;
    output = output.replaceAll(`:${name}`, replacement);
  });
  return output;
}

function translateTrimmed(trimmed) {
  if (locale !== "en" || !trimmed) return trimmed;
  if (exact.has(trimmed)) return exact.get(trimmed);
  for (const entry of templates) {
    const match = trimmed.match(entry.pattern);
    if (match) return interpolateTemplate(entry, match);
  }
  return localizedDate(trimmed) || trimmed;
}

function translateValue(value) {
  if (locale !== "en") return value;
  const source = String(value ?? "");
  const trimmed = source.trim();
  if (!trimmed) return source;
  const translated = translateTrimmed(trimmed);
  if (translated === trimmed) return source;
  const left = source.match(/^\s*/)?.[0] || "";
  const right = source.match(/\s*$/)?.[0] || "";
  return `${left}${translated}${right}`;
}

const protectedSelectors = [
  "script", "style", "textarea", "[contenteditable='true']",
  ".product-card h3", ".product-name", ".customer-card-head h3",
  ".customer-contact", ".supplier-name", ".sale-customer",
];

function isProtected(element) {
  return !!element?.closest?.(protectedSelectors.join(","));
}

function translateElementAttributes(element) {
  if (locale !== "en" || !element) return;
  ["placeholder", "title", "aria-label", "alt"].forEach(attribute => {
    if (!element.hasAttribute?.(attribute)) return;
    const current = element.getAttribute(attribute);
    const translated = translateValue(current);
    if (translated !== current) element.setAttribute(attribute, translated);
  });
}

function translateNode(node) {
  if (locale !== "en" || !node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    if (isProtected(node.parentElement)) return;
    const translated = translateValue(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  translateElementAttributes(node);
  if (node.matches?.("script,style,textarea,[contenteditable='true']")) return;
  if (isProtected(node) && !node.matches?.("input,select,option,button")) return;
  node.childNodes.forEach(translateNode);
}

function ensureStyles() {
  if (!document.querySelector('link[href*="/assets/css/i18n.css"]')) {
    const core = document.createElement("link");
    core.rel = "stylesheet";
    core.href = "/assets/css/i18n.css?v=20260903-240";
    document.head.appendChild(core);
  }
  if (!document.querySelector('link[href*="pos-locale-switcher-placement.css"]')) {
    const placement = document.createElement("link");
    placement.rel = "stylesheet";
    placement.href = "/assets/css/pos-locale-switcher-placement.css?v=20260903-248";
    document.head.appendChild(placement);
  }
}

function mountLocaleSwitcher() {
  if (document.querySelector("[data-pos-static-locale-switcher]")) return;
  ensureStyles();
  const root = document.createElement("div");
  root.className = "app-locale-switcher";
  root.dataset.posStaticLocaleSwitcher = "1";
  root.innerHTML = `<details class="app-locale-menu"><summary class="app-locale-trigger" aria-label="Language" title="Language"><i class="bi bi-globe2" aria-hidden="true"></i><span class="visually-hidden">Language</span></summary><div class="app-locale-menu__panel" role="menu" aria-label="Language"><button type="button" class="app-locale-option" data-locale-option="th" lang="th" role="menuitemradio" aria-checked="${locale === "th"}"><span>ไทย</span><i class="bi bi-check-lg" aria-hidden="true"></i></button><button type="button" class="app-locale-option" data-locale-option="en" lang="en" role="menuitemradio" aria-checked="${locale === "en"}"><span>English</span><i class="bi bi-check-lg" aria-hidden="true"></i></button></div></details>`;
  root.querySelectorAll("[data-locale-option]").forEach(button => button.addEventListener("click", () => {
    setLocale(button.dataset.localeOption);
    location.reload();
  }));

  const target = document.querySelector("[data-pos-locale-switcher-target]")
    || document.querySelector(".pos-header .header-actions")
    || document.querySelector(".display-header-actions");
  if (target) {
    const placeBeforeMenu = () => {
      const menuTrigger = target.querySelector("#posMenuTrigger, .pos-menu-trigger");
      if (menuTrigger) {
        if (root.nextElementSibling !== menuTrigger) target.insertBefore(root, menuTrigger);
        return;
      }
      if (root.parentElement !== target) target.appendChild(root);
    };

    placeBeforeMenu();
    const placementObserver = new MutationObserver(() => placeBeforeMenu());
    placementObserver.observe(target, { childList: true });
    return;
  }
  const fallback = document.createElement("div");
  fallback.className = "pos-locale-switcher-fallback";
  fallback.appendChild(root);
  document.body.prepend(fallback);
}

if (locale === "en") {
  document.title = translateTrimmed(document.title);
  translateNode(document.body);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") translateNode(record.target);
      else if (record.type === "attributes") translateElementAttributes(record.target);
      else record.addedNodes.forEach(translateNode);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label", "alt"] });
}

mountLocaleSwitcher();
