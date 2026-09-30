const { randomUUID } = require("crypto");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const REGION = "asia-southeast1";
const WALK_IN_ROLES = new Set(["owner", "admin", "manager", "cashier", "super_admin"]);
const CLOSED_STATUSES = new Set(["paid", "cancelled", "voided", "deleted", "completed"]);

function text(value = "", max = 500) {
  return String(value || "").trim().slice(0, max);
}
function applicationError(code, message = code) {
  return new HttpsError("failed-precondition", message, { code });
}
function invalid(code, message = code) {
  return new HttpsError("invalid-argument", message, { code });
}
function conflict(code, message = code) {
  return new HttpsError("already-exists", message, { code });
}
function missing(code, message = code) {
  return new HttpsError("not-found", message, { code });
}
function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
function bangkokDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date).reduce((map, part) => ({ ...map, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function queueNumber(sequence) {
  return `Q${String(sequence).padStart(3, "0")}`;
}

async function callerContext(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const db = getFirestore();
  const profileSnap = await db.collection("users").doc(request.auth.uid).get();
  const profile = profileSnap.data();
  if (!profile || profile.active === false || !WALK_IN_ROLES.has(profile.role)) {
    throw new HttpsError("permission-denied", "Walk-in order permission required");
  }
  const tenantId = text(profile.tenantId, 160);
  if (!tenantId && profile.role !== "super_admin") {
    throw new HttpsError("failed-precondition", "Tenant is missing from profile", { code: "TENANT_REQUIRED" });
  }
  const requestedTenant = text(request.data?.tenantId, 160);
  const effectiveTenant = profile.role === "super_admin" && requestedTenant ? requestedTenant : tenantId;
  if (!effectiveTenant) throw new HttpsError("failed-precondition", "Tenant is required", { code: "TENANT_REQUIRED" });
  if (profile.role !== "super_admin" && requestedTenant && requestedTenant !== tenantId) {
    throw new HttpsError("permission-denied", "Tenant mismatch");
  }
  return { db, uid: request.auth.uid, profile, tenantId: effectiveTenant };
}

function normalizeRequestedItems(value) {
  if (!Array.isArray(value) || !value.length || value.length > 100) invalid("ORDER_ITEMS_REQUIRED");
  return value.map(row => {
    const menuId = text(row?.menuId || row?.id, 180);
    const qty = Math.floor(Number(row?.qty || 0));
    if (!menuId) invalid("MENU_NOT_FOUND");
    if (!Number.isFinite(qty) || qty < 1 || qty > 999) invalid("ORDER_ITEM_QUANTITY_INVALID");
    return { menuId, qty, note: text(row?.note, 300) };
  });
}

async function menuMap(db, tenantId, requestedItems) {
  const ids = [...new Set(requestedItems.map(item => item.menuId))];
  const refs = ids.map(id => db.collection("tenants").doc(tenantId).collection("menus").doc(id));
  const snapshots = await db.getAll(...refs);
  const map = new Map();
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) return;
    const row = snapshot.data() || {};
    map.set(ids[index], {
      id: snapshot.id,
      name: text(row.name, 240),
      price: money(row.price ?? 0),
      active: row.active !== false && row.isActive !== false && row.is_active !== false,
    });
  });
  if (map.size !== ids.length) conflict("MENU_NOT_FOUND");
  return map;
}

function priceItems(requestedItems, menus) {
  let total = 0;
  const items = requestedItems.map(item => {
    const menu = menus.get(item.menuId);
    if (!menu) conflict("MENU_NOT_FOUND");
    if (!menu.active) conflict("MENU_NOT_AVAILABLE");
    const price = money(menu.price);
    total += price * item.qty;
    return { menuId: menu.id, name: menu.name, price, qty: item.qty, note: item.note, cancelled: false };
  });
  return { items, total: money(total) };
}

async function findTable(db, tenantId, code) {
  const lookup = text(code, 120);
  if (!lookup) return null;
  const collection = db.collection("tenants").doc(tenantId).collection("tables");
  const direct = await collection.doc(lookup).get();
  if (direct.exists) return { ref: direct.ref, id: direct.id, ...direct.data() };
  const byCode = await collection.where("code", "==", lookup).limit(1).get();
  if (byCode.empty) return null;
  const doc = byCode.docs[0];
  return { ref: doc.ref, id: doc.id, ...doc.data() };
}

function tableIdentity(table = {}) {
  const code = text(table.code || table.id, 120);
  return { code, name: text(table.name || `โต๊ะ ${code}`, 180) };
}

function tableAvailable(table, orderId = "") {
  if (!table || table.active === false || table.isActive === false || table.is_active === false) return false;
  const orderToken = text(table.orderToken || table.order_token, 300);
  const marker = text(table.walkInOrderId, 180);
  const status = text(table.status || table.tableStatus || "available", 40).toLowerCase();
  const qrOccupied = status === "occupied" && !marker;
  if (orderToken || qrOccupied) return false;
  if (marker && marker !== orderId) return false;
  return true;
}

function claimedTablePatch(orderId, queueNo, nowIso) {
  return {
    status: "occupied", tableStatus: "occupied",
    occupied: true, isOccupied: true, available: false, isAvailable: false, isOpen: true,
    walkInOrderId: orderId, walkInQueueNo: queueNo, walkInOccupiedAt: nowIso,
    occupancyType: "walkin", orderToken: "", updatedAt: FieldValue.serverTimestamp(),
  };
}

function releasedTablePatch() {
  return {
    status: "available", tableStatus: "available",
    occupied: false, isOccupied: false, available: true, isAvailable: true, isOpen: false,
    walkInOrderId: FieldValue.delete(), walkInQueueNo: FieldValue.delete(),
    walkInOccupiedAt: FieldValue.delete(), occupancyType: "available",
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function nextQueue(tx, db, tenantId, now = new Date()) {
  const date = bangkokDateKey(now);
  const compact = date.replaceAll("-", "");
  const ref = db.collection("tenants").doc(tenantId).collection("counters").doc(`order_queue_${compact}`);
  const snapshot = await tx.get(ref);
  const sequence = Math.max(0, Number(snapshot.data()?.current || 0)) + 1;
  tx.set(ref, {
    tenantId, shopId: tenantId, counterType: "order_queue",
    dateKey: date, current: sequence, lastQueueNo: queueNumber(sequence),
    updatedAt: FieldValue.serverTimestamp(),
    ...(snapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  }, { merge: true });
  return { queueNo: queueNumber(sequence), queueSequence: sequence, queueDate: date };
}

function normalizeOrder(snapshot) {
  if (!snapshot?.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

exports.createWalkInOrder = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const { db, uid, tenantId } = await callerContext(request);
  const serviceType = text(request.data?.serviceType, 30).toLowerCase();
  const paymentMethod = text(request.data?.paymentMethod, 30).toLowerCase();
  const requestedId = text(request.data?.id, 128);
  if (!["dine_in", "takeaway"].includes(serviceType)) invalid("WALK_IN_SERVICE_TYPE_INVALID");
  if (!["cash", "promptpay"].includes(paymentMethod)) invalid("WALK_IN_PAYMENT_METHOD_INVALID");
  const id = requestedId || `walkin-${randomUUID()}`;
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(id)) invalid("ORDER_ID_INVALID");
  const orderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(id);
  const existingBeforeValidation = await orderRef.get();
  if (existingBeforeValidation.exists) {
    const item = normalizeOrder(existingBeforeValidation);
    if (item.orderType === "walkin") return { item, idempotent: true };
    conflict("ORDER_ALREADY_EXISTS");
  }

  const requestedItems = normalizeRequestedItems(request.data?.items);
  const menus = await menuMap(db, tenantId, requestedItems);
  const priced = priceItems(requestedItems, menus);
  const tableCode = serviceType === "dine_in" ? text(request.data?.tableCode, 120) : "";
  const selectedTable = tableCode ? await findTable(db, tenantId, tableCode) : null;
  if (tableCode && !selectedTable) conflict("TABLE_NOT_AVAILABLE");

  let cashReceived = null, changeAmount = 0;
  if (paymentMethod === "cash") {
    if (request.data?.cashReceived === null || request.data?.cashReceived === undefined || request.data?.cashReceived === "") invalid("CASH_RECEIVED_REQUIRED");
    cashReceived = money(request.data.cashReceived);
    if (!Number.isFinite(cashReceived) || cashReceived < 0 || cashReceived > 999999999.99) invalid("CASH_RECEIVED_INVALID");
    if (cashReceived + 0.00001 < priced.total) invalid("CASH_RECEIVED_INSUFFICIENT");
    changeAmount = money(Math.max(0, cashReceived - priced.total));
  }

  const nowIso = new Date().toISOString();
  const result = await db.runTransaction(async tx => {
    const existing = await tx.get(orderRef);
    if (existing.exists) {
      const existingOrder = normalizeOrder(existing);
      if (existingOrder.orderType === "walkin") return { item: existingOrder, idempotent: true };
      conflict("ORDER_ALREADY_EXISTS");
    }

    let table = null;
    if (selectedTable) {
      const tableSnapshot = await tx.get(selectedTable.ref);
      table = { ref: selectedTable.ref, id: tableSnapshot.id, ...tableSnapshot.data() };
      if (!tableSnapshot.exists || !tableAvailable(table, id)) conflict("TABLE_NOT_AVAILABLE");
    }

    const queue = await nextQueue(tx, db, tenantId);
    const identity = table ? tableIdentity(table) : { code: "", name: "" };
    const order = {
      id, tenantId, shopId: tenantId,
      ...queue,
      orderType: "walkin", orderSource: "cashier_walkin", serviceType,
      status: "pending", paymentStatus: "paid", paymentMethod,
      paidAt: nowIso, paymentReceivedAt: nowIso,
      cashReceived, changeAmount, customerName: text(request.data?.customerName, 120),
      tableCode: identity.code, tableName: identity.name,
      items: priced.items, subtotalAmount: priced.total, totalAmount: priced.total,
      note: text(request.data?.note, 500), createdBy: uid,
      createdAt: FieldValue.serverTimestamp(), createdAtText: nowIso, updatedAt: FieldValue.serverTimestamp(),
    };
    tx.create(orderRef, order);
    if (table) tx.update(table.ref, claimedTablePatch(id, queue.queueNo, nowIso));
    return { item: { ...order, createdAt: nowIso, updatedAt: nowIso }, idempotent: false };
  });
  return result;
});

exports.assignWalkInTable = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const { db, tenantId } = await callerContext(request);
  const id = text(request.data?.id, 128);
  const tableCode = text(request.data?.tableCode, 120);
  if (!id) invalid("ORDER_ID_INVALID");
  const selectedTable = tableCode ? await findTable(db, tenantId, tableCode) : null;
  if (tableCode && !selectedTable) conflict("TABLE_NOT_AVAILABLE");
  const orderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(id);

  const currentOutside = await orderRef.get();
  if (!currentOutside.exists) missing("ORDER_NOT_FOUND");
  const currentData = currentOutside.data() || {};
  const previousTable = text(currentData.tableCode, 120)
    ? await findTable(db, tenantId, currentData.tableCode) : null;

  return db.runTransaction(async tx => {
    const orderSnapshot = await tx.get(orderRef);
    if (!orderSnapshot.exists) missing("ORDER_NOT_FOUND");
    const order = orderSnapshot.data() || {};
    if (order.orderType !== "walkin") conflict("WALK_IN_ORDER_REQUIRED");
    if (order.serviceType !== "dine_in") conflict("WALK_IN_DINE_IN_REQUIRED");
    if (CLOSED_STATUSES.has(text(order.status, 30).toLowerCase())) conflict("WALK_IN_ORDER_CLOSED");

    let nextTable = null;
    if (selectedTable) {
      const snapshot = await tx.get(selectedTable.ref);
      nextTable = { ref: selectedTable.ref, id: snapshot.id, ...snapshot.data() };
      if (!snapshot.exists || !tableAvailable(nextTable, id)) conflict("TABLE_NOT_AVAILABLE");
    }

    let previous = null;
    if (previousTable && (!nextTable || previousTable.ref.path !== nextTable.ref.path)) {
      const snapshot = await tx.get(previousTable.ref);
      if (snapshot.exists) previous = { ref: previousTable.ref, id: snapshot.id, ...snapshot.data() };
    }

    if (previous && text(previous.walkInOrderId, 180) === id) tx.update(previous.ref, releasedTablePatch());
    const nowIso = new Date().toISOString();
    const identity = nextTable ? tableIdentity(nextTable) : { code: "", name: "" };
    if (nextTable) tx.update(nextTable.ref, claimedTablePatch(id, text(order.queueNo, 50), nowIso));
    tx.update(orderRef, {
      tableCode: identity.code, tableName: identity.name, tableAssignedAt: nowIso,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { item: { id, ...order, tableCode: identity.code, tableName: identity.name, tableAssignedAt: nowIso } };
  });
});

exports.moveTableSession = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const { db, tenantId } = await callerContext(request);
  const fromTableCode = text(request.data?.fromTableCode, 120);
  const fromTableToken = text(request.data?.fromTableToken, 300);
  const toTableId = text(request.data?.toTableId, 180);
  const orderIds = [...new Set((Array.isArray(request.data?.orders) ? request.data.orders : [])
    .map(row => text(typeof row === "object" ? row?.id : row, 180)).filter(Boolean))];
  if (!fromTableCode || !fromTableToken || !toTableId || !orderIds.length) {
    invalid("INVALID_TABLE_MOVE_REQUEST");
  }

  const tableCollection = db.collection("tenants").doc(tenantId).collection("tables");
  const sourceLookup = await findTable(db, tenantId, fromTableCode);
  if (!sourceLookup) conflict("SOURCE_TABLE_NOT_ACTIVE");
  const sourceRef = sourceLookup.ref;
  const targetRef = tableCollection.doc(toTableId);
  if (sourceRef.path === targetRef.path) conflict("SAME_TABLE_MOVE");
  const orderRefs = orderIds.map(id => db.collection("tenants").doc(tenantId).collection("orders").doc(id));

  return db.runTransaction(async tx => {
    const [sourceSnap, targetSnap, ...orderSnaps] = await Promise.all([
      tx.get(sourceRef), tx.get(targetRef), ...orderRefs.map(ref => tx.get(ref)),
    ]);
    if (!sourceSnap.exists
      || String(sourceSnap.data()?.status || "") !== "occupied"
      || text(sourceSnap.data()?.orderToken, 300) !== fromTableToken) {
      conflict("SOURCE_TABLE_NOT_ACTIVE");
    }
    if (!targetSnap.exists) conflict("TARGET_TABLE_NOT_AVAILABLE");
    const source = { id: sourceSnap.id, ...sourceSnap.data() };
    const target = { id: targetSnap.id, ...targetSnap.data() };
    if (target.active === false
      || String(target.status || "available") !== "available"
      || text(target.orderToken, 300)
      || text(target.walkInOrderId, 180)) {
      conflict("TARGET_TABLE_NOT_AVAILABLE");
    }
    if (orderSnaps.some(snapshot => !snapshot.exists)) conflict("MOVE_ORDER_NOT_FOUND");

    let maxRound = Math.max(0, Number(source.currentRound || 0));
    const movedAt = new Date().toISOString();
    const orders = orderSnaps.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));
    for (const order of orders) {
      maxRound = Math.max(maxRound, Number(order.roundNumber || 0));
      if (["delivery", "takeaway"].includes(String(order.orderType || ""))
        || ["paid", "cancelled"].includes(String(order.status || ""))
        || String(order.paymentStatus || "") === "paid"
        || String(order.tableCode || "").toUpperCase() !== String(source.code || source.id).toUpperCase()
        || String(order.tableToken || "") !== fromTableToken) {
        conflict("MOVE_ORDER_NOT_UNPAID");
      }
    }

    const targetCode = String(target.code || target.id);
    const targetName = String(target.name || `โต๊ะ ${targetCode}`);
    orderRefs.forEach((ref, index) => tx.update(ref, {
      tableCode: targetCode,
      tableName: targetName,
      tableToken: fromTableToken,
      movedFromTableCode: String(source.code || source.id),
      tableMovedAt: movedAt,
      updatedAt: FieldValue.serverTimestamp(),
    }));

    const sessionOrderIds = [...new Set([
      ...(Array.isArray(source.orderIds) ? source.orderIds.map(String) : []),
      ...orderIds,
    ])];
    tx.update(sourceRef, {
      status: "available",
      orderToken: "",
      currentRound: 0,
      orderIds: FieldValue.delete(),
      queueNo: FieldValue.delete(),
      queueSequence: FieldValue.delete(),
      queueDate: FieldValue.delete(),
      sessionStartedAt: FieldValue.delete(),
      movedFromTableCode: FieldValue.delete(),
      movedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(targetRef, {
      status: "occupied",
      orderToken: fromTableToken,
      currentRound: maxRound,
      orderIds: sessionOrderIds,
      queueNo: source.queueNo || orders[0]?.queueNo || "",
      queueSequence: Number(source.queueSequence || orders[0]?.queueSequence || 0),
      queueDate: source.queueDate || orders[0]?.queueDate || "",
      sessionStartedAt: source.sessionStartedAt || orders[0]?.createdAtText || movedAt,
      movedFromTableCode: String(source.code || source.id),
      movedAt,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      fromTable: { ...source, status: "available", orderToken: "", currentRound: 0 },
      toTable: { ...target, status: "occupied", orderToken: fromTableToken, currentRound: maxRound, orderIds: sessionOrderIds },
      movedOrders: orderIds.length,
    };
  });
});


exports.releaseQuickOrderHeldBill = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const { db, uid, tenantId } = await callerContext(request);
  const id = text(request.data?.id, 180);
  const operationId = text(request.data?.operationId, 220);
  const disposition = text(request.data?.disposition || "resume", 20);
  if (!id) invalid("HELD_BILL_NOT_FOUND");
  if (!operationId) invalid("HELD_BILL_OPERATION_ID_INVALID");
  if (!["resume", "delete"].includes(disposition)) invalid("HELD_BILL_DISPOSITION_INVALID");

  const ref = db.collection("tenants").doc(tenantId).collection("heldBills").doc(id);
  const duplicate = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists || String(snapshot.data()?.source || "") !== "quick_order") {
      missing("HELD_BILL_NOT_FOUND");
    }
    const row = snapshot.data() || {};
    if (String(row.status || "held") !== "held") {
      if (String(row.releaseOperationId || "") === operationId
        && String(row.releaseDisposition || "") === disposition) {
        return true;
      }
      conflict("HELD_BILL_ALREADY_RELEASED");
    }
    tx.set(ref, {
      status: disposition === "resume" ? "resumed" : "deleted",
      releaseOperationId: operationId,
      releaseDisposition: disposition,
      releasedBy: uid,
      releasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return false;
  });
  const snapshot = await ref.get();
  return { item: { id: snapshot.id, ...snapshot.data() }, duplicate };
});

Object.defineProperty(exports, "__test", {
  value: { bangkokDateKey, queueNumber, normalizeRequestedItems, priceItems, tableAvailable },
  enumerable: false,
});
