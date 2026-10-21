"use strict";

// Read-only adapter between existing Delivery orders and the existing Hybrid
// calculator. It does not change orders, payment flows or tenant access.
const { calculateMonth } = require("./hybrid-billing-core");
const { paidDeliveryByDay } = require("./hybrid-billing-orders");

function previewDeliveryOnlyMonth({ orders, month, firstMonth = false, settings = {} }) {
  const dailyDeliverySales = paidDeliveryByDay(orders, month);
  return calculateMonth({ month, firstMonth, dailyDeliverySales, settings });
}

module.exports = { previewDeliveryOnlyMonth };
