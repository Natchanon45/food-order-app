import { auth, db, isFirebaseConfigured, doc, getDoc, runTransaction, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId, RetailCollections } from './retail-db.js?v=20260629-032';
import { listLocalSales, saveLocalSales, updateLocalSale, localSaleId } from './retail-pos-repository.js?v=20260630-081';
import { POS_COLLECTIONS, POS_FIRESTORE_VERSION, dateKeyFrom, applySaleToDailySummary, buildSaleItemRows, buildSyncQueueRow } from './retail-pos-firestore-foundation.js?v=20260702-002';
import { reserveRunningNumber, POS_COUNTER_VERSION } from './retail-pos-counter.js?v=20260706-037';

export const OFFLINE_QUEUE_VERSION = 'P9-B004.1';
export const OFFLINE_SYNC_HASH_VERSION = 'sale-sync-hash-v1';

const SALES_KEY = 'retail_pos_sales_v1';
const SYNC_EVENT = 'retail-offline-sales-synced';
const WORKER_EVENT = 'retail-offline-queue-worker';
const MAX_RETRY_PER_RUN = 5;
const SYNCING_STALE_MS = 30000;
const SYNC_ONE_TIMEOUT_MS = 18000;
const RETRY_DELAYS_MS = [0, 5000, 15000, 30000, 60000, 120000, 300000];
let syncRunning = false;
let workerTimer = 0;
let workerSnapshot = { version: OFFLINE_QUEUE_VERSION, state: 'idle', lastRunAt: '', lastResult: { synced: 0, failed: 0, conflict: 0, skipped: 0 }, queueSize: 0, counts: {}, nextRunAt: '', nextRetryAt: '', conflicts: [] };

function nowIso() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }
function readSales() { return listLocalSales(); }
function writeSales(rows) { return saveLocalSales(rows || []); }
function tenantDoc(collectionName, id) { return doc(db, 'tenants', getTenantId(), collectionName, String(id)); }
function errorMessage(error) { return String(error?.message || error || 'SYNC_FAILED'); }
function normalizeStatus(status = '') { return String(status || 'pending').toLowerCase(); }
function timeoutError(label, ms) { const error = new Error(`${label}_TIMEOUT_${ms}MS`); error.code = 'SYNC_TIMEOUT'; return error; }
function withTimeout(promise, ms, label = 'SYNC') {
  let timer = 0;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError(label, ms)), ms); })
  ]);
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
function isConflictError(error) { return Boolean(conflictTypeFromError(error)); }
function retryDelayMs(attemptCount) { return RETRY_DELAYS_MS[Math.max(0, Math.min(Number(attemptCount || 0), RETRY_DELAYS_MS.length - 1))]; }
function retryDue(sale) { const next = new Date(sale?.nextRetryAt || 0).getTime(); return !next || next <= nowMs(); }
function queueStatuses() { return new Set(['pending', 'syncing', 'failed', 'conflict']); }
function isCompletedSale(sale = {}) { return String(sale?.status || '').toLowerCase() === 'completed'; }
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}
function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function saleSyncPayload(sale = {}) {
  return {
    id: localSaleId(sale),
    tenantId: sale.tenantId || sale.shopId || '',
    deviceId: sale.deviceId || '',
    createdAt: sale.createdAt || '',
    channel: sale.channel || 'retail-pos',
    orderType: sale.orderType || 'pos',
    status: sale.status || 'completed',
    paymentStatus: sale.paymentStatus || 'paid',
    items: (Array.isArray(sale.items) ? sale.items : []).map(item => ({
      productId: String(item.productId || item.id || '').trim(),
      barcode: item.barcode || '',
      name: item.name || '',
      price: Number(item.price || 0),
      cost: item.cost == null ? null : Number(item.cost),
      qty: Number(item.qty || 0),
      unit: item.unit || '',
      lineTotal: Number(item.lineTotal ?? Number(item.price || 0) * Number(item.qty || 0))
    })),
    subtotal: Number(sale.subtotal || 0),
    discount: Number(sale.discount || 0),
    pointDiscount: Number(sale.pointDiscount || 0),
    discountedBase: Number(sale.discountedBase || 0),
    taxableBase: Number(sale.taxableBase || 0),
    beforeVat: Number(sale.beforeVat || 0),
    vatAmount: Number(sale.vatAmount || 0),
    vatRate: Number(sale.vatRate || 0),
    vatMode: sale.vatMode || '',
    vatRegistered: Boolean(sale.vatRegistered),
    vatCalculationBase: sale.vatCalculationBase || '',
    total: Number(sale.total ?? sale.totalAmount ?? 0),
    totalAmount: Number(sale.totalAmount ?? sale.total ?? 0),
    paymentMethod: sale.paymentMethod || sale.payment?.method || '',
    receivedAmount: Number(sale.receivedAmount ?? sale.payment?.received ?? 0),
    changeAmount: Number(sale.changeAmount ?? sale.payment?.change ?? 0),
    customerId: sale.customerId || '',
    customerCode: sale.customerCode || '',
    customerName: sale.customerName || '',
    customerPhone: sale.customerPhone || '',
    shiftId: sale.shiftId || '',
    cashierId: sale.cashierId || '',
    cashierName: sale.cashierName || '',
    terminalCode: sale.terminalCode || ''
  };
}
export function saleSyncHash(sale = {}) { return `${OFFLINE_SYNC_HASH_VERSION}:${hashText(stableJson(saleSyncPayload(sale)))}`; }
export function saleHasSyncedFlag(sale = {}) {
  const status = normalizeStatus(sale.syncStatus);
  if (status !== 'synced' && !sale.firebaseSyncedAt && !sale.syncedAt) return false;
  return true;
}
function getOfflineSyncQueue() { return readSales().filter(sale => isCompletedSale(sale) && !saleHasSyncedFlag(sale) && queueStatuses().has(normalizeStatus(sale.syncStatus))); }

function backfillSyncedSaleFlags() {
  let changed = 0;
  const next = readSales().map(sale => {
    const hash = saleSyncHash(sale);
    const status = normalizeStatus(sale.syncStatus);
    const hasSyncMarker = status === 'synced' || Boolean(sale.firebaseSyncedAt || sale.syncedAt);
    if (!hasSyncMarker) return sale;
    if (sale.offlineSyncHash && String(sale.offlineSyncHash) !== hash) {
      changed += 1;
      return {
        ...sale,
        syncStatus: 'synced',
        firebaseSyncedAt: sale.firebaseSyncedAt || sale.syncedAt || nowIso(),
        offlineSyncHash: hash,
        syncHashVersion: OFFLINE_SYNC_HASH_VERSION,
        syncError: '',
        syncLockId: '',
        syncStartedAt: '',
        nextRetryAt: '',
        conflictType: '',
        conflictResolution: '',
        syncHashMismatchAt: sale.syncHashMismatchAt || nowIso(),
        syncHashMismatchNote: 'synced marker kept authoritative after local payload metadata changed',
        queueVersion: OFFLINE_QUEUE_VERSION
      };
    }
    if (!saleHasSyncedFlag(sale)) return sale;
    if (sale.offlineSyncHash === hash && sale.syncHashVersion === OFFLINE_SYNC_HASH_VERSION && sale.syncStatus === 'synced' && sale.firebaseSyncedAt) return sale;
    changed += 1;
    return {
      ...sale,
      syncStatus: 'synced',
      firebaseSyncedAt: sale.firebaseSyncedAt || sale.syncedAt || nowIso(),
      offlineSyncHash: hash,
      syncHashVersion: OFFLINE_SYNC_HASH_VERSION,
      syncError: '',
      syncLockId: '',
      syncStartedAt: '',
      nextRetryAt: '',
      conflictType: '',
      conflictResolution: '',
      queueVersion: OFFLINE_QUEUE_VERSION
    };
  });
  if (changed) writeSales(next);
  return changed;
}

export function getOfflineSyncQueueDetails() {
  const queue = getOfflineSyncQueue();
  const counts = queue.reduce((acc, sale) => { const status = normalizeStatus(sale.syncStatus); acc[status] = Number(acc[status] || 0) + 1; return acc; }, {});
  const conflicts = queue.filter(sale => normalizeStatus(sale.syncStatus) === 'conflict').map(sale => ({ id: localSaleId(sale), saleNumber: sale.saleNumber || sale.localSaleNumber || '', conflictType: sale.conflictType || '', error: sale.syncError || '', total: Number(sale.totalAmount ?? sale.total ?? 0), createdAt: sale.createdAt || '' }));
  const failed = queue.filter(sale => normalizeStatus(sale.syncStatus) === 'failed');
  const nextRetryAt = failed.map(sale => new Date(sale.nextRetryAt || 0).getTime()).filter(Boolean).sort((a, b) => a - b)[0] || 0;
  return { version: OFFLINE_QUEUE_VERSION, queueSize: queue.length, counts, conflicts, failedCount: failed.length, nextRetryAt: nextRetryAt ? new Date(nextRetryAt).toISOString() : '' };
}

function updateWorkerSnapshot(patch = {}) {
  const details = getOfflineSyncQueueDetails();
  workerSnapshot = { ...workerSnapshot, ...details, ...patch, version: OFFLINE_QUEUE_VERSION };
  document.documentElement.dataset.offlineQueueState = workerSnapshot.state;
  document.documentElement.dataset.offlineQueueSize = String(workerSnapshot.queueSize || 0);
  window.dispatchEvent(new CustomEvent(WORKER_EVENT, { detail: workerSnapshot }));
  return workerSnapshot;
}
export function getOfflineQueueWorkerSnapshot() { return { ...workerSnapshot, ...getOfflineSyncQueueDetails() }; }

function saleNeedsSync(sale) {
  if (!sale || !isCompletedSale(sale)) return false;
  const status = normalizeStatus(sale.syncStatus);
  if (saleHasSyncedFlag(sale)) return false;
  if (status === 'discarded' || status === 'conflict_resolved') return false;
  if (status === 'conflict') return false;
  if (status === 'syncing') { const started = new Date(sale.syncStartedAt || 0).getTime(); if (started && nowMs() - started < SYNCING_STALE_MS) return false; }
  if (status === 'failed' && !retryDue(sale)) return false;
  return Boolean(localSaleId(sale));
}
function markSale(id, patch) { updateLocalSale(id, { ...patch, queueVersion: OFFLINE_QUEUE_VERSION }); }
function markSyncing(sale, lockId) { const id = localSaleId(sale); const attemptCount = Number(sale.syncAttemptCount || 0) + 1; markSale(id, { syncStatus: 'syncing', syncLockId: lockId, syncStartedAt: nowIso(), lastSyncAttemptAt: nowIso(), syncAttemptCount: attemptCount, syncError: '', nextRetryAt: '', conflictType: '', queueVersion: OFFLINE_QUEUE_VERSION }); }
function markSynced(id, extra = {}) {
  const current = readSales().find(sale => localSaleId(sale) === id) || {};
  const payload = { ...current, ...extra, syncStatus: 'synced' };
  markSale(id, { syncStatus: 'synced', firebaseSyncedAt: nowIso(), offlineSyncHash: saleSyncHash(payload), syncHashVersion: OFFLINE_SYNC_HASH_VERSION, syncError: '', syncLockId: '', syncStartedAt: '', nextRetryAt: '', conflictType: '', conflictResolution: '', queueVersion: OFFLINE_QUEUE_VERSION, ...extra });
}
function markFailed(id, error, status = 'failed') {
  const current = readSales().find(sale => localSaleId(sale) === id) || {};
  const attemptCount = Number(current.syncAttemptCount || 0);
  const isConflict = status === 'conflict';
  const delay = isConflict ? 0 : retryDelayMs(attemptCount);
  markSale(id, { syncStatus: status, syncError: errorMessage(error), syncLockId: '', syncStartedAt: '', lastSyncAttemptAt: nowIso(), nextRetryAt: isConflict ? '' : new Date(nowMs() + delay).toISOString(), conflictType: isConflict ? conflictTypeFromError(error) : '', conflictResolution: isConflict ? 'manual_required' : '', retryDelayMs: delay, queueVersion: OFFLINE_QUEUE_VERSION });
}

export function recoverStaleSyncingSales({ force = false } = {}) {
  let changed = 0;
  const next = readSales().map(sale => {
    if (normalizeStatus(sale.syncStatus) !== 'syncing') return sale;
    const started = new Date(sale.syncStartedAt || 0).getTime();
    if (!force && started && nowMs() - started < SYNCING_STALE_MS) return sale;
    changed += 1;
    return { ...sale, syncStatus: 'failed', syncError: 'RECOVERED_STALE_SYNCING', syncLockId: '', syncStartedAt: '', nextRetryAt: new Date(nowMs() + 5000).toISOString(), recoveredAt: nowIso(), queueVersion: OFFLINE_QUEUE_VERSION };
  });
  if (changed) { writeSales(next); updateWorkerSnapshot({ state: 'stale_recovered' }); }
  return changed;
}

async function reconcileRemoteSyncedSales({ limit = 100 } = {}) {
  if (!isFirebaseConfigured || !db || navigator.onLine === false) return 0;
  const tenantId = getTenantId();
  const active = readSales()
    .filter(sale => isCompletedSale(sale) && !saleHasSyncedFlag(sale) && queueStatuses().has(normalizeStatus(sale.syncStatus)))
    .filter(sale => localSaleId(sale))
    .slice(0, limit);
  let changed = 0;
  for (const sale of active) {
    const saleId = localSaleId(sale);
    try {
      const snap = await getDoc(tenantDoc(RetailCollections.sales, saleId));
      if (!snap.exists()) continue;
      const remote = snap.data() || {};
      if (remote.tenantId && String(remote.tenantId) !== String(tenantId)) continue;
      markSynced(saleId, {
        saleNumber: remote.saleNumber || sale.saleNumber || saleId,
        finalSaleNumber: remote.finalSaleNumber || remote.saleNumber || sale.finalSaleNumber || sale.saleNumber || saleId,
        runningNumberStatus: remote.runningNumberStatus || sale.runningNumberStatus || 'reserved',
        syncNote: 'remote sale already exists in Firebase',
        reconciledFromRemoteAt: nowIso()
      });
      changed += 1;
    } catch (error) {
      console.warn('[retail-offline-sale-sync] remote reconcile skipped', saleId, error);
    }
  }
  if (changed) updateWorkerSnapshot({ state: 'remote_reconciled', lastReconciled: changed, lastReconciledAt: nowIso() });
  return changed;
}

function normalizeOfflineSale(sale, { saleId, tenantId, userId, saleNumber, counterReserved }) {
  const createdAt = sale.createdAt || nowIso();
  const dateKey = sale.dateKey || dateKeyFrom(createdAt);
  const monthKey = sale.monthKey || dateKey.slice(0, 6);
  return { ...sale, id: saleId, saleNumber, finalSaleNumber: saleNumber, runningNumberStatus: 'reserved', runningNumberType: 'SALE', counterVersion: POS_COUNTER_VERSION, counterReserved: Boolean(counterReserved), tenantId, shopId: tenantId, schemaVersion: POS_FIRESTORE_VERSION, channel: sale.channel || 'retail-pos', orderType: sale.orderType || 'pos', dateKey, monthKey, deleted: false, syncStatus: 'synced', syncedFromOffline: true, syncedAt: nowIso(), syncedBy: userId, paymentStatus: sale.paymentStatus || 'paid', status: sale.status || 'completed', updatedAt: nowMs(), queueVersion: OFFLINE_QUEUE_VERSION };
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
  let alreadyReserved = false;
  await runTransaction(db, async transaction => {
    const existingSale = await transaction.get(saleRef);
    if (existingSale.exists()) { alreadyExists = true; syncedSaleNumber = existingSale.data()?.saleNumber || syncedSaleNumber; return; }
    const saleDateValue = sale.createdAt || new Date();
    const saleDateKey = sale.dateKey || dateKeyFrom(saleDateValue);
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
    const reserved = await reserveRunningNumber(transaction, db, { type: 'SALE', value: saleDateValue, tenantId, documentId: saleId, userId });
    syncedSaleNumber = reserved.documentNumber;
    alreadyReserved = Boolean(reserved.alreadyReserved);
    const normalizedSale = normalizeOfflineSale(sale, { saleId, tenantId, userId, saleNumber: syncedSaleNumber, counterReserved: true });
    const nextSummary = applySaleToDailySummary(summarySnapshot.exists() ? summarySnapshot.data() : {}, normalizedSale);
    transaction.set(saleRef, { ...normalizedSale, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp() }, { merge: true });
    buildSaleItemRows(normalizedSale).forEach(item => transaction.set(tenantDoc(POS_COLLECTIONS.saleItems, item.id), { ...item, saleNumber: syncedSaleNumber, createdBy: userId, updatedBy: userId, deviceId: normalizedSale.deviceId || '', schemaVersion: POS_FIRESTORE_VERSION, deleted: false, createdAtServer: serverTimestamp(), updatedAt: nowMs(), updatedAtServer: serverTimestamp() }, { merge: true }));
    productRows.forEach(({ item, product, productId, productRef, before, qty, after }) => {
      transaction.update(productRef, { stock: after, tenantId, shopId: product.shopId || tenantId, updatedAt: nowMs(), updatedAtServer: serverTimestamp() });
      const movementId = `${saleId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      transaction.set(tenantDoc(RetailCollections.stockMovements, movementId), { id: movementId, tenantId, shopId: product.shopId || tenantId, deviceId: normalizedSale.deviceId || '', schemaVersion: POS_FIRESTORE_VERSION, deleted: false, dateKey: saleDateKey, monthKey: saleDateKey.slice(0, 6), productId, productName: item.name || product.name || productId, type: 'sale', direction: 'out', qty, before, after, stockBefore: before, stockAfter: after, note: `ขายสินค้า ${syncedSaleNumber}`, referenceType: 'sale', referenceId: saleId, referenceNumber: syncedSaleNumber, createdBy: userId, updatedBy: userId, createdAt: sale.createdAt || nowIso(), createdAtServer: serverTimestamp(), updatedAt: nowMs(), updatedAtServer: serverTimestamp() }, { merge: true });
    });
    transaction.set(summaryRef, { ...nextSummary, updatedBy: userId, updatedAtServer: serverTimestamp() }, { merge: true });
    transaction.set(tenantDoc(POS_COLLECTIONS.syncQueue, saleId), { ...buildSyncQueueRow(normalizedSale, { status: 'synced' }), queueVersion: OFFLINE_QUEUE_VERSION, createdBy: userId, updatedBy: userId, updatedAtServer: serverTimestamp() }, { merge: true });
  });
  markSynced(saleId, alreadyExists ? { saleNumber: syncedSaleNumber, syncNote: 'sale already existed in Firebase' } : { saleNumber: syncedSaleNumber, finalSaleNumber: syncedSaleNumber, runningNumberStatus: 'reserved', counterVersion: POS_COUNTER_VERSION, counterAlreadyReserved: alreadyReserved });
  return saleId;
}
export { getOfflineSyncQueue };

export function retryFailedOfflineSales({ includeConflicts = false, saleId = '' } = {}) {
  let changed = 0;
  const targetId = String(saleId || '').trim();
  const next = readSales().map(sale => {
    const id = localSaleId(sale);
    const status = normalizeStatus(sale.syncStatus);
    const matchTarget = !targetId || id === targetId;
    if (matchTarget && (status === 'failed' || (includeConflicts && status === 'conflict'))) { changed += 1; return { ...sale, syncStatus: 'pending', syncError: '', nextRetryAt: '', syncLockId: '', syncStartedAt: '', conflictResolution: includeConflicts ? 'retry_requested' : sale.conflictResolution || '', retryRequestedAt: nowIso(), queueVersion: OFFLINE_QUEUE_VERSION }; }
    return sale;
  });
  if (changed) { writeSales(next); updateWorkerSnapshot({ state: 'retry_queued' }); scheduleOfflineQueueRun(600); }
  return changed;
}

export function resolveOfflineSaleConflict(saleId, resolution = 'discard') {
  const id = String(saleId || '').trim();
  if (!id) return false;
  let changed = false;
  const next = readSales().map(sale => {
    if (localSaleId(sale) !== id || normalizeStatus(sale.syncStatus) !== 'conflict') return sale;
    changed = true;
    if (resolution === 'retry') return { ...sale, syncStatus: 'pending', syncError: '', nextRetryAt: '', conflictResolution: 'retry_requested', retryRequestedAt: nowIso(), queueVersion: OFFLINE_QUEUE_VERSION };
    return { ...sale, syncStatus: 'discarded', syncError: '', conflictResolution: 'discarded_local_sale', resolvedAt: nowIso(), queueVersion: OFFLINE_QUEUE_VERSION };
  });
  if (changed) { writeSales(next); updateWorkerSnapshot({ state: resolution === 'retry' ? 'conflict_retry_queued' : 'conflict_discarded' }); if (resolution === 'retry') scheduleOfflineQueueRun(600); }
  return changed;
}
export function resolveAllOfflineSaleConflicts(resolution = 'discard') { return getOfflineSyncQueueDetails().conflicts.reduce((count, item) => count + (resolveOfflineSaleConflict(item.id, resolution) ? 1 : 0), 0); }

export async function syncOfflineSalesToFirebase({ forceRetry = false } = {}) {
  if (!isFirebaseConfigured || !db || navigator.onLine === false) { updateWorkerSnapshot({ state: navigator.onLine === false ? 'offline' : 'disabled' }); return { synced: 0, failed: 0, conflict: 0, skipped: 0 }; }
  if (syncRunning) return { synced: 0, failed: 0, conflict: 0, skipped: getOfflineSyncQueue().length };
  syncRunning = true;
  backfillSyncedSaleFlags();
  await reconcileRemoteSyncedSales();
  recoverStaleSyncingSales();
  const runId = `sync-${nowMs()}-${Math.random().toString(16).slice(2)}`;
  let synced = 0, failed = 0, conflict = 0, skipped = 0;
  updateWorkerSnapshot({ state: 'syncing', lastRunAt: nowIso() });
  try {
    if (forceRetry) retryFailedOfflineSales();
    const pending = readSales().filter(saleNeedsSync).slice(0, MAX_RETRY_PER_RUN);
    skipped = Math.max(0, getOfflineSyncQueue().length - pending.length);
    for (const sale of pending) {
      const id = localSaleId(sale);
      try {
        markSyncing(sale, runId);
        await withTimeout(syncOneSale({ ...sale, syncStatus: 'syncing' }), SYNC_ONE_TIMEOUT_MS, `SYNC_SALE_${id}`);
        synced += 1;
      } catch (error) {
        console.warn('[retail-offline-sale-sync] sync failed', id, error);
        if (isConflictError(error)) { conflict += 1; markFailed(id, error, 'conflict'); continue; }
        failed += 1;
        markFailed(id, error, 'failed');
      }
    }
    const result = { synced, failed, conflict, skipped };
    updateWorkerSnapshot({ state: conflict ? 'conflict' : failed ? 'failed' : 'idle', lastResult: result, finishedAt: nowIso() });
    if (synced || failed || conflict || skipped) window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: result }));
    return result;
  } finally {
    syncRunning = false;
    const details = getOfflineSyncQueueDetails();
    if (!details.counts.syncing) updateWorkerSnapshot({ state: details.queueSize ? (details.counts.conflict ? 'conflict' : details.counts.failed ? 'failed' : 'idle') : 'idle', finishedAt: nowIso() });
  }
}

export function scheduleOfflineQueueRun(delay = 1200) {
  clearTimeout(workerTimer);
  backfillSyncedSaleFlags();
  recoverStaleSyncingSales();
  if (!getOfflineSyncQueue().length) {
    updateWorkerSnapshot({ state: navigator.onLine === false ? 'offline' : 'idle', nextRunAt: '' });
    return;
  }
  const state = navigator.onLine === false ? 'offline' : 'scheduled';
  updateWorkerSnapshot({ state, nextRunAt: new Date(nowMs() + delay).toISOString() });
  workerTimer = setTimeout(async () => {
    const result = await syncOfflineSalesToFirebase();
    const hasRetryDue = getOfflineSyncQueue().some(sale => normalizeStatus(sale.syncStatus) === 'failed' && retryDue(sale));
    if (navigator.onLine !== false && result.skipped > 0) scheduleOfflineQueueRun(800);
    else if (navigator.onLine !== false && (result.failed > 0 || hasRetryDue)) scheduleOfflineQueueRun(Math.min(300000, Math.max(5000, delay * 2)));
  }, delay);
}

function exposeQueueApi() {
  window.retailOfflineQueue = Object.freeze({ version: OFFLINE_QUEUE_VERSION, snapshot: getOfflineQueueWorkerSnapshot, details: getOfflineSyncQueueDetails, sync: syncOfflineSalesToFirebase, reconcileRemote: reconcileRemoteSyncedSales, retryFailed: retryFailedOfflineSales, retryConflict: saleId => resolveOfflineSaleConflict(saleId, 'retry'), discardConflict: saleId => resolveOfflineSaleConflict(saleId, 'discard'), resolveAllConflicts: resolveAllOfflineSaleConflicts, recoverStale: recoverStaleSyncingSales, recoverNow: () => recoverStaleSyncingSales({ force: true }), schedule: scheduleOfflineQueueRun });
}
class OfflineQueueWorker {
  start() {
    exposeQueueApi();
    backfillSyncedSaleFlags();
    recoverStaleSyncingSales({ force: true });
    scheduleOfflineQueueRun(1200);
    window.addEventListener('online', () => scheduleOfflineQueueRun(800));
    window.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleOfflineQueueRun(1000); });
    window.addEventListener('focus', () => scheduleOfflineQueueRun(1200));
    window.addEventListener('storage', event => { if (!event.key || event.key === SALES_KEY) scheduleOfflineQueueRun(1000); });
  }
}
new OfflineQueueWorker().start();
