"use strict";

function isLalamoveCodOrder(order = {}) {
  return String(order.paymentMethod || "").toLowerCase() === "cod"
    && order.lalamoveCodEnabled === true;
}

function lalamoveCompletionPatch(order = {}, providerStatus = "", completedAt = new Date().toISOString()) {
  const status = String(providerStatus || order.lalamoveOrderStatus || "").trim().toUpperCase();
  if (status !== "COMPLETED") return {};

  const timestamp = String(completedAt || new Date().toISOString());
  const isCod = isLalamoveCodOrder(order);
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();

  const patch = {
    lalamoveCompletedAt: order.lalamoveCompletedAt || timestamp,
  };

  // Delivery fulfillment is complete. Close the operational order so Cashier/Kitchen
  // no longer keep it in their active queues. Payment settlement remains independent.
  if (isCod) {
    patch.status = "completed";
    patch.completedAt = order.completedAt || timestamp;
    patch.lalamoveCodDeliveryCompletedAt = order.lalamoveCodDeliveryCompletedAt || timestamp;
    patch.lalamoveCodSettlementStatus = String(order.lalamoveCodSettlementStatus || "pending");
    // Do not set paymentStatus/paidAt here. Lalamove COMPLETED means delivery finished;
    // it does not prove COD funds have been remitted/settled to the merchant.
  } else if (paymentStatus === "paid") {
    patch.status = "paid";
    patch.completedAt = order.completedAt || timestamp;
  }

  return patch;
}

function lalamoveCompletionNeedsRepair(order = {}) {
  if (String(order.lalamoveOrderStatus || "").trim().toUpperCase() !== "COMPLETED") return false;
  if (!order.lalamoveCompletedAt) return true;

  const isCod = isLalamoveCodOrder(order);
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  const orderStatus = String(order.status || "").toLowerCase();
  if (isCod && (orderStatus !== "completed" || !order.completedAt)) return true;
  if (!isCod && paymentStatus === "paid" && (orderStatus !== "paid" || !order.completedAt)) return true;

  if (isCod && (!order.lalamoveCodDeliveryCompletedAt || !order.lalamoveCodSettlementStatus)) return true;
  return false;
}

module.exports = {
  isLalamoveCodOrder,
  lalamoveCompletionPatch,
  lalamoveCompletionNeedsRepair,
};
