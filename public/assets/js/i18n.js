const supportedLocales = new Set(["th", "en", "my", "lo", "km"]);
const storageKey = "food_order_locale";
let dictionaries = globalThis.APP_I18N_DICTIONARIES || {};
let fallbackLocale = "th";
const configuredEvent = "app:i18n-configured";
const localeChangedEvent = "app:i18n-locale-changed";

function activeDictionaries() {
  const shared = globalThis.APP_I18N_DICTIONARIES;
  return shared && typeof shared === "object" ? shared : dictionaries;
}

function activeFallbackLocale() {
  return normalizeLocale(globalThis.APP_I18N_FALLBACK_LOCALE || fallbackLocale || "th");
}

function dispatchI18nEvent(name) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail: { locale: getLocale() } }));
}

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
  globalThis.APP_I18N_FALLBACK_LOCALE = fallbackLocale;
  dispatchI18nEvent(configuredEvent);
}

export function getLocale() {
  try { return normalizeLocale(localStorage.getItem(storageKey) || document.documentElement.lang || "th"); }
  catch { return normalizeLocale(document.documentElement.lang || "th"); }
}

export function setLocale(locale) {
  const next = normalizeLocale(locale);
  try { localStorage.setItem(storageKey, next); } catch {}
  document.documentElement.lang = next;
  dispatchI18nEvent(localeChangedEvent);
  return next;
}

const intlLocales = Object.freeze({ th: "th-TH", en: "en-US", my: "my-MM", lo: "lo-LA", km: "km-KH" });
export function getIntlLocale() { return intlLocales[getLocale()] || intlLocales.th; }

export function t(key, replacements = {}) {
  const locale = getLocale();
  const source = activeDictionaries();
  const fallback = activeFallbackLocale();
  const value = nested(source?.[locale] || {}, key) ?? nested(source?.[fallback] || {}, key) ?? key;
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
