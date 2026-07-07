import { doc, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId } from './retail-db.js?v=20260629-032';
import {
  POS_COLLECTIONS,
  buildCounterRow,
  buildDocumentNumber,
  counterIdForRunningNumber,
  dateKeyFrom,
  periodKeyFrom,
  runningNumberConfig
} from './retail-pos-firestore-foundation.js?v=20260707-001';

export const POS_COUNTER_VERSION = 'P9-B003';

function nowMs() { return Date.now(); }

function tenantDocRef(db, collectionName, id, tenantId = getTenantId()) {
  if (!db) throw new Error('FIRESTORE_REQUIRED');
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED');
  if (!collectionName) throw new Error('COLLECTION_REQUIRED');
  if (!id) throw new Error('DOCUMENT_ID_REQUIRED');
  return doc(db, 'tenants', tenantId, collectionName, String(id));
}

function safeIdPart(value = '') {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function counterScope({ type = 'SALE', value = new Date(), tenantId = getTenantId() } = {}) {
  const config = runningNumberConfig(type);
  const dateKey = dateKeyFrom(value);
  const periodKey = periodKeyFrom(value, config.reset);
  const counterId = counterIdForRunningNumber({ type: config.type, periodKey });
  return { tenantId, type: config.type, config, dateKey, periodKey, counterId };
}

export function counterRef(db, options = {}) {
  const scope = counterScope(options);
  return tenantDocRef(db, POS_COLLECTIONS.counters, scope.counterId, scope.tenantId);
}

export function runningNumberReservationId({ type = 'SALE', documentId = '', periodKey = '' } = {}) {
  const config = runningNumberConfig(type);
  return `${safeIdPart(config.type)}_${safeIdPart(periodKey)}_${safeIdPart(documentId)}`;
}

export function runningNumberRef(db, options = {}) {
  const scope = counterScope(options);
  const reservationId = runningNumberReservationId({ type: scope.type, documentId: options.documentId, periodKey: scope.periodKey });
  return tenantDocRef(db, POS_COLLECTIONS.runningNumbers, reservationId, scope.tenantId);
}

export function nextCounterSnapshot(snapshot, options = {}) {
  const scope = counterScope(options);
  const current = Number(snapshot?.exists?.() ? snapshot.data()?.current || 0 : 0);
  const running = current + 1;
  const documentNumber = buildDocumentNumber({ type: scope.type, running, periodKey: scope.periodKey });
  return { ...scope, current, running, documentNumber };
}

export function buildCounterCommit(next, { documentId = '', userId = '', now = nowMs() } = {}) {
  if (!next?.tenantId) throw new Error('TENANT_ID_REQUIRED');
  if (!next?.type) throw new Error('COUNTER_TYPE_REQUIRED');
  return {
    ...buildCounterRow({
      tenantId: next.tenantId,
      type: next.type,
      dateKey: next.dateKey,
      periodKey: next.periodKey,
      running: next.running,
      documentId,
      documentNumber: next.documentNumber,
      saleId: next.type === 'SALE' ? documentId : '',
      saleNumber: next.type === 'SALE' ? next.documentNumber : '',
      userId,
      now
    }),
    schemaVersion: POS_COUNTER_VERSION,
    counterVersion: POS_COUNTER_VERSION,
    updatedAtServer: serverTimestamp()
  };
}

export function buildRunningNumberRow(next, { documentId = '', userId = '', now = nowMs() } = {}) {
  const reservationId = runningNumberReservationId({ type: next.type, documentId, periodKey: next.periodKey });
  return {
    id: reservationId,
    tenantId: next.tenantId,
    shopId: next.tenantId,
    counterId: next.counterId,
    documentType: next.type,
    documentCollection: next.config?.collection || '',
    documentId,
    documentNumber: next.documentNumber,
    running: next.running,
    prefix: next.config?.prefix || '',
    reset: next.config?.reset || '',
    dateKey: next.dateKey,
    periodKey: next.periodKey,
    monthKey: String(next.dateKey || '').slice(0, 6),
    saleId: next.type === 'SALE' ? documentId : '',
    saleNumber: next.type === 'SALE' ? next.documentNumber : '',
    status: 'reserved',
    schemaVersion: POS_COUNTER_VERSION,
    counterVersion: POS_COUNTER_VERSION,
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp()
  };
}

function reservedFromSnapshot(snapshot, options = {}) {
  if (!snapshot?.exists?.()) return null;
  const row = snapshot.data() || {};
  return {
    ref: options.ref || null,
    row,
    tenantId: row.tenantId,
    type: row.documentType,
    counterId: row.counterId,
    dateKey: row.dateKey,
    periodKey: row.periodKey,
    running: Number(row.running || 0),
    documentNumber: row.documentNumber,
    alreadyReserved: true
  };
}

export async function reserveRunningNumber(transaction, db, options = {}) {
  if (!transaction?.get || !transaction?.set) throw new Error('FIRESTORE_TRANSACTION_REQUIRED');
  if (!options.documentId) throw new Error('DOCUMENT_ID_REQUIRED');

  const scope = counterScope(options);
  const cRef = counterRef(db, options);
  const rRef = runningNumberRef(db, options);

  const counterSnapshot = await transaction.get(cRef);
  const reservationSnapshot = await transaction.get(rRef);
  const existingReservation = reservedFromSnapshot(reservationSnapshot, { ref: rRef });
  if (existingReservation?.documentNumber) return existingReservation;

  const next = nextCounterSnapshot(counterSnapshot, options);
  const now = nowMs();
  const counterRow = buildCounterCommit(next, { ...options, now });
  const runningRow = buildRunningNumberRow(next, { ...options, now });

  transaction.set(cRef, counterRow, { merge: true });
  transaction.set(rRef, runningRow, { merge: true });
  return { ref: cRef, reservationRef: rRef, row: counterRow, runningRow, ...next, alreadyReserved: false };
}

export function pendingDocumentNumber({ type = 'SALE', value = new Date(), stableId = '' } = {}) {
  const scope = counterScope({ type, value });
  const suffix = String(stableId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${scope.config.prefix}-${scope.periodKey}-PENDING-${suffix}`;
}
