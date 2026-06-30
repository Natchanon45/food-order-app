import { auth, db, isFirebaseConfigured, doc, runTransaction, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId, RetailCollections } from './retail-db.js?v=20260629-032';
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
let syncRunning = false;

function readSales() {
  try {
    const rows = JSON.parse(localStorage.getItem(SALES_KEY));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeSales(rows) {
  localStorage.setItem(SALES_KEY, JSON.stringify(rows || []));
}

function tenantDoc(collectionName, id) {
  return doc(db, 'tenants', getTenantId(), collectionName, String(id));
}

function localSaleId(sale) {
  return String(sale?.id || sale?.saleNumber || '').trim();
}

function isConflictError(error) {
  const message = String(error?.message || error || '');
  return message.startsWith('TENANT_MISMATCH:')
    || message.startsWith('INSUFFICIENT_STOCK:')
    || message.startsWith('PRODUCT_NOT_FOUND:')
    || message.startsWith('INVALID_PRODUCT_ID')
    || message.startsWith('INVALID_QTY:');
}

function saleNeedsSync(sale) {
  if (!sale || sale.status !== 'completed') return false;
  if (sale.firebaseSyncedAt || sale.syncStatus === 'synced') return false;
  if (sale.syncStatus === 'conflict') return false;
  if (sale.syncStatus === 'syncing') {
    const started = new Date(sale.syncStartedAt || 0).getTime();
    if (started && Date.now() - started < 30000) return false;
  }
  return Boolean(localSaleId(sale));
}

function markSale(id, patch) {
  const rows = readSales();
  const next = rows.map(sale => localSaleId(sale) === id ? { ...sale, ...patch } : sale);
  writeSales(next);
}

function markSyncing(sale, lockId) {
  const id = localSaleId(sale);
  markSale(id, {
    syncStatus: 'syncing',
    syncLockId: lockId,
    syncStartedAt: new Date().toISOString(),
    lastSyncAttemptAt: new Date().toISOString(),
    syncAttemptCount: Number(sale.syncAttemptCount || 0) + 1,
    syncError: ''
  });
}

function markSynced(id, extra = {}) {
  markSale(id, {
    syncStatus: 'synced',
    firebaseSyncedAt: new Date().toISOString(),
    syncError: '',
    syncLockId: '',
    syncStartedAt: '',
    ...extra
  });
}

function markFailed(id, error, status = 'failed') {
  markSale(id, {
    syncStatus: status,
    syncError: String(error?.message || error || 'SYNC_FAILED'),
    syncLockId: '',
    syncStartedAt: '',
    lastSyncAttemptAt: new Date().toISOString()
  });
}

function normalizeOfflineSale(sale, { saleId, tenantId, userId, saleNumber }) {
  const createdAt = sale.createdAt || new Date().toISOString();
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
    syncedAt: new Date().toISOString(),
    syncedBy: userId,
    paymentStatus: sale.paymentStatus || 'paid',
    status: sale.status || 'completed',
    updatedAt: Date.now()
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

    transaction.set(saleRef, {
      ...normalizedSale,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp()
    }, { merge: true });

    buildSaleItemRows(normalizedSale).forEach(item => transaction.set(tenantDoc(POS_COLLECTIONS.saleItems, item.id), {
      ...item,
      saleNumber: syncedSaleNumber,
      createdBy: userId,
      updatedBy: userId,
      deviceId: normalizedSale.deviceId || '',
      schemaVersion: POS_FIRESTORE_VERSION,
      deleted: false,
      createdAtServer: serverTimestamp(),
      updatedAt: Date.now(),
      updatedAtServer: serverTimestamp()
    }, { merge: true }));

    productRows.forEach(({ item, product, productId, productRef, before, qty, after }) => {
      transaction.update(productRef, {
        stock: after,
        tenantId,
        shopId: product.shopId || tenantId,
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp()
      });

      const movementId = `${saleId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const movementRef = tenantDoc(RetailCollections.stockMovements, movementId);
      transaction.set(movementRef, {
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
        createdAt: sale.createdAt || new Date().toISOString(),
        createdAtServer: serverTimestamp(),
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp()
      }, { merge: true });
    });

    transaction.set(summaryRef, { ...nextSummary, updatedBy: userId, updatedAtServer: serverTimestamp() }, { merge: true });
    transaction.set(tenantDoc(POS_COLLECTIONS.syncQueue, saleId), { ...buildSyncQueueRow(normalizedSale, { status: 'synced' }), createdBy: userId, updatedBy: userId, updatedAtServer: serverTimestamp() }, { merge: true });
  });

  markSynced(saleId, alreadyExists ? { saleNumber: syncedSaleNumber, syncNote: 'sale already existed in Firebase' } : { saleNumber: syncedSaleNumber });
  return saleId;
}

export async function syncOfflineSalesToFirebase() {
  if (!isFirebaseConfigured || !db || navigator.onLine === false || syncRunning) return { synced: 0, failed: 0, conflict: 0 };
  syncRunning = true;
  const runId = `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let synced = 0;
  let failed = 0;
  let conflict = 0;
  try {
    const pending = readSales().filter(saleNeedsSync).slice(0, MAX_RETRY_PER_RUN);
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
        break;
      }
    }
    if (synced || failed || conflict) window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { synced, failed, conflict } }));
    return { synced, failed, conflict };
  } finally {
    syncRunning = false;
  }
}

window.addEventListener('online', () => setTimeout(syncOfflineSalesToFirebase, 800));
window.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncOfflineSalesToFirebase();
});
setTimeout(syncOfflineSalesToFirebase, 1200);
