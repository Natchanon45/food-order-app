import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { auth, db } from "@/firebase/client";
import { normalizePosTheme } from "@/config/posThemes";

export const POS_FIRESTORE_VERSION = "P9-B003-react";
const POS_CHANNEL = "retail-pos";
const POS_ORDER_TYPE = "pos";

const tenantCollection = (tenantId, name) => collection(db, "tenants", tenantId, name);
const tenantDoc = (tenantId, name, id) => doc(db, "tenants", tenantId, name, String(id));

const round2 = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const dateKeyFrom = value => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("");
};
const monthKeyFrom = value => dateKeyFrom(value).slice(0, 6);
const padRunning = value => String(Math.max(0, Number(value || 0))).padStart(5, "0");
const saleCounterId = dateKey => `SALE_${dateKey}`;
const runningReservationId = (dateKey, saleId) =>
  `SALE_${dateKey}_${String(saleId).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

function currentUserId() {
  const uid = auth.currentUser?.uid || "";
  if (!uid) throw new Error("AUTH_REQUIRED");
  return uid;
}

function deviceId() {
  const key = "retail_pos_device_id_v1";
  const saved = localStorage.getItem(key);
  if (saved) return saved;
  const id = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, id);
  return id;
}

function snapshotRow(snapshot) {
  return { id: snapshot.id, ...snapshot.data(), _documentId: snapshot.id };
}

export async function listPosProducts(tenantId) {
  const snapshot = await getDocs(query(tenantCollection(tenantId, "products"), orderBy("updatedAt", "desc")));
  return snapshot.docs.map(snapshotRow).map(row => ({
    ...row,
    id: String(row.id || row.code || ""),
    barcode: String(row.barcode || ""),
    name: String(row.name || ""),
    price: Number(row.price || 0),
    cost: Number.isFinite(Number(row.cost)) ? Number(row.cost) : null,
    stock: Number(row.stock ?? row.qty ?? 0),
    unit: row.unit || "ชิ้น",
    category: String(row.category || "ทั่วไป"),
    sortOrder: Number(row.sortOrder ?? 9999),
    showOnPos: row.showOnPos !== false,
  }));
}

export async function loadPosCatalogOrder(tenantId) {
  const snapshot = await getDoc(tenantDoc(tenantId, "settings", "catalog-order"));
  const row = snapshot.exists() ? snapshot.data() : {};
  return Array.isArray(row.categoryOrder)
    ? row.categoryOrder.map(value => String(value || "").trim()).filter(Boolean)
    : [];
}

export async function listPosSales(tenantId) {
  const snapshot = await getDocs(query(
    tenantCollection(tenantId, "sales"),
    orderBy("createdAt", "desc"),
    limit(500),
  ));
  return snapshot.docs.map(snapshotRow);
}

export function watchPosSales(tenantId, onRows, onError = null) {
  if (!tenantId || typeof onRows !== "function") return () => {};
  return onSnapshot(
    query(tenantCollection(tenantId, "sales"), orderBy("createdAt", "desc")),
    snapshot => onRows(snapshot.docs.map(snapshotRow)),
    error => {
      console.warn("POS_SALES_WATCH_FAILED", error);
      if (typeof onError === "function") onError(error);
    },
  );
}

export async function getPosSale(tenantId, saleId) {
  const id = String(saleId || "").trim();
  if (!id) return null;
  const snapshot = await getDoc(tenantDoc(tenantId, "sales", id));
  if (snapshot.exists()) return snapshotRow(snapshot);
  const snapshotAll = await getDocs(tenantCollection(tenantId, "sales"));
  const rows = snapshotAll.docs.map(snapshotRow);
  return rows.find(row => String(row.saleNumber || "") === id) || null;
}

export async function loadPosTaxSettings(tenantId) {
  const snapshot = await getDoc(tenantDoc(tenantId, "settings", "tax"));
  const data = snapshot.exists() ? snapshot.data() : {};
  const rawRegistered = String(data.vatRegistered ?? data.vatEnabled ?? data.taxRegistered ?? "no").toLowerCase();
  const vatRegistered = data.vatRegistered === true || ["yes", "true", "1", "registered", "enabled"].includes(rawRegistered);
  const vatRate = vatRegistered ? Math.max(0, Math.min(100, Number(data.vatRate ?? data.taxRate ?? 7) || 7)) : 0;
  return {
    vatRegistered,
    vatRate,
    defaultVatMode: String(data.defaultVatMode || "include") === "exclude" ? "exclude" : "include",
    vatCalculationBase: data.vatCalculationBase || "after_discount_and_points",
  };
}

const POS_ACTIVE_SHIFT_KEY = "retail_pos_active_shift_v1";
const POS_SHIFT_SYNC_QUEUE_KEY = "retail_pos_shift_sync_queue_v1";

function readPosLocalJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export async function loadActivePosShift(tenantId, userId = currentUserId()) {
  const local = readPosLocalJson(POS_ACTIVE_SHIFT_KEY, null);
  const localBelongs = local
    && String(local.tenantId || tenantId) === String(tenantId)
    && local.status === "open"
    && (!userId || String(local.createdBy || local.cashierId || "") === String(userId));
  if (localBelongs) return local;

  const queue = readPosLocalJson(POS_SHIFT_SYNC_QUEUE_KEY, []);
  const closingIds = new Set((Array.isArray(queue) ? queue : [])
    .filter(row => String(row?.tenantId || "") === String(tenantId)
      && row?.action === "close"
      && ["pending", "syncing", "conflict"].includes(String(row?.status || "")))
    .map(row => String(row?.shiftId || "")));
  const snapshot = await getDocs(query(tenantCollection(tenantId, "shifts"), orderBy("updatedAt", "desc")));
  const rows = snapshot.docs.map(snapshotRow);
  return rows.find(row => row.status === "open"
    && !closingIds.has(String(row.id))
    && (!userId || String(row.createdBy || row.cashierId || "") === String(userId))) || null;
}

function saleTotalsForSummary(summary = {}, sale = {}) {
  const method = sale.paymentMethod || sale.payment?.method || "unknown";
  const total = Number(sale.totalAmount ?? sale.total ?? 0);
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
    totalDiscount: Number(summary.totalDiscount || 0) + Number(sale.discount || 0),
    totalQty: Number(summary.totalQty || 0) + Number(sale.totalQty || 0),
    billCount: Number(summary.billCount || 0) + 1,
    [`payment_${method}`]: Number(summary[`payment_${method}`] || 0) + total,
    updatedAt: Date.now(),
  };
}

function saleItemRows(sale) {
  return (sale.items || []).map((item, index) => ({
    id: `${sale.id}_${item.productId || item.id || index}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
    saleId: sale.id,
    saleNumber: sale.saleNumber,
    tenantId: sale.tenantId,
    shopId: sale.tenantId,
    channel: POS_CHANNEL,
    orderType: POS_ORDER_TYPE,
    productId: item.productId || item.id || "",
    barcode: item.barcode || "",
    name: item.name || "",
    unit: item.unit || "ชิ้น",
    qty: Number(item.qty || 0),
    price: Number(item.price || 0),
    cost: Number.isFinite(Number(item.cost)) ? Number(item.cost) : null,
    lineTotal: round2(Number(item.lineTotal ?? Number(item.price || 0) * Number(item.qty || 0))),
    dateKey: sale.dateKey,
    createdAt: sale.createdAt,
  }));
}

export async function completePosSale({
  tenantId,
  items,
  totals,
  paymentMethod = "cash",
  received = 0,
  customer = null,
  shift = null,
}) {
  if (!tenantId) throw new Error("TENANT_ID_REQUIRED");
  if (!Array.isArray(items) || !items.length) throw new Error("NO_ITEMS");
  const userId = currentUserId();
  const saleId = `sale-${crypto.randomUUID?.() || Date.now()}`;
  const createdAt = new Date().toISOString();
  const dateKey = dateKeyFrom(createdAt);
  const monthKey = monthKeyFrom(createdAt);
  const saleRef = tenantDoc(tenantId, "sales", saleId);
  const summaryRef = tenantDoc(tenantId, "dailySummary", dateKey);
  const counterRef = tenantDoc(tenantId, "counters", saleCounterId(dateKey));
  const reservationRef = tenantDoc(tenantId, "runningNumbers", runningReservationId(dateKey, saleId));
  const now = Date.now();
  const posDeviceId = deviceId();

  let committedSale = null;
  await runTransaction(db, async transaction => {
    const [existingSale, counterSnapshot, reservationSnapshot, summarySnapshot] = await Promise.all([
      transaction.get(saleRef),
      transaction.get(counterRef),
      transaction.get(reservationRef),
      transaction.get(summaryRef),
    ]);
    if (existingSale.exists()) {
      committedSale = snapshotRow(existingSale);
      return;
    }

    const productRows = [];
    for (const item of items) {
      const productId = String(item.productId || item.id || "").trim();
      if (!productId) throw new Error("INVALID_PRODUCT_ID");
      const productRef = tenantDoc(tenantId, "products", productId);
      const productSnapshot = await transaction.get(productRef);
      if (!productSnapshot.exists()) throw new Error(`PRODUCT_NOT_FOUND:${productId}`);
      const product = productSnapshot.data();
      const before = Number(product.stock || 0);
      const qty = Number(item.qty || 0);
      if (!(qty > 0)) throw new Error(`INVALID_QTY:${productId}`);
      if (before < qty) throw new Error(`INSUFFICIENT_STOCK:${product.name || productId}`);
      productRows.push({ item, productId, productRef, product, before, qty, after: before - qty });
    }

    let running = 0;
    let saleNumber = "";
    if (reservationSnapshot.exists() && reservationSnapshot.data()?.documentNumber) {
      const reservation = reservationSnapshot.data();
      running = Number(reservation.running || 0);
      saleNumber = String(reservation.documentNumber);
    } else {
      running = Number(counterSnapshot.exists() ? counterSnapshot.data()?.current || 0 : 0) + 1;
      saleNumber = `POS-${dateKey}-${padRunning(running)}`;
      transaction.set(counterRef, {
        id: saleCounterId(dateKey),
        tenantId,
        shopId: tenantId,
        counterType: "daily-sale-number",
        documentType: "SALE",
        documentCollection: "sales",
        channel: POS_CHANNEL,
        orderType: POS_ORDER_TYPE,
        prefix: "POS",
        reset: "daily",
        dateKey,
        periodKey: dateKey,
        monthKey,
        current: running,
        lastRunning: running,
        lastNumber: saleNumber,
        lastSaleId: saleId,
        lastDocumentId: saleId,
        lastDocumentNumber: saleNumber,
        schemaVersion: POS_FIRESTORE_VERSION,
        updatedBy: userId,
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      }, { merge: true });
      transaction.set(reservationRef, {
        id: runningReservationId(dateKey, saleId),
        tenantId,
        shopId: tenantId,
        counterId: saleCounterId(dateKey),
        documentType: "SALE",
        documentCollection: "sales",
        documentId: saleId,
        documentNumber: saleNumber,
        running,
        prefix: "POS",
        reset: "daily",
        dateKey,
        periodKey: dateKey,
        monthKey,
        saleId,
        saleNumber,
        status: "reserved",
        schemaVersion: POS_FIRESTORE_VERSION,
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      }, { merge: true });
    }

    const subtotal = round2(totals.subtotal);
    const discount = round2(totals.discount);
    const total = round2(totals.total);
    const saleItems = items.map(item => ({
      id: String(item.productId || item.id || ""),
      productId: String(item.productId || item.id || ""),
      barcode: String(item.barcode || ""),
      name: String(item.name || ""),
      price: Number(item.price || 0),
      cost: Number.isFinite(Number(item.cost)) ? Number(item.cost) : null,
      qty: Number(item.qty || 0),
      unit: item.unit || "ชิ้น",
      lineTotal: round2(Number(item.price || 0) * Number(item.qty || 0)),
    }));
    const effectiveReceived = paymentMethod === "cash" ? Number(received || 0) : total;
    const sale = {
      id: saleId,
      saleId,
      saleNumber,
      finalSaleNumber: saleNumber,
      runningNumberType: "SALE",
      runningNumberStatus: "reserved",
      tenantId,
      shopId: tenantId,
      deviceId: posDeviceId,
      schemaVersion: POS_FIRESTORE_VERSION,
      deleted: false,
      dateKey,
      monthKey,
      channel: POS_CHANNEL,
      orderType: POS_ORDER_TYPE,
      status: "completed",
      paymentStatus: "paid",
      syncStatus: "synced",
      createdAt,
      items: saleItems,
      totalQty: saleItems.reduce((sum, item) => sum + item.qty, 0),
      subtotal,
      discount,
      pointDiscount: round2(totals.pointDiscount || 0),
      discountedBase: round2(totals.discountedBase),
      taxableBase: round2(totals.taxableBase),
      beforeVat: round2(totals.beforeVat),
      vatAmount: round2(totals.vatAmount),
      vatRate: Number(totals.vatRate || 0),
      vatMode: totals.vatMode || "none",
      vatRegistered: totals.vatRegistered === true || totals.vatRegistered === "yes",
      vatCalculationBase: totals.vatCalculationBase || "after_discount_and_points",
      total,
      totalAmount: total,
      payment: {
        method: paymentMethod,
        received: effectiveReceived,
        change: round2(Math.max(0, effectiveReceived - total)),
      },
      paymentMethod,
      receivedAmount: effectiveReceived,
      changeAmount: round2(Math.max(0, effectiveReceived - total)),
      cashierId: userId,
      customerId: customer?.id || "",
      customerCode: customer?.customerCode || customer?.code || "",
      customerName: customer?.name || "",
      customerPhone: customer?.phone || "",
      memberId: customer?.id || "",
      memberCode: customer?.customerCode || customer?.code || "",
      shiftId: shift?.id || "",
      cashierName: shift?.cashierName || "",
      terminalCode: shift?.terminalCode || "",
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
    };

    const nextSummary = saleTotalsForSummary(summarySnapshot.exists() ? summarySnapshot.data() : {}, sale);
    transaction.set(saleRef, {
      ...sale,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    }, { merge: true });

    saleItemRows(sale).forEach(item => {
      transaction.set(tenantDoc(tenantId, "saleItems", item.id), {
        ...item,
        createdBy: userId,
        updatedBy: userId,
        deviceId: posDeviceId,
        schemaVersion: POS_FIRESTORE_VERSION,
        deleted: false,
        createdAtServer: serverTimestamp(),
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      }, { merge: true });
    });

    productRows.forEach(({ item, productId, productRef, product, before, qty, after }) => {
      transaction.update(productRef, {
        stock: after,
        tenantId,
        shopId: product.shopId || tenantId,
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      });
      const movementId = `${saleId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      transaction.set(tenantDoc(tenantId, "stockMovements", movementId), {
        id: movementId,
        tenantId,
        shopId: product.shopId || tenantId,
        deviceId: posDeviceId,
        schemaVersion: POS_FIRESTORE_VERSION,
        deleted: false,
        dateKey,
        monthKey,
        productId,
        productName: item.name || product.name || productId,
        type: "sale",
        direction: "out",
        qty,
        before,
        after,
        stockBefore: before,
        stockAfter: after,
        note: `ขายสินค้า ${saleNumber}`,
        referenceType: "sale",
        referenceId: saleId,
        referenceNumber: saleNumber,
        createdBy: userId,
        updatedBy: userId,
        createdAt,
        createdAtServer: serverTimestamp(),
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      }, { merge: true });
    });

    transaction.set(summaryRef, {
      ...nextSummary,
      updatedBy: userId,
      updatedAtServer: serverTimestamp(),
    }, { merge: true });

    transaction.set(tenantDoc(tenantId, "syncQueue", saleId), {
      id: saleId,
      tenantId,
      shopId: tenantId,
      saleId,
      saleNumber,
      channel: POS_CHANNEL,
      orderType: POS_ORDER_TYPE,
      syncStatus: "synced",
      retryCount: 0,
      lastError: "",
      deviceId: posDeviceId,
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    }, { merge: true });

    committedSale = sale;
  });

  if (!committedSale) {
    const saved = await getDoc(saleRef);
    committedSale = saved.exists() ? snapshotRow(saved) : null;
  }
  return committedSale;
}

export async function listHeldPosBills(tenantId) {
  const snapshot = await getDocs(query(tenantCollection(tenantId, "heldBills"), orderBy("updatedAt", "desc")));
  return snapshot.docs.map(snapshotRow).filter(row => row.status === "held");
}

export async function holdPosBill(tenantId, payload = {}) {
  const userId = currentUserId();
  const id = payload.id || `held-${crypto.randomUUID?.() || Date.now()}`;
  const row = {
    ...payload,
    id,
    tenantId,
    shopId: tenantId,
    status: "held",
    source: "retail_pos",
    createdBy: userId,
    updatedBy: userId,
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp(),
  };
  await setDoc(tenantDoc(tenantId, "heldBills", id), row, { merge: true });
  return row;
}

export async function releaseHeldPosBill(tenantId, id) {
  await deleteDoc(tenantDoc(tenantId, "heldBills", id));
  return true;
}

function normalizePosCustomerRow(row = {}) {
  return {
    ...row,
    id: String(row.id || row.customerId || row.customerCode || ""),
    customerCode: String(row.customerCode || row.code || ""),
    name: String(row.name || ""),
    phone: String(row.phone || ""),
    email: String(row.email || ""),
    address: String(row.address || ""),
    note: String(row.note || ""),
    points: Math.max(0, Math.floor(Number(row.points || 0))),
  };
}

export async function listPosCustomers(tenantId) {
  const snapshot = await getDocs(tenantCollection(tenantId, "customers"));
  return snapshot.docs.map(snapshotRow).map(normalizePosCustomerRow).filter(row => row.id);
}

export function watchPosCustomers(tenantId, onRows, onError = null) {
  if (!tenantId || typeof onRows !== "function") return () => {};
  return onSnapshot(
    tenantCollection(tenantId, "customers"),
    snapshot => onRows(snapshot.docs.map(snapshotRow).map(normalizePosCustomerRow).filter(row => row.id)),
    error => {
      console.warn("POS_CUSTOMERS_WATCH_FAILED", error);
      if (typeof onError === "function") onError(error);
    },
  );
}

export async function listPosLoyaltyLedger(tenantId) {
  const snapshot = await getDocs(tenantCollection(tenantId, "loyaltyLedger"));
  return snapshot.docs.map(snapshotRow)
    .sort((a, b) => dateValueMs(b.createdAt || b.updatedAt) - dateValueMs(a.createdAt || a.updatedAt));
}

export function watchPosLoyaltyLedger(tenantId, onRows, onError = null) {
  if (!tenantId || typeof onRows !== "function") return () => {};
  return onSnapshot(
    tenantCollection(tenantId, "loyaltyLedger"),
    snapshot => onRows(snapshot.docs.map(snapshotRow)
      .sort((a, b) => dateValueMs(b.createdAt || b.updatedAt) - dateValueMs(a.createdAt || a.updatedAt))),
    error => {
      console.warn("POS_LOYALTY_LEDGER_WATCH_FAILED", error);
      if (typeof onError === "function") onError(error);
    },
  );
}

export async function loadPosLoyaltySettings(tenantId) {
  const snapshot = await getDoc(tenantDoc(tenantId, "settings", "loyalty"));
  const row = snapshot.exists() ? snapshot.data() : {};
  return {
    enabled: row.enabled !== false,
    spendPerPoint: Math.max(0.01, Number(row.spendPerPoint || 10)),
    pointValue: Math.max(0.01, Number(row.pointValue || 1)),
  };
}

export async function applyPosLoyalty({ tenantId, sale, customer, pointsUsed = 0, settings = null }) {
  if (!tenantId || !sale?.id || !customer?.id) return null;
  const userId = currentUserId();
  const config = settings || await loadPosLoyaltySettings(tenantId);
  const customerRef = tenantDoc(tenantId, "customers", customer.id);
  const saleRef = tenantDoc(tenantId, "sales", sale.id);
  const ledgerId = `loyalty-${sale.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const ledgerRef = tenantDoc(tenantId, "loyaltyLedger", ledgerId);
  let result = null;

  await runTransaction(db, async transaction => {
    const [customerSnapshot, saleSnapshot, ledgerSnapshot] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(saleRef),
      transaction.get(ledgerRef),
    ]);
    if (!customerSnapshot.exists() || !saleSnapshot.exists()) return;
    if (ledgerSnapshot.exists()) {
      result = snapshotRow(ledgerSnapshot);
      return;
    }
    const current = { id: customerSnapshot.id, ...customerSnapshot.data() };
    const before = Math.max(0, Math.floor(Number(current.points || 0)));
    const safeUsed = config.enabled
      ? Math.max(0, Math.min(before, Math.floor(Number(pointsUsed || 0))))
      : 0;
    const earned = config.enabled
      ? Math.floor(Math.max(0, Number(sale.totalAmount ?? sale.total ?? 0)) / config.spendPerPoint)
      : 0;
    const redeemValue = round2(safeUsed * config.pointValue);
    const after = Math.max(0, before - safeUsed + earned);
    const now = Date.now();
    const ledger = {
      id: ledgerId,
      tenantId,
      shopId: tenantId,
      customerId: customer.id,
      customerCode: customer.customerCode || current.customerCode || "",
      customerName: customer.name || current.name || "",
      saleId: sale.id,
      saleNumber: sale.saleNumber || "",
      pointsUsed: safeUsed,
      pointsEarned: earned,
      balanceBefore: before,
      balanceAfter: after,
      redeemValue,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: now,
    };
    transaction.set(customerRef, {
      ...current,
      id: customer.id,
      tenantId,
      shopId: current.shopId || tenantId,
      name: current.name || customer.name || "-",
      points: after,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    }, { merge: true });
    transaction.set(ledgerRef, { ...ledger, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp() });
    transaction.set(saleRef, {
      tenantId,
      shopId: tenantId,
      customerId: customer.id,
      customerCode: customer.customerCode || current.customerCode || "",
      customerName: customer.name || current.name || "",
      customerPhone: customer.phone || current.phone || "",
      loyalty: {
        pointsBefore: before,
        pointsUsed: safeUsed,
        pointsEarned: earned,
        pointsAfter: after,
        redeemValue,
      },
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    }, { merge: true });
    result = ledger;
  });
  return result;
}

export async function loadPosPaymentSettings(tenantId) {
  const [retailPosSnapshot, storeSnapshot, paymentSnapshot] = await Promise.all([
    getDoc(tenantDoc(tenantId, "settings", "retailPos")),
    getDoc(tenantDoc(tenantId, "settings", "store")),
    getDoc(tenantDoc(tenantId, "settings", "payment")),
  ]);
  const retailPos = retailPosSnapshot.exists() ? retailPosSnapshot.data() : {};
  const store = storeSnapshot.exists() ? storeSnapshot.data() : {};
  const payment = paymentSnapshot.exists() ? paymentSnapshot.data() : {};
  const merged = { ...store, ...retailPos, ...payment };
  return {
    shopName: String(retailPos.shopName || "POS ร้านค้าปลีก"),
    promptPayId: String(merged.promptPayId || ""),
    promptPayAccountName: String(merged.promptPayAccountName || merged.promptPayName || ""),
    promptPayEnabled: merged.promptPayEnabled === true || String(merged.promptPayEnabled || "no") === "yes",
  };
}

export async function loadPosReceiptSettings(tenantId) {
  const [receiptSnapshot, retailPosSnapshot, storeSnapshot, taxSnapshot] = await Promise.all([
    getDoc(tenantDoc(tenantId, "settings", "receipt")),
    getDoc(tenantDoc(tenantId, "settings", "retailPos")),
    getDoc(tenantDoc(tenantId, "settings", "store")),
    getDoc(tenantDoc(tenantId, "settings", "tax")),
  ]);
  const receipt = receiptSnapshot.exists() ? receiptSnapshot.data() : {};
  const retailPos = retailPosSnapshot.exists() ? retailPosSnapshot.data() : {};
  const store = storeSnapshot.exists() ? storeSnapshot.data() : {};
  const tax = taxSnapshot.exists() ? taxSnapshot.data() : {};
  const row = { ...store, ...retailPos, ...receipt, ...tax };
  const paperSize = ["58", "80", "a4"].includes(String(row.receiptPaperSize || ""))
    ? String(row.receiptPaperSize) : "80";
  return {
    autoPrint: String(row.receiptPrintMode || "").toLowerCase() === "auto",
    paperSize,
    shopName: String(row.taxInvoiceName || retailPos.shopName || "POS ร้านค้าปลีก"),
    shopAddress: String(row.shopAddress || row.address || ""),
    shopPhone: String(row.shopPhone || row.phone || ""),
    taxId: String(row.taxId || row.shopTaxId || ""),
    taxBranch: String(row.taxBranch || row.branchName || "สำนักงานใหญ่"),
    taxBranchType: String(row.taxBranchType || "headOffice") === "branch" ? "branch" : "headOffice",
    taxBranchCode: String(row.taxBranchCode || ""),
    taxInvoiceName: String(row.taxInvoiceName || row.shopName || row.name || ""),
    taxInvoiceAddress: String(row.taxInvoiceAddress || row.shopAddress || row.address || ""),
    vatRate: Number.isFinite(Number(row.vatRate)) ? Number(row.vatRate) : 7,
    logoUrl: String(row.logoUrl || row.shopLogoUrl || ""),
    receiptThanks: String(row.receiptThanks || "ขอบคุณที่ใช้บริการ"),
    receiptFooter: String(row.receiptFooter || ""),
  };
}

const taxCounterId = dateKey => `TAX_${dateKey}`;
const taxRunningReservationId = (dateKey, invoiceId) =>
  `TAX_${dateKey}_${String(invoiceId).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

export async function getPosTaxInvoice(tenantId, invoiceId) {
  const id = String(invoiceId || "").trim();
  if (!tenantId || !id) return null;
  const direct = await getDoc(tenantDoc(tenantId, "taxInvoices", id));
  if (direct.exists()) return snapshotRow(direct);
  const snapshot = await getDocs(tenantCollection(tenantId, "taxInvoices"));
  return snapshot.docs.map(snapshotRow).find(row =>
    String(row.invoiceNumber || "") === id || String(row.saleId || "") === id
  ) || null;
}

export async function getPosTaxInvoiceForSale(tenantId, sale) {
  const saleId = String(sale?.id || sale?.saleId || "").trim();
  const saleNumber = String(sale?.saleNumber || "").trim();
  if (!tenantId || (!saleId && !saleNumber)) return null;
  const deterministicId = `tax-${saleId || saleNumber}`;
  const direct = await getDoc(tenantDoc(tenantId, "taxInvoices", deterministicId));
  if (direct.exists()) return snapshotRow(direct);
  const snapshot = await getDocs(tenantCollection(tenantId, "taxInvoices"));
  return snapshot.docs.map(snapshotRow).find(row =>
    (saleId && String(row.saleId || "") === saleId) ||
    (saleNumber && String(row.saleNumber || "") === saleNumber)
  ) || null;
}

export async function createPosTaxInvoice({ tenantId, sale, buyer, settings = {} }) {
  if (!tenantId) throw new Error("TENANT_ID_REQUIRED");
  if (!sale?.id && !sale?.saleNumber) throw new Error("SALE_REQUIRED");
  const buyerName = String(buyer?.buyerName || "").replace(/\s+/g, " ").trim();
  const buyerTaxId = String(buyer?.buyerTaxId || "").replace(/\D/g, "").slice(0, 13);
  const buyerAddress = String(buyer?.buyerAddress || "").replace(/\s+/g, " ").trim();
  const buyerBranchName = String(buyer?.buyerBranchName || "สำนักงานใหญ่").replace(/\s+/g, " ").trim() || "สำนักงานใหญ่";
  if (!buyerName) throw new Error("BUYER_NAME_REQUIRED");

  const userId = currentUserId();
  const saleId = String(sale.id || sale.saleId || sale.saleNumber);
  const invoiceId = `tax-${saleId}`;
  const issuedAt = new Date().toISOString();
  const dateKey = dateKeyFrom(issuedAt);
  const monthKey = monthKeyFrom(issuedAt);
  const invoiceRef = tenantDoc(tenantId, "taxInvoices", invoiceId);
  const counterRef = tenantDoc(tenantId, "counters", taxCounterId(dateKey));
  const reservationRef = tenantDoc(tenantId, "runningNumbers", taxRunningReservationId(dateKey, invoiceId));
  const now = Date.now();
  let committed = null;

  await runTransaction(db, async transaction => {
    const [invoiceSnapshot, counterSnapshot, reservationSnapshot] = await Promise.all([
      transaction.get(invoiceRef),
      transaction.get(counterRef),
      transaction.get(reservationRef),
    ]);
    if (invoiceSnapshot.exists()) {
      committed = snapshotRow(invoiceSnapshot);
      return;
    }

    let running;
    let invoiceNumber;
    if (reservationSnapshot.exists() && reservationSnapshot.data()?.documentNumber) {
      running = Number(reservationSnapshot.data().running || 0);
      invoiceNumber = String(reservationSnapshot.data().documentNumber);
    } else {
      running = Number(counterSnapshot.exists() ? counterSnapshot.data()?.current || 0 : 0) + 1;
      invoiceNumber = `TAX-${dateKey}-${String(running).padStart(4, "0")}`;
      transaction.set(counterRef, {
        id: taxCounterId(dateKey),
        tenantId,
        shopId: tenantId,
        counterType: "daily-tax-number",
        documentType: "TAX",
        documentCollection: "taxInvoices",
        prefix: "TAX",
        reset: "daily",
        dateKey,
        periodKey: dateKey,
        monthKey,
        current: running,
        lastRunning: running,
        lastNumber: invoiceNumber,
        lastDocumentId: invoiceId,
        lastDocumentNumber: invoiceNumber,
        schemaVersion: POS_FIRESTORE_VERSION,
        updatedBy: userId,
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      }, { merge: true });
      transaction.set(reservationRef, {
        id: taxRunningReservationId(dateKey, invoiceId),
        tenantId,
        shopId: tenantId,
        counterId: taxCounterId(dateKey),
        documentType: "TAX",
        documentCollection: "taxInvoices",
        documentId: invoiceId,
        documentNumber: invoiceNumber,
        running,
        prefix: "TAX",
        reset: "daily",
        dateKey,
        periodKey: dateKey,
        monthKey,
        status: "reserved",
        schemaVersion: POS_FIRESTORE_VERSION,
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      }, { merge: true });
    }

    const seller = {
      sellerName: String(settings.taxInvoiceName || settings.shopName || "POS ร้านค้าปลีก"),
      sellerAddress: String(settings.taxInvoiceAddress || settings.shopAddress || ""),
      sellerPhone: String(settings.shopPhone || ""),
      sellerTaxId: String(settings.taxId || "").replace(/\D/g, "").slice(0, 13),
      sellerBranchType: settings.taxBranchType === "branch" ? "branch" : "headOffice",
      sellerBranchCode: String(settings.taxBranchCode || ""),
    };
    const total = round2(sale.totalAmount ?? sale.total);
    const vatAmount = round2(sale.vatAmount || 0);
    const beforeVat = round2(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? (total - vatAmount));
    const normalizedBuyer = {
      buyerName,
      buyerTaxId,
      buyerAddress,
      buyerBranchName,
      customerKey: String(sale.customerId || sale.customerCode || sale.customerPhone || sale.customerName || ""),
    };
    const invoice = {
      id: invoiceId,
      tenantId,
      shopId: tenantId,
      saleId,
      saleNumber: String(sale.saleNumber || ""),
      invoiceNumber,
      invoiceType: "fullTaxInvoice",
      runningNumberType: "TAX",
      runningNumberStatus: "reserved",
      dateKey,
      monthKey,
      status: "issued",
      issuedAt,
      seller,
      buyerProfileId: normalizedBuyer.customerKey,
      buyer: normalizedBuyer,
      items: Array.isArray(sale.items) ? sale.items : [],
      subtotal: round2(sale.subtotal),
      discount: round2(sale.discount),
      pointDiscount: round2(sale.pointDiscount),
      beforeVat,
      vatRate: Number.isFinite(Number(sale.vatRate)) ? Number(sale.vatRate) : Number(settings.vatRate || 7),
      vatAmount,
      vatMode: String(sale.vatMode || "include") === "exclude" ? "exclude" : "include",
      totalAmount: total,
      paymentMethod: sale.paymentMethod || sale.payment?.method || "",
      sourceSale: {
        id: saleId,
        saleNumber: String(sale.saleNumber || ""),
        createdAt: sale.createdAt || null,
        customerId: sale.customerId || sale.memberId || "",
        customerCode: sale.customerCode || sale.memberCode || "",
        customerName: sale.customerName || sale.customerDisplayName || "",
        customerPhone: sale.customerPhone || sale.customerDisplayPhone || "",
        paymentMethod: sale.paymentMethod || sale.payment?.method || "",
      },
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    };
    transaction.set(invoiceRef, invoice);
    committed = invoice;
  });

  const profileKey = String(sale.customerId || sale.customerCode || buyerTaxId || buyerName).trim();
  if (profileKey) {
    await setDoc(tenantDoc(tenantId, "taxBuyerProfiles", profileKey.replace(/[^a-zA-Z0-9_-]/g, "_")), {
      id: profileKey,
      customerKey: profileKey,
      tenantId,
      shopId: tenantId,
      buyerName,
      buyerTaxId,
      buyerAddress,
      buyerBranchName,
      updatedBy: userId,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    }, { merge: true }).catch(error => console.warn("POS_TAX_BUYER_PROFILE_SAVE_FAILED", error));
  }

  return committed;
}

const POS_OPERATION_CONFIG = Object.freeze({
  REFUND: { prefix: "RF", collection: "returns", pad: 5 },
  VOID: { prefix: "VD", collection: "returns", pad: 5 },
  SHIFT: { prefix: "SH", collection: "shifts", pad: 4 },
});
const safeId = value => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");

async function reservePosOperationNumber(transaction, tenantId, type, documentId, createdAt, userId) {
  const config = POS_OPERATION_CONFIG[type];
  if (!config) throw new Error("OPERATION_TYPE_INVALID");
  const dateKey = dateKeyFrom(createdAt);
  const counterId = `${type}_${dateKey}`;
  const reservationId = `${type}_${dateKey}_${safeId(documentId)}`;
  const counterRef = tenantDoc(tenantId, "counters", counterId);
  const reservationRef = tenantDoc(tenantId, "runningNumbers", reservationId);
  const [counterSnap, reservationSnap] = await Promise.all([transaction.get(counterRef), transaction.get(reservationRef)]);
  if (reservationSnap.exists() && reservationSnap.data()?.documentNumber) return reservationSnap.data().documentNumber;
  const running = Number(counterSnap.exists() ? counterSnap.data()?.current || 0 : 0) + 1;
  const documentNumber = [config.prefix, dateKey, String(running).padStart(config.pad, "0")].join("-");
  const now = Date.now();
  transaction.set(counterRef, {
    id: counterId, tenantId, shopId: tenantId, counterType: type.toLowerCase() + "-number",
    documentType: type, documentCollection: config.collection, prefix: config.prefix, reset: "daily",
    dateKey, periodKey: dateKey, monthKey: dateKey.slice(0, 6), current: running, lastRunning: running,
    lastNumber: documentNumber, lastDocumentId: documentId, lastDocumentNumber: documentNumber,
    schemaVersion: POS_FIRESTORE_VERSION, updatedBy: userId, updatedAt: now, updatedAtServer: serverTimestamp(),
  }, { merge: true });
  transaction.set(reservationRef, {
    id: reservationId, tenantId, shopId: tenantId, counterId, documentType: type,
    documentCollection: config.collection, documentId, documentNumber, running, prefix: config.prefix,
    reset: "daily", dateKey, periodKey: dateKey, monthKey: dateKey.slice(0, 6), status: "reserved",
    schemaVersion: POS_FIRESTORE_VERSION, createdBy: userId, updatedBy: userId,
    createdAt: now, updatedAt: now, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp(),
  }, { merge: true });
  return documentNumber;
}

export async function listPosReturns(tenantId) {
  const snapshot = await getDocs(tenantCollection(tenantId, "returns"));
  return snapshot.docs.map(snapshotRow).sort((a,b) => dateValueMs(b.createdAt || b.updatedAt) - dateValueMs(a.createdAt || a.updatedAt));
}
function dateValueMs(value) {
  if (value?.toMillis) return value.toMillis();
  const n = Number(value);
  if (Number.isFinite(n) && n > 100000000000) return n;
  const d = new Date(value || 0).getTime();
  return Number.isFinite(d) ? d : 0;
}
function returnedQtyMap(sale = {}) {
  return (sale.returns || []).reduce((map,row) => {
    (row.items || []).forEach(item => { map[item.productId] = Number(map[item.productId] || 0) + Number(item.qty || 0); });
    return map;
  }, {});
}
export async function createPosReturn({ tenantId, saleId, items = [], mode = "return", reason = "", refundMethod = "original", note = "" }) {
  const userId = currentUserId();
  const createdAt = new Date().toISOString();
  const returnId = safeId(`${mode}_${saleId}_${Date.now()}`);
  let committed = null;
  await runTransaction(db, async transaction => {
    const saleRef = tenantDoc(tenantId, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("SALE_NOT_FOUND");
    const sale = snapshotRow(saleSnap);
    if (sale.status !== "completed") throw new Error("SALE_NOT_COMPLETED");
    const returned = returnedQtyMap(sale);
    const normalized = items.map(request => {
      const productId = String(request.productId || request.id || "");
      const source = (sale.items || []).find(item => String(item.productId || item.id || "") === productId);
      if (!source) throw new Error("RETURN_PRODUCT_NOT_IN_SALE");
      const qty = Number(request.qty || 0), soldQty = Number(source.qty || 0), already = Number(returned[productId] || 0);
      if (!(qty > 0) || qty + already > soldQty) throw new Error("RETURN_QTY_EXCEEDS_REMAINING");
      return { productId, barcode: source.barcode || "", name: source.name || source.productName || productId, unit: source.unit || "ชิ้น", qty, price: Number(source.price || 0), lineTotal: round2(qty * Number(source.price || 0)) };
    });
    if (!normalized.length) throw new Error("RETURN_ITEMS_REQUIRED");
    const productRows = [];
    for (const item of normalized) {
      const ref = tenantDoc(tenantId, "products", item.productId);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("PRODUCT_NOT_FOUND");
      const row = snap.data(), before = Number(row.stock || 0), after = before + item.qty;
      productRows.push({ item, ref, row, before, after });
    }
    const type = mode === "void" ? "VOID" : "REFUND";
    const returnNumber = await reservePosOperationNumber(transaction, tenantId, type, returnId, createdAt, userId);
    const refundTotal = round2(normalized.reduce((sum,item) => sum + item.lineTotal, 0));
    const row = {
      id: returnId, returnNumber, tenantId, shopId: tenantId, deviceId: deviceId(), schemaVersion: POS_FIRESTORE_VERSION,
      deleted: false, channel: POS_CHANNEL, orderType: POS_ORDER_TYPE, mode,
      status: mode === "void" ? "voided" : "completed", saleId, saleNumber: sale.saleNumber || "",
      items: normalized, refundTotal, refundMethod, reason: String(reason || ""), note: String(note || ""),
      shiftId: sale.shiftId || "", cashierId: userId, createdBy: userId, updatedBy: userId,
      createdAt, updatedAt: Date.now(), createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp(),
    };
    transaction.set(tenantDoc(tenantId, "returns", returnId), row);
    for (const {item,ref,row:product,before,after} of productRows) {
      transaction.update(ref, { stock: after, tenantId, shopId: product.shopId || tenantId, updatedAt: Date.now(), updatedAtServer: serverTimestamp() });
      const movementId = safeId(`${returnId}_${item.productId}`);
      transaction.set(tenantDoc(tenantId, "stockMovements", movementId), {
        id: movementId, tenantId, shopId: tenantId, deviceId: deviceId(), schemaVersion: POS_FIRESTORE_VERSION,
        deleted:false,dateKey:dateKeyFrom(createdAt),monthKey:monthKeyFrom(createdAt),productId:item.productId,
        productName:item.name,type:"return",direction:"in",qty:item.qty,before,after,stockBefore:before,stockAfter:after,
        note:(mode === "void" ? "Void " : "คืนสินค้า ") + returnNumber,referenceType:mode,referenceId:returnId,
        referenceNumber:returnNumber,saleId,createdBy:userId,updatedBy:userId,createdAt,updatedAt:Date.now(),
        createdAtServer:serverTimestamp(),updatedAtServer:serverTimestamp(),
      });
    }
    const summary = { id:returnId, returnNumber, mode, refundTotal, items:normalized, createdAt };
    transaction.set(saleRef, {
      returns:[...(sale.returns || []), summary], refundTotal:round2(Number(sale.refundTotal || 0) + refundTotal),
      loyalty:sale.loyalty || null, tenantId, shopId:tenantId, updatedAt:Date.now(), updatedAtServer:serverTimestamp(),
    }, { merge:true });
    committed = row;
  });
  return committed;
}

export async function listPosShifts(tenantId) {
  const snapshot = await getDocs(tenantCollection(tenantId, "shifts"));
  return snapshot.docs.map(snapshotRow).sort((a,b) => dateValueMs(b.openedAt || b.createdAt) - dateValueMs(a.openedAt || a.createdAt));
}
export function watchPosShifts(tenantId, onRows, onError = null) {
  if (!tenantId || typeof onRows !== "function") return () => {};
  return onSnapshot(
    query(tenantCollection(tenantId, "shifts"), orderBy("updatedAt", "desc")),
    snapshot => onRows(snapshot.docs.map(snapshotRow)),
    error => {
      console.warn("POS_SHIFTS_WATCH_FAILED", error);
      if (typeof onError === "function") onError(error);
    },
  );
}
export async function openPosShift({
  tenantId, openingCash = 0, terminalCode = "POS-01", cashierName = "", note = "",
  shiftId: requestedShiftId = "", openedAt: requestedOpenedAt = "",
}) {
  const userId = currentUserId();
  const openedAt = requestedOpenedAt || new Date().toISOString();
  const shiftId = requestedShiftId || safeId(`shift-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`);
  let committed = null;
  await runTransaction(db, async transaction => {
    const ref = tenantDoc(tenantId, "shifts", shiftId), snap = await transaction.get(ref);
    if (snap.exists()) { committed = snapshotRow(snap); return; }
    const shiftNumber = await reservePosOperationNumber(transaction, tenantId, "SHIFT", shiftId, openedAt, userId);
    const cleanNote = String(note || "");
    const row = {
      id:shiftId,shiftNumber,tenantId,shopId:tenantId,deviceId:deviceId(),schemaVersion:POS_FIRESTORE_VERSION,
      deleted:false,channel:POS_CHANNEL,status:"open",terminalCode:String(terminalCode || "POS-01"),cashierId:userId,
      cashierName:String(cashierName || auth.currentUser?.displayName || auth.currentUser?.email || "Cashier"),
      openingCash:round2(openingCash),closingCash:0,actualCash:0,expectedCash:0,cashDifference:0,
      totalSales:0,salesTotal:0,totalCashSales:0,cashSales:0,totalNonCashSales:0,transferSales:0,billCount:0,
      openedAt,closedAt:"",note:cleanNote,openNote:cleanNote,createdBy:userId,updatedBy:userId,
      createdAt:openedAt,updatedAt:Date.now(),createdAtServer:serverTimestamp(),updatedAtServer:serverTimestamp(),
    };
    transaction.set(ref,row,{merge:true}); committed=row;
  });
  localStorage.setItem(POS_ACTIVE_SHIFT_KEY,JSON.stringify(committed));
  return committed;
}
export async function closePosShift({
  tenantId, shiftId, closingCash = 0, totals = {}, note = "", closedAt: requestedClosedAt = "",
}) {
  const userId=currentUserId(),closedAt=requestedClosedAt || new Date().toISOString();
  const ref=tenantDoc(tenantId,"shifts",shiftId); let committed=null;
  await runTransaction(db,async transaction=>{
    const snap=await transaction.get(ref); if(!snap.exists()) throw new Error("SHIFT_NOT_FOUND");
    const row=snapshotRow(snap); if(row.status!=="open"){committed=row;return;}
    const expectedCash=round2(Number(row.openingCash||0)+Number(totals.totalCashSales||totals.cashSales||0));
    const closeCash=round2(closingCash);
    const totalSales=round2(totals.totalSales ?? totals.salesTotal);
    const cashSales=round2(totals.totalCashSales ?? totals.cashSales);
    const transferSales=round2(totals.totalNonCashSales ?? totals.transferSales);
    const closed={...row,status:"closed",closingCash:closeCash,actualCash:closeCash,expectedCash,cashDifference:round2(closeCash-expectedCash),
      totalSales,salesTotal:totalSales,totalCashSales:cashSales,cashSales,totalNonCashSales:transferSales,transferSales,
      billCount:Number(totals.billCount||0),closedAt,closedBy:userId,closeNote:String(note||""),updatedBy:userId,
      updatedAt:Date.now(),updatedAtServer:serverTimestamp()};
    transaction.set(ref,closed,{merge:true}); committed=closed;
  });
  localStorage.removeItem(POS_ACTIVE_SHIFT_KEY);
  return committed;
}
export async function listPosTaxInvoices(tenantId) {
  const snapshot = await getDocs(tenantCollection(tenantId, "taxInvoices"));
  return snapshot.docs.map(snapshotRow).sort((a,b) => dateValueMs(b.issuedAt || b.createdAt) - dateValueMs(a.issuedAt || a.createdAt));
}


function nextPosCustomerCode(rows = []) {
  const max=rows.reduce((m,c)=>Math.max(m,Number(String(c.customerCode||"").match(/^C(\d+)$/i)?.[1]||0)),0);
  return "C"+String(max+1).padStart(5,"0");
}
export async function savePosCustomer(tenantId,input={},editingId="") {
  const userId=currentUserId(), rows=await listPosCustomers(tenantId);
  const id=String(editingId||input.id||("customer-"+crypto.randomUUID())), name=String(input.name||"").trim();
  if(!name) throw new Error("CUSTOMER_NAME_REQUIRED");
  const current=editingId?rows.find(c=>c.id===editingId):null;
  const payload={id,tenantId,shopId:tenantId,customerCode:current?.customerCode||input.customerCode||nextPosCustomerCode(rows),name,phone:String(input.phone||"").trim(),email:String(input.email||"").trim(),address:String(input.address||"").trim(),note:String(input.note||"").trim(),points:Math.max(0,Math.floor(Number(current?.points??input.points??0))),active:input.active!==false,updatedBy:userId,updatedAt:Date.now(),updatedAtServer:serverTimestamp(),...(!current?{createdBy:userId,createdAt:Date.now(),createdAtServer:serverTimestamp()}: {})};
  await setDoc(tenantDoc(tenantId,"customers",id),payload,{merge:true}); return payload;
}
export async function deletePosCustomer(tenantId,id){if(id)await deleteDoc(tenantDoc(tenantId,"customers",id))}
export async function loadPosStoreSettings(tenantId){
  const ids=["retailPos","store","tax","payment","receipt","loyalty","pos-theme"],snaps=await Promise.all(ids.map(id=>getDoc(tenantDoc(tenantId,"settings",id))));
  const rows=Object.fromEntries(ids.map((id,index)=>[id,snaps[index].exists()?snaps[index].data():{}]));
  return {...rows,posTheme:rows["pos-theme"]||{}};
}
export async function savePosStoreSettings(tenantId,data={},options={}){
  const userId=currentUserId(),now=Date.now(),meta={tenantId,shopId:tenantId,updatedBy:userId,updatedAt:now,updatedAtServer:serverTimestamp()};
  const taxId=String(data.taxId||"");
  const retailPos={id:"retailPos",type:"retail-pos",...meta,shopName:String(data.shopName||""),shopAddress:String(data.shopAddress||""),shopPhone:String(data.shopPhone||""),taxId,storeLatitude:data.storeLatitude==null||data.storeLatitude===""?null:Number(data.storeLatitude),storeLongitude:data.storeLongitude==null||data.storeLongitude===""?null:Number(data.storeLongitude)};
  const tax={id:"tax",...meta,taxId,vatRegistered:data.vatRegistered===true||data.vatRegistered==="yes",vatRate:Number(data.vatRate||7),defaultVatMode:data.defaultVatMode==="exclude"?"exclude":"include",taxBranchType:data.taxBranchType==="branch"?"branch":"headOffice",taxBranchCode:String(data.taxBranchCode||""),taxInvoiceName:String(data.taxInvoiceName||""),taxInvoiceAddress:String(data.taxInvoiceAddress||""),vatCalculationBase:"after_discount_and_points",shortTaxInvoiceEnabled:true};
  const payment={id:"payment",...meta,promptPayEnabled:data.promptPayEnabled===true||data.promptPayEnabled==="yes",promptPayId:String(data.promptPayId||"").replace(/[^\d]/g,"").slice(0,13),promptPayAccountName:String(data.promptPayAccountName||"")};
  const receipt={id:"receipt",...meta,receiptPaperSize:["58","80","a4"].includes(String(data.receiptPaperSize))?String(data.receiptPaperSize):"80",receiptPrintMode:data.receiptPrintMode==="auto"?"auto":"ask",receiptThanks:String(data.receiptThanks||"ขอบคุณที่ใช้บริการ"),receiptFooter:String(data.receiptFooter||"เอกสารฉบับนี้ออกโดยระบบของร้านตามข้อมูลด้านบน")};
  const loyalty={id:"loyalty",...meta,enabled:data.loyaltyEnabled!==false&&data.loyaltyEnabled!=="no",spendPerPoint:Math.max(.01,Number(data.spendPerPoint||10)),pointValue:Math.max(.01,Number(data.pointValue||1))};
  const posTheme={id:"pos-theme",type:"pos-theme",...meta,theme:normalizePosTheme(data.posTheme)};
  const rows=new Map([["retailPos",retailPos],["tax",tax],["payment",payment],["receipt",receipt],["loyalty",loyalty],["pos-theme",posTheme]]);
  const requested=Array.isArray(options.sections)&&options.sections.length?options.sections:[...rows.keys()];
  const sections=[...new Set(requested.map(String))].filter(id=>rows.has(id));
  if(!sections.length) return loadPosStoreSettings(tenantId);
  await Promise.all(sections.map(id=>setDoc(tenantDoc(tenantId,"settings",id),rows.get(id),{merge:true})));
  return loadPosStoreSettings(tenantId);
}
