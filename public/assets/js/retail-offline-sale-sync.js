import { auth, db, isFirebaseConfigured, doc, runTransaction, serverTimestamp } from './firebase-config.js?v=20260628-1';
import { getTenantId, RetailCollections } from './retail-db.js?v=20260628-6';

const SALES_KEY = 'retail_pos_sales_v1';
const SYNC_EVENT = 'retail-offline-sales-synced';
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

function saleNeedsSync(sale) {
  if (!sale || sale.status !== 'completed') return false;
  if (sale.firebaseSyncedAt) return false;
  if (sale.syncStatus === 'conflict') return false;
  return Boolean(localSaleId(sale));
}

function markSale(id, patch) {
  const rows = readSales();
  const next = rows.map(sale => localSaleId(sale) === id ? { ...sale, ...patch } : sale);
  writeSales(next);
}

async function syncOneSale(sale) {
  const saleId = localSaleId(sale);
  const tenantId = getTenantId();
  const userId = auth?.currentUser?.uid || sale.cashierId || '';
  const saleRef = tenantDoc(RetailCollections.sales, saleId);
  const items = Array.isArray(sale.items) ? sale.items : [];

  await runTransaction(db, async transaction => {
    const existingSale = await transaction.get(saleRef);
    if (existingSale.exists()) return;

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

  markSale(saleId, {
    syncStatus: 'synced',
    firebaseSyncedAt: new Date().toISOString(),
    syncError: ''
  });
  return saleId;
}

export async function syncOfflineSalesToFirebase() {
  if (!isFirebaseConfigured || !db || navigator.onLine === false || syncRunning) return { synced: 0, failed: 0 };
  syncRunning = true;
  let synced = 0;
  let failed = 0;
  try {
    const pending = readSales().filter(saleNeedsSync);
    for (const sale of pending) {
      const id = localSaleId(sale);
      try {
        await syncOneSale(sale);
        synced += 1;
      } catch (error) {
        failed += 1;
        console.warn('[retail-offline-sale-sync] sync failed', id, error);
        markSale(id, {
          syncStatus: String(error?.message || '').startsWith('INSUFFICIENT_STOCK:') ? 'conflict' : 'pending',
          syncError: String(error?.message || error || 'SYNC_FAILED'),
          lastSyncAttemptAt: new Date().toISOString()
        });
        if (String(error?.message || '').startsWith('INSUFFICIENT_STOCK:')) continue;
        break;
      }
    }
    if (synced || failed) window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { synced, failed } }));
    return { synced, failed };
  } finally {
    syncRunning = false;
  }
}

window.addEventListener('online', () => setTimeout(syncOfflineSalesToFirebase, 800));
window.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncOfflineSalesToFirebase();
});
setTimeout(syncOfflineSalesToFirebase, 1200);
