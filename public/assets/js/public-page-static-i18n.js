import translations from "./public-translations.js?v=20260903-243";
import { configureI18n, getLocale, setLocale } from "./i18n.js?v=20260903-202";

configureI18n(translations);
const locale = getLocale();
document.documentElement.lang = locale;

function flatten(value, prefix = "", result = new Map()) {
  if (!value || typeof value !== "object") return result;
  Object.entries(value).forEach(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object") flatten(item, path, result);
    else result.set(path, String(item ?? ""));
  });
  return result;
}

const th = flatten(translations.th || {});
const selected = flatten(translations[locale] || {});
const exact = new Map();
th.forEach((thai, key) => {
  const translated = selected.get(key);
  if (thai && translated && thai !== translated && !exact.has(thai)) exact.set(thai, translated);
});

function translateValue(value) {
  if (locale === "th") return value;
  const source = String(value ?? "");
  const trimmed = source.trim();
  const translated = exact.get(trimmed);
  if (!translated) return source;
  const left = source.match(/^\s*/)?.[0] || "";
  const right = source.match(/\s*$/)?.[0] || "";
  return `${left}${translated}${right}`;
}

function translateNode(node) {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    if (["SCRIPT", "STYLE"].includes(node.parentElement?.tagName)) return;
    node.nodeValue = translateValue(node.nodeValue);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  ["placeholder", "title", "aria-label", "alt"].forEach(attr => {
    if (node.hasAttribute(attr)) node.setAttribute(attr, translateValue(node.getAttribute(attr)));
  });
  node.childNodes.forEach(translateNode);
}

function ensureStyles() {
  if (document.querySelector('link[href*="i18n.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/i18n.css?v=20260903-231";
  document.head.appendChild(link);
}

function mountLocaleSwitcher() {
  const header = document.querySelector(".app-header");
  if (!header || header.querySelector("[data-public-locale-switcher]")) return;
  ensureStyles();
  const root = document.createElement("div");
  root.className = "app-locale-switcher";
  root.dataset.publicLocaleSwitcher = "1";
  root.innerHTML = `<details class="app-locale-menu"><summary class="app-locale-trigger" aria-label="Language" title="Language"><i class="bi bi-globe2" aria-hidden="true"></i></summary><div class="app-locale-menu__panel" role="menu"><button type="button" class="app-locale-option" data-locale="th" role="menuitemradio" aria-checked="${locale === "th"}"><span>ไทย</span></button><button type="button" class="app-locale-option" data-locale="en" role="menuitemradio" aria-checked="${locale === "en"}"><span>English</span></button></div></details>`;
  root.querySelectorAll("[data-locale]").forEach(button => button.addEventListener("click", () => {
    setLocale(button.dataset.locale);
    location.reload();
  }));
  const userMenu = header.querySelector("[data-user-menu]");
  if (userMenu) header.insertBefore(root, userMenu); else header.appendChild(root);
}

translateNode(document.body);
mountLocaleSwitcher();

if (locale === "en") {
  const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(translateNode)));
  observer.observe(document.body, { childList: true, subtree: true });
}
