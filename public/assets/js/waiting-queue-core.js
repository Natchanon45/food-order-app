import {
  db,
  auth,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  writeBatch,
  serverTimestamp,
  deleteField,
} from "./waiting-queue-firebase.js?v=20260802-001";

export const WAITING_QUEUE_STATUS = Object.freeze({
  WAITING: "waiting",
  CALLED: "called",
  ACKNOWLEDGED: "acknowledged",
  PREPARING_TABLE: "preparing_table",
  SEATED: "seated",
  DEFERRED: "deferred",
  NO_SHOW: "no_show",
  CANCELLED: "cancelled",
});

export const WAITING_QUEUE_STATUS_LABEL = Object.freeze({
  waiting: "รอเรียก",
  called: "เรียกแล้ว",
  acknowledged: "ลูกค้าตอบรับแล้ว",
  preparing_table: "กำลังจัดโต๊ะ",
  seated: "เข้านั่งแล้ว",
  deferred: "ขอเลื่อนคิว",
  no_show: "ไม่มา/พ้นเวลา",
  cancelled: "ยกเลิก",
});

export const WAITING_QUEUE_FINAL_STATUSES = new Set([
  WAITING_QUEUE_STATUS.SEATED,
  WAITING_QUEUE_STATUS.NO_SHOW,
  WAITING_QUEUE_STATUS.CANCELLED,
]);

export const WAITING_QUEUE_ACTIVE_STATUSES = new Set([
  WAITING_QUEUE_STATUS.WAITING,
  WAITING_QUEUE_STATUS.CALLED,
  WAITING_QUEUE_STATUS.ACKNOWLEDGED,
  WAITING_QUEUE_STATUS.PREPARING_TABLE,
  WAITING_QUEUE_STATUS.DEFERRED,
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  waiting: new Set(["called", "deferred", "cancelled", "no_show", "preparing_table"]),
  called: new Set(["acknowledged", "waiting", "deferred", "cancelled", "no_show", "preparing_table"]),
  acknowledged: new Set(["preparing_table", "called", "deferred", "cancelled", "no_show"]),
  preparing_table: new Set(["called", "acknowledged", "deferred", "cancelled", "no_show"]),
  deferred: new Set(["waiting", "called", "cancelled", "no_show"]),
  seated: new Set(),
  no_show: new Set(["waiting"]),
  cancelled: new Set(),
});

const COLLECTIONS = Object.freeze({
  queues: "waitingQueues",
  public: "waitingQueuePublic",
  board: "waitingQueueBoard",
  audits: "waitingQueueAudits",
  counters: "waitingQueueCounters",
  leases: "waitingQueueNumberLeases",
  numbers: "waitingQueueNumbers",
  dedupe: "waitingQueueDedupe",
  operations: "waitingQueueOperations",
  orders: "orders",
  tables: "tables",
});

const STORAGE_PREFIX = "food_waiting_queue_v1";
const DEFAULT_CALL_TIMEOUT_MINUTES = 5;
const DEFAULT_MAX_DEFERS = 2;
const DEFAULT_TABLE_MINUTES = 45;
const NUMBER_LEASE_SIZE = 20;
const APPLIED_OPERATION_LIMIT = 30;
const ACTIVE_DEDUPE_STATUSES = new Set([
  "waiting",
  "called",
  "acknowledged",
  "preparing_table",
  "deferred",
]);

export class WaitingQueueError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "WaitingQueueError";
    this.code = code;
    this.details = details;
  }
}

const WAITING_QUEUE_TRANSACTION_MAX_ATTEMPTS = 10;
const WAITING_QUEUE_TRANSACTION_OUTER_ATTEMPTS = 2;
const WAITING_QUEUE_TRANSIENT_TRANSACTION_CODES = new Set([
  "aborted",
  "cancelled",
  "deadline-exceeded",
  "failed-precondition",
  "internal",
  "resource-exhausted",
  "unavailable",
  "unknown",
]);

function waitForRetry(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryableWaitingQueueTransactionError(error) {
  if (error instanceof WaitingQueueError) return false;
  const code = String(error?.code || "")
    .toLowerCase()
    .replace(/^firestore\//, "");
  const message = String(error?.message || error || "").toLowerCase();
  return WAITING_QUEUE_TRANSIENT_TRANSACTION_CODES.has(code)
    || (message.includes("stored version") && message.includes("required base version"))
    || message.includes("transaction aborted")
    || message.includes("transaction failed")
    || message.includes("too much contention");
}

async function runWaitingQueueTransaction(updateFunction) {
  let lastError = null;
  for (let attempt = 0; attempt < WAITING_QUEUE_TRANSACTION_OUTER_ATTEMPTS; attempt += 1) {
    try {
      return await runTransaction(
        db,
        updateFunction,
        { maxAttempts: WAITING_QUEUE_TRANSACTION_MAX_ATTEMPTS },
      );
    } catch (error) {
      lastError = error;
      if (!retryableWaitingQueueTransactionError(error)) throw error;
      if (attempt + 1 < WAITING_QUEUE_TRANSACTION_OUTER_ATTEMPTS) {
        await waitForRetry(120 + Math.floor(Math.random() * 180));
      }
    }
  }
  throw new WaitingQueueError(
    "TRANSACTION_RETRY_EXHAUSTED",
    "ข้อมูลคิวถูกอัปเดตพร้อมกัน ระบบลองใหม่แล้ว กรุณากดอีกครั้ง",
    {
      originalCode: String(lastError?.code || ""),
      originalMessage: String(lastError?.message || lastError || ""),
    },
  );
}

function stripOperationMetadata(row) {
  if (!row || typeof row !== "object") return row;
  const {
    _idempotent,
    _operationResolution,
    _operationResolutionReason,
    _resolvedOperationId,
    ...clean
  } = row;
  return clean;
}

function operationQueueId(operation) {
  return String(operation?.queueId || operation?.payload?.queueId || operation?.payload?.id || "");
}

function operationTargetStatus(operation) {
  return String(operation?.payload?.toStatus || "");
}

async function readRemoteWaitingQueue(queueId) {
  if (!queueId || !db) return null;
  const snapshot = await getDoc(queueRef(queueId));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
}

function operationCanResolveFromRemote(operation, remote, error) {
  if (!operation || !remote) return false;
  if (operation.kind === "create") {
    return String(remote.id) === String(operation.payload?.id)
      && String(remote.tenantId) === String(operation.tenantId || operation.payload?.tenantId);
  }
  if (operation.kind !== "transition") return false;

  const targetStatus = operationTargetStatus(operation);
  if (remote.status === targetStatus || WAITING_QUEUE_FINAL_STATUSES.has(remote.status)) return true;

  const expectedVersion = Number(operation.payload?.expectedVersion);
  const remoteVersion = Number(remote.version || 1);
  const code = String(error?.code || "");
  return Number.isFinite(expectedVersion)
    && remoteVersion >= expectedVersion
    && ["INVALID_STATUS_TRANSITION", "QUEUE_CONFLICT", "QUEUE_NOT_ACTIVE", "QUEUE_ALREADY_SEATED"].includes(code);
}

function nowMs() {
  return Date.now();
}

function nowIso() {
  return new Date().toISOString();
}

function toDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeId(prefix = "wq") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeToken() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replaceAll("-", "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

export function maskPhone(value) {
  const phone = normalizePhone(value);
  if (!phone) return "";
  if (phone.length <= 4) return "x".repeat(Math.max(0, phone.length - 2)) + phone.slice(-2);
  return `${phone.slice(0, 3)}-xxx-xx${phone.slice(-2)}`;
}

async function hashText(value) {
  const text = String(value ?? "");
  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function storageKey(tenantId, suffix) {
  return `${STORAGE_PREFIX}:${tenantId}:${suffix}`;
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getDeviceId() {
  const key = `${STORAGE_PREFIX}:device-id`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = safeId("device");
    localStorage.setItem(key, id);
  }
  return id;
}

function localQueues(tenantId) {
  const rows = readJson(storageKey(tenantId, "queues"), []);
  return Array.isArray(rows) ? rows : [];
}

function saveLocalQueues(tenantId, rows, { notify = true } = {}) {
  const key = storageKey(tenantId, "queues");
  const nextRows = (rows || []).slice(0, 1000);
  const encoded = JSON.stringify(nextRows);
  if (localStorage.getItem(key) === encoded) return false;
  localStorage.setItem(key, encoded);
  if (notify) {
    window.dispatchEvent(new CustomEvent("waiting-queue:local-changed", { detail: { tenantId } }));
  }
  return true;
}

function upsertLocalQueue(tenantId, row) {
  const cleanRow = stripOperationMetadata(row);
  const rows = localQueues(tenantId).filter(item => String(item.id) !== String(cleanRow.id));
  rows.push(cleanRow);
  rows.sort((a, b) => Number(a.queuedAtMs || 0) - Number(b.queuedAtMs || 0));
  saveLocalQueues(tenantId, rows);
  return cleanRow;
}

function removeLocalQueue(tenantId, queueId) {
  saveLocalQueues(tenantId, localQueues(tenantId).filter(item => String(item.id) !== String(queueId)));
}

function localOutbox(tenantId) {
  const rows = readJson(storageKey(tenantId, "outbox"), []);
  return Array.isArray(rows) ? rows : [];
}

function saveOutbox(tenantId, rows) {
  const key = storageKey(tenantId, "outbox");
  const nextRows = (rows || []).slice(-1000);
  const encoded = JSON.stringify(nextRows);
  if (localStorage.getItem(key) === encoded) return false;
  localStorage.setItem(key, encoded);
  window.dispatchEvent(new CustomEvent("waiting-queue:outbox-changed", { detail: { tenantId } }));
  return true;
}

function enqueueOperation(tenantId, operation) {
  const rows = localOutbox(tenantId).filter(item => item.opId !== operation.opId);
  rows.push(operation);
  saveOutbox(tenantId, rows);
  return operation;
}

function removeOperation(tenantId, opId) {
  saveOutbox(tenantId, localOutbox(tenantId).filter(item => item.opId !== opId));
}

function markOperationError(tenantId, opId, error) {
  const rows = localOutbox(tenantId).map(item => item.opId === opId ? {
    ...item,
    syncStatus: "error",
    syncError: String(error?.message || error),
    syncAttemptCount: Number(item.syncAttemptCount || 0) + 1,
    syncAttemptedAtMs: nowMs(),
  } : item);
  saveOutbox(tenantId, rows);
}

export function getWaitingQueueOutbox(tenantId) {
  return localOutbox(tenantId);
}

export function isOnline() {
  return navigator.onLine !== false;
}

async function readProfileContext(uid) {
  if (!uid || !db) return null;
  for (const collectionName of ["users", "staff", "profiles"]) {
    try {
      const snapshot = await getDoc(doc(db, collectionName, uid));
      if (!snapshot.exists()) continue;
      const data = snapshot.data() || {};
      const tenantId = normalizeString(
        data.tenantId
        || data.activeTenantId
        || data.shopId
        || data.storeId,
      );
      if (!tenantId) continue;
      return {
        tenantId,
        role: normalizeString(data.role),
        active: data.active !== false,
        source: collectionName,
      };
    } catch {
      // Try the next supported profile shape.
    }
  }
  return null;
}

function canonicalStoredTenantId() {
  try {
    const row = JSON.parse(
      localStorage.getItem("food_order_active_tenant") || "null",
    );
    return normalizeString(row?.id || row?.tenantId);
  } catch {
    return "";
  }
}

function legacyStoredTenantIds() {
  return [
    localStorage.getItem("tenantId"),
    localStorage.getItem("currentTenantId"),
    localStorage.getItem("selectedTenantId"),
    localStorage.getItem("food_order_tenant_id"),
    localStorage.getItem("retail_pos_tenant_id"),
  ].map(normalizeString).filter(Boolean);
}

function saveResolvedTenantId(tenantId) {
  if (!tenantId) return;
  localStorage.setItem("food_order_tenant_id", tenantId);
  localStorage.setItem("tenantId", tenantId);
}

function recordTenantCorrection(previousTenantId, tenantId) {
  if (!previousTenantId || !tenantId || previousTenantId === tenantId) return;
  writeJson(`${STORAGE_PREFIX}:tenant-correction`, {
    previousTenantId,
    tenantId,
    correctedAtMs: nowMs(),
    reason: "authenticated_profile_is_authoritative",
  });
}

export function consumeWaitingQueueTenantCorrection() {
  const key = `${STORAGE_PREFIX}:tenant-correction`;
  const value = readJson(key, null);
  localStorage.removeItem(key);
  return value;
}

export async function resolveTenantId({
  required = true,
  preferredTenantId = "",
} = {}) {
  const params = new URLSearchParams(location.search);
  const queryTenant = normalizeString(
    params.get("tenantId") || params.get("shopId"),
  );
  const user = auth?.currentUser || null;
  const profile = await readProfileContext(user?.uid);

  let claimTenant = "";
  let claimRole = "";
  if (user?.getIdTokenResult) {
    try {
      const token = await user.getIdTokenResult();
      claimTenant = normalizeString(
        token?.claims?.tenantId
        || token?.claims?.activeTenantId
        || token?.claims?.shopId
        || token?.claims?.storeId,
      );
      claimRole = normalizeString(token?.claims?.role);
    } catch {
      // Continue with the Firestore profile.
    }
  }

  const preferred = normalizeString(preferredTenantId);
  const canonicalTenant = canonicalStoredTenantId();
  const legacyTenants = legacyStoredTenantIds();
  const previousTenant = legacyTenants[0] || canonicalTenant || queryTenant;

  if (user && profile?.active === false) {
    throw new WaitingQueueError(
      "ACCOUNT_INACTIVE",
      "บัญชีผู้ใช้งานถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
    );
  }

  let tenantId = "";
  if (user && preferred) {
    tenantId = preferred;
  } else if (user && profile?.tenantId && profile.active) {
    tenantId = profile.tenantId;
  } else if (user && claimTenant) {
    tenantId = claimTenant;
  } else if (
    user
    && claimRole === "super_admin"
    && (queryTenant || canonicalTenant)
  ) {
    tenantId = queryTenant || canonicalTenant;
  } else {
    tenantId = queryTenant || canonicalTenant || legacyTenants[0] || "";
  }

  if (tenantId) {
    saveResolvedTenantId(tenantId);
    recordTenantCorrection(previousTenant, tenantId);
    return tenantId;
  }

  if (required) {
    throw new WaitingQueueError(
      "TENANT_REQUIRED",
      "ไม่พบ Tenant ของร้าน กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่",
    );
  }
  return "";
}

function actorFromStorage() {
  for (const key of ["currentUser", "user", "staffUser", "retail_pos_current_user_v1", "retail_pos_user_v1"]) {
    const value = readJson(key, null);
    if (value && typeof value === "object") return value;
  }
  return null;
}

export function currentActor() {
  const user = auth?.currentUser || null;
  const cached = actorFromStorage() || {};
  return {
    actorId: normalizeString(user?.uid || cached.id || cached.uid || cached.userId || "unknown"),
    actorName: normalizeString(user?.displayName || cached.name || cached.displayName || cached.email || user?.email || "พนักงาน"),
    actorEmail: normalizeString(user?.email || cached.email || ""),
    deviceId: getDeviceId(),
  };
}

function queueCounterId(tenantId, dateKey) {
  return `${tenantId}_${dateKey}`;
}

function numberClaimId(tenantId, dateKey, queueNumber) {
  return `${tenantId}_${dateKey}_${queueNumber}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

function dedupeId(tenantId, dateKey, phoneHash) {
  return `${tenantId}_${dateKey}_${phoneHash}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

function formatQueueNumber(sequence) {
  return `W${String(Math.max(1, Number(sequence) || 1)).padStart(3, "0")}`;
}

function readLease(tenantId, dateKey) {
  const value = readJson(storageKey(tenantId, `number-lease:${dateKey}`), null);
  if (!value || value.dateKey !== dateKey || Number(value.next || 0) > Number(value.end || 0)) return null;
  return value;
}

function saveLease(tenantId, dateKey, lease) {
  writeJson(storageKey(tenantId, `number-lease:${dateKey}`), lease);
}

export async function ensureWaitingNumberLease(tenantId, { force = false } = {}) {
  const dateKey = toDateKey();
  const existing = readLease(tenantId, dateKey);
  if (!force && existing && Number(existing.end) - Number(existing.next) >= 3) return existing;
  if (!isOnline()) return existing;

  const actor = currentActor();
  const leaseId = safeId("lease");
  const counterRef = doc(db, COLLECTIONS.counters, queueCounterId(tenantId, dateKey));
  const leaseRef = doc(db, COLLECTIONS.leases, leaseId);
  const lease = await runWaitingQueueTransaction(async transaction => {
    const counterSnap = await transaction.get(counterRef);
    const counter = counterSnap.exists() ? counterSnap.data() : {};
    const start = Math.max(1, Number(counter.nextNumber || 1));
    const end = start + NUMBER_LEASE_SIZE - 1;
    const nextCounter = {
      tenantId,
      dateKey,
      nextNumber: end + 1,
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs(),
    };
    const row = {
      id: leaseId,
      tenantId,
      dateKey,
      start,
      end,
      next: start,
      deviceId: actor.deviceId,
      createdBy: actor.actorId,
      createdAt: serverTimestamp(),
      createdAtMs: nowMs(),
    };
    transaction.set(counterRef, nextCounter, { merge: true });
    transaction.set(leaseRef, row, { merge: false });
    return { ...row, createdAt: null };
  });
  saveLease(tenantId, dateKey, lease);
  return lease;
}

async function allocateQueueNumber(tenantId) {
  const dateKey = toDateKey();
  let lease = readLease(tenantId, dateKey);
  if (!lease && isOnline()) lease = await ensureWaitingNumberLease(tenantId, { force: true });
  if (!lease) {
    throw new WaitingQueueError(
      "OFFLINE_NUMBER_LEASE_REQUIRED",
      "ไม่มีชุดเลขคิวออฟไลน์สำรอง กรุณาเชื่อมต่ออินเทอร์เน็ตชั่วคราวเพื่อสำรองเลข W ก่อนรับคิว",
    );
  }
  const sequence = Number(lease.next);
  saveLease(tenantId, dateKey, { ...lease, next: sequence + 1 });
  if (Number(lease.end) - sequence <= 3 && isOnline()) {
    setTimeout(() => ensureWaitingNumberLease(tenantId, { force: true }).catch(() => {}), 0);
  }
  return { queueNumber: formatQueueNumber(sequence), queueSequence: sequence, dateKey, provisional: false };
}

function priorityRank(priority) {
  return ({
    disabled: 4,
    elderly: 3,
    young_child: 2,
    normal: 0,
  })[priority] ?? 0;
}

function normalizeNeeds(needs = {}) {
  return {
    highChair: Boolean(needs.highChair),
    wheelchair: Boolean(needs.wheelchair),
    quietArea: Boolean(needs.quietArea),
    strollerSpace: Boolean(needs.strollerSpace),
  };
}

function activeFromStatus(status) {
  return WAITING_QUEUE_ACTIVE_STATUSES.has(status);
}

function baseQueueRow({ tenantId, queueId, publicToken, number, input, phoneHash, dedupeType, actor }) {
  const queuedAtMs = nowMs();
  const status = WAITING_QUEUE_STATUS.WAITING;
  return {
    id: queueId,
    waitingQueueId: queueId,
    clientRequestId: queueId,
    tenantId,
    queueNumber: number.queueNumber,
    queueSequence: number.queueSequence,
    queueDate: number.dateKey,
    queueNumberProvisional: Boolean(number.provisional),
    publicToken,
    customerName: normalizeString(input.customerName),
    phone: normalizePhone(input.phone),
    phoneMasked: maskPhone(input.phone),
    phoneHash,
    dedupeType: normalizeString(dedupeType || "request"),
    partySize: Math.max(1, Number(input.partySize) || 1),
    priority: normalizeString(input.priority || "normal") || "normal",
    priorityRank: priorityRank(input.priority || "normal"),
    needs: normalizeNeeds(input.needs),
    specialNote: normalizeString(input.specialNote),
    status,
    statusLabel: WAITING_QUEUE_STATUS_LABEL[status],
    active: true,
    deferCount: 0,
    maxDefers: Math.max(0, Number(input.maxDefers ?? DEFAULT_MAX_DEFERS)),
    queuedAt: new Date(queuedAtMs).toISOString(),
    queuedAtMs,
    effectiveQueuedAtMs: queuedAtMs,
    calledAt: null,
    calledAtMs: null,
    responseDeadlineAtMs: null,
    acknowledgedAtMs: null,
    preparingAtMs: null,
    seatedAtMs: null,
    deferredAtMs: null,
    noShowAtMs: null,
    cancelledAtMs: null,
    tableId: "",
    tableLabel: "",
    orderId: "",
    groupsAhead: Math.max(0, Number(input.groupsAhead || 0)),
    estimatedWaitMin: Math.max(0, Number(input.estimatedWaitMin || 0)),
    estimatedWaitMax: Math.max(0, Number(input.estimatedWaitMax || 0)),
    version: 1,
    appliedOperationIds: [],
    syncStatus: "pending_sync",
    createdBy: actor.actorId,
    createdByName: actor.actorName,
    createdByDeviceId: actor.deviceId,
    updatedBy: actor.actorId,
    updatedByName: actor.actorName,
    updatedAtMs: queuedAtMs,
    createdAtMs: queuedAtMs,
    deleted: false,
  };
}

function publicSnapshotFromQueue(queue, extra = {}, options = {}) {
  const seatedOrderUrl = queue.status === WAITING_QUEUE_STATUS.SEATED
    && normalizeString(queue.tenantSlug)
    && normalizeString(queue.tableCode || queue.tableId)
    && normalizeString(queue.tableToken)
    ? orderUrl({
        tenantSlug: normalizeString(queue.tenantSlug),
        tableCode: normalizeString(queue.tableCode || queue.tableId),
        tableToken: normalizeString(queue.tableToken),
      })
    : "";
  const snapshot = {
    id: queue.publicToken,
    token: queue.publicToken,
    tenantId: queue.tenantId,
    waitingQueueId: queue.id,
    queueNumber: queue.queueNumber,
    queueDate: queue.queueDate,
    queueNumberProvisional: Boolean(queue.queueNumberProvisional),
    partySize: Number(queue.partySize || 1),
    queuedAtMs: Number(queue.queuedAtMs || 0),
    effectiveQueuedAtMs: Number(queue.effectiveQueuedAtMs || queue.queuedAtMs || 0),
    status: queue.status,
    statusLabel: WAITING_QUEUE_STATUS_LABEL[queue.status] || queue.status,
    active: activeFromStatus(queue.status),
    groupsAhead: Number(extra.groupsAhead ?? queue.groupsAhead ?? 0),
    estimatedWaitMin: Number(extra.estimatedWaitMin ?? queue.estimatedWaitMin ?? 0),
    estimatedWaitMax: Number(extra.estimatedWaitMax ?? queue.estimatedWaitMax ?? 0),
    calledAtMs: Number(queue.calledAtMs || 0) || null,
    responseDeadlineAtMs: Number(queue.responseDeadlineAtMs || 0) || null,
    tableLabel: queue.status === WAITING_QUEUE_STATUS.SEATED ? normalizeString(queue.tableLabel) : "",
    orderUrl: seatedOrderUrl,
    updatedAtMs: nowMs(),
  };
  const responseMode = options.responseMode || "omit";
  const responseSource = responseMode === "queue" ? queue : responseMode === "preserve" ? extra : null;
  if (responseSource && Object.prototype.hasOwnProperty.call(responseSource, "customerResponse")) {
    snapshot.customerResponse = normalizeString(responseSource.customerResponse);
    snapshot.customerResponseAtMs = Number(responseSource.customerResponseAtMs || 0) || null;
  }
  return snapshot;
}

function boardSnapshotFromQueue(queue, extra = {}) {
  return {
    id: queue.id,
    tenantId: queue.tenantId,
    waitingQueueId: queue.id,
    queueNumber: queue.queueNumber,
    queueDate: queue.queueDate,
    queueNumberProvisional: Boolean(queue.queueNumberProvisional),
    partySize: Number(queue.partySize || 1),
    queuedAtMs: Number(queue.queuedAtMs || 0),
    effectiveQueuedAtMs: Number(queue.effectiveQueuedAtMs || queue.queuedAtMs || 0),
    status: queue.status,
    statusLabel: WAITING_QUEUE_STATUS_LABEL[queue.status] || queue.status,
    active: activeFromStatus(queue.status),
    groupsAhead: Number(extra.groupsAhead ?? queue.groupsAhead ?? 0),
    estimatedWaitMin: Number(extra.estimatedWaitMin ?? queue.estimatedWaitMin ?? 0),
    estimatedWaitMax: Number(extra.estimatedWaitMax ?? queue.estimatedWaitMax ?? 0),
    calledAtMs: Number(queue.calledAtMs || 0) || null,
    responseDeadlineAtMs: Number(queue.responseDeadlineAtMs || 0) || null,
    updatedAtMs: nowMs(),
  };
}

function auditRow({ opId, queue, action, fromStatus, toStatus, reason, actor, metadata = {} }) {
  return {
    id: opId,
    tenantId: queue.tenantId,
    waitingQueueId: queue.id,
    queueNumber: queue.queueNumber,
    action,
    fromStatus: fromStatus || "",
    toStatus: toStatus || "",
    reason: normalizeString(reason),
    actorId: actor.actorId,
    actorName: actor.actorName,
    actorEmail: actor.actorEmail,
    deviceId: actor.deviceId,
    metadata,
    createdAt: serverTimestamp(),
    createdAtMs: nowMs(),
  };
}

function pushAppliedOperation(row, opId) {
  const values = [...new Set([...(row.appliedOperationIds || []), opId])];
  return values.slice(-APPLIED_OPERATION_LIMIT);
}

function queueRef(queueId) {
  return doc(db, COLLECTIONS.queues, queueId);
}

function publicRef(token) {
  return doc(db, COLLECTIONS.public, token);
}

function boardRef(queueId) {
  return doc(db, COLLECTIONS.board, queueId);
}

function auditRef(opId) {
  return doc(db, COLLECTIONS.audits, opId);
}

function operationRef(opId) {
  return doc(db, COLLECTIONS.operations, opId);
}

function queueNumberRef(tenantId, dateKey, queueNumber) {
  return doc(db, COLLECTIONS.numbers, numberClaimId(tenantId, dateKey, queueNumber));
}

function queueDedupeRef(tenantId, dateKey, phoneHash) {
  return doc(db, COLLECTIONS.dedupe, dedupeId(tenantId, dateKey, phoneHash));
}

async function syncCreateOperation(operation) {
  const payload = operation.payload;
  const qRef = queueRef(payload.id);
  const pRef = publicRef(payload.publicToken);
  const bRef = boardRef(payload.id);
  const aRef = auditRef(operation.opId);
  const opRef = operationRef(operation.opId);
  const dRef = queueDedupeRef(payload.tenantId, payload.queueDate, payload.phoneHash || "no-phone");
  const initialNumberRef = queueNumberRef(payload.tenantId, payload.queueDate, payload.queueNumber);
  const actor = operation.actor || currentActor();

  return runWaitingQueueTransaction(async transaction => {
    const [operationSnap, queueSnap, dedupeSnap, initialNumberSnap] = await Promise.all([
      transaction.get(opRef),
      transaction.get(qRef),
      transaction.get(dRef),
      transaction.get(initialNumberRef),
    ]);

    if (operationSnap.exists()) {
      const marker = operationSnap.data() || {};
      if (marker.tenantId !== payload.tenantId || marker.waitingQueueId !== payload.id) {
        throw new WaitingQueueError("OPERATION_ID_CONFLICT", "พบ Operation ID ซ้ำ กรุณาลองใหม่");
      }
      return {
        ...payload,
        queueNumber: marker.queueNumber || payload.queueNumber,
        queueSequence: marker.queueSequence ?? payload.queueSequence,
        queueNumberProvisional: false,
        syncStatus: "synced",
        firebaseSyncedAtMs: Number(marker.createdAtMs || nowMs()),
        _idempotent: true,
      };
    }


    if (queueSnap.exists()) {
      const existing = { ...queueSnap.data(), id: queueSnap.id };
      if (String(existing.tenantId) !== String(payload.tenantId) || String(existing.id) !== String(payload.id)) {
        throw new WaitingQueueError("QUEUE_ID_CONFLICT", "พบ Waiting Queue ID ซ้ำ กรุณาลองใหม่");
      }
      return {
        ...existing,
        syncStatus: "synced",
        _operationResolution: "queue_exists",
        _operationResolutionReason: "พบคิวนี้ใน Firebase แล้ว จึงไม่เขียนข้อมูลเริ่มต้นทับสถานะล่าสุด",
      };
    }

    if (dedupeSnap.exists()) {
      const dedupe = dedupeSnap.data() || {};
      const existingId = normalizeString(dedupe.waitingQueueId);
      if (existingId && existingId !== payload.id && ACTIVE_DEDUPE_STATUSES.has(dedupe.status)) {
        throw new WaitingQueueError("DUPLICATE_ACTIVE_QUEUE", "ลูกค้าหรืออุปกรณ์นี้มีคิวที่กำลังใช้งานอยู่แล้ว", {
          waitingQueueId: existingId,
          queueNumber: dedupe.queueNumber || "",
        });
      }
    }

    const queueNumber = payload.queueNumber;
    const queueSequence = payload.queueSequence;
    const numberClaimRef = initialNumberRef;
    if (payload.queueNumberProvisional) {
      throw new WaitingQueueError("PROVISIONAL_NUMBER_NOT_ALLOWED", "เลขคิวต้องคงที่ กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อรับเลข W ที่สำรองไว้");
    }
    const numberConflict = initialNumberSnap.exists() && initialNumberSnap.data()?.waitingQueueId !== payload.id;
    if (numberConflict) {
      throw new WaitingQueueError("QUEUE_NUMBER_CONFLICT", `เลขคิว ${queueNumber} ถูกใช้แล้ว กรุณาให้ผู้จัดการตรวจสอบก่อนออกคิวใหม่`);
    }

    const createdAtMs = Number(payload.createdAtMs || nowMs());
    const row = {
      ...payload,
      queueNumber,
      queueSequence,
      queueNumberProvisional: false,
      syncStatus: "synced",
      firebaseSyncedAtMs: nowMs(),
      appliedOperationIds: pushAppliedOperation(payload, operation.opId),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAtMs: nowMs(),
      createdAtMs,
    };
    const publicRow = publicSnapshotFromQueue(row);

    if (!initialNumberSnap.exists()) {
      transaction.set(numberClaimRef, {
        tenantId: payload.tenantId,
        dateKey: payload.queueDate,
        queueNumber,
        waitingQueueId: payload.id,
        createdAt: serverTimestamp(),
        createdAtMs,
      }, { merge: false });
    }
    transaction.set(opRef, {
      id: operation.opId,
      tenantId: payload.tenantId,
      waitingQueueId: payload.id,
      kind: "create",
      queueNumber,
      queueSequence,
      createdAt: serverTimestamp(),
      createdAtMs,
    }, { merge: false });
    transaction.set(qRef, row, { merge: false });
    transaction.set(pRef, { ...publicRow, updatedAt: serverTimestamp() }, { merge: false });
    transaction.set(bRef, { ...boardSnapshotFromQueue(row), updatedAt: serverTimestamp() }, { merge: false });
    transaction.set(dRef, {
      tenantId: payload.tenantId,
      dateKey: payload.queueDate,
      phoneHash: payload.phoneHash || "",
      waitingQueueId: payload.id,
      queueNumber,
      status: row.status,
      active: true,
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs(),
    }, { merge: true });
    transaction.set(aRef, auditRow({
      opId: operation.opId,
      queue: row,
      action: "queue_created",
      fromStatus: "",
      toStatus: row.status,
      reason: "",
      actor,
      metadata: { partySize: row.partySize, source: row.source || "staff" },
    }), { merge: false });
    return { ...row, updatedAt: null, createdAt: null };
  });
}

function transitionPatch(queue, toStatus, options = {}) {
  const timestamp = nowMs();
  const patch = {
    status: toStatus,
    statusLabel: WAITING_QUEUE_STATUS_LABEL[toStatus] || toStatus,
    active: activeFromStatus(toStatus),
    updatedAtMs: timestamp,
  };
  if (toStatus === WAITING_QUEUE_STATUS.CALLED) {
    const timeoutMinutes = Math.max(1, Number(options.callTimeoutMinutes || DEFAULT_CALL_TIMEOUT_MINUTES));
    patch.calledAtMs = timestamp;
    patch.calledAt = new Date(timestamp).toISOString();
    patch.responseDeadlineAtMs = timestamp + timeoutMinutes * 60_000;
    patch.customerResponse = "";
    patch.customerResponseAtMs = null;
  }
  if (toStatus === WAITING_QUEUE_STATUS.ACKNOWLEDGED) patch.acknowledgedAtMs = timestamp;
  if (toStatus === WAITING_QUEUE_STATUS.PREPARING_TABLE) patch.preparingAtMs = timestamp;
  if (toStatus === WAITING_QUEUE_STATUS.DEFERRED) {
    patch.deferredAtMs = timestamp;
    patch.deferCount = Number(queue.deferCount || 0) + 1;
    patch.effectiveQueuedAtMs = timestamp;
    patch.calledAtMs = null;
    patch.calledAt = null;
    patch.responseDeadlineAtMs = null;
    patch.customerResponse = "";
    patch.customerResponseAtMs = null;
  }
  if (toStatus === WAITING_QUEUE_STATUS.WAITING) {
    patch.calledAtMs = null;
    patch.calledAt = null;
    patch.responseDeadlineAtMs = null;
    patch.customerResponse = "";
    patch.customerResponseAtMs = null;
    if (queue.status === WAITING_QUEUE_STATUS.NO_SHOW) patch.effectiveQueuedAtMs = timestamp;
  }
  if (toStatus === WAITING_QUEUE_STATUS.NO_SHOW) patch.noShowAtMs = timestamp;
  if (toStatus === WAITING_QUEUE_STATUS.CANCELLED) patch.cancelledAtMs = timestamp;
  return patch;
}

function validateTransition(queue, toStatus, options = {}) {
  if (!queue) throw new WaitingQueueError("QUEUE_NOT_FOUND", "ไม่พบคิวรอโต๊ะ");
  if (queue.status === toStatus) {
    if (options.allowSameStatus) return;
    return;
  }
  const allowed = ALLOWED_TRANSITIONS[queue.status] || new Set();
  if (!allowed.has(toStatus)) {
    throw new WaitingQueueError("INVALID_STATUS_TRANSITION", `ไม่สามารถเปลี่ยนสถานะจาก ${WAITING_QUEUE_STATUS_LABEL[queue.status] || queue.status} เป็น ${WAITING_QUEUE_STATUS_LABEL[toStatus] || toStatus}`);
  }
  if (toStatus === WAITING_QUEUE_STATUS.DEFERRED && Number(queue.deferCount || 0) >= Number(queue.maxDefers ?? DEFAULT_MAX_DEFERS)) {
    throw new WaitingQueueError("DEFER_LIMIT_REACHED", "คิวนี้ใช้สิทธิ์เลื่อนครบจำนวนที่ร้านกำหนดแล้ว");
  }
  if (options.requireReason && !normalizeString(options.reason)) {
    throw new WaitingQueueError("REASON_REQUIRED", "กรุณาระบุเหตุผล");
  }
}

async function syncTransitionOperation(operation) {
  const {
    tenantId,
    queueId,
    toStatus,
    options = {},
    expectedVersion,
    fromStatus,
  } = operation.payload;
  const qRef = queueRef(queueId);
  const aRef = auditRef(operation.opId);
  const actor = operation.actor || currentActor();

  return runWaitingQueueTransaction(async transaction => {
    const qSnap = await transaction.get(qRef);
    if (!qSnap.exists()) throw new WaitingQueueError("QUEUE_NOT_FOUND", "ไม่พบคิวรอโต๊ะใน Firebase");

    const remote = {
      ...qSnap.data(),
      id: qSnap.id,
      waitingQueueId: qSnap.data()?.waitingQueueId || qSnap.id,
    };
    if ((remote.appliedOperationIds || []).includes(operation.opId)) {
      return {
        ...remote,
        _idempotent: true,
        _operationResolution: "already_applied",
      };
    }
    if (remote.status === toStatus && !options.allowSameStatus) {
      return {
        ...remote,
        _idempotent: true,
        _operationResolution: "already_applied",
      };
    }
    if (WAITING_QUEUE_FINAL_STATUSES.has(remote.status)) {
      return {
        ...remote,
        _operationResolution: "remote_final",
        _operationResolutionReason: `สถานะล่าสุดคือ ${WAITING_QUEUE_STATUS_LABEL[remote.status] || remote.status}`,
      };
    }

    const sourceStatus = normalizeString(fromStatus);
    const expected = Number(expectedVersion);
    const versionChanged = Number.isFinite(expected)
      && Number(remote.version || 1) !== expected;
    const sourceChanged = Boolean(sourceStatus && remote.status !== sourceStatus);
    const terminalIntent = [
      WAITING_QUEUE_STATUS.CANCELLED,
      WAITING_QUEUE_STATUS.NO_SHOW,
    ].includes(toStatus);
    const recallIntent = toStatus === WAITING_QUEUE_STATUS.CALLED
      && options.allowSameStatus
      && remote.status === WAITING_QUEUE_STATUS.CALLED;

    if ((versionChanged || sourceChanged) && !terminalIntent && !recallIntent) {
      return {
        ...remote,
        _operationResolution: "superseded",
        _operationResolutionReason: "คำสั่งนี้อ้างอิงสถานะเก่า ระบบใช้สถานะล่าสุดจาก Firebase แทน",
      };
    }

    try {
      validateTransition(remote, toStatus, options);
    } catch (error) {
      if (
        error?.code === "INVALID_STATUS_TRANSITION"
        && (versionChanged || sourceChanged)
      ) {
        return {
          ...remote,
          _operationResolution: "superseded",
          _operationResolutionReason: "ลำดับสถานะเปลี่ยนจากอุปกรณ์อื่นแล้ว ระบบจึงยกเลิกคำสั่งเก่า",
        };
      }
      throw error;
    }

    const pRef = publicRef(remote.publicToken);
    const bRef = boardRef(remote.id);
    const dRef = queueDedupeRef(tenantId, remote.queueDate, remote.phoneHash || "no-phone");
    const [publicSnap, dedupeSnap] = await Promise.all([
      transaction.get(pRef),
      transaction.get(dRef),
    ]);

    const patch = transitionPatch(remote, toStatus, options);
    const next = {
      ...remote,
      ...patch,
      version: Number(remote.version || 1) + 1,
      appliedOperationIds: pushAppliedOperation(remote, operation.opId),
      updatedBy: actor.actorId,
      updatedByName: actor.actorName,
      lastReason: normalizeString(options.reason),
      syncStatus: "synced",
      firebaseSyncedAtMs: nowMs(),
    };

    transaction.set(qRef, { ...next, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(pRef, {
      ...publicSnapshotFromQueue(
        next,
        publicSnap.exists() ? publicSnap.data() : {},
        {
          responseMode: [
            WAITING_QUEUE_STATUS.CALLED,
            WAITING_QUEUE_STATUS.WAITING,
            WAITING_QUEUE_STATUS.DEFERRED,
          ].includes(toStatus) ? "queue" : "preserve",
        },
      ),
      updatedAt: serverTimestamp(),
    }, { merge: false });
    transaction.set(bRef, {
      ...boardSnapshotFromQueue(next),
      updatedAt: serverTimestamp(),
    }, { merge: false });
    transaction.set(dRef, {
      ...(dedupeSnap.exists() ? dedupeSnap.data() : {}),
      tenantId,
      waitingQueueId: remote.id,
      queueNumber: remote.queueNumber,
      status: toStatus,
      active: activeFromStatus(toStatus),
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs(),
    }, { merge: true });
    transaction.set(aRef, auditRow({
      opId: operation.opId,
      queue: next,
      action: options.action || "status_changed",
      fromStatus: remote.status,
      toStatus,
      reason: options.reason,
      actor,
      metadata: options.metadata || {},
    }), { merge: false });

    return { ...next, updatedAt: null };
  });
}

async function syncOperation(operation) {
  if (operation.kind === "create") return syncCreateOperation(operation);
  if (operation.kind === "transition") return syncTransitionOperation(operation);
  throw new WaitingQueueError("UNKNOWN_OPERATION", `ไม่รู้จักงาน Sync: ${operation.kind}`);
}

export async function syncWaitingQueueOutbox(tenantId, { maxOperations = 20 } = {}) {
  if (!isOnline() || !db) {
    return {
      processed: 0,
      resolved: 0,
      pending: localOutbox(tenantId).length,
      errors: [],
    };
  }

  const pending = localOutbox(tenantId).slice(0, maxOperations);
  let processed = 0;
  let resolved = 0;
  const errors = [];

  for (const operation of pending) {
    try {
      const synced = await syncOperation(operation);
      if (synced?.id) {
        upsertLocalQueue(tenantId, {
          ...stripOperationMetadata(synced),
          syncStatus: "synced",
          syncError: "",
        });
      }
      if (synced?._operationResolution && synced._operationResolution !== "already_applied") {
        resolved += 1;
      }
      removeOperation(tenantId, operation.opId);
      processed += 1;
    } catch (error) {
      let remote = null;
      try {
        remote = await readRemoteWaitingQueue(operationQueueId(operation));
      } catch {
        remote = null;
      }

      if (operationCanResolveFromRemote(operation, remote, error)) {
        removeOperation(tenantId, operation.opId);
        if (remote?.id) {
          upsertLocalQueue(tenantId, {
            ...remote,
            syncStatus: "synced",
            syncError: "",
          });
        }
        processed += 1;
        resolved += 1;
        continue;
      }

      markOperationError(tenantId, operation.opId, error);
      errors.push({ opId: operation.opId, error });
      break;
    }
  }

  return {
    processed,
    resolved,
    pending: localOutbox(tenantId).length,
    errors,
  };
}

export async function createWaitingQueue(input) {
  const tenantId = normalizeString(input.tenantId || await resolveTenantId());
  const partySize = Number(input.partySize || 0);
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 99) {
    throw new WaitingQueueError("INVALID_PARTY_SIZE", "จำนวนลูกค้าต้องอยู่ระหว่าง 1–99 คน");
  }
  const phone = normalizePhone(input.phone);
  if (phone && phone.length < 9) throw new WaitingQueueError("INVALID_PHONE", "เบอร์โทรศัพท์ไม่ถูกต้อง");
  const actor = currentActor();
  const queueId = normalizeString(input.waitingQueueId || input.clientRequestId) || safeId("wq");
  const publicToken = normalizeString(input.publicToken) || safeToken();
  const customerDeviceId = normalizeString(input.customerDeviceId);
  const dedupeType = phone ? "phone" : customerDeviceId ? "device" : "request";
  const dedupeIdentity = phone || customerDeviceId || queueId;
  const dateKey = toDateKey();
  const phoneHash = await hashText(`${tenantId}|${dateKey}|${dedupeType}|${dedupeIdentity}`);
  if (dedupeType !== "request") {
    const localDuplicate = localQueues(tenantId).find(item =>
      item.queueDate === dateKey
        && item.phoneHash === phoneHash
        && activeFromStatus(item.status)
        && String(item.id) !== String(queueId)
    );
    if (localDuplicate) {
      throw new WaitingQueueError("DUPLICATE_ACTIVE_QUEUE", "ลูกค้าหรืออุปกรณ์นี้มีคิวที่กำลังใช้งานอยู่แล้ว", {
        waitingQueueId: localDuplicate.id,
        queueNumber: localDuplicate.queueNumber,
      });
    }
  }
  const number = await allocateQueueNumber(tenantId);
  const row = baseQueueRow({ tenantId, queueId, publicToken, number, input, phoneHash, dedupeType, actor });
  row.source = normalizeString(input.source || "staff");
  const opId = safeId("wqop");
  const operation = {
    opId,
    kind: "create",
    tenantId,
    queueId,
    payload: row,
    actor,
    createdAtMs: nowMs(),
    syncStatus: "pending_sync",
  };
  upsertLocalQueue(tenantId, row);
  enqueueOperation(tenantId, operation);
  if (isOnline()) {
    try {
      const synced = await syncOperation(operation);
      removeOperation(tenantId, opId);
      upsertLocalQueue(tenantId, { ...synced, syncStatus: "synced" });
      ensureWaitingNumberLease(tenantId).catch(() => {});
      return synced;
    } catch (error) {
      if (error?.code === "DUPLICATE_ACTIVE_QUEUE") {
        removeOperation(tenantId, opId);
        removeLocalQueue(tenantId, queueId);
        throw error;
      }
      markOperationError(tenantId, opId, error);
    }
  }
  return row;
}

export async function transitionWaitingQueue(queueId, toStatus, options = {}) {
  const tenantId = normalizeString(options.tenantId || await resolveTenantId());
  const local = localQueues(tenantId).find(item => String(item.id) === String(queueId));

  if (!local) {
    const snapshot = await getDoc(queueRef(queueId));
    if (!snapshot.exists()) throw new WaitingQueueError("QUEUE_NOT_FOUND", "ไม่พบคิวรอโต๊ะ");
    upsertLocalQueue(tenantId, { ...snapshot.data(), id: snapshot.id });
  }

  const current = localQueues(tenantId).find(item => String(item.id) === String(queueId));
  validateTransition(current, toStatus, options);

  const actor = currentActor();
  const opId = safeId("wqop");
  const localPatch = transitionPatch(current, toStatus, options);
  const optimistic = {
    ...current,
    ...localPatch,
    version: Number(current.version || 1) + 1,
    updatedBy: actor.actorId,
    updatedByName: actor.actorName,
    lastReason: normalizeString(options.reason),
    syncStatus: "pending_sync",
    syncError: "",
  };
  upsertLocalQueue(tenantId, optimistic);

  const operation = {
    opId,
    kind: "transition",
    tenantId,
    queueId,
    payload: {
      tenantId,
      queueId,
      fromStatus: current.status,
      toStatus,
      options,
      expectedVersion: Number(current.version || 1),
    },
    actor,
    createdAtMs: nowMs(),
    syncStatus: "pending_sync",
  };
  enqueueOperation(tenantId, operation);

  if (!isOnline()) return optimistic;

  try {
    const synced = await syncOperation(operation);
    removeOperation(tenantId, opId);
    upsertLocalQueue(tenantId, {
      ...stripOperationMetadata(synced),
      syncStatus: "synced",
      syncError: "",
    });
    return synced;
  } catch (error) {
    let remote = null;
    try {
      remote = await readRemoteWaitingQueue(queueId);
    } catch {
      remote = null;
    }

    if (operationCanResolveFromRemote(operation, remote, error)) {
      removeOperation(tenantId, opId);
      upsertLocalQueue(tenantId, {
        ...remote,
        syncStatus: "synced",
        syncError: "",
      });
      return {
        ...remote,
        _operationResolution: "reconciled_after_error",
        _operationResolutionReason: "ระบบโหลดสถานะล่าสุดจาก Firebase และยกเลิกคำสั่งที่อ้างอิงข้อมูลเก่า",
      };
    }

    markOperationError(tenantId, opId, error);
    upsertLocalQueue(tenantId, {
      ...current,
      syncStatus: "conflict",
      syncError: String(error?.message || error),
    });
    throw error;
  }
}

function normalizeTable(snapshot, sourceCollection) {
  const data = snapshot.data ? snapshot.data() : snapshot;
  const id = snapshot.id || data.id || data.tableId;
  const capacity = Math.max(1, Number(data.capacity || data.seats || data.seatCount || data.maxGuests || data.size || 4));
  const label = normalizeString(data.name || data.tableName || data.label || data.number || data.code || id);
  const status = normalizeString(data.status || data.tableStatus || (data.occupied || data.isOccupied ? "occupied" : "available")).toLowerCase();
  const available = !data.deleted && !data.disabled && !data.occupied && !data.isOccupied && data.available !== false && data.isAvailable !== false && ["", "available", "free", "empty", "open", "ready", "ว่าง"].includes(status);
  return {
    ...data,
    id: String(id),
    tableId: String(id),
    label,
    capacity,
    status,
    available,
    accessible: Boolean(data.accessible || data.wheelchairAccessible || data.wheelchair),
    highChairSupported: data.highChairSupported !== false,
    quietArea: Boolean(data.quietArea),
    _collection: sourceCollection,
  };
}

export async function loadWaitingQueueTables(tenantId) {
  const rows = [];
  const seen = new Set();
  const attempts = [
    { collectionRef: collection(db, COLLECTIONS.tables), source: COLLECTIONS.tables, filter: true },
    { collectionRef: collection(db, "tenants", tenantId, COLLECTIONS.tables), source: `tenants/${tenantId}/${COLLECTIONS.tables}`, filter: false },
  ];
  for (const attempt of attempts) {
    try {
      const q = attempt.filter
        ? query(attempt.collectionRef, where("tenantId", "==", tenantId))
        : attempt.collectionRef;
      const snapshot = await getDocs(q);
      snapshot.forEach(item => {
        const table = normalizeTable(item, attempt.source);
        const key = `${table._collection}:${table.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(table);
        }
      });
    } catch (error) {
      console.warn("[waiting-queue] table source unavailable", attempt.source, error);
    }
  }
  return rows.sort((a, b) => String(a.label).localeCompare(String(b.label), "th", { numeric: true }));
}

function tableRefFromTable(table) {
  const source = normalizeString(table?._collection || COLLECTIONS.tables);
  if (source.startsWith("tenants/")) {
    const parts = source.split("/").filter(Boolean);
    return doc(db, ...parts, String(table.id));
  }
  return doc(db, COLLECTIONS.tables, String(table.id));
}

function tableIsAvailable(data = {}) {
  return normalizeTable({ ...data, id: data.id || data.tableId || "table" }, COLLECTIONS.tables).available;
}

function tableSupportsQueue(table, queue) {
  if (!table || !queue) return false;
  if (Number(queue.partySize || 1) > Number(table.capacity || 1)) return false;
  if (queue.needs?.wheelchair && !table.accessible) return false;
  if (queue.needs?.highChair && !table.highChairSupported) return false;
  if (queue.needs?.quietArea && !table.quietArea) return false;
  return true;
}

function tableFitsQueue(table, queue) {
  return Boolean(table?.available) && tableSupportsQueue(table, queue);
}

async function tenantStorefrontSlug(tenantId) {
  const snapshot = await getDoc(doc(db, "tenants", tenantId));
  const slug = normalizeString(snapshot.exists() ? snapshot.data()?.slug : "");
  if (!slug) {
    throw new WaitingQueueError(
      "TENANT_SLUG_REQUIRED",
      "ร้านนี้ยังไม่มีชื่อร้านสำหรับลิงก์สั่งอาหาร กรุณาตั้งค่าร้านก่อนเปิดโต๊ะ",
    );
  }
  return slug;
}

function orderUrl({ tenantSlug, tableCode, tableToken }) {
  const params = new URLSearchParams({
    table: tableCode,
    token: tableToken,
  });
  return `/s/${encodeURIComponent(tenantSlug)}/order/?${params.toString()}`;
}

export async function seatWaitingQueue(queueId, table, options = {}) {
  if (!isOnline()) throw new WaitingQueueError("ONLINE_REQUIRED", "การเปิดโต๊ะต้องเชื่อมต่ออินเทอร์เน็ตเพื่อป้องกันการจัดโต๊ะซ้ำ");
  const tenantId = normalizeString(options.tenantId || await resolveTenantId());
  const tenantSlug = await tenantStorefrontSlug(tenantId);
  const actor = currentActor();
  const opId = safeId("wqseat");
  const orderId = normalizeString(options.orderId) || `order-wq-${queueId}`;
  const requestedTableToken = normalizeString(options.tableToken) || safeToken();
  const qRef = queueRef(queueId);
  const tRef = tableRefFromTable(table);
  const oRef = doc(db, COLLECTIONS.orders, orderId);
  const bRef = boardRef(queueId);
  const aRef = auditRef(opId);

  const result = await runWaitingQueueTransaction(async transaction => {
    const [qSnap, tSnap, oSnap] = await Promise.all([
      transaction.get(qRef),
      transaction.get(tRef),
      transaction.get(oRef),
    ]);
    if (!qSnap.exists()) throw new WaitingQueueError("QUEUE_NOT_FOUND", "ไม่พบคิวรอโต๊ะ");
    if (!tSnap.exists()) throw new WaitingQueueError("TABLE_NOT_FOUND", "ไม่พบโต๊ะที่เลือก");
    const queue = {
      ...qSnap.data(),
      id: qSnap.id,
      waitingQueueId: qSnap.data()?.waitingQueueId || qSnap.id,
    };
    const remoteTable = { ...tSnap.data(), id: tSnap.id };
    const seatedAtSelectedTable = queue.status === WAITING_QUEUE_STATUS.SEATED
      && queue.tableId === String(table.id)
      && queue.orderId;
    const repairExistingSeat = Boolean(
      seatedAtSelectedTable
      && (
        !normalizeString(queue.tableToken)
        || !normalizeString(remoteTable.orderToken)
        || normalizeString(queue.tableToken) !== normalizeString(remoteTable.orderToken)
      ),
    );
    if (queue.status === WAITING_QUEUE_STATUS.SEATED && !repairExistingSeat) {
      if (seatedAtSelectedTable) {
        const tableCode = normalizeString(remoteTable.code || remoteTable.id || table.id);
        const tableToken = normalizeString(remoteTable.orderToken || queue.tableToken);
        return {
          queue: { ...queue, tableCode, tableToken },
          orderId: queue.orderId,
          tableId: queue.tableId,
          tableCode,
          tableToken,
          tenantSlug,
          idempotent: true,
        };
      }
      throw new WaitingQueueError("QUEUE_ALREADY_SEATED", "คิวนี้ถูกจัดโต๊ะไปแล้วจากอุปกรณ์อื่น");
    }
    if (!repairExistingSeat && !WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status)) {
      throw new WaitingQueueError("QUEUE_NOT_ACTIVE", "คิวนี้ไม่อยู่ในสถานะที่เปิดโต๊ะได้");
    }
    if (!repairExistingSeat && !tableIsAvailable(remoteTable)) {
      throw new WaitingQueueError("TABLE_ALREADY_OCCUPIED", "โต๊ะนี้ไม่ว่างแล้ว กรุณาเลือกโต๊ะใหม่");
    }
    const normalizedRemoteTable = normalizeTable({ ...remoteTable, id: tSnap.id }, table._collection || COLLECTIONS.tables);
    if (!repairExistingSeat && !tableFitsQueue(normalizedRemoteTable, queue) && !normalizeString(options.overrideReason)) {
      throw new WaitingQueueError("TABLE_NOT_SUITABLE", "โต๊ะไม่เหมาะกับจำนวนคนหรือความต้องการพิเศษ หากต้องการข้ามเงื่อนไขต้องระบุเหตุผล");
    }
    if (oSnap.exists()) {
      const existingOrder = oSnap.data() || {};
      if (existingOrder.waitingQueueId !== queue.id || existingOrder.tenantId !== tenantId) {
        throw new WaitingQueueError("ORDER_ID_CONFLICT", "พบ Order ID ซ้ำ กรุณาลองใหม่");
      }
    }
    const pRef = publicRef(queue.publicToken);
    const dRef = queueDedupeRef(tenantId, queue.queueDate, queue.phoneHash || "no-phone");
    const [publicSnap, dedupeSnap] = await Promise.all([transaction.get(pRef), transaction.get(dRef)]);
    const timestamp = nowMs();
    const tableLabel = normalizedRemoteTable.label;
    const tableCode = normalizeString(normalizedRemoteTable.code || normalizedRemoteTable.id);
    const tableToken = normalizeString(remoteTable.orderToken || queue.tableToken || requestedTableToken);
    const nextQueue = {
      ...queue,
      status: WAITING_QUEUE_STATUS.SEATED,
      statusLabel: WAITING_QUEUE_STATUS_LABEL.seated,
      active: false,
      seatedAtMs: Number(queue.seatedAtMs || timestamp),
      tableId: String(table.id),
      tableCode,
      tableLabel,
      tableToken,
      tenantSlug,
      orderId,
      version: Number(queue.version || 1) + 1,
      appliedOperationIds: pushAppliedOperation(queue, opId),
      updatedBy: actor.actorId,
      updatedByName: actor.actorName,
      updatedAtMs: timestamp,
      syncStatus: "synced",
      firebaseSyncedAtMs: timestamp,
      lastReason: normalizeString(options.overrideReason || options.reason),
    };
    const order = {
      id: orderId,
      orderId,
      tenantId,
      type: "dine_in",
      orderType: "dine_in",
      status: "open",
      orderStatus: "open",
      paymentStatus: "unpaid",
      kitchenStatus: "draft",
      tableId: String(table.id),
      table: tableLabel,
      tableNumber: tableLabel,
      tableNo: tableLabel,
      tableName: tableLabel,
      tableLabel,
      tableCode,
      tableToken,
      waitingQueueId: queue.id,
      waitingQueueNumber: queue.queueNumber,
      customerName: queue.customerName,
      customerPhone: queue.phone,
      partySize: Number(queue.partySize || 1),
      guestCount: Number(queue.partySize || 1),
      customerCount: Number(queue.partySize || 1),
      items: [],
      subtotal: 0,
      total: 0,
      createdBy: actor.actorId,
      createdByName: actor.actorName,
      createdAt: serverTimestamp(),
      createdAtMs: timestamp,
      updatedAt: serverTimestamp(),
      updatedAtMs: timestamp,
    };
    const tablePatch = {
      tenantId,
      status: "occupied",
      tableStatus: "occupied",
      occupied: true,
      isOccupied: true,
      available: false,
      isAvailable: false,
      activeOrderId: orderId,
      currentOrderId: orderId,
      orderId,
      isOpen: true,
      orderToken: tableToken,
      sessionStartedAt: normalizeString(remoteTable.sessionStartedAt) || new Date(timestamp).toISOString(),
      currentRound: Number(remoteTable.currentRound || 0),
      orderIds: Array.isArray(remoteTable.orderIds) ? remoteTable.orderIds : [],
      waitingQueueId: queue.id,
      waitingQueueNumber: queue.queueNumber,
      partySize: Number(queue.partySize || 1),
      occupiedAt: serverTimestamp(),
      occupiedAtMs: timestamp,
      updatedAt: serverTimestamp(),
      updatedAtMs: timestamp,
    };
    transaction.set(tRef, tablePatch, { merge: true });
    transaction.set(oRef, order, { merge: true });
    transaction.set(qRef, { ...nextQueue, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(pRef, {
      ...publicSnapshotFromQueue(
        nextQueue,
        publicSnap.exists() ? publicSnap.data() : {},
        { responseMode: "preserve" },
      ),
      updatedAt: serverTimestamp(),
    }, { merge: false });
    transaction.set(bRef, {
      ...boardSnapshotFromQueue(nextQueue),
      updatedAt: serverTimestamp(),
    }, { merge: false });
    transaction.set(dRef, {
      ...(dedupeSnap.exists() ? dedupeSnap.data() : {}),
      tenantId,
      waitingQueueId: queue.id,
      queueNumber: queue.queueNumber,
      status: WAITING_QUEUE_STATUS.SEATED,
      active: false,
      updatedAt: serverTimestamp(),
      updatedAtMs: timestamp,
    }, { merge: true });
    transaction.set(aRef, auditRow({
      opId,
      queue: nextQueue,
      action: repairExistingSeat ? "table_session_repaired" : "table_opened",
      fromStatus: queue.status,
      toStatus: WAITING_QUEUE_STATUS.SEATED,
      reason: options.overrideReason || options.reason,
      actor,
      metadata: {
        tableId: String(table.id),
        tableLabel,
        tableCapacity: normalizedRemoteTable.capacity,
        orderId,
        tableSuitable: tableSupportsQueue(normalizedRemoteTable, queue),
        fairnessOverride: Boolean(options.fairnessContext?.recommendedQueueId && options.fairnessContext.recommendedQueueId !== queue.id),
        recommendedQueueId: normalizeString(options.fairnessContext?.recommendedQueueId),
        recommendedQueueNumber: normalizeString(options.fairnessContext?.recommendedQueueNumber),
        skippedQueues: Array.isArray(options.fairnessContext?.skippedQueues)
          ? options.fairnessContext.skippedQueues.slice(0, 10)
          : [],
      },
    }), { merge: false });
    return {
      queue: nextQueue,
      orderId,
      tableId: String(table.id),
      tableCode,
      tableToken,
      tenantSlug,
      idempotent: false,
      repaired: repairExistingSeat,
    };
  });

  upsertLocalQueue(tenantId, { ...result.queue, syncStatus: "synced" });
  return {
    ...result,
    orderUrl: orderUrl({
      tenantSlug: result.tenantSlug || tenantSlug,
      tableCode: result.tableCode || result.tableId,
      tableToken: result.tableToken || result.queue.tableToken,
    }),
  };
}

function snapshotRows(snapshot) {
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
}

function mergeRemoteAndLocal(tenantId, remoteRows, dateKey = toDateKey()) {
  const byId = new Map(remoteRows.map(row => [String(row.id), row]));
  const pendingQueueIds = new Set(
    localOutbox(tenantId)
      .map(operationQueueId)
      .filter(Boolean),
  );

  localQueues(tenantId).forEach(local => {
    const id = String(local.id);
    const remote = byId.get(id);
    if (!remote) {
      byId.set(id, local);
      return;
    }

    const hasPending = pendingQueueIds.has(id);
    const localVersion = Number(local.version || 1);
    const remoteVersion = Number(remote.version || 1);
    const remoteIsFinal = WAITING_QUEUE_FINAL_STATUSES.has(remote.status);
    const localShouldLead = hasPending
      && local.syncStatus === "pending_sync"
      && !remoteIsFinal
      && localVersion > remoteVersion;

    if (localShouldLead) {
      byId.set(id, { ...remote, ...local });
      return;
    }

    byId.set(id, {
      ...local,
      ...remote,
      syncStatus: hasPending ? "pending_sync" : "synced",
      syncError: hasPending ? String(local.syncError || "") : "",
    });
  });

  const rows = [...byId.values()]
    .filter(item => item.tenantId === tenantId && item.queueDate === dateKey && item.deleted !== true)
    .sort((a, b) =>
      Number(a.effectiveQueuedAtMs || a.queuedAtMs || 0)
        - Number(b.effectiveQueuedAtMs || b.queuedAtMs || 0)
    );

  saveLocalQueues(tenantId, rows, { notify: false });
  return rows;
}

export function watchWaitingQueues(tenantId, callback, onError = console.error) {
  let unsubscribe = () => {};
  let stopped = false;
  let latestRemoteRows = [];
  const dateKey = toDateKey();

  const publish = () => {
    callback(mergeRemoteAndLocal(tenantId, latestRemoteRows, dateKey));
  };

  const attach = mode => {
    try {
      const base = collection(db, COLLECTIONS.queues);
      const q = mode === "ordered"
        ? query(base, where("tenantId", "==", tenantId), where("queueDate", "==", dateKey), orderBy("effectiveQueuedAtMs", "asc"))
        : mode === "dated"
          ? query(base, where("tenantId", "==", tenantId), where("queueDate", "==", dateKey))
          : query(base, where("tenantId", "==", tenantId));

      unsubscribe = onSnapshot(q, snapshot => {
        latestRemoteRows = snapshotRows(snapshot);
        publish();
      }, error => {
        if (stopped) return;
        if (mode === "ordered") attach("dated");
        else if (mode === "dated") attach("tenant");
        else {
          onError(error);
          publish();
        }
      });
    } catch (error) {
      if (mode === "ordered") attach("dated");
      else if (mode === "dated") attach("tenant");
      else {
        onError(error);
        publish();
      }
    }
  };

  attach("ordered");

  const localHandler = event => {
    if (event.detail?.tenantId !== tenantId) return;
    publish();
  };
  window.addEventListener("waiting-queue:local-changed", localHandler);

  return () => {
    stopped = true;
    unsubscribe();
    window.removeEventListener("waiting-queue:local-changed", localHandler);
  };
}

export function compatibleQueuesForTable(table, queues) {
  const now = nowMs();
  return (queues || []).filter(queue => {
    if (![WAITING_QUEUE_STATUS.WAITING, WAITING_QUEUE_STATUS.CALLED, WAITING_QUEUE_STATUS.ACKNOWLEDGED, WAITING_QUEUE_STATUS.PREPARING_TABLE, WAITING_QUEUE_STATUS.DEFERRED].includes(queue.status)) return false;
    if (queue.status === WAITING_QUEUE_STATUS.DEFERRED && Number(queue.nextEligibleAtMs || 0) > now) return false;
    return tableFitsQueue(table, queue);
  });
}

export function recommendQueueForTable(table, queues) {
  const active = (queues || []).filter(queue => WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status));
  const eligible = compatibleQueuesForTable(table, active);
  const fiveMinutes = 5 * 60_000;
  eligible.sort((a, b) => {
    const aTime = Number(a.effectiveQueuedAtMs || a.queuedAtMs || 0);
    const bTime = Number(b.effectiveQueuedAtMs || b.queuedAtMs || 0);
    if (Math.abs(aTime - bTime) <= fiveMinutes && Number(a.priorityRank || 0) !== Number(b.priorityRank || 0)) {
      return Number(b.priorityRank || 0) - Number(a.priorityRank || 0);
    }
    return aTime - bTime;
  });
  const recommendation = eligible[0] || null;
  const recommendationTime = Number(recommendation?.effectiveQueuedAtMs || recommendation?.queuedAtMs || Infinity);
  const skipped = active
    .filter(queue => Number(queue.effectiveQueuedAtMs || queue.queuedAtMs || 0) < recommendationTime)
    .map(queue => {
      let reason = "";
      if (Number(queue.partySize || 1) > Number(table.capacity || 1)) reason = `จำนวน ${queue.partySize} คน มากกว่าความจุโต๊ะ ${table.capacity} ที่นั่ง`;
      else if (queue.needs?.wheelchair && !table.accessible) reason = "โต๊ะไม่รองรับพื้นที่รถเข็น";
      else if (queue.needs?.highChair && !table.highChairSupported) reason = "โต๊ะไม่รองรับเก้าอี้เด็ก";
      else if (queue.needs?.quietArea && !table.quietArea) reason = "โต๊ะไม่อยู่ในพื้นที่เงียบ";
      else reason = "ยังไม่เข้าเงื่อนไขการจัดโต๊ะ";
      return { queue, reason };
    });
  return { recommendation, eligible, skipped };
}

export function estimateWaitRange(queue, queues, tables, settings = {}) {
  const averageTableMinutes = Math.max(10, Number(settings.averageTableMinutes || DEFAULT_TABLE_MINUTES));
  const active = (queues || []).filter(item => WAITING_QUEUE_ACTIVE_STATUSES.has(item.status));
  const queueTime = Number(queue.effectiveQueuedAtMs || queue.queuedAtMs || 0);
  const suitableTables = (tables || []).filter(table => tableSupportsQueue(table, queue));
  const tableCount = Math.max(1, suitableTables.length);
  const maximumCapacity = Math.max(...suitableTables.map(table => Number(table.capacity || 0)), Number(queue.partySize || 1));
  const groupsAhead = active.filter(item => {
    const itemTime = Number(item.effectiveQueuedAtMs || item.queuedAtMs || 0);
    if (item.id === queue.id || itemTime >= queueTime) return false;
    if (Number(item.partySize || 1) > maximumCapacity) return false;
    return !suitableTables.length || suitableTables.some(table => tableSupportsQueue(table, item));
  }).length;
  const occupiedRatio = suitableTables.length
    ? suitableTables.filter(table => !table.available).length / suitableTables.length
    : 1;
  const base = Math.max(0, Math.ceil((groupsAhead / tableCount) * averageTableMinutes * Math.max(0.5, occupiedRatio)));
  const min = Math.max(0, Math.floor(base / 5) * 5);
  const max = Math.max(min + (groupsAhead ? 10 : 5), Math.ceil((base + 10) / 5) * 5);
  return { groupsAhead, estimatedWaitMin: min, estimatedWaitMax: max };
}

let publicRefreshTimer = null;
let pendingPublicRefresh = null;
const publicSnapshotSignatures = new Map();

function stablePublicSnapshotSignature(publicRow, boardRow) {
  const { updatedAtMs: _publicUpdatedAtMs, ...stablePublic } = publicRow;
  const { updatedAtMs: _boardUpdatedAtMs, ...stableBoard } = boardRow;
  return JSON.stringify({ public: stablePublic, board: stableBoard });
}
export function schedulePublicSnapshotRefresh(tenantId, queues, tables, settings = {}) {
  pendingPublicRefresh = { tenantId, queues, tables, settings };
  if (publicRefreshTimer) return;

  publicRefreshTimer = setTimeout(() => {
    const pending = pendingPublicRefresh;
    pendingPublicRefresh = null;
    publicRefreshTimer = null;
    if (!pending) return;
    refreshPublicSnapshots(
      pending.tenantId,
      pending.queues,
      pending.tables,
      pending.settings,
    ).catch(error => {
      console.warn("[waiting-queue] public snapshot refresh failed", error);
    });
  }, 900);
}

export async function refreshPublicSnapshots(tenantId, queues, tables, settings = {}) {
  if (!isOnline() || !db) return 0;
  const active = (queues || []).filter(queue => queue.publicToken && queue.tenantId === tenantId);
  if (!active.length) return 0;

  let updated = 0;
  for (let offset = 0; offset < active.length; offset += 200) {
    const changes = [];

    active.slice(offset, offset + 200).forEach(queue => {
      const estimate = estimateWaitRange(queue, queues, tables, settings);
      const publicRow = publicSnapshotFromQueue(queue, estimate);
      const boardRow = boardSnapshotFromQueue(queue, estimate);
      const key = `${tenantId}:${queue.id}`;
      const signature = stablePublicSnapshotSignature(publicRow, boardRow);
      if (publicSnapshotSignatures.get(key) === signature) return;
      changes.push({ queue, publicRow, boardRow, key, signature });
    });

    if (!changes.length) continue;

    const batch = writeBatch(db);
    changes.forEach(({ queue, publicRow, boardRow }) => {
      batch.set(publicRef(queue.publicToken), {
        ...publicRow,
        customerName: deleteField(),
        phone: deleteField(),
        phoneMasked: deleteField(),
        phoneHash: deleteField(),
        specialNote: deleteField(),
        createdByName: deleteField(),
        actorName: deleteField(),
        actorEmail: deleteField(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(boardRef(queue.id), {
        ...boardRow,
        customerName: deleteField(),
        phone: deleteField(),
        phoneMasked: deleteField(),
        phoneHash: deleteField(),
        specialNote: deleteField(),
        createdByName: deleteField(),
        actorName: deleteField(),
        actorEmail: deleteField(),
        token: deleteField(),
        publicToken: deleteField(),
        customerResponse: deleteField(),
        customerResponseAtMs: deleteField(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();
    changes.forEach(({ key, signature }) => {
      publicSnapshotSignatures.set(key, signature);
      updated += 1;
    });
  }

  return updated;
}

export function watchPublicQueue(token, callback, onError = console.error) {
  return onSnapshot(publicRef(token), snapshot => {
    callback(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null);
  }, onError);
}

function watchTenantPublicRows(collectionName, tenantId, callback, onError = console.error) {
  const base = collection(db, collectionName);
  let unsubscribe = () => {};
  let stopped = false;
  const attach = mode => {
    try {
      const q = mode === "ordered"
        ? query(base, where("tenantId", "==", tenantId), where("active", "==", true), orderBy("updatedAtMs", "desc"))
        : mode === "active"
          ? query(base, where("tenantId", "==", tenantId), where("active", "==", true))
          : query(base, where("tenantId", "==", tenantId));
      unsubscribe = onSnapshot(q, snapshot => {
        callback(snapshotRows(snapshot).filter(row => row.active === true));
      }, error => {
        if (stopped) return;
        if (mode === "ordered") attach("active");
        else if (mode === "active") attach("tenant");
        else onError(error);
      });
    } catch (error) {
      if (mode === "ordered") attach("active");
      else if (mode === "active") attach("tenant");
      else onError(error);
    }
  };
  attach("ordered");
  return () => {
    stopped = true;
    unsubscribe();
  };
}

export function watchWaitingQueuePublicResponses(tenantId, callback, onError = console.error) {
  return watchTenantPublicRows(COLLECTIONS.public, tenantId, callback, onError);
}

export function watchPublicQueueBoard(tenantId, callback, onError = console.error) {
  return watchTenantPublicRows(COLLECTIONS.board, tenantId, callback, onError);
}

export async function recallWaitingQueue(queueId, options = {}) {
  if (!isOnline()) {
    throw new WaitingQueueError("ONLINE_REQUIRED", "ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อส่งเสียงเรียกซ้ำ");
  }
  const tenantId = normalizeString(options.tenantId || await resolveTenantId());
  const ref = boardRef(queueId);
  const signalAtMs = nowMs();
  await runWaitingQueueTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new WaitingQueueError("QUEUE_NOT_FOUND", "ไม่พบคิวบนจอเรียกคิว");
    const board = snapshot.data() || {};
    if (normalizeString(board.tenantId) !== tenantId) {
      throw new WaitingQueueError("TENANT_MISMATCH", "คิวนี้ไม่ได้อยู่ในร้านที่กำลังใช้งาน");
    }
    if (board.status !== WAITING_QUEUE_STATUS.CALLED) {
      throw new WaitingQueueError("INVALID_STATUS_TRANSITION", "เรียกซ้ำได้เฉพาะคิวที่อยู่ในสถานะเรียกแล้ว");
    }
    transaction.set(ref, {
      recallSignalAtMs: signalAtMs,
      updatedAt: serverTimestamp(),
      updatedAtMs: signalAtMs,
    }, { merge: true });
  });
  return { queueId, tenantId, recallSignalAtMs: signalAtMs };
}

export async function updatePublicCustomerResponse(token, response) {
  const allowed = new Set(["on_the_way", "cancel_requested"]);
  if (!allowed.has(response)) throw new WaitingQueueError("INVALID_CUSTOMER_RESPONSE", "คำตอบของลูกค้าไม่ถูกต้อง");
  if (!isOnline()) throw new WaitingQueueError("ONLINE_REQUIRED", "ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อส่งคำตอบ");
  const ref = publicRef(token);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new WaitingQueueError("PUBLIC_QUEUE_NOT_FOUND", "ไม่พบข้อมูลคิว");
  const current = snapshot.data() || {};
  await runWaitingQueueTransaction(async transaction => {
    const latest = await transaction.get(ref);
    if (!latest.exists()) throw new WaitingQueueError("PUBLIC_QUEUE_NOT_FOUND", "ไม่พบข้อมูลคิว");
    const data = latest.data() || {};
    if (!data.active && data.status !== WAITING_QUEUE_STATUS.CALLED) {
      throw new WaitingQueueError("QUEUE_NOT_ACTIVE", "คิวนี้สิ้นสุดแล้ว");
    }
    transaction.set(ref, {
      customerResponse: response,
      customerResponseAtMs: nowMs(),
      updatedAt: serverTimestamp(),
      updatedAtMs: nowMs(),
    }, { merge: true });
  });
  return { ...current, customerResponse: response, customerResponseAtMs: nowMs() };
}

export async function acknowledgeCustomerResponse(queue, publicRow) {
  if (!queue || !publicRow) return queue;
  if (publicRow.customerResponse === "on_the_way" && queue.status === WAITING_QUEUE_STATUS.CALLED) {
    return transitionWaitingQueue(queue.id, WAITING_QUEUE_STATUS.ACKNOWLEDGED, {
      tenantId: queue.tenantId,
      action: "customer_acknowledged",
      reason: "ลูกค้ายืนยันกำลังมาที่จุดรับโต๊ะ",
      metadata: { customerResponseAtMs: publicRow.customerResponseAtMs || null },
    });
  }
  if (publicRow.customerResponse === "cancel_requested" && WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status)) {
    return transitionWaitingQueue(queue.id, WAITING_QUEUE_STATUS.CANCELLED, {
      tenantId: queue.tenantId,
      action: "customer_cancelled",
      reason: "ลูกค้าขอยกเลิกผ่านหน้าติดตามคิว",
      metadata: { customerResponseAtMs: publicRow.customerResponseAtMs || null },
    });
  }
  return queue;
}

export function customerTrackingUrl(queue) {
  const params = new URLSearchParams({ tenantId: queue.tenantId, token: queue.publicToken });
  return `${location.origin}/waiting-queue/customer/?${params.toString()}`;
}

export function queueDisplayUrl(tenantId) {
  const params = new URLSearchParams({ tenantId });
  return `${location.origin}/waiting-queue/display/?${params.toString()}`;
}

export function waitingQueueStatusLabel(status) {
  return WAITING_QUEUE_STATUS_LABEL[status] || status || "-";
}

export function waitDurationMinutes(queue, atMs = nowMs()) {
  const start = Number(queue?.queuedAtMs || 0);
  if (!start) return 0;
  const end = Number(queue?.seatedAtMs || queue?.cancelledAtMs || queue?.noShowAtMs || atMs);
  return Math.max(0, Math.floor((end - start) / 60_000));
}

export function callCountdownSeconds(queue, atMs = nowMs()) {
  const deadline = Number(queue?.responseDeadlineAtMs || 0);
  if (!deadline) return null;
  return Math.ceil((deadline - atMs) / 1000);
}

export function getLocalWaitingQueues(tenantId) {
  return localQueues(tenantId);
}

window.addEventListener("online", async () => {
  const tenantId = await resolveTenantId({ required: false }).catch(() => "");
  if (!tenantId) return;
  syncWaitingQueueOutbox(tenantId).catch(error => console.warn("[waiting-queue] online sync failed", error));
  ensureWaitingNumberLease(tenantId).catch(() => {});
});
