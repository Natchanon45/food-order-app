import {
  collection, doc, getDocs, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/firebase/client";
import { POS_FIRESTORE_VERSION } from "@/data/retailPosData";

const tenantCollection = (tenantId, name) => collection(db, "tenants", tenantId, name);
const tenantDoc = (tenantId, name, id) => doc(db, "tenants", tenantId, name, String(id));
const safeId = value => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
const round2 = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const dateKeyFrom = value => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("");
};
const deviceId = () => {
  const key = "retail_pos_device_id_v1";
  const saved = localStorage.getItem(key);
  if (saved) return saved;
  const id = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, id);
  return id;
};
const snapshotRow = snapshot => ({ id: snapshot.id, ...snapshot.data() });
export async function listPosReturnsParity(tenantId) {
  const snapshot = await getDocs(tenantCollection(tenantId, "returns"));
  return snapshot.docs.map(snapshotRow).sort((a, b) => {
    const left = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const right = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return right - left;
  });
}

export function watchPosReturnsParity(tenantId, onRows, onError = null) {
  if (!tenantId || typeof onRows !== "function") return () => {};
  return onSnapshot(
    query(tenantCollection(tenantId, "returns"), orderBy("createdAt", "desc")),
    snapshot => onRows(snapshot.docs.map(snapshotRow)),
    error => {
      console.warn("POS_RETURNS_WATCH_FAILED", error);
      if (typeof onError === "function") onError(error);
    },
  );
}

function returnedQtyMap(sale = {}) {
  return (sale.returns || []).reduce((map, row) => {
    (row.items || []).forEach(item => {
      const key = String(item.productId || item.id || "");
      map[key] = Number(map[key] || 0) + Number(item.qty || 0);
    });
    return map;
  }, {});
}
function loyaltyPlan(sale = {}, refundTotal = 0, settings = {}) {
  if (!sale?.customerId || !sale?.loyalty || refundTotal <= 0) return null;
  const originalEarned = Math.max(0, Math.floor(Number(sale.loyalty.pointsEarned || 0)));
  const originalUsed = Math.max(0, Math.floor(Number(sale.loyalty.pointsUsed || 0)));
  const saleTotal = Math.max(0, Number(sale.totalAmount ?? sale.total ?? 0));
  const previousRefund = Math.max(0, Number(sale.refundTotal || 0));
  const cumulativeRefund = Math.min(saleTotal, previousRefund + Number(refundTotal || 0));
  const remainingNet = Math.max(0, saleTotal - cumulativeRefund);
  const spendPerPoint = Math.max(0.01, Number(settings.spendPerPoint || 10));
  const targetEarned = Math.min(
    originalEarned,
    Math.max(0, originalEarned - Math.floor(remainingNet / spendPerPoint)),
  );
  const prior = Array.isArray(sale.returns) ? sale.returns : [];
  const deducted = prior.reduce((sum, row) => sum + Number(row?.loyaltyAdjustment?.pointsEarnedDeducted || 0), 0);
  const targetRestore = saleTotal <= 0 ? 0
    : cumulativeRefund >= saleTotal ? originalUsed
      : Math.floor(originalUsed * cumulativeRefund / saleTotal);
  const restored = prior.reduce((sum, row) => sum + Number(row?.loyaltyAdjustment?.pointsUsedRestored || 0), 0);
  return {
    customerId: String(sale.customerId || ""),
    pointsEarnedToDeduct: Math.max(0, targetEarned - deducted),
    pointsUsedToRestore: Math.max(0, targetRestore - restored),
  };
}
function loyaltyBundle({ planned, customer, sale, returnId, refundTotal, createdAt, userId, tenantId }) {
  if (!planned || !customer) return null;
  const pointsBefore = Math.max(0, Math.floor(Number(customer.points || 0)));
  const pointsUsedRestored = Math.max(0, Math.floor(Number(planned.pointsUsedToRestore || 0)));
  const available = pointsBefore + pointsUsedRestored;
  const pointsEarnedDeducted = Math.min(available, Math.max(0, Math.floor(Number(planned.pointsEarnedToDeduct || 0))));
  const deductionShortfall = Math.max(0, Number(planned.pointsEarnedToDeduct || 0) - pointsEarnedDeducted);
  const pointsAfter = Math.max(0, available - pointsEarnedDeducted);
  const adjustment = {
    customerId: customer.id,
    customerCode: customer.customerCode || sale.customerCode || "",
    customerName: customer.name || sale.customerName || "",
    pointsBefore, pointsEarnedDeducted, pointsUsedRestored, deductionShortfall, pointsAfter,
  };
  const ledgerId = safeId(`point_return_${returnId}`);
  const ledger = {
    id: ledgerId, type: "return", returnId, saleId: sale.id, tenantId, shopId: tenantId,
    deviceId: deviceId(), schemaVersion: POS_FIRESTORE_VERSION,
    customerId: customer.id, customerCode: adjustment.customerCode, customerName: adjustment.customerName,
    pointsEarned: 0, pointsUsed: 0, pointsEarnedDeducted, pointsUsedRestored, deductionShortfall,
    balanceBefore: pointsBefore, balanceAfter: pointsAfter, refundTotal,
    createdBy: userId, updatedBy: userId, createdAt, updatedAt: Date.now(),
  };
  return { adjustment, ledger, updatedCustomer: { ...customer, points: pointsAfter } };
}
export async function createPosReturnParity({
  tenantId, saleId, saleDocumentId = "", items = [], products = [], customers = [], mode = "return",
  refundMethod = "original", reason = "", note = "", returnDate = "",
}) {
  const userId = auth.currentUser?.uid || "";
  if (!userId) throw new Error("AUTH_REQUIRED");
  if (!tenantId || !saleId) throw new Error("SALE_NOT_FOUND");
  const createdAt = new Date().toISOString();
  const prefix = mode === "void" ? "VOID" : "RETURN";
  const returnId = `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  let committed = null;

  await runTransaction(db, async transaction => {
    const saleRef = tenantDoc(tenantId, "sales", saleDocumentId || saleId);
    const returnRef = tenantDoc(tenantId, "returns", returnId);
    const [saleSnapshot, returnSnapshot] = await Promise.all([
      transaction.get(saleRef), transaction.get(returnRef),
    ]);
    if (returnSnapshot.exists()) throw new Error("RETURN_DUPLICATE");
    if (!saleSnapshot.exists()) throw new Error("SALE_NOT_FOUND");
    const sale = snapshotRow(saleSnapshot);
    if (sale.tenantId && String(sale.tenantId) !== String(tenantId)) throw new Error("TENANT_MISMATCH");

    const returned = returnedQtyMap(sale);
    const normalized = items.map(request => {
      const productId = String(request.productId || request.id || "");
      const source = (sale.items || []).find(row => String(row.id || row.productId || "") === productId);
      if (!source) throw new Error(`PRODUCT_NOT_FOUND:${request.productName || productId}`);
      const qty = Number(request.qty || 0);
      const available = Math.max(0, Number(source.qty || 0) - Number(returned[productId] || 0));
      if (!(qty > 0)) throw new Error("RETURN_ITEMS_REQUIRED");
      if (qty > available) throw new Error(`RETURN_QTY_EXCEEDED:${source.name || source.productName || productId}`);
      return {
        productId, barcode: source.barcode || "", productName: source.name || source.productName || productId,
        qty, unit: source.unit || "", price: Number(source.price || 0), cost: source.cost ?? null,
        lineTotal: round2(qty * Number(source.price || 0)),
      };
    });
    if (!normalized.length) throw new Error("RETURN_ITEMS_REQUIRED");
    const productRows = [];
    for (const item of normalized) {
      const cachedProduct = products.find(row => String(row.id || "") === String(item.productId));
      const productRef = tenantDoc(tenantId, "products", cachedProduct?._documentId || item.productId);
      const productSnapshot = await transaction.get(productRef);
      if (!productSnapshot.exists()) throw new Error(`PRODUCT_NOT_FOUND:${item.productName}`);
      const product = productSnapshot.data();
      const before = Number(product.stock || 0);
      productRows.push({ item, productRef, product, before, after: before + Number(item.qty || 0) });
    }

    const soldQty = (sale.items || []).reduce((sum, row) => sum + Number(row.qty || 0), 0);
    const returnedBefore = (sale.returns || []).flatMap(row => row.items || [])
      .reduce((sum, row) => sum + Number(row.qty || 0), 0);
    const returningQty = normalized.reduce((sum, row) => sum + Number(row.qty || 0), 0);
    const returnType = returnedBefore + returningQty >= soldQty ? "void" : "return";
    const refundTotal = round2(normalized.reduce((sum, row) => sum + Number(row.lineTotal || 0), 0));
    const settingsRef = tenantDoc(tenantId, "settings", "loyalty");
    const settingsSnapshot = await transaction.get(settingsRef);
    const planned = loyaltyPlan(sale, refundTotal, settingsSnapshot.exists() ? settingsSnapshot.data() : {});

    let bundle = null;
    if (planned?.customerId) {
      const cachedCustomer = customers.find(row => String(row.id || "") === String(planned.customerId));
      const customerRef = tenantDoc(tenantId, "customers", cachedCustomer?._documentId || planned.customerId);
      const customerSnapshot = await transaction.get(customerRef);
      if (customerSnapshot.exists()) {
        const customer = snapshotRow(customerSnapshot);
        bundle = loyaltyBundle({ planned, customer, sale, returnId, refundTotal, createdAt, userId, tenantId });
        if (bundle) {
          transaction.set(customerRef, {
            ...bundle.updatedCustomer, tenantId, shopId: customer.shopId || tenantId,
            updatedAt: Date.now(), updatedAtServer: serverTimestamp(),
          }, { merge: true });
          transaction.set(tenantDoc(tenantId, "loyaltyLedger", bundle.ledger.id), {
            ...bundle.ledger, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp(),
          }, { merge: true });
        }
      }
    }
    const dateKey = dateKeyFrom(createdAt);
    const loyaltyAdjustment = bundle?.adjustment || null;
    const record = {
      id: returnId, saleId, saleNumber: sale.saleNumber || sale.number || sale.id || "",
      returnType, mode: returnType, returnDate: String(returnDate || createdAt.slice(0, 10)),
      createdAt, dateKey, monthKey: dateKey.slice(0, 6), refundMethod: String(refundMethod || "original"),
      reason: String(reason || "").trim(), note: String(note || "").trim(), refundTotal,
      items: normalized, loyaltyAdjustment, tenantId, shopId: tenantId, deviceId: deviceId(),
      schemaVersion: POS_FIRESTORE_VERSION, deleted: false, createdBy: userId, updatedBy: userId,
      updatedAt: Date.now(), createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp(),
    };
    transaction.set(returnRef, record);

    for (const { item, productRef, product, before, after } of productRows) {
      transaction.update(productRef, {
        stock: after, tenantId, shopId: product.shopId || tenantId,
        updatedAt: Date.now(), updatedAtServer: serverTimestamp(),
      });
      const movementId = safeId(`${returnId}_${item.productId}`);
      transaction.set(tenantDoc(tenantId, "stockMovements", movementId), {
        id: movementId, tenantId, shopId: tenantId, deviceId: deviceId(),
        schemaVersion: POS_FIRESTORE_VERSION, deleted: false, dateKey, monthKey: dateKey.slice(0, 6),
        productId: item.productId, productName: item.productName, type: returnType, direction: "in",
        qty: item.qty, before, after, stockBefore: before, stockAfter: after,
        note: `${returnType === "void" ? "ยกเลิกบิล" : "คืนสินค้า"} ${returnId} จาก ${record.saleNumber}`,
        referenceType: returnType, referenceId: returnId, referenceNumber: returnId,
        createdBy: userId, updatedBy: userId, createdAt, updatedAt: Date.now(),
        createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp(),
      }, { merge: true });
    }
    const summary = {
      id: returnId, returnType, refundTotal, createdAt,
      items: normalized.map(row => ({ productId: row.productId, qty: row.qty })), loyaltyAdjustment,
    };
    const saleTotal = Number(sale.totalAmount ?? sale.total ?? 0);
    const nextRefundTotal = round2(Number(sale.refundTotal || 0) + refundTotal);
    const refundStatus = nextRefundTotal >= saleTotal ? "fully_refunded" : "partially_refunded";
    const currentLoyalty = sale.loyalty || null;
    const updatedLoyalty = currentLoyalty && loyaltyAdjustment ? {
      ...currentLoyalty,
      pointsEarnedReversed: Number(currentLoyalty.pointsEarnedReversed || 0) + Number(loyaltyAdjustment.pointsEarnedDeducted || 0),
      pointsUsedRestored: Number(currentLoyalty.pointsUsedRestored || 0) + Number(loyaltyAdjustment.pointsUsedRestored || 0),
      pointsAfterReturns: loyaltyAdjustment.pointsAfter,
    } : currentLoyalty;
    transaction.set(saleRef, {
      returns: [...(sale.returns || []), summary], refundTotal: nextRefundTotal, refundStatus,
      status: returnType === "void" ? "voided" : sale.status, loyalty: updatedLoyalty,
      updatedAt: Date.now(), updatedAtServer: serverTimestamp(),
    }, { merge: true });

    const action = returnType === "void" ? "pos_sale_voided" : "pos_return_completed";
    const auditId = safeId(`${action}_${returnId}`);
    transaction.set(tenantDoc(tenantId, "auditLogs", auditId), {
      id: auditId, tenantId, shopId: tenantId, deviceId: deviceId(), schemaVersion: POS_FIRESTORE_VERSION,
      action, entityType: "return", entityId: returnId, entityNumber: returnId,
      createdBy: userId, updatedBy: userId, createdAt, updatedAt: Date.now(),
      summary: {
        saleId, saleNumber: record.saleNumber, refundTotal,
        totalQty: normalized.reduce((sum, row) => sum + Number(row.qty || 0), 0),
        refundMethod: record.refundMethod, returnType,
      },
    }, { merge: true });
    committed = record;
  });
  return committed;
}
