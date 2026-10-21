"use strict";

// Read-only adapter between existing Delivery orders and the existing Hybrid
// calculator. It does not change orders, payment flows or tenant access.
const { calculateMonth, calculateCycle, billingCycleById, validDate } = require("./hybrid-billing-core");
const { paidDeliveryByDay, paidDeliveryByWindow } = require("./hybrid-billing-orders");

function previewDeliveryOnlyMonth({ orders, month, firstMonth = false, settings = {} }) {
  const dailyDeliverySales = paidDeliveryByDay(orders, month);
  return calculateMonth({ month, firstMonth, dailyDeliverySales, settings });
}


function previewDeliveryOnlyCycle({ orders, signupDate, cycleId, throughDate, settings = {} }) {
  const cycle = billingCycleById(signupDate, cycleId);
  let lastDateExclusive = cycle.endDate;
  if (throughDate !== undefined) {
    const day = validDate(throughDate);
    if (day < cycle.startDate || day >= cycle.endDate) {
      throw new RangeError("Selected day is outside the billing cycle");
    }
    // Sum only receipts on or before the selected Bangkok day.
    const followingDay = new Date(Date.parse(day + "T00:00:00Z") + 86400000)
      .toISOString().slice(0, 10);
    lastDateExclusive = followingDay < cycle.endDate ? followingDay : cycle.endDate;
  }
  const dailyDeliverySales = paidDeliveryByWindow(orders, cycle.startDate, lastDateExclusive);
  return calculateCycle({ signupDate, cycleId, dailyDeliverySales, settings });
}

module.exports = { previewDeliveryOnlyMonth, previewDeliveryOnlyCycle };

