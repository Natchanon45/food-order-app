import { auth, db, isFirebaseConfigured, doc, runTransaction, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId, RetailCollections } from './retail-db.js?v=20260629-032';
import { POS_COLLECTIONS, POS_FIRESTORE_VERSION, POS_CHANNEL, getDeviceId, dateKeyFrom, monthKeyFrom } from './retail-pos-firestore-foundation.js?v=20260702-002';
import { reserveRunningNumber } from './retail-pos-counter.js?v=20260702-003';
import { POS_AUDIT_ACTIONS, buildAuditLogRow, setAuditLogInTransaction } from './retail-pos-audit-log.js?v=20260702-008';
import { getActiveShiftLocal } from './retail-pos-shift.js?v=20260702-009';

export const POS_RETURN_VERSION = 'P9-B009';

function nowIso() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }
function safeId(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_'); }
function tenantDoc(collectionName, id, tenantId = getTenantId()) { return doc(db, 'tenants', tenantId, collectionName, String(id)); }

export function buildReturnId({ saleId, mode = 'return', items = [], createdAt = nowIso() } = {}) {
  const itemKey = (items || []).map(item => `${item.productId || item.id || ''}_${Number(item.qty || 0)}`).join('_') || 'all';
  return safeId(`${mode}_${saleId}_${itemKey}_${new Date(createdAt).getTime() || Date.now()}`);
}

export function normalizeReturnItems(sale = {}, requestedItems = []) {
  const saleItems = Array.isArray(sale.items) ? sale.items : [];
  const requests = Array.isArray(requestedItems) && requestedItems.length ? requestedItems : saleItems.map(item => ({ productId: item.productId || item.id, qty: item.qty }));
  return requests.map(request => {
    const productId = String(request.productId || request.id || '').trim();
    const saleItem = saleItems.find(item => String(item.productId || item.id || '') === productId);
    if (!saleItem) throw new Error(`RETURN_PRODUCT_NOT_IN_SALE:${productId}`);
    const qty = Number(request.qty || 0);
    const soldQty = Number(saleItem.qty || 0);
    if (qty <= 0) throw new Error(`RETURN_INVALID_QTY:${productId}`);
    if (qty > soldQty) throw new Error(`RETURN_QTY_EXCEEDS_SALE:${productId}`);
    const price = Number(saleItem.price || 0);
    return {
      productId,
      barcode: saleItem.barcode || '',
      name: saleItem.name || request.name || productId,
      unit: saleItem.unit || 'ชิ้น',
      qty,
      price,
      lineTotal: qty * price
    };
  });
}

export function buildReturnRow({
  id,
  returnNumber,
  sale,
  items,
  mode = 'return',
  reason = '',
  userId = auth?.currentUser?.uid || '',
  tenantId = getTenantId(),
  createdAt = nowIso(),
  deviceId = getDeviceId()
} = {}) {
  const activeShift = getActiveShiftLocal();
  const refundTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  return {
    id,
    returnNumber,
    tenantId,
    shopId: tenantId,
    deviceId,
    schemaVersion: POS_FIRESTORE_VERSION,
    returnVersion: POS_RETURN_VERSION,
    deleted: false,
    channel: POS_CHANNEL,
    orderType: 'pos',
    mode,
    status: mode === 'void' ? 'voided' : 'completed',
    saleId: sale.id,
    saleNumber: sale.saleNumber || sale.number || '',
    items,
    refundTotal,
    reason: String(reason || ''),
    shiftId: activeShift?.id || sale.shiftId || '',
    cashierId: userId,
    createdBy: userId,
    updatedBy: userId,
    createdAt,
    updatedAt: nowMs()
  };
}

function returnedQtyByProduct(sale = {}) {
  const rows = Array.isArray(sale.returns) ? sale.returns : [];
  return rows.reduce((acc, row) => {
    (row.items || []).forEach(item => { acc[item.productId] = Number(acc[item.productId] || 0) + Number(item.qty || 0); });
    return acc;
  }, {});
}

function validateNotAlreadyReturned(sale = {}, returnId, items = []) {
  const returns = Array.isArray(sale.returns) ? sale.returns : [];
  if (returns.some(row => row.id === returnId)) throw new Error(`RETURN_ALREADY_EXISTS:${returnId}`);
  const returned = returnedQtyByProduct(sale);
  items.forEach(item => {
    const saleItem = (sale.items || []).find(row => String(row.productId || row.id || '') === String(item.productId));
    const soldQty = Number(saleItem?.qty || 0);
    const already = Number(returned[item.productId] || 0);
    if (already + Number(item.qty || 0) > soldQty) throw new Error(`RETURN_QTY_EXCEEDS_REMAINING:${item.productId}`);
  });
}

export async function createReturnOrRefund({ saleId, items = [], mode = 'return', reason = '' } = {}) {
  if (!isFirebaseConfigured || !db) throw new Error('FIREBASE_REQUIRED');
  const userId = auth?.currentUser?.uid || '';
  if (!userId) throw new Error('AUTH_REQUIRED');
  const tenantId = getTenantId();
  const createdAt = nowIso();
  let committed = null;
  await runTransaction(db, async transaction => {
    const saleRef = tenantDoc(RetailCollections.sales, saleId, tenantId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error(`SALE_NOT_FOUND:${saleId}`);
    const sale = { id: saleSnap.id, ...saleSnap.data() };
    if (sale.status !== 'completed') throw new Error(`SALE_NOT_COMPLETED:${saleId}`);
    if (sale.tenantId && String(sale.tenantId) !== String(tenantId)) throw new Error(`TENANT_MISMATCH:${saleId}`);
    const normalizedItems = normalizeReturnItems(sale, items);
    const returnId = buildReturnId({ saleId, mode, items: normalizedItems, createdAt });
    validateNotAlreadyReturned(sale, returnId, normalizedItems);

    const productRows = [];
    for (const item of normalizedItems) {
      const productRef = tenantDoc(RetailCollections.products, item.productId, tenantId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
      const product = productSnap.data();
      const before = Number(product.stock || 0);
      const after = before + Number(item.qty || 0);
      productRows.push({ item, product, productRef, before, after });
    }

    const reserved = await reserveRunningNumber(transaction, db, { type: mode === 'void' ? 'VOID' : 'REFUND', value: createdAt, tenantId, documentId: returnId, userId });
    const returnNumber = reserved.documentNumber;
    const returnRow = buildReturnRow({ id: returnId, returnNumber, sale, items: normalizedItems, mode, reason, userId, tenantId, createdAt });
    const returnRef = tenantDoc(RetailCollections.returns, returnId, tenantId);

    transaction.set(returnRef, { ...returnRow, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp() }, { merge: true });

    productRows.forEach(({ item, product, productRef, before, after }) => {
      transaction.update(productRef, { stock: after, tenantId, shopId: product.shopId || tenantId, updatedAt: nowMs(), updatedAtServer: serverTimestamp() });
      const movementId = safeId(`${returnId}_${item.productId}`);
      transaction.set(tenantDoc(RetailCollections.stockMovements, movementId, tenantId), {
        id: movementId,
        tenantId,
        shopId: product.shopId || tenantId,
        deviceId: returnRow.deviceId,
        schemaVersion: POS_FIRESTORE_VERSION,
        deleted: false,
        dateKey: dateKeyFrom(createdAt),
        monthKey: monthKeyFrom(createdAt),
        productId: item.productId,
        productName: item.name || product.name || item.productId,
        type: 'return',
        direction: 'in',
        qty: Number(item.qty || 0),
        before,
        after,
        stockBefore: before,
        stockAfter: after,
        note: `${mode === 'void' ? 'Void' : 'คืนสินค้า'} ${returnNumber}`,
        referenceType: mode,
        referenceId: returnId,
        referenceNumber: returnNumber,
        saleId,
        createdBy: userId,
        updatedBy: userId,
        createdAt,
        createdAtServer: serverTimestamp(),
        updatedAt: nowMs(),
        updatedAtServer: serverTimestamp()
      }, { merge: true });
    });

    const nextReturns = [ ...(Array.isArray(sale.returns) ? sale.returns : []), { id: returnId, returnNumber, mode, refundTotal: returnRow.refundTotal, items: normalizedItems, createdAt } ];
    const nextRefundTotal = Number(sale.refundTotal || 0) + Number(returnRow.refundTotal || 0);
    transaction.set(saleRef, { returns: nextReturns, refundTotal: nextRefundTotal, loyalty: sale.loyalty || null, updatedAt: nowMs(), updatedAtServer: serverTimestamp(), tenantId, shopId: tenantId }, { merge: true });

    setAuditLogInTransaction(transaction, buildAuditLogRow({ action: mode === 'void' ? POS_AUDIT_ACTIONS.VOID_CREATED : POS_AUDIT_ACTIONS.RETURN_CREATED, entityType: mode, entityId: returnId, entityNumber: returnNumber, userId, deviceId: returnRow.deviceId, tenantId, createdAt, summary: { saleId, saleNumber: returnRow.saleNumber, refundTotal: returnRow.refundTotal, itemCount: normalizedItems.length, mode } }));
    committed = returnRow;
  });
  return committed;
}

export function createReturn(options = {}) { return createReturnOrRefund({ ...options, mode: 'return' }); }
export function createRefund(options = {}) { return createReturnOrRefund({ ...options, mode: 'refund' }); }
export function createVoid(options = {}) { return createReturnOrRefund({ ...options, mode: 'void' }); }
