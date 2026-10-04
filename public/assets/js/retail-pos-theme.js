import { RetailCollections, getRecord, getTenantId, listRecords } from './retail-db.js?v=20260629-032';

export const POS_THEME_SETTINGS_ID = 'pos-theme';
export const DEFAULT_POS_THEME = 'modern-card';
export const POS_THEME_OPTIONS = [
  { id: 'minimal-clean', label: 'Minimal Clean', option: 1 },
  { id: 'modern-card', label: 'Modern Card', option: 2 },
  { id: 'section-sidebar', label: 'Sidebar แบ่งแยกหมวด', option: 3 },
  { id: 'summary', label: 'พร้อมข้อมูลสรุป', option: 4 },
  { id: 'dark-hitech', label: 'Dark Mode Hi-Tech', option: 5 },
];

const THEME_IDS = new Set(POS_THEME_OPTIONS.map(item => item.id));
const CACHE_PREFIX = 'retail_pos_theme_v1_';
const STYLE_ID = 'retail-pos-theme-styles';
const STYLE_HREF = '/assets/css/retail-pos-themes.css?v=20261004-105';

function cacheKey(tenantId = getTenantId()) {
  return CACHE_PREFIX + String(tenantId || 'default');
}

export function normalizePosTheme(value) {
  const theme = String(value || '').trim().toLowerCase();
  return THEME_IDS.has(theme) ? theme : DEFAULT_POS_THEME;
}

export function getCachedPosTheme(tenantId = getTenantId()) {
  try {
    return normalizePosTheme(localStorage.getItem(cacheKey(tenantId)) || DEFAULT_POS_THEME);
  } catch {
    return DEFAULT_POS_THEME;
  }
}

export function cachePosTheme(theme, tenantId = getTenantId()) {
  const normalized = normalizePosTheme(theme);
  try { localStorage.setItem(cacheKey(tenantId), normalized); } catch {}
  return normalized;
}

export function ensurePosThemeStyles() {
  let link = document.getElementById(STYLE_ID);
  if (link) return link;
  link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  document.head.appendChild(link);
  return link;
}

export function applyPosTheme(theme, { tenantId = getTenantId(), cache = true } = {}) {
  const normalized = normalizePosTheme(theme);
  ensurePosThemeStyles();
  document.documentElement.dataset.posTheme = normalized;
  if (document.body) document.body.dataset.posTheme = normalized;
  if (cache) cachePosTheme(normalized, tenantId);
  window.dispatchEvent(new CustomEvent('pos-theme-applied', {
    detail: { theme: normalized, tenantId: String(tenantId || '') },
  }));
  return normalized;
}

export async function loadAndApplyPosTheme() {
  const tenantId = getTenantId();
  const cached = getCachedPosTheme(tenantId);
  applyPosTheme(cached, { tenantId, cache: false });
  try {
    const row = await getRecord(RetailCollections.settings, POS_THEME_SETTINGS_ID);
    const remote = normalizePosTheme(row?.theme || row?.posTheme || cached);
    return applyPosTheme(remote, { tenantId, cache: true });
  } catch (error) {
    console.warn('[retail-pos-theme] settings fallback', error);
    return cached;
  }
}

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSameLocalDay(value, reference = new Date()) {
  const ms = timestampMs(value);
  if (!ms) return false;
  const date = new Date(ms);
  return date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate();
}

function validSale(row = {}) {
  return !['cancelled', 'canceled', 'void'].includes(String(row.status || '').toLowerCase());
}

export async function loadPosThemeSummary({ includeSales = true, includeProducts = true } = {}) {
  try {
    const [sales, products] = await Promise.all([
      includeSales ? listRecords(RetailCollections.sales) : Promise.resolve([]),
      includeProducts ? listRecords(RetailCollections.products) : Promise.resolve([]),
    ]);
    const now = new Date();
    const today = (sales || []).filter(row => validSale(row) && isSameLocalDay(
      row.createdAtServer || row.createdAt || row.updatedAt,
      now,
    ));
    const total = today.reduce((sum, sale) => {
      const gross = Number(sale.totalAmount ?? sale.total ?? 0);
      const refund = Number(sale.refundTotal || 0);
      return sum + Math.max(0, gross - refund);
    }, 0);
    const inStock = (products || []).filter(product => Number(product.stock ?? product.qty ?? 0) > 0).length;
    return { salesTotal: total, billCount: today.length, inStock };
  } catch (error) {
    console.warn('[retail-pos-theme] summary load failed', error);
    return { salesTotal: 0, billCount: 0, inStock: 0, failed: true };
  }
}
