const supportedLocales = new Set(["th", "en"]);
const storageKey = "food_order_locale";
let dictionaries = globalThis.APP_I18N_DICTIONARIES || {};
let fallbackLocale = "th";

function normalizeLocale(value) {
  const locale = String(value || "").trim().toLowerCase().split("-")[0];
  return supportedLocales.has(locale) ? locale : fallbackLocale;
}

function nested(source, key) {
  return String(key || "").split(".").filter(Boolean).reduce((value, part) => (
    value && Object.prototype.hasOwnProperty.call(value, part) ? value[part] : undefined
  ), source);
}

function interpolate(value, replacements = {}) {
  return String(value).replace(/:([A-Za-z0-9_]+)/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(replacements, key) ? String(replacements[key]) : match
  ));
}

export function configureI18n(next = {}, options = {}) {
  dictionaries = next || {};
  fallbackLocale = normalizeLocale(options.fallbackLocale || "th");
  globalThis.APP_I18N_DICTIONARIES = dictionaries;
}

export function getLocale() {
  try { return normalizeLocale(localStorage.getItem(storageKey) || document.documentElement.lang || "th"); }
  catch { return normalizeLocale(document.documentElement.lang || "th"); }
}

export function setLocale(locale) {
  const next = normalizeLocale(locale);
  try { localStorage.setItem(storageKey, next); } catch {}
  document.documentElement.lang = next;
  return next;
}

export function getIntlLocale() { return getLocale() === "th" ? "th-TH" : "en-US"; }

export function t(key, replacements = {}) {
  const locale = getLocale();
  const value = nested(dictionaries?.[locale] || {}, key) ?? nested(dictionaries?.[fallbackLocale] || {}, key) ?? key;
  return interpolate(value, replacements);
}

export function formatNumber(value, options = {}) { return new Intl.NumberFormat(getIntlLocale(), options).format(Number(value || 0)); }
export function formatCurrency(value, currency = "THB", options = {}) { return new Intl.NumberFormat(getIntlLocale(), { style: "currency", currency, ...options }).format(Number(value || 0)); }
export function formatDate(value, options = {}) { const date=value instanceof Date?value:new Date(value); return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat(getIntlLocale(), options).format(date); }

export function applyTranslations(root = document) {
  document.documentElement.lang = getLocale();
  root.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = t(node.dataset.i18n); });
  root.querySelectorAll("[data-i18n-placeholder]").forEach(node => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  root.querySelectorAll("[data-i18n-title]").forEach(node => { node.title = t(node.dataset.i18nTitle); });
  root.querySelectorAll("[data-i18n-aria-label]").forEach(node => { node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel)); });
  root.querySelectorAll("[data-i18n-alt]").forEach(node => { node.setAttribute("alt", t(node.dataset.i18nAlt)); });
  root.querySelectorAll("[data-i18n-data-description]").forEach(node => { node.dataset.description = t(node.dataset.i18nDataDescription); });
}

export default Object.freeze({ configureI18n, getLocale, setLocale, getIntlLocale, t, formatNumber, formatCurrency, formatDate, applyTranslations });
