import { createContext, useCallback, useContext, useMemo, useState } from "react";
import parityTranslations from "./parity-translations.json";

const Ctx = createContext(null);
const KEY = "food_order_locale";
const SUPPORTED = ["th", "en", "my", "lo", "km"];
const INTL = { th: "th-TH", en: "en-US", my: "my-MM", lo: "lo-LA", km: "km-KH" };
const MANUAL_DATE_LOCALES = new Set(["my", "lo", "km"]);

const normalize = value => {
  const next = String(value || "").trim().toLowerCase().split("-")[0];
  return SUPPORTED.includes(next) ? next : "th";
};
const nested = (source, key) => String(key || "")
  .split(".")
  .filter(Boolean)
  .reduce((value, part) => value && Object.prototype.hasOwnProperty.call(value, part) ? value[part] : undefined, source);
const interpolate = (value, replacements = {}) => String(value).replace(/:([A-Za-z0-9_]+)/g, (match, key) =>
  Object.prototype.hasOwnProperty.call(replacements, key) ? String(replacements[key]) : match,
);
const normalizeVisibleBranding = value => {
  if (typeof value === "string") {
    return value
      .replaceAll("Food Order/Delivery With QR", "PENGUIN")
      .replaceAll("Food Order Delivery", "PENGUIN")
      .replaceAll("FOOD ORDER QR", "PENGUIN QR")
      .replaceAll("LUKKAJA", "PENGUIN")
      .replaceAll("KINJAI", "PENGUIN")
      .replace(/\bFOD\b/g, "PG");
  }
  if (Array.isArray(value)) return value.map(normalizeVisibleBranding);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeVisibleBranding(item)]));
  }
  return value;
};
function initialLocale() {
  try { return normalize(localStorage.getItem(KEY) || document.documentElement.lang || "th"); }
  catch { return normalize(document.documentElement.lang || "th"); }
}

function localizeDigits(value, digits = "0123456789") {
  const glyphs = [...String(digits || "0123456789")];
  if (glyphs.length !== 10 || glyphs.join("") === "0123456789") return String(value);
  return String(value).replace(/\d/g, digit => glyphs[Number(digit)] ?? digit);
}

function numericDateParts(date, timeZone = "") {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: date.getDay(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = {};
  formatter.formatToParts(date).forEach(part => {
    if (["year", "month", "day", "hour", "minute", "second"].includes(part.type)) {
      values[part.type] = Number(part.value);
    }
  });
  values.weekday = new Date(Date.UTC(values.year, values.month - 1, values.day)).getUTCDay();
  return values;
}

function manualDateFormat(locale, date, options = {}) {
  const dictionary =
    nested(parityTranslations?.[locale], "i18n.date")
    ?? nested(parityTranslations?.th, "i18n.date")
    ?? {};
  const order = String(dictionary.order || (locale === "my" ? "ymd" : "dmy"));
  const digits = String(dictionary.digits || "0123456789");
  const monthsLong = Array.isArray(dictionary.months_long) ? dictionary.months_long : [];
  const monthsShort = Array.isArray(dictionary.months_short) ? dictionary.months_short : monthsLong;
  const weekdaysLong = Array.isArray(dictionary.weekdays_long) ? dictionary.weekdays_long : [];
  const weekdaysShort = Array.isArray(dictionary.weekdays_short) ? dictionary.weekdays_short : weekdaysLong;
  const parts = numericDateParts(date, String(options.timeZone || ""));

  const explicitDateField = options.year || options.month || options.day || options.weekday;
  const explicitTimeField = options.hour || options.minute || options.second;
  const hasDate = Boolean(options.dateStyle || explicitDateField || (!options.timeStyle && !explicitTimeField));
  const hasTime = Boolean(options.timeStyle || explicitTimeField);

  let monthMode = options.month || "";
  if (!monthMode && options.dateStyle) {
    monthMode = options.dateStyle === "short"
      ? "2-digit"
      : (options.dateStyle === "medium" ? "short" : "long");
  }
  if (!monthMode && hasDate) monthMode = "numeric";

  const includeYear = Boolean(options.dateStyle || options.year || (!explicitDateField && !options.timeStyle && !explicitTimeField));
  const includeMonth = Boolean(options.dateStyle || options.month || (!explicitDateField && !options.timeStyle && !explicitTimeField));
  const includeDay = Boolean(options.dateStyle || options.day || (!explicitDateField && !options.timeStyle && !explicitTimeField));

  const yearText = localizeDigits(parts.year, digits);
  const dayRaw = options.day === "2-digit" ? String(parts.day).padStart(2, "0") : String(parts.day);
  const dayText = localizeDigits(dayRaw, digits);
  let monthText = "";
  let namedMonth = false;

  if (includeMonth) {
    if (monthMode === "long") {
      monthText = String(monthsLong[parts.month - 1] || parts.month);
      namedMonth = true;
    } else if (monthMode === "short") {
      monthText = String(monthsShort[parts.month - 1] || monthsLong[parts.month - 1] || parts.month);
      namedMonth = true;
    } else {
      const raw = monthMode === "2-digit" ? String(parts.month).padStart(2, "0") : String(parts.month);
      monthText = localizeDigits(raw, digits);
    }
  }

  const dateValues = {
    y: includeYear ? yearText : "",
    m: includeMonth ? monthText : "",
    d: includeDay ? dayText : "",
  };
  const dateTokens = [...order].map(key => dateValues[key]).filter(Boolean);
  let dateText = hasDate ? dateTokens.join(namedMonth ? " " : "/") : "";

  if (options.weekday) {
    const weekdayText = String(
      (options.weekday === "short" ? weekdaysShort : weekdaysLong)[parts.weekday]
      || weekdaysLong[parts.weekday]
      || ""
    );
    dateText = [weekdayText, dateText].filter(Boolean).join(" ");
  }

  let timeText = "";
  if (hasTime) {
    const includeSeconds = Boolean(options.second)
      || ["medium", "long", "full"].includes(String(options.timeStyle || ""));
    const hour = localizeDigits(String(parts.hour ?? 0).padStart(2, "0"), digits);
    const minute = localizeDigits(String(parts.minute ?? 0).padStart(2, "0"), digits);
    const second = localizeDigits(String(parts.second ?? 0).padStart(2, "0"), digits);
    timeText = includeSeconds ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
  }

  return [dateText, timeText].filter(Boolean).join(" ");
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(initialLocale);

  const setLocale = useCallback(value => {
    const next = normalize(value);
    try { localStorage.setItem(KEY, next); } catch {}
    document.documentElement.lang = next;
    document.documentElement.dir = "ltr";
    setLocaleState(next);
  }, []);

  const t = useCallback((key, replacements = {}) => {
    const value =
      nested(parityTranslations?.[locale], key) ??
      nested(parityTranslations?.th, key) ??
      key;
    return interpolate(normalizeVisibleBranding(value), replacements);
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    supportedLocales: SUPPORTED,
    raw: key => normalizeVisibleBranding(nested(parityTranslations?.[locale], key) ?? nested(parityTranslations?.th, key)),
    intlLocale: INTL[locale] || "th-TH",
    setLocale,
    t,
    formatNumber: (number, options = {}) =>
      new Intl.NumberFormat(INTL[locale] || "th-TH", options).format(Number(number || 0)),
    formatCurrency: (number, currency = "THB") =>
      new Intl.NumberFormat(INTL[locale] || "th-TH", { style: "currency", currency }).format(Number(number || 0)),
    formatDate: (value, options = {}) => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      if (MANUAL_DATE_LOCALES.has(locale)) return manualDateFormat(locale, date, options);
      return new Intl.DateTimeFormat(INTL[locale] || "th-TH", options).format(date);
    },
  }), [locale, setLocale, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const value = useContext(Ctx);
  if (!value) throw new Error("I18N_PROVIDER_REQUIRED");
  return value;
}
