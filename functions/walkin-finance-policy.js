"use strict";

// PENGUIN 2026-10-31 LUKKAJA parity: pure, private policy groundwork.
// THIS MODULE DOES NOT WRITE TO FIRESTORE AND ENABLES NO CALLABLE BY ITSELF.
// Callers must read the actual tenant/order/menu/table under one transaction
// and verify role, session, menu prices, table ownership and idempotency there.
const ACTIVE = new Set(["pending", "accepted", "cooking", "ready", "served"]);
const FINISHED = new Set(["paid", "cancelled", "completed", "voided", "deleted"]);
const CASHIER = new Set(["owner", "admin", "manager", "cashier", "super_admin"]);
const KITCHEN = new Set(["owner", "admin", "manager", "kitchen", "super_admin"]);
const REQ_ID = /^[a-zA-Z0-9_-]{8,128}$/;
const MAX_CENTS = 99999999999; // 999,999,999.99 THB

function reject(code) {
  const err = new Error(code);
  err.code = code;
  throw err;
}
function cents(input, code = "AMOUNT_INVALID") {
  if ((typeof input !== "number" && typeof input !== "string") ||
      String(input).trim() === "" || !Number.isFinite(Number(input))) reject(code);
  const n = Number(input);
  if (n < 0 || n > MAX_CENTS / 100 || Math.abs(Math.round(n * 100) - n * 100) > 1e-6) reject(code);
  return Math.round(n * 100);
}
function amount(c) {
  return c / 100;
}
function eligibleDeferred(order, role, kind = "cashier") {
  const allowed = kind === "kitchen" ? KITCHEN : CASHIER;
  if (!allowed.has(role)) reject("ROLE_FORBIDDEN");
  if (order?.orderType !== "walkin" ||
      order?.paymentTiming !== "after" ||
      order?.paymentMethod !== "cash" ||
      order?.paymentStatus !== "unpaid" ||
      order?.tableToken || order?.paidAt || order?.paymentReceivedAt ||
      order?.slipVerificationStatus || order?.refundStatus ||
      !["dine_in", "takeaway"].includes(order?.serviceType) ||
      (order.serviceType === "dine_in" && !String(order.tableCode || "").trim()) ||
      (order.serviceType === "takeaway" && String(order.tableCode || "").trim()) ||
      !ACTIVE.has(String(order.status || ""))) reject("DEFERRED_BILL_NOT_ELIGIBLE");
  return true;
}
function prepareWalkInPayment(body, total) {
  const method = body?.paymentMethod;
  const timing = body?.paymentTiming || "before";
  if (!["before", "after"].includes(timing)) reject("PAYMENT_TIMING_INVALID");
  if (timing === "after") {
    if (method !== "cash") reject("DEFERRED_CASH_ONLY");
    if (body.serviceType === "dine_in" && !String(body.tableCode || "").trim()) reject("TABLE_REQUIRED");
    if (body.cashReceived !== undefined && body.cashReceived !== null ||
        body.paymentStatus !== undefined || body.paidAt || body.paymentReceivedAt ||
        body.refundStatus || body.refundAmount) reject("DEFERRED_PAYMENT_FORGED");
    return { paymentTiming: "after", paymentStatus: "unpaid", paymentMethod: "cash" };
  }
  if (method !== "cash" && method !== "promptpay") reject("PAYMENT_METHOD_INVALID");
  if (method === "promptpay") reject("PROMPTPAY_REVIEW_REQUIRED");
  const received = cents(body.cashReceived, "CASH_RECEIVED_INVALID");
  const due = cents(total);
  if (received < due) reject("CASH_RECEIVED_INSUFFICIENT");
  return {
    paymentStatus: "paid", paymentMethod: "cash", paymentTiming: "before",
    cashReceived: amount(received), changeAmount: amount(received - due),
  };
}
function activeTotalCents(lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 500) reject("ORDER_ITEMS_INVALID");
  return lines.reduce((sum, line) => {
    const qty = Number(line?.qty);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 999) reject("ORDER_QUANTITY_INVALID");
    const unit = cents(line.price);
    const added = unit * qty;
    if (!Number.isSafeInteger(added) || added > MAX_CENTS) reject("ORDER_AMOUNT_EXCEEDED");
    const next = sum + (line.cancelled ? 0 : added);
    if (!Number.isSafeInteger(next) || next > MAX_CENTS) reject("ORDER_AMOUNT_EXCEEDED");
    return next;
  }, 0);
}
function addKitchenRound(order, role, operationId, requested, menuById, now) {
  eligibleDeferred(order, role, "cashier");
  if (!REQ_ID.test(operationId || "")) reject("OPERATION_ID_INVALID");
  if (!Array.isArray(requested) || !requested.length || requested.length > 100) reject("ORDER_ITEMS_REQUIRED");
  if (FINISHED.has(order.status)) reject("BILL_CLOSED");
  const previous = order.items;
  if (!Array.isArray(previous) || previous.length + requested.length > 500) reject("ORDER_ITEMS_INVALID");
  const operations = order.kitchenAddOperations || {};
  if (Object.hasOwn(operations, operationId)) return { duplicate: true, patch: null };
  if (Object.keys(operations).length >= 100) reject("OPERATION_LIMIT");
  const previousCents = activeTotalCents(previous);
  if (previousCents !== cents(order.totalAmount)) reject("ORIGINAL_TOTAL_MISMATCH");
  let added = 0;
  const lines = requested.map(row => {
    const id = String(row?.menuId || "");
    if (!REQ_ID.test(id)) reject("MENU_ID_INVALID");
    const qty = Number(row.qty);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 999) reject("ORDER_QUANTITY_INVALID");
    if (Object.keys(row).some(k => !["menuId","qty","note"].includes(k))) reject("CLIENT_PRICE_FORBIDDEN");
    const menu = menuById?.get(id);
    if (!menu || menu.active === false || menu.isActive === false) reject("MENU_NOT_AVAILABLE");
    const unit = cents(menu.price);
    const lineCents = unit * qty;
    if (!Number.isSafeInteger(lineCents) || lineCents > MAX_CENTS ||
        added + previousCents + lineCents > MAX_CENTS) reject("ORDER_AMOUNT_EXCEEDED");
    added += lineCents;
    return {
      menuId:id, name:String(menu.name || ""), price:amount(unit), qty,
      note:String(row.note || "").trim().slice(0,300),cancelled:false,
      served:false, kitchenAddOperationId:operationId,kitchenAddedAt:now,
    };
  });
  const old = order.status === "served"
    ? previous.map(line => line.cancelled ? {...line} : {...line,served:true,kitchenPreviouslyServed:true})
    : previous.map(line=>({...line}));
  return {
    duplicate:false,
    addedAmount: amount(added),
    patch: {
      items:[...old,...lines],
      totalAmount:amount(previousCents+added),
      subtotalAmount:amount(previousCents+added),
      kitchenAddOperations:{...operations,[operationId]:now},
      lastKitchenAddAt:now, status:"pending",
    }
  };
}
function settleDeferredWalkIn(order, role, receivedInput, expectedTotalInput, now) {
  eligibleDeferred(order,role,"cashier");
  if (order.status !== "served") reject("WAIT_FOR_KITCHEN");
  const due = cents(order.totalAmount);
  if (due !== activeTotalCents(order.items)) reject("TOTAL_MISMATCH");
  if (expectedTotalInput === undefined || due !== cents(expectedTotalInput)) reject("STALE_CASHIER_TOTAL");
  if (order.items.some(line=>line.cancelled !== true && line.served !== true)) reject("WAIT_FOR_KITCHEN");
  const received = cents(receivedInput, "CASH_RECEIVED_INVALID");
  if (received < due) reject("CASH_RECEIVED_INSUFFICIENT");
  return {
    paymentStatus:"paid",status:"paid",paidAt:now,paymentReceivedAt:now,
    cashReceived:amount(received), changeAmount:amount(received-due),completedAt:now,
  };
}
function cancelDeferredWalkIn(order, role, source, now) {
  if (!["cashier","kitchen"].includes(source)) reject("CANCELLATION_SOURCE_INVALID");
  eligibleDeferred(order,role,source);
  const due = cents(order.totalAmount);
  if (due !== activeTotalCents(order.items)) reject("TOTAL_MISMATCH");
  return {
    status:"cancelled", cancelledAt:now, cancellationSource:source,
    cancelledNetAmount:amount(due),
    // paymentStatus is intentionally unchanged. Never fabricate a refund.
  };
}
function cancelDeferredItem(order, role, index, now) {
  eligibleDeferred(order,role,"kitchen");
  if (!Number.isSafeInteger(index) || index < 0 || index >= order.items?.length) reject("ITEM_NOT_FOUND");
  if (order.items[index]?.cancelled) reject("ITEM_ALREADY_CANCELLED");
  if (activeTotalCents(order.items) !== cents(order.totalAmount)) reject("TOTAL_MISMATCH");
  const items=order.items.map((line,i)=>i===index ? {...line,cancelled:true,cancelledAt:now,cancellationSource:"kitchen"} : {...line});
  const remaining=activeTotalCents(items);
  return {
    items,totalAmount:amount(remaining),subtotalAmount:amount(remaining),
    ...(remaining===0 ? {status:"cancelled",cancelledAt:now,cancellationSource:"kitchen"} : {}),
    originalUnpaidTotal:order.originalUnpaidTotal ?? order.totalAmount,
  };
}
module.exports={
  prepareWalkInPayment,eligibleDeferred,activeTotalCents,addKitchenRound,
  settleDeferredWalkIn,cancelDeferredWalkIn,cancelDeferredItem,
};
