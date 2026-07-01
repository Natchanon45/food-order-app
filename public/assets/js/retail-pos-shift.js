import { auth, db, isFirebaseConfigured, doc, getDoc, runTransaction, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId } from './retail-db.js?v=20260629-032';
import { POS_COLLECTIONS, POS_FIRESTORE_VERSION, POS_CHANNEL, getDeviceId, dateKeyFrom } from './retail-pos-firestore-foundation.js?v=20260702-002';
import { buildDocumentNumber } from './retail-pos-firestore-foundation.js?v=20260702-002';
import { reserveRunningNumber } from './retail-pos-counter.js?v=20260702-003';
import { POS_AUDIT_ACTIONS, buildAuditLogRow, setAuditLogInTransaction } from './retail-pos-audit-log.js?v=20260702-008';

export const POS_SHIFT_VERSION = 'P9-B008';
export const POS_ACTIVE_SHIFT_KEY = 'retail_pos_active_shift_v1';

function nowIso() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }
function safeId(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_'); }

function shiftDocRef(tenantId, shiftId) {
  return doc(db, 'tenants', tenantId, POS_COLLECTIONS.shifts, String(shiftId));
}

function readLocalShift() {
  try { return JSON.parse(localStorage.getItem(POS_ACTIVE_SHIFT_KEY)) || null; } catch { return null; }
}

function writeLocalShift(shift) {
  if (!shift) localStorage.removeItem(POS_ACTIVE_SHIFT_KEY);
  else localStorage.setItem(POS_ACTIVE_SHIFT_KEY, JSON.stringify(shift));
  window.dispatchEvent(new CustomEvent('retail-pos-shift-change', { detail: { shift } }));
  return shift;
}

export function getActiveShiftLocal() {
  const shift = readLocalShift();
  if (!shift || shift.status !== 'open') return null;
  if (shift.tenantId && String(shift.tenantId) !== String(getTenantId())) return null;
  return shift;
}

export function buildShiftId({ tenantId = getTenantId(), userId = auth?.currentUser?.uid || '', terminalCode = 'MAIN', openedAt = nowIso() } = {}) {
  return safeId(`shift_${tenantId}_${terminalCode}_${userId}_${dateKeyFrom(openedAt)}`);
}

export function buildOpenShiftRow({
  shiftId,
  shiftNumber,
  openingCash = 0,
  terminalCode = 'MAIN',
  cashierName = '',
  userId = auth?.currentUser?.uid || '',
  tenantId = getTenantId(),
  openedAt = nowIso(),
  deviceId = getDeviceId(),
  note = ''
} = {}) {
  const id = shiftId || buildShiftId({ tenantId, userId, terminalCode, openedAt });
  return {
    id,
    shiftNumber,
    tenantId,
    shopId: tenantId,
    deviceId,
    schemaVersion: POS_FIRESTORE_VERSION,
    shiftVersion: POS_SHIFT_VERSION,
    deleted: false,
    channel: POS_CHANNEL,
    status: 'open',
    terminalCode: String(terminalCode || 'MAIN'),
    cashierId: userId,
    cashierName: String(cashierName || auth?.currentUser?.displayName || auth?.currentUser?.email || 'Cashier'),
    openingCash: Number(openingCash || 0),
    closingCash: 0,
    expectedCash: 0,
    cashDifference: 0,
    totalSales: 0,
    totalCashSales: 0,
    totalNonCashSales: 0,
    billCount: 0,
    openedAt,
    closedAt: '',
    note: String(note || ''),
    createdBy: userId,
    updatedBy: userId,
    createdAt: openedAt,
    updatedAt: nowMs()
  };
}

export function buildClosedShiftRow(openShift = {}, { closingCash = 0, userId = auth?.currentUser?.uid || '', closedAt = nowIso(), totals = {}, note = '' } = {}) {
  const expectedCash = Number(openShift.openingCash || 0) + Number(totals.totalCashSales || 0);
  const closeCash = Number(closingCash || 0);
  return {
    ...openShift,
    status: 'closed',
    closingCash: closeCash,
    expectedCash,
    cashDifference: closeCash - expectedCash,
    totalSales: Number(totals.totalSales || 0),
    totalCashSales: Number(totals.totalCashSales || 0),
    totalNonCashSales: Number(totals.totalNonCashSales || 0),
    billCount: Number(totals.billCount || 0),
    closedAt,
    closedBy: userId,
    closeNote: String(note || ''),
    updatedBy: userId,
    updatedAt: nowMs()
  };
}

export async function openShift({ openingCash = 0, terminalCode = 'MAIN', cashierName = '', note = '' } = {}) {
  if (!isFirebaseConfigured || !db) throw new Error('FIREBASE_REQUIRED');
  const userId = auth?.currentUser?.uid || '';
  if (!userId) throw new Error('AUTH_REQUIRED');
  const tenantId = getTenantId();
  const openedAt = nowIso();
  let committed = null;
  await runTransaction(db, async transaction => {
    const existingLocal = getActiveShiftLocal();
    if (existingLocal?.id) {
      const existingRef = shiftDocRef(tenantId, existingLocal.id);
      const existingSnap = await transaction.get(existingRef);
      if (existingSnap.exists() && existingSnap.data()?.status === 'open') {
        committed = { id: existingSnap.id, ...existingSnap.data() };
        return;
      }
    }
    const reserved = await reserveRunningNumber(transaction, db, { type: 'SHIFT', value: openedAt, tenantId, documentId: '', userId });
    const shiftNumber = reserved.documentNumber || buildDocumentNumber({ type: 'SHIFT', running: reserved.running, value: openedAt });
    const shift = buildOpenShiftRow({ shiftNumber, openingCash, terminalCode, cashierName, userId, tenantId, openedAt, note });
    const ref = shiftDocRef(tenantId, shift.id);
    transaction.set(ref, { ...shift, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp() }, { merge: true });
    setAuditLogInTransaction(transaction, buildAuditLogRow({ action: POS_AUDIT_ACTIONS.SHIFT_OPENED, entityType: 'shift', entityId: shift.id, entityNumber: shift.shiftNumber, userId, deviceId: shift.deviceId, tenantId, createdAt: openedAt, summary: { openingCash: shift.openingCash, terminalCode: shift.terminalCode } }));
    committed = shift;
  });
  writeLocalShift(committed);
  return committed;
}

export async function closeShift({ shiftId = '', closingCash = 0, totals = {}, note = '' } = {}) {
  if (!isFirebaseConfigured || !db) throw new Error('FIREBASE_REQUIRED');
  const userId = auth?.currentUser?.uid || '';
  if (!userId) throw new Error('AUTH_REQUIRED');
  const tenantId = getTenantId();
  const active = shiftId ? { id: shiftId } : getActiveShiftLocal();
  if (!active?.id) throw new Error('NO_ACTIVE_SHIFT');
  const ref = shiftDocRef(tenantId, active.id);
  const closedAt = nowIso();
  let committed = null;
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error('SHIFT_NOT_FOUND');
    const current = { id: snap.id, ...snap.data() };
    if (current.status !== 'open') {
      committed = current;
      return;
    }
    const closed = buildClosedShiftRow(current, { closingCash, userId, closedAt, totals, note });
    transaction.set(ref, { ...closed, updatedAtServer: serverTimestamp() }, { merge: true });
    setAuditLogInTransaction(transaction, buildAuditLogRow({ action: POS_AUDIT_ACTIONS.SHIFT_CLOSED, entityType: 'shift', entityId: closed.id, entityNumber: closed.shiftNumber, userId, deviceId: closed.deviceId, tenantId, createdAt: closedAt, summary: { closingCash: closed.closingCash, expectedCash: closed.expectedCash, cashDifference: closed.cashDifference, totalSales: closed.totalSales, billCount: closed.billCount } }));
    committed = closed;
  });
  if (committed?.status === 'closed') writeLocalShift(null);
  else writeLocalShift(committed);
  return committed;
}

export async function fetchShift(shiftId) {
  if (!isFirebaseConfigured || !db || !shiftId) return null;
  const tenantId = getTenantId();
  const snap = await getDoc(shiftDocRef(tenantId, shiftId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
