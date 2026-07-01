import { auth, db, isFirebaseConfigured, doc, serverTimestamp, setDoc } from './firebase-config.js?v=20260630-073';
import { getTenantId } from './retail-db.js?v=20260629-032';
import { POS_COLLECTIONS, POS_FIRESTORE_VERSION, POS_CHANNEL, getDeviceId } from './retail-pos-firestore-foundation.js?v=20260702-002';

export const POS_AUDIT_VERSION = 'P9-B007';

export const POS_AUDIT_ACTIONS = Object.freeze({
  SALE_COMPLETED: 'pos_sale_completed',
  SALE_OFFLINE_QUEUED: 'pos_sale_offline_queued',
  SALE_SYNCED: 'pos_sale_synced',
  SYNC_CONFLICT: 'pos_sync_conflict',
  SHIFT_OPENED: 'pos_shift_opened',
  SHIFT_CLOSED: 'pos_shift_closed',
  REFUND_CREATED: 'pos_refund_created',
  RETURN_CREATED: 'pos_return_created',
  VOID_CREATED: 'pos_void_created',
  STOCK_ADJUSTED: 'pos_stock_adjusted'
});

function safeId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function auditLogId(action, entityId, createdAt = new Date().toISOString()) {
  const suffix = new Date(createdAt).getTime() || Date.now();
  return `${safeId(action)}_${safeId(entityId)}_${suffix}`;
}

export function buildAuditLogRow({
  action,
  entityType = 'sale',
  entityId,
  entityNumber = '',
  summary = {},
  metadata = {},
  userId = auth?.currentUser?.uid || '',
  deviceId = getDeviceId(),
  tenantId = getTenantId(),
  createdAt = new Date().toISOString()
} = {}) {
  if (!action) throw new Error('POS_AUDIT_ACTION_REQUIRED');
  if (!entityId) throw new Error('POS_AUDIT_ENTITY_ID_REQUIRED');
  return {
    id: auditLogId(action, entityId, createdAt),
    tenantId,
    shopId: tenantId,
    deviceId,
    schemaVersion: POS_FIRESTORE_VERSION,
    auditVersion: POS_AUDIT_VERSION,
    deleted: false,
    channel: POS_CHANNEL,
    action,
    entityType,
    entityId: String(entityId),
    entityNumber: String(entityNumber || ''),
    createdBy: userId,
    updatedBy: userId,
    createdAt,
    updatedAt: Date.now(),
    summary,
    metadata
  };
}

export function setAuditLogInTransaction(transaction, row) {
  if (!transaction?.set) throw new Error('FIRESTORE_TRANSACTION_REQUIRED');
  if (!row?.tenantId || !row?.id) throw new Error('POS_AUDIT_ROW_INVALID');
  const ref = doc(db, 'tenants', row.tenantId, POS_COLLECTIONS.auditLogs, row.id);
  transaction.set(ref, { ...row, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp() }, { merge: true });
  return row;
}

export async function writeAuditLog(row) {
  if (!isFirebaseConfigured || !db) return row;
  if (!row?.tenantId || !row?.id) throw new Error('POS_AUDIT_ROW_INVALID');
  const ref = doc(db, 'tenants', row.tenantId, POS_COLLECTIONS.auditLogs, row.id);
  await setDoc(ref, { ...row, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp() }, { merge: true });
  return row;
}

export function saleAuditSummary(sale = {}) {
  return {
    saleNumber: sale.saleNumber || sale.number || '',
    totalAmount: Number(sale.totalAmount ?? sale.total ?? 0),
    totalQty: Number(sale.totalQty || 0),
    paymentMethod: sale.paymentMethod || sale.payment?.method || '',
    customerId: sale.customerId || '',
    shiftId: sale.shiftId || '',
    syncStatus: sale.syncStatus || ''
  };
}
