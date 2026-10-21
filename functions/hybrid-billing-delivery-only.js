"use strict";

// Read-only adapter between existing Delivery orders and the existing Hybrid
// calculator. It does not change orders, payment flows or tenant access.
const { calculateMonth, calculateCycle, billingCycleById } = require("./hybrid-billing-core");
const { paidDeliveryByDay, paidDeliveryByWindow } = require("./hybrid-billing-orders");

function previewDeliveryOnlyMonth({ orders, month, firstMonth = false, settings = {} }) {
  const dailyDeliverySales = paidDeliveryByDay(orders, month);
  return calculateMonth({ month, firstMonth, dailyDeliverySales, settings });
}


function previewDeliveryOnlyCycle({ orders, signupDate, cycleId, settings = {} }) {
  const cycle = billingCycleById(signupDate, cycleId);
  const dailyDeliverySales = paidDeliveryByWindow(orders, cycle.startDate, cycle.endDate);
  return calculateCycle({ signupDate, cycleId, dailyDeliverySales, settings });
}

module.exports = { previewDeliveryOnlyMonth, previewDeliveryOnlyCycle };

