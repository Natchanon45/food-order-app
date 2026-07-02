const PERF_VERSION = 'P9-B010';
const SEARCH_DEBOUNCE_MS = 120;
const MAX_VISIBLE_PRODUCTS = 96;
const PRODUCT_GRID_SELECTOR = '#productGrid';
const SEARCH_INPUT_SELECTOR = '#searchInput';
let searchTimer = 0;
let lastSearchValue = '';
let syntheticSearch = false;
let productObserver = null;

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function ensurePerfBadge(grid, hiddenCount = 0) {
  const old = grid.querySelector('[data-pos-perf-summary]');
  if (old) old.remove();
  if (hiddenCount <= 0) return;
  const badge = document.createElement('div');
  badge.className = 'empty-state';
  badge.dataset.posPerfSummary = '1';
  badge.textContent = `แสดงสินค้า ${MAX_VISIBLE_PRODUCTS.toLocaleString('th-TH')} รายการแรกจากผลลัพธ์ทั้งหมด เพื่อให้หน้า POS ทำงานเร็วขึ้น กรุณาค้นหาเพื่อจำกัดรายการ`;
  grid.appendChild(badge);
}

function productCards(grid) {
  return [...grid.querySelectorAll('[data-product-id]')];
}

function cardSearchText(card) {
  if (!card.dataset.searchText) card.dataset.searchText = normalizeText(card.textContent || '');
  return card.dataset.searchText;
}

function applyProductVirtualLimit(grid = document.querySelector(PRODUCT_GRID_SELECTOR), keyword = lastSearchValue) {
  if (!grid) return;
  const cards = productCards(grid);
  if (!cards.length) return;
  const term = normalizeText(keyword);
  let shown = 0;
  let matched = 0;
  cards.forEach(card => {
    const match = !term || cardSearchText(card).includes(term);
    if (match) matched += 1;
    const visible = match && shown < MAX_VISIBLE_PRODUCTS;
    card.hidden = !visible;
    if (visible) shown += 1;
  });
  ensurePerfBadge(grid, Math.max(0, matched - shown));
}

function debounceSearchInput(event) {
  if (syntheticSearch) return;
  const input = event.target?.closest?.(SEARCH_INPUT_SELECTOR);
  if (!input) return;
  event.stopImmediatePropagation();
  lastSearchValue = input.value || '';
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    applyProductVirtualLimit(document.querySelector(PRODUCT_GRID_SELECTOR), lastSearchValue);
    syntheticSearch = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    syntheticSearch = false;
    requestAnimationFrame(() => applyProductVirtualLimit(document.querySelector(PRODUCT_GRID_SELECTOR), lastSearchValue));
  }, SEARCH_DEBOUNCE_MS);
}

function startProductObserver() {
  const grid = document.querySelector(PRODUCT_GRID_SELECTOR);
  if (!grid || productObserver) return;
  productObserver = new MutationObserver(() => requestAnimationFrame(() => applyProductVirtualLimit(grid, lastSearchValue)));
  productObserver.observe(grid, { childList: true });
  applyProductVirtualLimit(grid, lastSearchValue);
}

function cacheLocalSnapshot() {
  try {
    const keys = ['retail_pos_products_v1', 'retail_pos_sales_v1', 'retail_pos_stock_movements_v1'];
    const snapshot = keys.reduce((acc, key) => {
      const value = localStorage.getItem(key);
      if (value) acc[key] = value.length;
      return acc;
    }, {});
    sessionStorage.setItem('retail_pos_perf_snapshot_v1', JSON.stringify({ version: PERF_VERSION, updatedAt: new Date().toISOString(), snapshot }));
  } catch {}
}

document.addEventListener('input', debounceSearchInput, true);
window.addEventListener('storage', cacheLocalSnapshot);
window.addEventListener('retail-pos-repository-change', cacheLocalSnapshot);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startProductObserver, { once: true });
else startProductObserver();
setTimeout(cacheLocalSnapshot, 500);

window.retailPosPerformance = Object.freeze({
  version: PERF_VERSION,
  applyProductVirtualLimit,
  maxVisibleProducts: MAX_VISIBLE_PRODUCTS,
  searchDebounceMs: SEARCH_DEBOUNCE_MS
});
