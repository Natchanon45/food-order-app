export const POS_FIRESTORE_VERSION = 'P9-B003';

export const POS_COLLECTIONS = Object.freeze({
  sales: 'sales',
  saleItems: 'saleItems',
  stockMovements: 'stockMovements',
  shifts: 'shifts',
  counters: 'counters',
  dailySummary: 'dailySummary',
  syncQueue: 'syncQueue',
  auditLogs: 'auditLogs'
});

export const POS_CHANNEL = 'retail-pos';
export const POS_ORDER_TYPE = 'pos';
export const POS_RUNNING_PREFIX = 'POS';
export const POS_RUNNING_PAD_LENGTH = 5;
export const POS_COUNTER_TYPE = 'daily-sale-number';

export function padRunning(value, length = POS_RUNNING_PAD_LENGTH) {
  return String(Math.max(0, Number(value || 0))).padStart(length, '0');
}

export function dateKeyFrom(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return dateKeyFrom(new Date());
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('');
}

export function monthKeyFrom(value = new Date()) {
  return dateKeyFrom(value).slice(0, 6);
}

export function counterIdForDate(dateKey = dateKeyFrom()) {
  return `${POS_RUNNING_PREFIX}_${dateKey}`;
}

export function buildRunningNumber({ prefix = POS_RUNNING_PREFIX, dateKey = dateKeyFrom(), running = 0 } = {}) {
  return `${prefix}-${dateKey}-${padRunning(running)}`;
}

export function buildCounterRow({
  tenantId,
  dateKey = dateKeyFrom(),
  running = 0,
  saleId = '',
  saleNumber = '',
  userId = '',
  now = Date.now()
} = {}) {
  const id = counterIdForDate(dateKey);
  const number = saleNumber || buildRunningNumber({ dateKey, running });
  return {
    id,
    tenantId,
    shopId: tenantId,
    counterType: POS_COUNTER_TYPE,
    channel: POS_CHANNEL,
    orderType: POS_ORDER_TYPE,
    prefix: POS_RUNNING_PREFIX,
    dateKey,
    monthKey: String(dateKey).slice(0, 6),
    current: Number(running || 0),
    lastRunning: Number(running || 0),
    lastNumber: number,
    lastSaleId: saleId,
    schemaVersion: POS_FIRESTORE_VERSION,
    updatedBy: userId,
    updatedAt: now
  };
}

export function getDeviceId(storage = localStorage) {
  const key = 'retail_pos_device_id_v1';
  const saved = storage.getItem(key);
  if (saved) return saved;
  const id = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  storage.setItem(key, id);
  return id;
}

export function standardMeta({ tenantId, userId = '', now = Date.now(), deviceId = getDeviceId() } = {}) {
  return {
    tenantId,
    shopId: tenantId,
    deviceId,
    schemaVersion: POS_FIRESTORE_VERSION,
    deleted: false,
    createdAtMs: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId
  };
}

export function normalizeSaleForFirestore(sale = {}, { tenantId, userId = '', deviceId = getDeviceId(), now = Date.now() } = {}) {
  const createdDate = sale.createdAt ? new Date(sale.createdAt) : new Date(now);
  const dateKey = sale.dateKey || dateKeyFrom(createdDate);
  const monthKey = sale.monthKey || monthKeyFrom(createdDate);
  return {
    ...standardMeta({ tenantId, userId, now, deviceId }),
    ...sale,
    tenantId,
    shopId: tenantId,
    channel: sale.channel || POS_CHANNEL,
    orderType: sale.orderType || POS_ORDER_TYPE,
    dateKey,
    monthKey,
    paymentStatus: sale.paymentStatus || 'paid',
    status: sale.status || 'completed',
    syncStatus: sale.syncStatus || 'synced'
  };
}

export function buildSaleItemRows(sale = {}) {
  const saleId = sale.id;
  const saleNumber = sale.saleNumber || sale.number || '';
  const tenantId = sale.tenantId;
  const createdAt = sale.createdAt || new Date().toISOString();
  const dateKey = sale.dateKey || dateKeyFrom(createdAt);
  return (sale.items || []).map((item, index) => ({
    id: `${saleId}_${item.productId || item.id || index}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
    saleId,
    saleNumber,
    tenantId,
    shopId: tenantId,
    channel: POS_CHANNEL,
    orderType: POS_ORDER_TYPE,
    productId: item.productId || item.id || '',
    barcode: item.barcode || '',
    name: item.name || '',
    unit: item.unit || 'ชิ้น',
    qty: Number(item.qty || 0),
    price: Number(item.price || 0),
    cost: Number.isFinite(Number(item.cost)) ? Number(item.cost) : null,
    lineTotal: Number(item.lineTotal ?? Number(item.price || 0) * Number(item.qty || 0)),
    dateKey,
    createdAt
  }));
}

export function applySaleToDailySummary(summary = {}, sale = {}) {
  const method = sale.paymentMethod || sale.payment?.method || 'unknown';
  const total = Number(sale.totalAmount ?? sale.total ?? 0);
  const discount = Number(sale.discount || 0);
  const qty = Number(sale.totalQty || 0);
  return {
    ...summary,
    id: sale.dateKey,
    tenantId: sale.tenantId,
    shopId: sale.tenantId,
    dateKey: sale.dateKey,
    monthKey: sale.monthKey,
    channel: POS_CHANNEL,
    totalSales: Number(summary.totalSales || 0) + total,
    totalAmount: Number(summary.totalAmount || 0) + total,
    totalDiscount: Number(summary.totalDiscount || 0) + discount,
    totalQty: Number(summary.totalQty || 0) + qty,
    billCount: Number(summary.billCount || 0) + 1,
    [`payment_${method}`]: Number(summary[`payment_${method}`] || 0) + total,
    updatedAt: Date.now()
  };
}

export function buildSyncQueueRow(sale = {}, { status = 'pending', error = '' } = {}) {
  return {
    id: sale.id,
    tenantId: sale.tenantId,
    shopId: sale.tenantId,
    saleId: sale.id,
    saleNumber: sale.saleNumber || '',
    channel: POS_CHANNEL,
    orderType: POS_ORDER_TYPE,
    syncStatus: status,
    retryCount: Number(sale.retryCount || 0),
    lastError: error,
    deviceId: sale.deviceId || getDeviceId(),
    updatedAt: Date.now()
  };
}
