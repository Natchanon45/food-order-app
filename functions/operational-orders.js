const { randomUUID } = require("crypto");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const deferredPolicy = require("./walkin-finance-policy");

const REGION = "asia-southeast1";
const WALK_IN_ROLES = new Set(["owner", "admin", "manager", "cashier", "super_admin"]);
const TABLE_SETTLEMENT_ROLES = new Set(["owner", "admin", "manager", "cashier", "kitchen", "super_admin"]);
const CLOSED_STATUSES = new Set(["paid", "cancelled", "voided", "deleted", "completed"]);

function text(value = "", max = 500) {
  return String(value || "").trim().slice(0, max);
}
function applicationError(code, message = code) {
  throw new HttpsError("failed-precondition", message, { code });
}
function invalid(code, message = code) {
  throw new HttpsError("invalid-argument", message, { code });
}
function conflict(code, message = code) {
  throw new HttpsError("already-exists", message, { code });
}
function missing(code, message = code) {
  throw new HttpsError("not-found", message, { code });
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

async function callerContext(request, allowedRoles = WALK_IN_ROLES) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const db = getFirestore();
  const profileSnap = await db.collection("users").doc(request.auth.uid).get();
  const profile = profileSnap.data();
  if (!profile || profile.active === false || !allowedRoles.has(profile.role)) {
    throw new HttpsError("permission-denied", "Operational order permission required");
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

function releasedQrTablePatch() {
  return {
    ...releasedTablePatch(),
    orderToken: "",
    currentRound: 0,
    orderIds: [],
    sessionStartedAt: null,
    queueNo: FieldValue.delete(),
    queueSequence: FieldValue.delete(),
    queueDate: FieldValue.delete(),
  };
}

function waitingQueuePlaceholder(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  return Boolean(order.waitingQueueId)
    && Number(order.roundNumber || 0) === 0
    && items.length === 0
    && Number(order.totalAmount ?? order.total ?? 0) === 0;
}

function activeOrderItems(order = {}) {
  return (Array.isArray(order.items) ? order.items : []).filter(item => item?.cancelled !== true);
}

function orderFullyServed(order = {}) {
  const status = text(order.status, 30).toLowerCase();
  if (["served", "paid", "completed"].includes(status)) return true;
  const items = activeOrderItems(order);
  return items.length > 0 && items.every(item => item?.served === true);
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
  // LUKKAJA never records unverified PromptPay as a paid counter sale.
  if (paymentMethod === "promptpay" && request.data?.paymentTiming !== "after") invalid("WALK_IN_PROMPTPAY_REVIEW_REQUIRED");
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
  const deferred = request.data?.paymentTiming === "after";
  if (request.data?.paymentTiming !== undefined && request.data.paymentTiming !== "after") invalid("WALK_IN_PAYMENT_TIMING_INVALID");
  if (deferred) {
    try { deferredPolicy.prepareWalkInPayment(request.data, priced.total); }
    catch (error) { invalid(error.code || "DEFERRED_PAYMENT_INVALID"); }
  }
  const tableCode = serviceType === "dine_in" ? text(request.data?.tableCode, 120) : "";
  const selectedTable = tableCode ? await findTable(db, tenantId, tableCode) : null;
  if (tableCode && !selectedTable) conflict("TABLE_NOT_AVAILABLE");

  let cashReceived = null, changeAmount = 0;
  if (paymentMethod === "cash" && !deferred) {
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
      status: "pending", paymentStatus: deferred ? "unpaid" : "paid", paymentMethod,
      paymentTiming: deferred ? "after" : "before",
      ...(deferred ? {} : { paidAt: nowIso, paymentReceivedAt: nowIso }),
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


exports.settleTableSession = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const { db, tenantId } = await callerContext(request, TABLE_SETTLEMENT_ROLES);
  const orderId = text(request.data?.orderId, 180);
  if (!orderId) invalid("ORDER_ID_INVALID");

  const orderRef = db.collection("tenants").doc(tenantId).collection("orders").doc(orderId);
  const triggerSnapshot = await orderRef.get();
  if (!triggerSnapshot.exists) missing("ORDER_NOT_FOUND");
  const trigger = { id: triggerSnapshot.id, ...triggerSnapshot.data() };
  const orderType = text(trigger.orderType, 30).toLowerCase();
  if (["delivery", "takeaway", "walkin"].includes(orderType) || !text(trigger.tableCode, 120)) {
    conflict("TABLE_ORDER_REQUIRED");
  }

  const tableLookup = await findTable(db, tenantId, trigger.tableCode);
  if (!tableLookup) return { closed: true, alreadyClosed: true, tableCode: text(trigger.tableCode, 120) };

  return db.runTransaction(async tx => {
    const tableSnapshot = await tx.get(tableLookup.ref);
    if (!tableSnapshot.exists) return { closed: true, alreadyClosed: true, tableCode: text(trigger.tableCode, 120) };
    const table = { id: tableSnapshot.id, ...tableSnapshot.data() };
    const tableToken = text(table.orderToken, 300);
    const triggerToken = text(trigger.tableToken, 300);

    if (text(table.status, 30).toLowerCase() !== "occupied" || !tableToken || (triggerToken && tableToken !== triggerToken)) {
      return { closed: true, alreadyClosed: true, tableCode: text(table.code || table.id, 120) };
    }

    const ids = [...new Set([
      ...(Array.isArray(table.orderIds) ? table.orderIds : []),
      orderId,
    ].map(value => text(value, 180)).filter(Boolean))];
    const refs = ids.map(id => db.collection("tenants").doc(tenantId).collection("orders").doc(id));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    const rows = snapshots
      .filter(snapshot => snapshot.exists)
      .map(snapshot => ({ id: snapshot.id, ref: snapshot.ref, ...snapshot.data() }))
      .filter(row => !waitingQueuePlaceholder(row))
      .filter(row => {
        const type = text(row.orderType, 30).toLowerCase();
        const sameToken = text(row.tableToken, 300) === tableToken;
        return !["delivery", "takeaway", "walkin"].includes(type) && sameToken;
      });

    if (!rows.length) return { closed: false, reason: "NO_TABLE_ROUNDS", tableCode: text(table.code || table.id, 120) };

    const nowIso = new Date().toISOString();
    rows.forEach(row => {
      const status = text(row.status, 30).toLowerCase();
      if (text(row.paymentStatus, 30).toLowerCase() === "paid"
        && orderFullyServed(row)
        && !CLOSED_STATUSES.has(status)) {
        tx.update(row.ref, {
          status: "paid",
          servedAt: row.servedAt || nowIso,
          completedAt: row.completedAt || nowIso,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    const allSettled = rows.every(row => {
      const status = text(row.status, 30).toLowerCase();
      if (CLOSED_STATUSES.has(status)) return true;
      return text(row.paymentStatus, 30).toLowerCase() === "paid" && orderFullyServed(row);
    });

    if (allSettled) tx.update(tableLookup.ref, releasedQrTablePatch());

    return {
      closed: allSettled,
      normalizedOrders: rows.filter(row =>
        text(row.paymentStatus, 30).toLowerCase() === "paid"
        && orderFullyServed(row)
        && !CLOSED_STATUSES.has(text(row.status, 30).toLowerCase())
      ).length,
      tableCode: text(table.code || table.id, 120),
      orderCount: rows.length,
    };
  });
});

exports.closeWalkInTable = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const { db, tenantId } = await callerContext(request);
  const tableIdOrCode = text(request.data?.tableId || request.data?.tableCode, 180);
  const expectedOrderId = text(request.data?.orderId, 180);
  if (!tableIdOrCode) invalid("TABLE_NOT_FOUND");

  const tableLookup = await findTable(db, tenantId, tableIdOrCode);
  if (!tableLookup) missing("TABLE_NOT_FOUND");

  return db.runTransaction(async tx => {
    const tableSnapshot = await tx.get(tableLookup.ref);
    if (!tableSnapshot.exists) missing("TABLE_NOT_FOUND");
    const table = { id: tableSnapshot.id, ...tableSnapshot.data() };
    const markerOrderId = text(table.walkInOrderId, 180);
    const occupancyType = text(table.occupancyType, 40).toLowerCase();

    if (!markerOrderId && occupancyType !== "walkin") {
      if (text(table.status, 30).toLowerCase() === "available") {
        return { closed: true, alreadyClosed: true, tableId: table.id };
      }
      conflict("WALK_IN_TABLE_REQUIRED");
    }
    if (expectedOrderId && markerOrderId && expectedOrderId !== markerOrderId) {
      conflict("WALK_IN_ORDER_MISMATCH");
    }

    const orderId = markerOrderId || expectedOrderId;
    const orderRef = orderId
      ? db.collection("tenants").doc(tenantId).collection("orders").doc(orderId)
      : null;
    const orderSnapshot = orderRef ? await tx.get(orderRef) : null;
    if (orderSnapshot?.exists) {
      const order = orderSnapshot.data() || {};
      if (text(order.orderType, 30).toLowerCase() !== "walkin"
        || text(order.serviceType, 30).toLowerCase() !== "dine_in") {
        conflict("WALK_IN_DINE_IN_REQUIRED");
      }
    }

    const nowIso = new Date().toISOString();
    tx.update(tableLookup.ref, {
      ...releasedTablePatch(),
      orderToken: "",
      currentRound: 0,
      orderIds: [],
      sessionStartedAt: null,
    });
    if (orderSnapshot?.exists) {
      tx.update(orderRef, {
        tableClosedAt: nowIso,
        tableOccupancyStatus: "closed",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      closed: true,
      alreadyClosed: false,
      tableId: table.id,
      orderId,
      tableCode: text(table.code || table.id, 120),
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
  value: { bangkokDateKey, queueNumber, normalizeRequestedItems, priceItems, tableAvailable, waitingQueuePlaceholder, orderFullyServed },
  enumerable: false,
});

// PENGUIN / LUKKAJA Oct 31: trusted Firebase transactions for pay-after
// Walk-in. All mutations run in the single tenant order's transaction and
// are role-checked server-side; browser Firestore Rules block direct edits.
function deferredId(value, field = "ORDER_ID_INVALID") {
  const id = text(value, 140);
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(id)) invalid(field);
  return id;
}
function deferredFailure(error) {
  if (error instanceof HttpsError) throw error;
  if (error?.code && /^[A-Z][A-Z0-9_]{2,100}$/.test(error.code)) {
    throw applicationError(error.code);
  }
  throw error;
}
async function lockedMenus(tx, db, tenantId, requested) {
  const ids = [...new Set(requested.map(row => deferredId(row.menuId, "MENU_ID_INVALID")))];
  const refs = ids.map(id => db.collection("tenants").doc(tenantId).collection("menus").doc(id));
  const snap = await Promise.all(refs.map(ref => tx.get(ref)));
  const menus = new Map();
  snap.forEach((doc, index) => {
    if (doc.exists) menus.set(ids[index], { ...doc.data(), id: doc.id });
  });
  return menus;
}
function walkinTableRef(db, tenantId, tableCode) {
  return db.collection("tenants").doc(tenantId).collection("tables").doc(tableCode);
}
function verifyWalkinTableOwner(snapshot, orderId) {
  if (!snapshot?.exists ||
    text(snapshot.data()?.walkInOrderId, 140) !== orderId ||
    text(snapshot.data()?.status, 40) !== "occupied" ||
    text(snapshot.data()?.orderToken, 140)) conflict("WALK_IN_TABLE_MISMATCH");
}
function isDeferredBill(order) {
  return order?.orderType === "walkin" && order?.paymentTiming === "after";
}

exports.appendUnpaidWalkInItems = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const { db, tenantId, profile } = await callerContext(request);
  const id = deferredId(request.data?.orderId);
  const operationId = deferredId(request.data?.operationId, "OPERATION_ID_INVALID");
  const requested = normalizeRequestedItems(request.data?.items).map(item => ({ menuId: item.menuId, qty: item.qty, note: item.note }));
  if (request.data.items?.some(item => Object.keys(item || {}).some(key => !["menuId", "qty", "note"].includes(key)))) invalid("CLIENT_PRICE_FORBIDDEN");
  const ref = db.collection("tenants").doc(tenantId).collection("orders").doc(id);
  const result = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) missing("ORDER_NOT_FOUND");
    const order = normalizeOrder(snapshot);
    if (order?.kitchenAddOperations?.[operationId]) {
      if (!isDeferredBill(order)) conflict("DEFERRED_BILL_NOT_ELIGIBLE");
      return { duplicate: true, item: order };
    }
    try { deferredPolicy.eligibleDeferred(order, profile.role); }
    catch (error) { deferredFailure(error); }
    const menus = await lockedMenus(tx, db, tenantId, requested);
    const now = new Date().toISOString();
    let change;
    try { change = deferredPolicy.addKitchenRound(order, profile.role, operationId, requested, menus, now); }
    catch (error) { deferredFailure(error); }
    if (change.duplicate) return { duplicate: true, item: order };
    tx.update(ref, { ...change.patch, updatedAt: FieldValue.serverTimestamp() });
    return { duplicate: false, item: { ...order, ...change.patch } };
  });
  return result;
});

exports.settleDeferredWalkIn = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const { db, tenantId, profile, uid } = await callerContext(request);
  const id = deferredId(request.data?.orderId);
  const operationId = deferredId(request.data?.operationId, "OPERATION_ID_INVALID");
  const ref = db.collection("tenants").doc(tenantId).collection("orders").doc(id);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) missing("ORDER_NOT_FOUND");
    const order = normalizeOrder(snap);
    if (isDeferredBill(order) && order.paymentStatus === "paid" && order.settlementOperationId === operationId) {
      return { duplicate: true, item: order };
    }
    const now = new Date().toISOString();
    let patch;
    try { patch = deferredPolicy.settleDeferredWalkIn(order, profile.role, request.data?.cashReceived, request.data?.expectedTotal, now); }
    catch (error) { deferredFailure(error); }
    let table = null;
    if (order.serviceType === "dine_in") {
      // resolve real table code / ID using the existing code lookup.
      const lookup = await findTable(db, tenantId, order.tableCode);
      if (!lookup) conflict("WALK_IN_TABLE_MISMATCH");
      table = await tx.get(lookup.ref);
      verifyWalkinTableOwner(table, id);
      // All reads complete before any writes.
      tx.update(lookup.ref, releasedTablePatch());
    }
    patch.settledByUid = uid;
    patch.settlementOperationId = operationId;
    patch.updatedAt = FieldValue.serverTimestamp();
    if (table) patch.tableClosedAt = now;
    tx.update(ref, patch);
    return { duplicate: false, item: { ...order, ...patch } };
  });
});

exports.cancelDeferredWalkIn = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const source = text(request.data?.source, 25);
  if (!["cashier", "kitchen"].includes(source)) invalid("CANCELLATION_SOURCE_INVALID");
  const roles = source === "kitchen"
    ? new Set(["owner", "admin", "manager", "kitchen", "super_admin"])
    : WALK_IN_ROLES;
  const { db, tenantId, uid, profile } = await callerContext(request, roles);
  const id = deferredId(request.data?.orderId);
  const ref = db.collection("tenants").doc(tenantId).collection("orders").doc(id);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) missing("ORDER_NOT_FOUND");
    const order = normalizeOrder(snap);
    if (isDeferredBill(order) && order.status === "cancelled") return { duplicate: true, item: order };
    const now = new Date().toISOString();
    let patch;
    try { patch = deferredPolicy.cancelDeferredWalkIn(order, profile.role, source, now); }
    catch (error) { deferredFailure(error); }
    let lookup = null;
    if (order.serviceType === "dine_in") {
      lookup = await findTable(db, tenantId, order.tableCode);
      if (!lookup) conflict("WALK_IN_TABLE_MISMATCH");
      const ownedTable = await tx.get(lookup.ref);
      verifyWalkinTableOwner(ownedTable, id);
      tx.update(lookup.ref, releasedTablePatch());
    }
    patch.cancelledByUid = uid;
    patch.cancelledByRole = profile.role;
    patch.cancelledFromStatus = order.status;
    if (lookup) patch.tableClosedAt = now;
    patch.updatedAt = FieldValue.serverTimestamp();
    tx.update(ref, patch);
    return { duplicate: false, item: { ...order, ...patch } };
  });
});

exports.updateDeferredKitchen = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const roles = new Set(["owner", "admin", "manager", "kitchen", "super_admin"]);
  const { db, tenantId, profile, uid } = await callerContext(request, roles);
  const id = deferredId(request.data?.orderId);
  const action = text(request.data?.action, 30);
  if (!["serve_item", "serve_all", "cancel_item", "status"].includes(action)) invalid("KITCHEN_ACTION_INVALID");
  const ref = db.collection("tenants").doc(tenantId).collection("orders").doc(id);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) missing("ORDER_NOT_FOUND");
    const order = normalizeOrder(snap);
    const legacyPaidAwaitingKitchen = order?.orderType === "walkin" &&
      String(order.status || "").toLowerCase() === "paid" &&
      !order.completedAt && !order.tableClosedAt &&
      (Array.isArray(order.items) ? order.items : []).some(line =>
        line && line.cancelled !== true && line.served !== true && line.kitchenPreviouslyServed !== true);
    const paidWalkIn = order?.orderType === "walkin" && order?.paymentStatus === "paid"
      && ["cash", "promptpay"].includes(order?.paymentMethod)
      && !order?.tableToken && (!CLOSED_STATUSES.has(String(order.status || "")) || legacyPaidAwaitingKitchen);
    if (!paidWalkIn) {
      try { deferredPolicy.eligibleDeferred(order, profile.role, "kitchen"); }
      catch (error) { deferredFailure(error); }
    } else if (action === "cancel_item") conflict("CASHIER_CANCEL_PAYMENT_REVIEW_REQUIRED");
    const now = new Date().toISOString();
    let patch = {};
    const index = Number(request.data?.index);
    if (action === "cancel_item") {
      try { patch = deferredPolicy.cancelDeferredItem(order, profile.role, index, now); }
      catch (error) { deferredFailure(error); }
      if (patch.status === "cancelled") {
        patch.cancelledByUid = uid;
        patch.cancelledByRole = profile.role;
      }
    } else if (action === "serve_item" || action === "serve_all") {
      if (action === "serve_item" && (!Number.isSafeInteger(index) || index < 0 || index >= order.items.length)) invalid("ITEM_NOT_FOUND");
      if (action === "serve_item" && (order.items[index].cancelled || order.items[index].served || order.items[index].kitchenPreviouslyServed)) conflict("ITEM_ALREADY_SERVED");
      const items = order.items.map((line, i) => (line.cancelled || line.served || line.kitchenPreviouslyServed || (action === "serve_item" && i !== index))
        ? { ...line } : { ...line, served: true, servedAt: now });
      const complete = items.filter(line => !line.cancelled).every(line => line.served || line.kitchenPreviouslyServed);
      patch = { items, lastServedItemAt: now, ...(complete ? {
        status: paidWalkIn ? "paid" : "served", servedAt: now,
        ...(paidWalkIn ? { completedAt: now } : {}),
      } : {}) };
    } else {
      const nextStatus = text(request.data?.status, 30);
      if (!["accepted", "cooking", "ready", "served"].includes(nextStatus)) invalid("KITCHEN_STATUS_INVALID");
      patch = { status: paidWalkIn && nextStatus === "served" ? "paid" : nextStatus };
      if (nextStatus === "served") {
        patch.items = order.items.map(line => line.cancelled || line.served ? { ...line } : { ...line, served: true, servedAt: now });
        patch.servedAt = now;
        patch.lastServedItemAt = now;
        if (paidWalkIn) patch.completedAt = now;
      }
    }
    // Cancel last item and release its table in the very same transaction.
    if (patch.status === "cancelled" && order.serviceType === "dine_in") {
      const lookup = await findTable(db, tenantId, order.tableCode);
      if (!lookup) conflict("WALK_IN_TABLE_MISMATCH");
      const owned = await tx.get(lookup.ref);
      verifyWalkinTableOwner(owned, id);
      tx.update(lookup.ref, releasedTablePatch());
      patch.tableClosedAt = now;
    }
    patch.updatedAt = FieldValue.serverTimestamp();
    tx.update(ref, patch);
    return { item: { ...order, ...patch } };
  });
});

// Paid Walk-in cancellation must be reviewed. Record sale amount and actor,
// preserve prior payment evidence, never assert any automatic refund.
exports.cancelReviewedPaidWalkIn = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const source = text(request.data?.source || "cashier", 25);
  if (!["cashier", "kitchen"].includes(source)) invalid("CANCELLATION_SOURCE_INVALID");
  const roles = source === "kitchen"
    ? new Set(["owner", "admin", "manager", "kitchen", "super_admin"])
    : WALK_IN_ROLES;
  const { db, uid, profile, tenantId } = await callerContext(request, roles);
  const id = deferredId(request.data?.orderId);
  const ref = db.collection("tenants").doc(tenantId).collection("orders").doc(id);
  const audit = db.collection("tenants").doc(tenantId).collection("auditLogs").doc("reviewed_walkin_cancel_" + id);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) missing("ORDER_NOT_FOUND");
    const order = normalizeOrder(snap);
    if (order?.orderType !== "walkin" || order?.paymentStatus !== "paid" ||
        !["cash", "promptpay"].includes(order.paymentMethod) ||
        order.tableToken || order.lalamoveOrderId || order.lalamoveDispatchPlacedAt ||
        !Number.isFinite(Number(order.totalAmount)) || Number(order.totalAmount) < 0) {
      conflict("CASHIER_CANCEL_PAYMENT_REVIEW_REQUIRED");
    }
    if (order.status === "cancelled" && order.cancellationReviewRequired === true) {
      return { item: order, duplicate: true };
    }
    if (!["pending", "accepted", "cooking", "ready", "served", "paid", "completed"].includes(String(order.status))) {
      conflict("CASHIER_CANCEL_SESSION_REQUIRED");
    }
    const existingAudit = await tx.get(audit);
    if (existingAudit.exists) conflict("CASHIER_CANCEL_AUDIT_CONFLICT");
    const cents = deferredPolicy.activeTotalCents(order.items);
    if (Math.round(Number(order.totalAmount) * 100) !== cents) conflict("CASHIER_CANCEL_TOTAL_MISMATCH");
    // Release only a table still owned by THIS Walk-in. A paid bill settled
    // earlier may already have freed the table for somebody else's order.
    let ownedTable = null;
    if (order.serviceType === "dine_in" && order.tableCode) {
      const found = await findTable(db, tenantId, order.tableCode);
      if (found) {
        const snapshot = await tx.get(found.ref);
        if (snapshot.exists && text(snapshot.data().walkInOrderId) === id &&
          text(snapshot.data().status) === "occupied" && !text(snapshot.data().orderToken)) {
          ownedTable = found.ref;
        }
      }
    }
    const now = new Date().toISOString();
    const patch = {
      status: "cancelled", cancelledAt: now, cancelledFromStatus: order.status,
      cancellationSource: source, cancelledByUid: uid, cancelledByRole: profile.role,
      cancellationReviewRequired: true, financialReviewRequired: true,
      originalPaidTotal: cents / 100, cancelledNetAmount: cents / 100,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (ownedTable) {
      tx.update(ownedTable, releasedTablePatch());
      patch.tableClosedAt = now;
    }
    tx.update(ref, patch);
    tx.create(audit, {
      tenantId, orderId: id, action: source === "kitchen"
        ? "kitchen_order_cancelled_paid" : "cashier_order_cancelled_review_required",
      actorUid: uid, actorRole: profile.role, previousStatus: order.status,
      paymentStatus: "paid", originalNetAmount: cents / 100,
      manualRefundNotRecorded: true, timestamp: FieldValue.serverTimestamp(),
    });
    return { item: { ...order, ...patch }, duplicate: false };
  });
});
