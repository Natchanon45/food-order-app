import { db, collection, doc } from './firebase-config.js?v=20260630-073';
import { getTenantId, RetailCollections, listRecords, getRecord, saveRecord, saveRecordStrict, watchRecords } from './retail-db.js?v=20260629-032';
import { POS_COLLECTIONS, POS_FIRESTORE_VERSION } from './retail-pos-firestore-foundation.js?v=20260702-002';

export const POS_REPOSITORY_VERSION = 'P9-B005.1';
export const POS_LOCAL_KEYS = Object.freeze({
  sales: 'retail_pos_sales_v1',
  products: 'retail_pos_products_v1',
  movements: 'retail_pos_stock_movements_v1',
  activeShift: 'retail_pos_active_shift_v1',
  syncQueue: 'retail_pos_sync_queue_v1',
  customers: 'retail_pos_customers_v1',
  storeSettings: 'retail_pos_store_settings_v1'
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

export function normalizeRepositoryId(row) {
  return String(row?.id || row?.saleId || row?.saleNumber || row?.code || row?._documentId || '').trim();
}

export function withTenantMeta(row = {}, { tenantId = getTenantId(), now = Date.now(), schemaVersion = POS_FIRESTORE_VERSION } = {}) {
  return {
    ...row,
    tenantId,
    shopId: row.shopId || tenantId,
    schemaVersion: row.schemaVersion || schemaVersion,
    updatedAt: row.updatedAt || now
  };
}

export function assertTenantRow(row = {}, tenantId = getTenantId()) {
  if (!row) throw new Error('POS_REPOSITORY_ROW_REQUIRED');
  if (row.tenantId && String(row.tenantId) !== String(tenantId)) throw new Error(`POS_REPOSITORY_TENANT_MISMATCH:${row.id || row.saleId || ''}`);
  return true;
}

export function tenantCollectionRef(collectionName) {
  return collection(db, 'tenants', getTenantId(), collectionName);
}

export function tenantDocRef(collectionName, id) {
  return doc(db, 'tenants', getTenantId(), collectionName, String(id));
}

export function createLocalJsonRepository(key, { fallback = [], limit = 500, idSelector = normalizeRepositoryId } = {}) {
  return {
    key,
    all() {
      const rows = safeJsonParse(localStorage.getItem(key), fallback);
      return Array.isArray(rows) ? rows : fallback;
    },
    set(rows) {
      const next = Array.isArray(rows) ? rows.slice(0, limit) : fallback;
      localStorage.setItem(key, JSON.stringify(next));
      dispatchStorageChange(key);
      return next;
    },
    updateById(id, patch, options = {}) {
      const selector = options.idSelector || idSelector;
      const targetId = String(id || '').trim();
      let changed = false;
      const rows = this.all();
      const next = rows.map(item => {
        if (selector(item) !== targetId) return item;
        changed = true;
        return { ...item, ...patch };
      });
      if (changed) this.set(next);
      return changed;
    },
    upsert(row, options = {}) {
      const selector = options.idSelector || idSelector;
      const rowId = selector(row);
      const rows = this.all().filter(item => selector(item) !== rowId);
      rows.unshift(row);
      this.set(rows);
      return row;
    },
    removeById(id, options = {}) {
      const selector = options.idSelector || idSelector;
      const targetId = String(id || '').trim();
      const rows = this.all();
      const next = rows.filter(item => selector(item) !== targetId);
      if (next.length !== rows.length) this.set(next);
      return next.length !== rows.length;
    },
    clear() {
      localStorage.removeItem(key);
      dispatchStorageChange(key);
      return true;
    }
  };
}

export function createLocalValueRepository(key, { fallback = null } = {}) {
  return {
    key,
    get() {
      return safeJsonParse(localStorage.getItem(key), fallback);
    },
    set(value) {
      localStorage.setItem(key, JSON.stringify(value ?? fallback));
      dispatchStorageChange(key);
      return value ?? fallback;
    },
    patch(patch = {}) {
      const next = { ...(this.get() || {}), ...patch };
      return this.set(next);
    },
    clear() {
      localStorage.removeItem(key);
      dispatchStorageChange(key);
      return true;
    }
  };
}

export function createTenantRepository(collectionName, { localRepository = null, strict = false } = {}) {
  return Object.freeze({
    collectionName,
    tenantId: () => getTenantId(),
    collectionRef: () => tenantCollectionRef(collectionName),
    docRef: id => tenantDocRef(collectionName, id),
    list: options => listRecords(collectionName, options),
    get: id => getRecord(collectionName, id),
    watch: (callback, options) => watchRecords(collectionName, callback, options),
    async save(row) {
      assertTenantRow(row);
      const payload = withTenantMeta(row);
      const saved = strict ? await saveRecordStrict(collectionName, payload) : await saveRecord(collectionName, payload);
      if (localRepository?.upsert) localRepository.upsert(saved);
      return saved;
    },
    async saveStrict(row) {
      assertTenantRow(row);
      const saved = await saveRecordStrict(collectionName, withTenantMeta(row));
      if (localRepository?.upsert) localRepository.upsert(saved);
      return saved;
    },
    local: localRepository
  });
}

export function localSaleId(sale) {
  return String(sale?.id || sale?.saleId || sale?.saleNumber || '').trim();
}

export const localSalesRepository = createLocalJsonRepository(POS_LOCAL_KEYS.sales, { fallback: [], idSelector: localSaleId });
export const localProductsRepository = createLocalJsonRepository(POS_LOCAL_KEYS.products, { fallback: [] });
export const localStockMovementsRepository = createLocalJsonRepository(POS_LOCAL_KEYS.movements, { fallback: [] });
export const localSyncQueueRepository = createLocalJsonRepository(POS_LOCAL_KEYS.syncQueue, { fallback: [] });
export const localCustomersRepository = createLocalJsonRepository(POS_LOCAL_KEYS.customers, { fallback: [] });
export const activeShiftRepository = createLocalValueRepository(POS_LOCAL_KEYS.activeShift, { fallback: null });
export const storeSettingsRepository = createLocalValueRepository(POS_LOCAL_KEYS.storeSettings, { fallback: {} });

export const posProductsRepository = createTenantRepository(RetailCollections.products, { localRepository: localProductsRepository });
export const posSalesRepository = createTenantRepository(RetailCollections.sales, { localRepository: localSalesRepository });
export const posStockMovementsRepository = createTenantRepository(RetailCollections.stockMovements, { localRepository: localStockMovementsRepository });
export const posShiftsRepository = createTenantRepository(RetailCollections.shifts, { localRepository: activeShiftRepository });
export const posReturnsRepository = createTenantRepository(RetailCollections.returns);
export const posCustomersRepository = createTenantRepository(RetailCollections.customers, { localRepository: localCustomersRepository });
export const posSettingsRepository = createTenantRepository(RetailCollections.settings, { localRepository: storeSettingsRepository });
export const posSyncQueueRepository = createTenantRepository(POS_COLLECTIONS.syncQueue, { localRepository: localSyncQueueRepository });
export const posAuditLogRepository = createTenantRepository(POS_COLLECTIONS.auditLogs, { strict: true });
export const posCountersRepository = createTenantRepository(POS_COLLECTIONS.counters, { strict: true });

export const POS_REPOSITORIES = Object.freeze({
  products: posProductsRepository,
  sales: posSalesRepository,
  stockMovements: posStockMovementsRepository,
  shifts: posShiftsRepository,
  returns: posReturnsRepository,
  customers: posCustomersRepository,
  settings: posSettingsRepository,
  syncQueue: posSyncQueueRepository,
  auditLogs: posAuditLogRepository,
  counters: posCountersRepository
});

export function updateLocalSale(saleId, patch) {
  return localSalesRepository.updateById(saleId, patch, { idSelector: localSaleId });
}

export function upsertLocalSale(sale) {
  return localSalesRepository.upsert(sale, { idSelector: localSaleId });
}

export function listLocalSales() {
  return localSalesRepository.all();
}

export function saveLocalSales(rows) {
  return localSalesRepository.set(rows || []);
}

export function listPendingLocalSales() {
  return listLocalSales().filter(sale => ['pending', 'syncing', 'failed', 'conflict'].includes(String(sale?.syncStatus || '').toLowerCase()));
}

export function listLocalProducts() {
  return localProductsRepository.all();
}

export function saveLocalProducts(rows) {
  return localProductsRepository.set(rows || []);
}

export function listLocalStockMovements() {
  return localStockMovementsRepository.all();
}

export function prependLocalStockMovements(rows = []) {
  return localStockMovementsRepository.set([...(rows || []), ...listLocalStockMovements()]);
}

export function listLocalCustomers() {
  return localCustomersRepository.all();
}

export function getActiveShift() {
  return activeShiftRepository.get();
}

export function saveActiveShift(row) {
  return activeShiftRepository.set(row || null);
}

export function clearActiveShift() {
  return activeShiftRepository.clear();
}

export function getStoreSettings() {
  return storeSettingsRepository.get() || {};
}

export function saveStoreSettings(row) {
  return storeSettingsRepository.set(row || {});
}
