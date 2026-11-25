import {
  collection, deleteDoc, doc, getDoc, getDocFromServer, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, runTransaction
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/firebase/client";

const createWalkInCallable = httpsCallable(functions, "createWalkInOrder");
const appendWalkInCallable = httpsCallable(functions, "appendUnpaidWalkInItems");
const settleDeferredWalkInCallable = httpsCallable(functions, "settleDeferredWalkIn");
const cancelDeferredWalkInCallable = httpsCallable(functions, "cancelDeferredWalkIn");
const updateDeferredKitchenCallable = httpsCallable(functions, "updateDeferredKitchen");
const cancelReviewedPaidWalkInCallable = httpsCallable(functions, "cancelReviewedPaidWalkIn");
const assignWalkInTableCallable = httpsCallable(functions, "assignWalkInTable");
const moveTableSessionCallable = httpsCallable(functions, "moveTableSession");
const settleTableSessionCallable = httpsCallable(functions, "settleTableSession");
const closeWalkInTableCallable = httpsCallable(functions, "closeWalkInTable");
const releaseQuickOrderHeldBillCallable = httpsCallable(functions, "releaseQuickOrderHeldBill");
const quoteLalamoveCallable = httpsCallable(functions, "quoteTenantLalamoveDispatch");
const placeLalamoveCallable = httpsCallable(functions, "placeTenantLalamoveDispatch");
const refreshLalamoveCallable = httpsCallable(functions, "refreshTenantLalamoveDispatch");
const cancelLalamoveCallable = httpsCallable(functions, "cancelTenantLalamoveDispatch");
const cashierCashReceiptCallable = httpsCallable(functions, "cashierRecordCashReceipt");
const cashierPickupCallable = httpsCallable(functions, "cashierPickupAction");
const cashierCancelCallable = httpsCallable(functions, "cashierCancelOrderSafely");
const kitchenActionCallable = httpsCallable(functions, "kitchenApplyOrderAction");

function requireTenantId(value) {
  const id = String(value || "").trim();
  if (!id) throw new Error("TENANT_REQUIRED");
  return id;
}
function tenantDoc(tenantId, collectionName, id) {
  return doc(db, "tenants", requireTenantId(tenantId), collectionName, String(id));
}
function tenantCollection(tenantId, collectionName) {
  return collection(db, "tenants", requireTenantId(tenantId), collectionName);
}
function documentRow(snapshot) {
  const data = snapshot.data() || {};
  const embeddedId = String(data.id || "").trim();
  return {
    ...data,
    ...(embeddedId && embeddedId !== snapshot.id ? { legacyId: embeddedId } : {}),
    id: snapshot.id,
  };
}
function docs(snapshot) {
  return snapshot.docs.map(documentRow);
}
function millis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function categoryOrderKey(value = "") {
  return String(value).normalize("NFKC").replace(/\s+/g, "").replace(/^อาหาร/, "").replace(/^ประเภท/, "");
}
function menuSort(rows, categoryOrder = []) {
  const categoryRank = new Map((categoryOrder || []).map((name, index) => [categoryOrderKey(name), index]));
  return [...rows].sort((a, b) => {
    const ac = String(a.category || "อื่น ๆ"), bc = String(b.category || "อื่น ๆ");
    const ar = categoryRank.get(categoryOrderKey(ac)) ?? 9999;
    const br = categoryRank.get(categoryOrderKey(bc)) ?? 9999;
    if (ar !== br) return ar - br;
    if (ac !== bc) return ac.localeCompare(bc, "th");
    const as = Number(a.sortOrder ?? 9999), bs = Number(b.sortOrder ?? 9999);
    return as !== bs ? as - bs : String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}
export function normalizeFunctionError(error) {
  const code = String(error?.details?.code || error?.code || "UNKNOWN_ERROR")
    .replace(/^functions\//, "")
    .toUpperCase()
    .replaceAll("-", "_");
  const normalized = new Error(error?.message || code);
  normalized.code = code;
  normalized.details = error?.details || {};
  normalized.serverResponse = error?.details || {};
  normalized.cause = error;
  return normalized;
}

export async function loadOperationalSnapshot(tenantId) {
  const id = requireTenantId(tenantId);
  // Core restaurant data must not depend on Retail POS-only collections.
  // heldBills are loaded separately through watchQuickOrderHeldBills only for
  // tenants with retail_pos enabled; querying them here breaks restaurant_cafe.
  const [settingsSnap, menuSnap, tableSnap, orderSnap] = await Promise.all([
    getDoc(tenantDoc(id, "settings", "store")),
    getDocs(tenantCollection(id, "menus")),
    getDocs(tenantCollection(id, "tables")),
    getDocs(query(tenantCollection(id, "orders"), orderBy("createdAt", "desc"))),
  ]);
  const settings = settingsSnap.exists() ? { id: settingsSnap.id, ...settingsSnap.data() } : {};
  const menus = menuSort(docs(menuSnap), settings.categoryOrder || []);
  const tables = docs(tableSnap);
  const orders = docs(orderSnap);
  return { settings, menus, tables, orders, heldBills: [] };
}

// Kitchen only needs its menu catalogue and ordering stream. Do not read heldBills:
 // that collection is Retail POS-only and restaurant-only tenants cannot list it.
export async function loadKitchenMenus(tenantId) {
  const id = requireTenantId(tenantId);
  const [settingsSnap, menuSnap] = await Promise.all([
    getDoc(tenantDoc(id, "settings", "store")),
    getDocs(tenantCollection(id, "menus")),
  ]);
  const settings = settingsSnap.exists() ? settingsSnap.data() || {} : {};
  return menuSort(docs(menuSnap), settings.categoryOrder || []);
}

export function watchOperationalOrders(tenantId, onRows, onError = console.error) {
  return onSnapshot(
    query(tenantCollection(tenantId, "orders"), orderBy("createdAt", "desc")),
    snapshot => onRows(docs(snapshot)),
    onError,
  );
}
export function watchOperationalMenus(tenantId, categoryOrder = [], onRows, onError = console.error) {
  return onSnapshot(
    tenantCollection(tenantId, "menus"),
    snapshot => onRows(menuSort(docs(snapshot), categoryOrder)),
    onError,
  );
}
export function watchOperationalTables(tenantId, onRows, onError = console.error) {
  return onSnapshot(tenantCollection(tenantId, "tables"), snapshot => onRows(docs(snapshot)), onError);
}
export async function updateOperationalTable(tenantId, tableId, patch = {}) {
  const id = String(tableId || "").trim();
  if (!id) throw new Error("TABLE_REQUIRED");
  const ref = tenantDoc(tenantId, "tables", id);
  const {expectedOrderToken,...changes}=patch;
  if(typeof expectedOrderToken!=="string"||!["available","occupied"].includes(changes.status))
    throw new Error("TABLE_SESSION_EXPECTED_REQUIRED");
  await runTransaction(db,async tx=>{
    const snapshot=await tx.get(ref);
    if(!snapshot.exists())throw new Error("TABLE_NOT_FOUND");
    const row=snapshot.data();
    if(row.active===false||row.occupancyType==="walkin"||row.walkInOrderId||
      String(row.orderToken||"")!==expectedOrderToken)
      throw new Error("TABLE_SESSION_CHANGED");
    if(changes.status==="occupied"){
      if((row.status&&row.status!=="available")||expectedOrderToken||!changes.orderToken||
         (row.orderIds||[]).length)throw new Error("TABLE_SESSION_CHANGED");
    }else{
      if(row.status!=="occupied"||!expectedOrderToken||changes.orderToken!=="")
        throw new Error("TABLE_SESSION_CHANGED");
      if(!Array.isArray(row.orderIds)||row.orderIds.length>100)throw new Error("TABLE_ORDER_HISTORY_UNAVAILABLE");
      // Never clear an outstanding order, including a newly submitted round.
      const orders=await Promise.all(row.orderIds.map(orderId=>tx.get(tenantDoc(tenantId,"orders",orderId))));
      if(orders.some(o=>!o.exists()||!(o.data().paymentStatus==="paid"||o.data().status==="cancelled")))
        throw new Error("TABLE_HAS_UNPAID_ORDERS");
    }
    tx.update(ref,{...changes,tenantId:requireTenantId(tenantId),shopId:requireTenantId(tenantId),updatedAt:serverTimestamp()});
  });
  const snapshot = await getDocFromServer(ref);
  if (!snapshot.exists()||String(snapshot.data().orderToken||"")!==String(changes.orderToken||"")||
      snapshot.data().status!==changes.status) throw new Error("TABLE_SESSION_CHANGED");
  return documentRow(snapshot);
}
export async function getOperationalOrder(tenantId, orderId) {
  const id = String(orderId || "").trim();
  if (!id) return null;
  const snapshot = await getDoc(tenantDoc(tenantId, "orders", id));
  return snapshot.exists() ? documentRow(snapshot) : null;
}

// Explicit server read after a fresh Lalamove quote/status: never compare
// a cached local order to a provider quotation for paid dispatch consent.
export async function getOperationalOrderFromServer(tenantId, orderId) {
  const id=String(orderId||"").trim();
  if(!id)throw new Error("ORDER_REQUIRED");
  const snap=await getDocFromServer(tenantDoc(tenantId,"orders",id));
  if(!snap.exists())throw new Error("ORDER_NOT_FOUND");
  return documentRow(snap);
}

export async function getOperationalStoreSettings(tenantId) {
  const snapshot = await getDoc(tenantDoc(tenantId, "settings", "store"));
  return snapshot.exists() ? documentRow(snapshot) : {};
}

export async function getOperationalTable(tenantId, tableId, {server=false}={}) {
  const id = String(tableId || "").trim();
  if (!id) return null;
  const snapshot = await (server?getDocFromServer:getDoc)(tenantDoc(tenantId, "tables", id));
  return snapshot.exists() ? documentRow(snapshot) : null;
}
export async function updateCustomerDisplay(tenantId, displayId, payload = {}) {
  const id = String(displayId || "").trim();
  if (!id) throw new Error("CUSTOMER_DISPLAY_ID_REQUIRED");
  const ref = tenantDoc(tenantId, "customerDisplays", id);
  const row={...payload,id,tenantId:requireTenantId(tenantId),shopId:requireTenantId(tenantId),updatedAt:serverTimestamp()};
  if(id.startsWith("quick-order-")){
    const version=payload.updatedAt;
    if(!Number.isSafeInteger(version)||version<=0)throw Error("DISPLAY_TIMESTAMP_INVALID");
    await runTransaction(db,async tx=>{
      const prior=await tx.get(ref);
      const current=Number(prior.data()?.snapshotUpdatedAt||0);
      const stale=()=>Object.assign(Error("DISPLAY_SNAPSHOT_STALE"),{code:"DISPLAY_SNAPSHOT_STALE"});
      if(current>version)throw stale();
      if(current===version){
        const canonical=value=>Array.isArray(value)?value.map(canonical):
          value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
        const saved=prior.data(),keys=Object.keys(payload).filter(k=>k!=="updatedAt");
        if(keys.some(k=>JSON.stringify(canonical(saved[k]))!==JSON.stringify(canonical(payload[k]))))
          throw stale();
        return;
      }
      tx.set(ref,{...row,snapshotUpdatedAt:version},{merge:true});
    });
  }else await setDoc(ref,row,{merge:true});
  return { ...payload, id };
}
export function watchCustomerDisplay(tenantId, displayId, onValue, onError = console.error) {
  const id = String(displayId || "").trim() || "main-register";
  return onSnapshot(tenantDoc(tenantId, "customerDisplays", id), snapshot => {
    onValue(snapshot.exists() ? documentRow(snapshot) : null);
  }, onError);
}
export async function updateOperationalOrder(tenantId, orderId, patch = {}) {
  const id = String(orderId || "").trim();
  if (!id) throw new Error("ORDER_REQUIRED");
  const ref = tenantDoc(tenantId, "orders", id);
  await setDoc(ref, {
    ...patch,
    tenantId: requireTenantId(tenantId),
    shopId: requireTenantId(tenantId),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("ORDER_NOT_FOUND");
  return documentRow(snapshot);
}

export async function cancelOperationalOrder(tenantId, orderId, extra = {}) {
  const id = String(orderId || "").trim();
  if (!id) throw new Error("ORDER_REQUIRED");
  const scopedTenantId = requireTenantId(tenantId);
  const user = auth.currentUser;
  const cancelledAt = new Date().toISOString();
  const patch = {
    ...extra,
    status: "cancelled",
    cancelledAt,
    cancelledByUid: String(user?.uid || ""),
    cancelledByEmail: String(user?.email || ""),
    tenantId: scopedTenantId,
    shopId: scopedTenantId,
    updatedAt: serverTimestamp(),
  };
  await setDoc(tenantDoc(scopedTenantId, "orders", id), patch, { merge: true });
  return {
    id,
    ...extra,
    status: "cancelled",
    cancelledAt,
    cancelledByUid: String(user?.uid || ""),
    cancelledByEmail: String(user?.email || ""),
  };
}
export function watchQuickOrderHeldBills(tenantId, onRows, onError = console.error) {
  return onSnapshot(tenantCollection(tenantId, "heldBills"), snapshot => {
    onRows(
      docs(snapshot)
        .filter(item => item.source === "quick_order" && item.status === "held")
        .sort((a, b) => millis(b.createdAt) - millis(a.createdAt)),
    );
  }, onError);
}

export async function createWalkInOrder(tenantId, payload) {
  try {
    const response = await createWalkInCallable({ tenantId: requireTenantId(tenantId), ...payload });
    return response.data;
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}
export async function appendUnpaidWalkInItems(tenantId, orderId, operationId, items) {
  try {
    const result = await appendWalkInCallable({
      tenantId: requireTenantId(tenantId), orderId, operationId, items,
    });
    return result.data;
  } catch (error) { throw normalizeFunctionError(error); }
}
export async function settleUnpaidWalkIn(tenantId, orderId, operationId, cashReceived, expectedTotal) {
  try {
    const result = await settleDeferredWalkInCallable({
      tenantId: requireTenantId(tenantId), orderId, operationId, cashReceived, expectedTotal,
    });
    return result.data;
  } catch (error) { throw normalizeFunctionError(error); }
}
export async function cancelUnpaidWalkIn(tenantId, orderId, source) {
  try {
    const result = await cancelDeferredWalkInCallable({
      tenantId: requireTenantId(tenantId), orderId, source,
    });
    return result.data;
  } catch (error) { throw normalizeFunctionError(error); }
}
export async function updateDeferredWalkInKitchen(tenantId, orderId, action, extra = {}) {
  try {
    const result = await updateDeferredKitchenCallable({
      tenantId: requireTenantId(tenantId), orderId, action, ...extra,
    });
    return result.data;
  } catch (error) { throw normalizeFunctionError(error); }
}

export async function cancelReviewedWalkIn(tenantId, orderId, source = "cashier") {
  try {
    const result = await cancelReviewedPaidWalkInCallable({ tenantId: requireTenantId(tenantId), orderId, source });
    return result.data;
  } catch (error) { throw normalizeFunctionError(error); }
}

export async function moveTableSession(tenantId, payload = {}) {
  try {
    const response = await moveTableSessionCallable({ tenantId: requireTenantId(tenantId), ...payload });
    return response.data;
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

export async function settleTableSession(tenantId, orderId) {
  try {
    const response = await settleTableSessionCallable({
      tenantId: requireTenantId(tenantId), orderId: String(orderId || "").trim(),
    });
    return response.data;
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

export async function closeWalkInTable(tenantId, tableId, orderId = "") {
  try {
    const response = await closeWalkInTableCallable({
      tenantId: requireTenantId(tenantId),
      tableId: String(tableId || "").trim(),
      orderId: String(orderId || "").trim(),
    });
    return response.data;
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

export async function assignWalkInTable(tenantId, id, tableCode = "") {
  try {
    const response = await assignWalkInTableCallable({
      tenantId: requireTenantId(tenantId), id: String(id || "").trim(), tableCode: String(tableCode || "").trim(),
    });
    return response.data;
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

async function dispatchCall(callable, tenantId, orderId, payload = {}) {
  try {
    const response = await callable({
      tenantId: requireTenantId(tenantId),
      orderId: String(orderId || "").trim(),
      ...payload,
    });
    return response.data;
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}
export function quoteLalamoveDispatch(tenantId, orderId) {
  return dispatchCall(quoteLalamoveCallable, tenantId, orderId);
}
export function placeLalamoveDispatch(tenantId, orderId, options = {}) {
  return dispatchCall(placeLalamoveCallable, tenantId, orderId, options);
}
export function refreshLalamoveDispatch(tenantId, orderId) {
  return dispatchCall(refreshLalamoveCallable, tenantId, orderId);
}
export function cancelLalamoveDispatch(tenantId, orderId) {
  return dispatchCall(cancelLalamoveCallable, tenantId, orderId);
}

export function cashierRecordCashReceipt(tenantId, orderIds, kind, operationId) {
  return dispatchCall(cashierCashReceiptCallable, tenantId, "", {
    orderIds, kind, operationId,
  });
}
export function cashierPickupAction(tenantId, orderId, action) {
  return dispatchCall(cashierPickupCallable, tenantId, orderId, {action});
}
export function cashierCancelOrderSafely(tenantId, orderId) {
  return dispatchCall(cashierCancelCallable, tenantId, orderId);
}

export function kitchenApplyOrderAction(tenantId, orderId, action, options = {}) {
  return dispatchCall(kitchenActionCallable, tenantId, orderId, { action,...options });
}

export async function saveQuickOrderHeldBill(tenantId, bill) {
  const id = String(bill?.id || `held-${crypto.randomUUID()}`).trim();
  const userId = auth.currentUser?.uid || "";
  if (!userId) throw new Error("AUTH_REQUIRED");
  const items = Array.isArray(bill?.items) ? bill.items : [];
  if (!items.length || items.length > 100) throw new Error("HELD_BILL_ITEMS_REQUIRED");
  const total = Math.max(0, Number(bill?.total ?? bill?.totalAmount ?? 0) || 0);
  const ref = tenantDoc(tenantId, "heldBills", id);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data()?.source !== "quick_order") {
    throw new Error("HELD_BILL_SOURCE_MISMATCH");
  }
  const payload = {
    ...bill, id, tenantId: requireTenantId(tenantId), shopId: requireTenantId(tenantId),
    source: "quick_order", status: "held", items, total, createdBy: userId,
    context: {
      serviceType: String(bill?.context?.serviceType || bill?.serviceType || "dine_in"),
      paymentMethod: String(bill?.context?.paymentMethod || bill?.paymentMethod || "cash"),
      tableCode: String(bill?.context?.tableCode || bill?.tableCode || ""),
      customerName: String(bill?.context?.customerName || bill?.customerName || ""),
      note: String(bill?.context?.note || bill?.note || ""),
    },
    createdAt: bill?.createdAt || serverTimestamp(), updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
  return { ...payload, id };
}

export async function releaseQuickOrderHeldBill(tenantId, id, disposition = "resume", operationId = "") {
  try {
    const response = await releaseQuickOrderHeldBillCallable({
      tenantId: requireTenantId(tenantId),
      id: String(id || "").trim(),
      disposition: String(disposition || "resume"),
      operationId: String(operationId || `quick-order-${disposition}-${crypto.randomUUID()}`),
    });
    return response.data;
  } catch (error) {
    throw normalizeFunctionError(error);
  }
}

export async function deleteQuickOrderHeldBill(tenantId, id) {
  const ref = tenantDoc(tenantId, "heldBills", id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return false;
  if (snapshot.data()?.source !== "quick_order") throw new Error("HELD_BILL_SOURCE_MISMATCH");
  await deleteDoc(ref);
  return true;
}
