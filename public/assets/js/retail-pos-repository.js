import { getTenantId, RetailCollections, listRecords, getRecord, saveRecord, saveRecordStrict, watchRecords } from './retail-db.js?v=20260629-032';

export const POS_REPOSITORY_VERSION = 'P9-B005';
export const POS_LOCAL_KEYS = Object.freeze({
  sales: 'retail_pos_sales_v1',
  products: 'retail_pos_products_v1',
  movements: 'retail_pos_stock_movements_v1',
  activeShift: 'retail_pos_active_shift_v1'
});

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function dispatchStorageChange(key) {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key }));
  } catch {
    window.dispatchEvent(new CustomEvent('retail-pos-repository-change', { detail: { key } }));
  }
}

export function createLocalJsonRepository(key, { fallback = [] } = {}) {
  return {
    key,
    all() {
      return safeJsonParse(localStorage.getItem(key), fallback);
    },
    set(rows) {
      localStorage.setItem(key, JSON.stringify(rows ?? fallback));
      dispatchStorageChange(key);
      return rows ?? fallback;
    },
    updateById(id, patch, { idSelector = item => String(item?.id || item?.saleNumber || '') } = {}) {
      const targetId = String(id || '').trim();
      let changed = false;
      const rows = this.all();
      const next = rows.map(item => {
        if (idSelector(item) !== targetId) return item;
        changed = true;
        return { ...item, ...patch };
      });
      if (changed) this.set(next);
      return changed;
    },
    upsert(row, { idSelector = item => String(item?.id || item?.saleNumber || '') } = {}) {
      const rowId = idSelector(row);
      const rows = this.all().filter(item => idSelector(item) !== rowId);
      rows.unshift(row);
      this.set(rows);
      return row;
    },
    removeById(id, { idSelector = item => String(item?.id || item?.saleNumber || '') } = {}) {
      const targetId = String(id || '').trim();
      const rows = this.all();
      const next = rows.filter(item => idSelector(item) !== targetId);
      if (next.length !== rows.length) this.set(next);
      return next.length !== rows.length;
    }
  };
}

export const localSalesRepository = createLocalJsonRepository(POS_LOCAL_KEYS.sales, { fallback: [] });
export const localProductsRepository = createLocalJsonRepository(POS_LOCAL_KEYS.products, { fallback: [] });
export const localStockMovementsRepository = createLocalJsonRepository(POS_LOCAL_KEYS.movements, { fallback: [] });

export const posProductsRepository = Object.freeze({
  list: options => listRecords(RetailCollections.products, options),
  get: id => getRecord(RetailCollections.products, id),
  save: row => saveRecord(RetailCollections.products, row),
  saveStrict: row => saveRecordStrict(RetailCollections.products, row),
  watch: (callback, options) => watchRecords(RetailCollections.products, callback, options)
});

export const posSalesRepository = Object.freeze({
  list: options => listRecords(RetailCollections.sales, options),
  get: id => getRecord(RetailCollections.sales, id),
  save: row => saveRecord(RetailCollections.sales, row),
  saveStrict: row => saveRecordStrict(RetailCollections.sales, row),
  tenantId: () => getTenantId()
});

export function localSaleId(sale) {
  return String(sale?.id || sale?.saleNumber || '').trim();
}

export function updateLocalSale(saleId, patch) {
  return localSalesRepository.updateById(saleId, patch, { idSelector: localSaleId });
}

export function listLocalSales() {
  return localSalesRepository.all();
}

export function saveLocalSales(rows) {
  return localSalesRepository.set(rows || []);
}
