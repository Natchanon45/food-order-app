export const POS_FIRESTORE_VERSION = 'P9-B002';

export const POS_COLLECTIONS = Object.freeze({
  sales: 'sales',
  saleItems: 'saleItems',
  stockMovements: 'stockMovements',
  shifts: 'shifts',
  counters: 'counters',
  runningNumbers: 'runningNumbers',
  dailySummary: 'dailySummary',
  syncQueue: 'syncQueue',
  auditLogs: 'auditLogs'
});

export const POS_CHANNEL = 'retail-pos';
export const POS_ORDER_TYPE = 'pos';
export const POS_RUNNING_PREFIX = 'POS';
export const POS_RUNNING_PAD_LENGTH = 5;
export const POS_COUNTER_TYPE = 'daily-sale-number';

export const RUNNING_NUMBER_TYPES = Object.freeze({
  SALE: Object.freeze({ type: 'SALE', prefix: POS_RUNNING_PREFIX, reset: 'daily', padLength: POS_RUNNING_PAD_LENGTH, collection: 'sales' }),
  RECEIPT: Object.freeze({ type: 'RECEIPT', prefix: 'RC', reset: 'daily', padLength: POS_RUNNING_PAD_LENGTH, collection: 'sales' }),
  TAX: Object.freeze({ type: 'TAX', prefix: 'TAX', reset: 'monthly', padLength: POS_RUNNING_PAD_LENGTH, collection: 'sales' }),
  REFUND: Object.freeze({ type: 'REFUND', prefix: 'RF', reset: 'daily', padLength: POS_RUNNING_PAD_LENGTH, collection: 'returns' }),
  VOID: Object.freeze({ type: 'VOID', prefix: 'VD', reset: 'daily', padLength: POS_RUNNING_PAD_LENGTH, collection: 'voids' }),
  SHIFT: Object.freeze({ type: 'SHIFT', prefix: 'SH', reset: 'daily', padLength: 4, collection: 'shifts' }),
  PURCHASE: Object.freeze({ type: 'PURCHASE', prefix: 'PO', reset: 'monthly', padLength: POS_RUNNING_PAD_LENGTH, collection: 'purchases' }),
  STOCK: Object.freeze({ type: 'STOCK', prefix: 'ST', reset: 'daily', padLength: POS_RUNNING_PAD_LENGTH, collection: 'stockMovements' }),
  TRANSFER: Object.freeze({ type: 'TRANSFER', prefix: 'TR', reset: 'monthly', padLength: POS_RUNNING_PAD_LENGTH, collection: 'stockTransfers' })
});

export function runningNumberConfig(type = 'SALE') {
  const key = String(type || 'SALE').trim().toUpperCase();
  return RUNNING_NUMBER_TYPES[key] || Object.freeze({ type: key, prefix: key, reset: 'daily', padLength: POS_RUNNING_PAD_LENGTH, collection: '' });
}

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

export function periodKeyFrom(value = new Date(), reset = 'daily') {
  const dateKey = dateKeyFrom(value);
  if (reset === 'none') return 'all';
  if (reset === 'yearly') return dateKey.slice(0, 4);
  if (reset === 'monthly') return dateKey.slice(0, 6);
  return dateKey;
}

export function counterIdForRunningNumber({ type = 'SALE', periodKey = dateKeyFrom() } = {}) {
  return `${runningNumberConfig(type).type}_${periodKey}`;
}

export function counterIdForDate(dateKey = dateKeyFrom()) {
  return counterIdForRunningNumber({ type: 'SALE', periodKey: dateKey });
}

export function buildRunningNumber({ prefix = POS_RUNNING_PREFIX, dateKey = dateKeyFrom(), running = 0, padLength = POS_RUNNING_PAD_LENGTH, separator = '-' } = {}) {
  return [prefix, dateKey, padRunning(running, padLength)].filter(Boolean).join(separator);
}

export function buildDocumentNumber({ type = 'SALE', running = 0, value = new Date(), periodKey = '', separator = '-' } = {}) {
  const config = runningNumberConfig(type);
  const key = periodKey || periodKeyFrom(value, config.reset);
  return buildRunningNumber({ prefix: config.prefix, dateKey: key === 'all' ? '' : key, running, padLength: config.padLength, separator });
}

export function buildCounterRow({
  tenantId,
  type = 'SALE',
  dateKey = dateKeyFrom(),
  periodKey = '',
  running = 0,
  saleId = '',
  saleNumber = '',
  documentId = saleId,
  documentNumber = saleNumber,
  userId = '',
  now = Date.now()
} = {}) {
  const config = runningNumberConfig(type);
  const resolvedPeriodKey = periodKey || periodKeyFrom(dateKey, config.reset);
  const id = counterIdForRunningNumber({ type: config.type, periodKey: resolvedPeriodKey });
  const number = documentNumber || saleNumber || buildDocumentNumber({ type: config.type, running, periodKey: resolvedPeriodKey });
  return {
    id,
    tenantId,
    shopId: tenantId,
    counterType: config.type === 'SALE' ? POS_COUNTER_TYPE : `${String(config.type).toLowerCase()}-number`,
    documentType: config.type,
    documentCollection: config.collection,
    channel: POS_CHANNEL,
    orderType: POS_ORDER_TYPE,
    prefix: config.prefix,
    reset: config.reset,
    dateKey,
    periodKey: resolvedPeriodKey,
    monthKey: String(dateKey).slice(0, 6),
    current: Number(running || 0),
    lastRunning: Number(running || 0),
    lastNumber: number,
    lastSaleId: saleId,
    lastDocumentId: documentId || saleId,
    lastDocumentNumber: number,
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
