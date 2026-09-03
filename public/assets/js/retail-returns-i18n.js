import { getIntlLocale, getLocale } from './i18n.js?v=20260812-099';

const active = getLocale() === 'en';
const intlLocale = getIntlLocale();
const source = globalThis.APP_I18N?.fallbackMessages?.pos_returns?.runtime || {};
const target = globalThis.APP_I18N?.messages?.pos_returns_runtime || {};
const thaiUi = globalThis.APP_I18N?.fallbackMessages?.pos_returns || {};
const enUi = globalThis.APP_I18N?.messages?.pos_returns || {};
const staticPairs = new Map([
  [thaiUi.search?.title, enUi.search?.title],
  [thaiUi.search?.button, enUi.search?.button],
  [thaiUi.search?.empty, enUi.search?.empty],
  [thaiUi.actions?.void, enUi.actions?.void],
  [thaiUi.actions?.confirm, enUi.actions?.confirm],
].filter(pair => pair[0] && pair[1]));

function formatDate(text) {
  const match = String(text || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const rawYear = Number(match[3]);
  const year = rawYear > 2400 ? rawYear - 543 : rawYear;
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(intlLocale, match[4] ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}

function replaceTemplate(text) {
  const value = String(text || '').trim();
  if (staticPairs.has(value)) return staticPairs.get(value);
  for (const [key, thai] of Object.entries(source)) {
    const english = target[key];
    if (typeof thai !== 'string' || typeof english !== 'string') continue;
    if (!thai.includes(':')) {
      if (value === thai) return english;
      continue;
    }
    const marker = thai.indexOf(':');
    const prefix = thai.slice(0, marker);
    const suffixSpace = thai.indexOf(' ', marker);
    const suffix = suffixSpace >= 0 ? thai.slice(suffixSpace) : '';
    if (!value.startsWith(prefix) || (suffix && !value.endsWith(suffix))) continue;
    const captured = value.slice(prefix.length, suffix ? -suffix.length : undefined);
    const name = thai.slice(marker + 1, suffixSpace >= 0 ? suffixSpace : undefined);
    return english.replace(`:${name}`, captured);
  }
  return formatDate(value);
}

const selectors = [
  '.return-search-panel h2', '#returnSearchBtn', '#returnSaleEmpty', '#voidSaleBtn', '#confirmReturnBtn',
  '#returnSaleMeta', '#returnTotal', '#returnError', '#toast',
  '#returnLoyaltyPreview strong', '#returnLoyaltyText',
  '.return-sale-card > div:first-child > span', '.return-sale-total strong', '.return-sale-total span',
  '.return-sale-card button[data-sale-id]', '.return-history-head > div:first-child > span',
  '.return-history-total strong', '.return-history-loyalty', '.return-history-actions button',
  '#rrDate', '#rrMethod'
];

function refresh() {
  if (!active) return;
  selectors.forEach(selector => document.querySelectorAll(selector).forEach(element => {
    const direct = replaceTemplate(element.textContent);
    if (direct) element.textContent = direct;
  }));
}

function later() { setTimeout(refresh, 0); }

if (active) {
  refresh();
  document.addEventListener('click', later);
  document.addEventListener('input', later);
  document.addEventListener('keydown', event => { if (event.key === 'Enter') later(); });
  window.addEventListener('storage', later);
  window.addEventListener('retail:return-sync', later);
}
