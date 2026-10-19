"use strict";

const { dateKey } = require("./hybrid-billing-core");

const CANCELED = new Set(["cancelled", "canceled", "voided", "deleted", "refunded"]);
const toCents = value => {
  const n = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(n) || n < 0 || n > 1e9) return null;
  const cents = Math.round(n * 100);
  if (Math.abs(cents - n * 100) > 0.00001) return null;
  return cents;
};
function asDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d : null;
  }
  return null; // A client-controlled string date must not be trusted as the payment timestamp.
}

/**
 * Single authoritative order-to-revenue mapping.
 * Both subtotalAmount and (totalAmount - deliveryFee) are server-created order fields;
 * use the lower figure to avoid charging for discounts or shipping twice.
 * A fully refunded/cancelled delivery contributes nothing.
 * Partial refunds are deducted from the merchandise base, not from POS.
 * Missing/invalid/ambiguous paid order amounts abort reconciliation instead of charging a guess.
 */
function paidDeliverySale(order) {
  if (!order || String(order.orderType || "").toLowerCase() !== "delivery") return null;
  if (String(order.paymentStatus || "").toLowerCase() !== "paid") return null;
  if (CANCELED.has(String(order.status || "").toLowerCase())) return null;
  const paidAt = asDate(order.paidAt);
  if (!paidAt) throw new Error("HYBRID_PAID_DELIVERY_MISSING_SERVER_TIMESTAMP");
  const total = toCents(order.totalAmount ?? order.total);
  const shipping = toCents(order.deliveryFee ?? 0);
  const subtotal = toCents(order.subtotalAmount);
  if (total === null || shipping === null || shipping > total) {
    throw new Error("HYBRID_DELIVERY_INVALID_TOTAL_OR_SHIPPING");
  }
  if (subtotal === null && order.subtotalAmount !== undefined) {
    throw new Error("HYBRID_DELIVERY_INVALID_SUBTOTAL");
  }
  // The price paid for goods can never exceed total received minus shipping.
  const merchandise = subtotal === null ? total - shipping : Math.min(subtotal, total - shipping);
  const refund = toCents(order.refundTotal ?? order.refundedAmount ?? order.refundAmount ?? 0);
  if (refund === null) throw new Error("HYBRID_DELIVERY_INVALID_REFUND");
  return { date: dateKey(paidAt), amount: Math.max(0, merchandise - refund) / 100 };
}

function paidDeliveryByDay(orders, month) {
  if (!Array.isArray(orders)) throw new TypeError("orders must be an array");
  const map = new Map();
  for (const order of orders) {
    const sale = paidDeliverySale(order);
    if (!sale || !sale.date.startsWith(month + "-")) continue;
    map.set(sale.date, (map.get(sale.date) || 0) + Math.round(sale.amount * 100));
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, cents]) => ({ date, amount: cents / 100 }));
}
module.exports = { paidDeliverySale, paidDeliveryByDay };
