import { auth, db, isFirebaseConfigured, doc, runTransaction, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId, RetailCollections } from './retail-db.js?v=20260629-032';
import { listLocalSales, saveLocalSales, updateLocalSale, localSaleId } from './retail-pos-repository.js?v=20260630-081';
import {
  POS_COLLECTIONS,
  POS_FIRESTORE_VERSION,
  buildRunningNumber,
  buildCounterRow,
  counterIdForDate,
  dateKeyFrom,
  applySaleToDailySummary,
  buildSaleItemRows,
  buildSyncQueueRow
} from './retail-pos-firestore-foundation.js?v=20260630-077';

const SALES_KEY = 'retail_pos_sales_v1';
const SYNC_EVENT = 'retail-offline-sales-synced';
const MAX_RETRY_PER_RUN = 5;
const SYNCING_STALE_MS = 30000;
const RETRY_DELAYS_MS = [0, 5000, 15000, 30000, 60000, 120000, 300000];
let syncRunning = false;

function nowIso() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }
function readSales() { return listLocalSales(); }
function writeSales(rows) { return saveLocalSales(rows || []); }

function tenantDoc(collectionName, id) {
  return doc(db, 'tenants', getTenantId(), collectionName, String(id));
}

function errorMessage(error) {
  return String(error?.message || error || 'SYNC_FAILED');
}

function conflictTypeFromError(error) {
  const message = errorMessage(error);
  if (message.startsWith('TENANT_MISMATCH:')) return 'tenant_mismatch';
  if (message.startsWith('INSUFFICIENT_STOCK:')) return 'insufficient_stock';
  if (message.startsWith('PRODUCT_NOT_FOUND:')) return 'product_not_found';
  if (message.startsWith('INVALID_PRODUCT_ID')) return 'invalid_product_id';
  if (message.startsWith('INVALID_QTY:')) return 'invalid_qty';
  return '';
}

function isConflictError(error) {
  return Boolean(conflictTypeFromError(error));
}

function retryDelayMs(attemptCount) {
  const index = Math.max(0, Math.min(Number(attemptCount || 0), RETRY_DELAYS_MS.length - 1));
  return RETRY_DELAYS_MS[index];
}

function retryDue(sale) {
  const next = new Date(sale?.nextRetryAt || 0).getTime();
  return !next || next <= nowMs();
}

function saleNeedsSync(sale) {
  if (!sale || sale.status !== 'completed') return false;
  if (sale.firebaseSyncedAt || sale.syncStatus === 'synced') return false;
  if (sale.syncStatus === 'discarded' || sale.syncStatus === 'conflict_resolved') return false;
  if (sale.syncStatus === 'conflict') return false;
  if (sale.syncStatus === 'syncing') {
    const started = new Date(sale.syncStartedAt || 0).getTime();
    if (started && nowMs() - started < SYNCING_STALE_MS) return false;
  }
  if (sale.syncStatus === 'failed' && !retryDue(sale)) return false;
  return Boolean(localSaleId(sale));
}

function markSale(id, patch) {
  updateLocalSale(id, patch);
}

function markSyncing(sale, lockId) {
  const id = localSaleId(sale);
  const attemptCount = Number(sale.syncAttemptCount || 0) + 1;
  markSale(id, {
    syncStatus: 'syncing',
    syncLockId: lockId,
    syncStartedAt: nowIso(),
    lastSyncAttemptAt: nowIso(),
    syncAttemptCount: attemptCount,
    syncError: '',
    nextRetryAt: ''
  });
}

function markSynced(id, extra = {}) {
  markSale(id, {
    syncStatus: 'synced',
    firebaseSyncedAt: nowIso(),
    syncError: '',
    syncLockId: '',
    syncStartedAt: '',
    nextRetryAt: '',
    conflictType: '',
    conflictResolution: '',
    ...extra
  });
}

function markFailed(id, error, status = 'failed') {
  const rows = readSales();
  const current = rows.find(sale => localSaleId(sale) === id) || {};
  const attemptCount = Number(current.syncAttemptCount || 0);
  const isConflict = status === 'conflict';
  const delay = isConflict ? 0 : retryDelayMs(attemptCount);
  markSale(id, {
    syncStatus: status,
    syncError: errorMessage(error),
    syncLockId: '',
    syncStartedAt: '',
    lastSyncAttemptAt: nowIso(),
    nextRetryAt: isConflict ? '' : new Date(nowMs() + delay).toISOString(),
    conflictType: isConflict ? conflictTypeFromError(error) : '',
    conflictResolution: isConflict ? 'manual_required' : ''
  });
}

function normalizeOfflineSale(sale, { saleId, tenantId, userId, saleNumber }) {
  const createdAt = sale.createdAt || nowIso();
  const dateKey = sale.dateKey || dateKeyFrom(createdAt);
  const monthKey = sale.monthKey || dateKey.slice(0, 6);
  return {
    ...sale,
    id: saleId,
    saleNumber,
    tenantId,
    shopId: tenantId,
    schemaVersion: POS_FIRESTORE_VERSION,
    channel: sale.channel || 'retail-pos',
    orderType: sale.orderType || 'pos',
    dateKey,
    monthKey,
    deleted: false,
    syncStatus: 'synced',
    syncedFromOffline: true,
    syncedAt: nowIso(),
    syncedBy: userId,
    paymentStatus: sale.paymentStatus || 'paid',
    status: sale.status || 'completed',
    updatedAt: nowMs()
  };
}

async function syncOneSale(sale) {
  const saleId = localSaleId(sale);
  const tenantId = getTenantId();
  if (sale.tenantId && String(sale.tenantId) !== String(tenantId)) throw new Error(`TENANT_MISMATCH:${saleId}`);

  const userId = auth?.currentUser?.uid || sale.cashierId || '';
  const saleRef = tenantDoc(RetailCollections.sales, saleId);
  const items = Array.isArray(sale.items) ? sale.items : [];
  let alreadyExists = false;
  let syncedSaleNumber = sale.saleNumber || saleId;

  await runTransaction(db, async transaction => {
    const existingSale = await transaction.get(saleRef);
    if (existingSale.exists()) {
      alreadyExists = true;
      syncedSaleNumber = existingSale.data()?.saleNumber || syncedSaleNumber;
      return;
    }

    const saleDateKey = sale.dateKey || dateKeyFrom(sale.createdAt || new Date());
    const counterRef = tenantDoc(POS_COLLECTIONS.counters, counterIdForDate(saleDateKey));
    const counterSnapshot = await transaction.get(counterRef);
    const summaryRef = tenantDoc(POS_COLLECTIONS.dailySummary, saleDateKey);
    const summarySnapshot = await transaction.get(summaryRef);

    const productRows = [];
    for (const item of items) {
      const productId = String(item.productId || item.id || '').trim();
      if (!productId) throw new Error('INVALID_PRODUCT_ID');
      const productRef = tenantDoc(RetailCollections.products, productId);
      const productSnapshot = await transaction.get(productRef);
      if (!productSnapshot.exists()) throw new Error(`PRODUCT_NOT_FOUND:${productId}`);
      const product = productSnapshot.data();
      const before = Number(product.stock || 0);
      const qty = Number(item.qty || 0);
      if (qty <= 0) throw new Error(`INVALID_QTY:${productId}`);
      if (before < qty) throw new Error(`INSUFFICIENT_STOCK:${product.name || productId}`);
      productRows.push({ item, product, productId, productRef, before, qty, after: before - qty });
    }

    const nextRunning = Number(counterSnapshot.exists() ? counterSnapshot.data().current || 0 : 0) + 1;
    syncedSaleNumber = buildRunningNumber({ dateKey: saleDateKey, running: nextRunning });
    const normalizedSale = normalizeOfflineSale(sale, { saleId, tenantId, userId, saleNumber: syncedSaleNumber });
    const nextSummary = applySaleToDailySummary(summarySnapshot.exists() ? summarySnapshot.data() : {}, normalizedSale);

    transaction.set(counterRef, {
      ...buildCounterRow({ tenantId, dateKey: saleDateKey, running: nextRunning, saleId, saleNumber: syncedSaleNumber, userId }),
      updatedAtServer: serverTimestamp()
    }, { merge: true });

    transaction.set(saleRef, { ...normalizedSale, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp() }, { merge: true });

    buildSaleItemRows(normalizedSale).forEach(item => transaction.set(tenantDoc(POS_COLLECTIONS.saleItems, item.id), {
      ...item,
      saleNumber: syncedSaleNumber,
      createdBy: userId,
      updatedBy: userId,
      deviceId: normalizedSale.deviceId || '',
      schemaVersion: POS_FIRESTORE_VERSION,
      deleted: false,
      createdAtServer: serverTimestamp(),
      updatedAt: nowMs(),
      updatedAtServer: serverTimestamp()
    }, { merge: true }));

    productRows.forEach(({ item, product, productId, productRef, before, qty, after }) => {
      transaction.update(productRef, { stock: after, tenantId, shopId: product.shopId || tenantId, updatedAt: nowMs(), updatedAtServer: serverTimestamp() });
      const movementId = `${saleId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      transaction.set(tenantDoc(RetailCollections.stockMovements, movementId), {
        id: movementId,
        tenantId,
        shopId: product.shopId || tenantId,
        deviceId: normalizedSale.deviceId || '',
        schemaVersion: POS_FIRESTORE_VERSION,
        deleted: false,
        dateKey: saleDateKey,
        monthKey: saleDateKey.slice(0, 6),
        productId,
        productName: item.name || product.name || productId,
        type: 'sale',
        direction: 'out',
        qty,
        before,
        after,
        stockBefore: before,
        stockAfter: after,
        note: `ขายสินค้า ${syncedSaleNumber}`,
        referenceType: 'sale',
        referenceId: saleId,
        referenceNumber: syncedSaleNumber,
        createdBy: userId,
        updatedBy: userId,
        createdAt: sale.createdAt || nowIso(),
        createdAtServer: serverTimestamp(),
        updatedAt: nowMs(),
        updatedAtServer: serverTimestamp()
      }, { merge: true });
    });

    transaction.set(summaryRef, { ...nextSummary, updatedBy: userId, updatedAtServer: serverTimestamp() }, { merge: true });
    transaction.set(tenantDoc(POS_COLLECTIONS.syncQueue, saleId), { ...buildSyncQueueRow(normalizedSale, { status: 'synced' }), createdBy: userId, updatedBy: userId, updatedAtServer: serverTimestamp() }, { merge: true });
  });

  markSynced(saleId, alreadyExists ? { saleNumber: syncedSaleNumber, syncNote: 'sale already existed in Firebase' } : { saleNumber: syncedSaleNumber });
  return saleId;
}

export function getOfflineSyncQueue() {
  return readSales().filter(sale => ['pending', 'syncing', 'failed', 'conflict'].includes(String(sale.syncStatus || '').toLowerCase()));
}

export function retryFailedOfflineSales({ includeConflicts = false } = {}) {
  const rows = readSales();
  let changed = 0;
  const next = rows.map(sale => {
    const status = String(sale?.syncStatus || '').toLowerCase();
    if (status === 'failed' || (includeConflicts && status === 'conflict')) {
      changed += 1;
      return { ...sale, syncStatus: 'pending', syncError: '', nextRetryAt: '', syncLockId: '', syncStartedAt: '', conflictResolution: includeConflicts ? 'retry_requested' : sale.conflictResolution || '' };
    }
    return sale;
  });
  if (changed) writeSales(next);
  return changed;
}

export function resolveOfflineSaleConflict(saleId, resolution = 'discard') {
  const id = String(saleId || '').trim();
  if (!id) return false;
  const rows = readSales();
  let changed = false;
  const next = rows.map(sale => {
    if (localSaleId(sale) !== id || sale.syncStatus !== 'conflict') return sale;
    changed = true;
    if (resolution === 'retry') return { ...sale, syncStatus: 'pending', syncError: '', nextRetryAt: '', conflictResolution: 'retry_requested' };
    return { ...sale, syncStatus: 'discarded', syncError: '', conflictResolution: 'discarded_local_sale', resolvedAt: nowIso() };
  });
  if (changed) writeSales(next);
  return changed;
}

export async function syncOfflineSalesToFirebase({ forceRetry = false } = {}) {
  if (!isFirebaseConfigured || !db || navigator.onLine === false || syncRunning) return { synced: 0, failed: 0, conflict: 0, skipped: 0 };
  syncRunning = true;
  const runId = `sync-${nowMs()}-${Math.random().toString(16).slice(2)}`;
  let synced = 0;
  let failed = 0;
  let conflict = 0;
  let skipped = 0;
  try {
    if (forceRetry) retryFailedOfflineSales();
    const pending = readSales().filter(saleNeedsSync).slice(0, MAX_RETRY_PER_RUN);
    skipped = Math.max(0, getOfflineSyncQueue().length - pending.length);
    for (const sale of pending) {
      const id = localSaleId(sale);
      try {
        markSyncing(sale, runId);
        await syncOneSale({ ...sale, syncStatus: 'syncing' });
        synced += 1;
      } catch (error) {
        console.warn('[retail-offline-sale-sync] sync failed', id, error);
        if (isConflictError(error)) {
          conflict += 1;
          markFailed(id, error, 'conflict');
          continue;
        }
        failed += 1;
        markFailed(id, error, 'failed');
        continue;
      }
    }
    if (synced || failed || conflict || skipped) window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { synced, failed, conflict, skipped } }));
    return { synced, failed, conflict, skipped };
  } finally {
    syncRunning = false;
  }
}

class OfflineQueueWorker {
  constructor() {
    this.timer = 0;
    this.delay = 1200;
  }
  start() {
    this.schedule(1200);
    window.addEventListener('online', () => this.schedule(800));
    window.addEventListener('visibilitychange', () => { if (!document.hidden) this.schedule(1000); });
    window.addEventListener('focus', () => this.schedule(1200));
    window.addEventListener('storage', event => { if (!event.key || event.key === SALES_KEY) this.schedule(1000); });
  }
  schedule(delay = this.delay) {
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      const result = await syncOfflineSalesToFirebase();
      const hasFailed = result.failed > 0 || getOfflineSyncQueue().some(sale => sale.syncStatus === 'failed' && retryDue(sale));
      if (navigator.onLine !== false && hasFailed) this.schedule(Math.min(300000, Math.max(5000, delay * 2)));
    }, delay);
  }
}

new OfflineQueueWorker().start();
