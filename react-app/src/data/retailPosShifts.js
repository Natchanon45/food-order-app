import { auth } from "@/firebase/client";
import {
  POS_FIRESTORE_VERSION,
  closePosShift,
  listPosShifts,
  openPosShift,
  watchPosShifts,
} from "@/data/retailPosData";

export const POS_ACTIVE_SHIFT_KEY = "retail_pos_active_shift_v1";
export const POS_SHIFT_HISTORY_KEY = "retail_pos_shift_history_v1";
export const POS_SHIFT_QUEUE_KEY = "retail_pos_shift_sync_queue_v1";
const DEVICE_KEY = "retail_pos_device_id_v1";
const RETRY_DELAYS = [1000, 3000, 10000, 30000];

let syncing = false;
let retryTimer = 0;

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const nowIso = () => new Date().toISOString();
const safeId = value => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
const shiftTime = value => {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : Number(value || 0);
};
const currentUserId = () => {
  const uid = auth.currentUser?.uid || "";
  if (!uid) throw new Error("AUTH_REQUIRED");
  return uid;
};
const deviceId = () => {
  const saved = localStorage.getItem(DEVICE_KEY);
  if (saved) return saved;
  const value = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DEVICE_KEY, value);
  return value;
};
const newShiftId = () => safeId(`shift-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`);
const belongs = (row, tenantId) => String(row?.tenantId || "") === String(tenantId || "");
const queueRows = () => {
  const rows = readJson(POS_SHIFT_QUEUE_KEY, []);
  return Array.isArray(rows) ? rows : [];
};
const historyRows = () => {
  const rows = readJson(POS_SHIFT_HISTORY_KEY, []);
  return Array.isArray(rows) ? rows : [];
};
const announce = () => window.dispatchEvent(new Event("retail:shift-sync"));
function writeQueue(rows) {
  writeJson(POS_SHIFT_QUEUE_KEY, rows.slice(-500));
  announce();
}
function operationId(shiftId, action) {
  return `${shiftId}:${action}`;
}
function replaceQueue(entry) {
  const rows = queueRows().filter(row =>
    !(belongs(row, entry.tenantId) && row.operationId === entry.operationId));
  rows.push(entry);
  writeQueue(rows);
  return entry;
}
function updateQueue(operation, tenantId, changes) {
  const rows = queueRows();
  const index = rows.findIndex(row => belongs(row, tenantId) && row.operationId === operation);
  if (index < 0) return null;
  rows[index] = {
    ...rows[index],
    ...changes,
    operationId: rows[index].operationId,
    tenantId: rows[index].tenantId,
  };
  writeQueue(rows);
  return rows[index];
}
function removeQueue(operation, tenantId) {
  writeQueue(queueRows().filter(row =>
    !(belongs(row, tenantId) && row.operationId === operation)));
}
function writeHistoryShift(shift) {
  const rows = historyRows();
  const tenantId = shift?.tenantId || "";
  writeJson(POS_SHIFT_HISTORY_KEY, [
    shift,
    ...rows.filter(row =>
      !(String(row?.id || "") === String(shift?.id || "")
        && String(row?.tenantId || tenantId) === String(tenantId))),
  ].slice(0, 100));
}
function markLocal(record, status, error = "") {
  const changes = { syncStatus: status, syncError: error };
  if (record.action === "close") {
    writeHistoryShift({ ...record.shift, ...changes });
    return;
  }
  const active = readJson(POS_ACTIVE_SHIFT_KEY, null);
  if (String(active?.id || "") === String(record.shiftId)
    && belongs(active, record.tenantId)) {
    writeJson(POS_ACTIVE_SHIFT_KEY, { ...active, ...changes });
  }
}
function pendingClose(tenantId, shiftId) {
  return queueRows().some(row => belongs(row, tenantId)
    && row.action === "close"
    && String(row.shiftId || "") === String(shiftId || "")
    && ["pending", "syncing", "conflict"].includes(String(row.status || "")));
}
function mergeServerShift(tenantId, shift) {
  if (!shift?.id || pendingClose(tenantId, shift.id)) return;
  if (shift.status === "closed") {
    writeHistoryShift({ ...shift, syncStatus: "synced", syncError: "" });
    const active = readJson(POS_ACTIVE_SHIFT_KEY, null);
    if (String(active?.id || "") === String(shift.id) && belongs(active, tenantId)) {
      localStorage.removeItem(POS_ACTIVE_SHIFT_KEY);
    }
  } else {
    writeJson(POS_ACTIVE_SHIFT_KEY, {
      ...shift,
      tenantId,
      syncStatus: "synced",
      syncError: "",
    });
  }
  announce();
}

function mergeServerRows(tenantId, rows = []) {
  rows.filter(shift => shift?.status === "closed")
    .forEach(shift => mergeServerShift(tenantId, shift));

  const uid = auth.currentUser?.uid || "";
  const openRows = rows.filter(shift =>
    shift?.status === "open" && !pendingClose(tenantId, shift.id));
  const active = openRows.find(shift =>
    !uid || String(shift.createdBy || shift.cashierId || "") === String(uid))
    || openRows[0]
    || null;
  if (active) {
    mergeServerShift(tenantId, active);
    return;
  }

  const local = readJson(POS_ACTIVE_SHIFT_KEY, null);
  const pendingOpen = queueRows().some(row => belongs(row, tenantId)
    && row.action === "open"
    && String(row.shiftId || "") === String(local?.id || "")
    && ["pending", "syncing", "conflict"].includes(String(row.status || "")));
  if (local && belongs(local, tenantId) && !pendingOpen) {
    localStorage.removeItem(POS_ACTIVE_SHIFT_KEY);
    announce();
  }
}
function isConflict(error) {
  const code = String(error?.code || error?.message || "").toLowerCase();
  return ["permission-denied", "failed-precondition", "invalid-argument", "not-found", "already-exists"]
    .some(value => code.includes(value));
}
function scheduleRetry(attempt) {
  clearTimeout(retryTimer);
  retryTimer = window.setTimeout(
    () => syncPendingPosShifts(),
    RETRY_DELAYS[Math.min(Number(attempt || 0), RETRY_DELAYS.length - 1)],
  );
}
function enqueue(action, shift) {
  const tenantId = shift.tenantId;
  const pending = { ...shift, syncStatus: "pending_sync", syncError: "" };
  return replaceQueue({
    operationId: operationId(shift.id, action),
    shiftId: shift.id,
    tenantId,
    action,
    shift: pending,
    status: "pending",
    attempt: 0,
    queuedAt: nowIso(),
  });
}

async function syncRecord(record) {
  const attempt = Number(record.attempt || 0) + 1;
  updateQueue(record.operationId, record.tenantId, {
    status: "syncing",
    attempt,
    error: "",
  });
  markLocal(record, "syncing");
  try {
    let shift;
    if (record.action === "open") {
      shift = await openPosShift({
        tenantId: record.tenantId,
        shiftId: record.shiftId,
        openedAt: record.shift.openedAt,
        openingCash: record.shift.openingCash,
        terminalCode: record.shift.terminalCode,
        cashierName: record.shift.cashierName,
        note: record.shift.openNote || record.shift.note || "",
      });
    } else {
      shift = await closePosShift({
        tenantId: record.tenantId,
        shiftId: record.shiftId,
        closedAt: record.shift.closedAt,
        closingCash: record.shift.actualCash ?? record.shift.closingCash ?? 0,
        note: record.shift.closeNote || "",
        totals: {
          totalSales: record.shift.salesTotal ?? record.shift.totalSales ?? 0,
          totalCashSales: record.shift.cashSales ?? record.shift.totalCashSales ?? 0,
          totalNonCashSales: record.shift.transferSales ?? record.shift.totalNonCashSales ?? 0,
          billCount: record.shift.billCount || 0,
        },
      });
    }
    removeQueue(record.operationId, record.tenantId);
    mergeServerShift(record.tenantId, shift || record.shift);
    return { ...record, shift: shift || record.shift, status: "synced", error: "" };
  } catch (error) {
    const conflict = isConflict(error);
    const code = String(error?.code || error?.message || "NETWORK_ERROR");
    const updated = updateQueue(record.operationId, record.tenantId, {
      status: conflict ? "conflict" : "pending",
      error: code,
      lastAttemptAt: nowIso(),
      attempt,
    });
    markLocal(record, conflict ? "conflict" : "pending_sync", code);
    if (!conflict && navigator.onLine !== false) scheduleRetry(attempt);
    return updated || { ...record, status: conflict ? "conflict" : "pending", error: code, attempt };
  } finally {
    announce();
  }
}
export function getLocalActivePosShift(tenantId, userId = "") {
  const shift = readJson(POS_ACTIVE_SHIFT_KEY, null);
  if (!shift || !belongs(shift, tenantId) || shift.status !== "open") return null;
  if (userId && String(shift.createdBy || shift.cashierId || "") !== String(userId)) return null;
  return shift;
}

export function overlayPendingPosShifts(tenantId, rows = []) {
  const local = [
    ...historyRows().filter(row => belongs(row, tenantId)),
    readJson(POS_ACTIVE_SHIFT_KEY, null),
  ].filter(row => row && belongs(row, tenantId));
  const byId = new Map(local.map(row => [String(row.id), row]));
  (rows || []).forEach(row => byId.set(String(row.id), row));
  queueRows().filter(row => belongs(row, tenantId))
    .sort((left, right) => String(left.queuedAt || "").localeCompare(String(right.queuedAt || "")))
    .forEach(record => byId.set(String(record.shiftId), record.shift));
  return [...byId.values()].sort((left, right) =>
    shiftTime(right.updatedAt || right.closedAt || right.openedAt)
    - shiftTime(left.updatedAt || left.closedAt || left.openedAt));
}

export async function listPosShiftsParity(tenantId) {
  let remote = [];
  try { remote = await listPosShifts(tenantId); }
  catch (error) { console.warn("POS_SHIFTS_REMOTE_LOAD_FAILED", error); }
  mergeServerRows(tenantId, remote);
  return overlayPendingPosShifts(tenantId, remote);
}

export function watchPosShiftsParity(tenantId, onRows, onError = null) {
  if (!tenantId || typeof onRows !== "function") return () => {};
  let remoteRows = [];
  const emit = () => onRows(overlayPendingPosShifts(tenantId, remoteRows));
  const stopRemote = watchPosShifts(tenantId, rows => {
    remoteRows = rows;
    mergeServerRows(tenantId, rows);
    emit();
  }, onError);
  const localListener = () => emit();
  const storageListener = event => {
    if (!event.key || [POS_ACTIVE_SHIFT_KEY, POS_SHIFT_HISTORY_KEY, POS_SHIFT_QUEUE_KEY].includes(event.key)) emit();
  };
  window.addEventListener("retail:shift-sync", localListener);
  window.addEventListener("storage", storageListener);
  emit();
  return () => {
    stopRemote();
    window.removeEventListener("retail:shift-sync", localListener);
    window.removeEventListener("storage", storageListener);
  };
}
export async function submitLocalPosShiftOpen({
  tenantId,
  cashierName,
  terminalCode,
  openingCash,
  note = "",
}) {
  const userId = currentUserId();
  const existing = getLocalActivePosShift(tenantId);
  if (existing) {
    return { status: existing.syncStatus || "synced", shift: existing, duplicate: true };
  }
  const openedAt = nowIso();
  const shift = {
    id: newShiftId(),
    tenantId,
    shopId: tenantId,
    deviceId: deviceId(),
    schemaVersion: POS_FIRESTORE_VERSION,
    deleted: false,
    channel: "retail-pos",
    status: "open",
    cashierId: userId,
    cashierName: String(cashierName || auth.currentUser?.displayName || auth.currentUser?.email || ""),
    terminalCode: String(terminalCode || "POS-01"),
    openingCash: Number(openingCash || 0),
    closingCash: 0,
    actualCash: 0,
    expectedCash: 0,
    cashDifference: 0,
    totalSales: 0,
    salesTotal: 0,
    totalCashSales: 0,
    cashSales: 0,
    totalNonCashSales: 0,
    transferSales: 0,
    billCount: 0,
    openedAt,
    closedAt: "",
    note: String(note || "").trim(),
    openNote: String(note || "").trim(),
    createdBy: userId,
    updatedBy: userId,
    createdAt: openedAt,
    updatedAt: Date.now(),
    syncStatus: "pending_sync",
    syncError: "",
  };
  writeJson(POS_ACTIVE_SHIFT_KEY, shift);
  announce();
  const record = enqueue("open", shift);
  if (navigator.onLine === false) return record;
  return syncRecord(record);
}

export async function submitLocalPosShiftClose({
  tenantId,
  shift,
  actualCash,
  totals,
  note = "",
}) {
  if (!shift?.id) throw new Error("SHIFT_NOT_FOUND");
  const userId = currentUserId();
  const closedAt = nowIso();
  const closeCash = Number(actualCash || 0);
  const expectedCash = Number(shift.openingCash || 0) + Number(totals?.totalCashSales || 0);
  const closed = {
    ...shift,
    tenantId,
    shopId: tenantId,
    status: "closed",
    closedAt,
    closeNote: String(note || "").trim(),
    billCount: Number(totals?.billCount || 0),
    salesTotal: Number(totals?.totalSales || 0),
    totalSales: Number(totals?.totalSales || 0),
    cashSales: Number(totals?.totalCashSales || 0),
    totalCashSales: Number(totals?.totalCashSales || 0),
    transferSales: Number(totals?.totalNonCashSales || 0),
    totalNonCashSales: Number(totals?.totalNonCashSales || 0),
    expectedCash,
    actualCash: closeCash,
    closingCash: closeCash,
    cashDifference: closeCash - expectedCash,
    closedBy: userId,
    updatedBy: userId,
    updatedAt: Date.now(),
    syncStatus: "pending_sync",
    syncError: "",
  };
  writeHistoryShift(closed);
  const active = readJson(POS_ACTIVE_SHIFT_KEY, null);
  if (String(active?.id || "") === String(shift.id) && belongs(active, tenantId)) {
    localStorage.removeItem(POS_ACTIVE_SHIFT_KEY);
  }
  announce();
  const record = enqueue("close", closed);
  if (navigator.onLine === false) return record;
  await syncPendingPosShifts();
  return queueRows().find(row => belongs(row, tenantId) && row.operationId === record.operationId)
    || { ...record, shift: closed, status: "synced", error: "" };
}
export async function syncPendingPosShifts() {
  if (syncing || navigator.onLine === false) return;
  syncing = true;
  try {
    const pending = queueRows()
      .filter(row => ["pending", "syncing"].includes(String(row.status || "")))
      .sort((left, right) => String(left.queuedAt || "").localeCompare(String(right.queuedAt || "")));
    for (const record of pending) await syncRecord(record);
  } finally {
    syncing = false;
  }
}

export function clearLocalPosShiftHistory(tenantId) {
  const keep = historyRows().filter(row => !belongs(row, tenantId));
  writeJson(POS_SHIFT_HISTORY_KEY, keep);
}

export function localShiftHistoryRows(tenantId) {
  return historyRows().filter(row => belongs(row, tenantId));
}

if (typeof window !== "undefined") {
  window.addEventListener("online", syncPendingPosShifts);
  window.setTimeout(syncPendingPosShifts, 250);
}
