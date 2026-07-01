import { doc, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId } from './retail-db.js?v=20260629-032';
import {
  POS_COLLECTIONS,
  POS_FIRESTORE_VERSION,
  buildCounterRow,
  buildDocumentNumber,
  counterIdForRunningNumber,
  dateKeyFrom,
  periodKeyFrom,
  runningNumberConfig
} from './retail-pos-firestore-foundation.js?v=20260702-002';

function tenantDocRef(db, collectionName, id, tenantId = getTenantId()) {
  if (!db) throw new Error('FIRESTORE_REQUIRED');
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED');
  if (!collectionName) throw new Error('COLLECTION_REQUIRED');
  if (!id) throw new Error('DOCUMENT_ID_REQUIRED');
  return doc(db, 'tenants', tenantId, collectionName, String(id));
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

export function nextCounterSnapshot(snapshot, options = {}) {
  const scope = counterScope(options);
  const current = Number(snapshot?.exists?.() ? snapshot.data()?.current || 0 : 0);
  const running = current + 1;
  const documentNumber = buildDocumentNumber({ type: scope.type, running, periodKey: scope.periodKey });
  return { ...scope, current, running, documentNumber };
}

export function buildCounterCommit(next, { documentId = '', userId = '', now = Date.now() } = {}) {
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
    schemaVersion: POS_FIRESTORE_VERSION,
    updatedAtServer: serverTimestamp()
  };
}

export async function reserveRunningNumber(transaction, db, options = {}) {
  if (!transaction?.get || !transaction?.set) throw new Error('FIRESTORE_TRANSACTION_REQUIRED');
  const ref = counterRef(db, options);
  const snapshot = await transaction.get(ref);
  const next = nextCounterSnapshot(snapshot, options);
  const row = buildCounterCommit(next, options);
  transaction.set(ref, row, { merge: true });
  return { ref, row, ...next };
}

export function pendingDocumentNumber({ type = 'SALE', value = new Date(), stableId = '' } = {}) {
  const scope = counterScope({ type, value });
  const suffix = String(stableId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${scope.config.prefix}-${scope.periodKey}-PENDING-${suffix}`;
}
