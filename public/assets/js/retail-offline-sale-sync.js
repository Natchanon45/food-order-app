import { auth, db, isFirebaseConfigured, doc, runTransaction, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId, RetailCollections } from './retail-db.js?v=20260629-032';

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

async function syncOneSale(sale) {
  const saleId = localSaleId(sale);
  const tenantId = getTenantId();
  if (sale.tenantId && String(sale.tenantId) !== String(tenantId)) throw new Error(`TENANT_MISMATCH:${saleId}`);

  const userId = auth?.currentUser?.uid || sale.cashierId || '';
  const saleRef = tenantDoc(RetailCollections.sales, saleId);
  const items = Array.isArray(sale.items) ? sale.items : [];
  let alreadyExists = false;

  await runTransaction(db, async transaction => {
    const existingSale = await transaction.get(saleRef);
    if (existingSale.exists()) {
      alreadyExists = true;
      return;
    }

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

    transaction.set(saleRef, {
      ...sale,
      id: saleId,
      tenantId,
      shopId: sale.shopId || tenantId,
      syncStatus: 'synced',
      syncedFromOffline: true,
      syncedAt: new Date().toISOString(),
      syncedBy: userId,
      createdAtServer: serverTimestamp(),
      updatedAt: Date.now(),
      updatedAtServer: serverTimestamp()
    }, { merge: true });

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
        productId,
        productName: item.name || product.name || productId,
        type: 'sale',
        direction: 'out',
        qty,
        before,
        after,
        stockBefore: before,
        stockAfter: after,
        note: `ขายสินค้า ${sale.saleNumber || saleId}`,
        referenceType: 'sale',
        referenceId: saleId,
        referenceNumber: sale.saleNumber || saleId,
        createdBy: userId,
        createdAt: sale.createdAt || new Date().toISOString(),
        createdAtServer: serverTimestamp()
      }, { merge: true });
    });
  });

  markSynced(saleId, alreadyExists ? { syncNote: 'sale already existed in Firebase' } : {});
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
