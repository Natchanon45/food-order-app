const BILLING_MODES = new Set(["subscription", "revenue_share", "hybrid"]);
const BUSINESS_TYPES = new Set(["restaurant_cafe", "retail", "both"]);
const RESTAURANT_SCOPES = new Set(["delivery_only", "storefront_only", "all"]);
const PLAN_CODES = new Set(["monthly", "yearly"]);

function clean(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeBillingMode(value) {
  const mode = clean(value);
  return BILLING_MODES.has(mode) ? mode : "subscription";
}

function normalizeBusinessType(value) {
  const type = clean(value);
  return BUSINESS_TYPES.has(type) ? type : "both";
}

function normalizeRestaurantScope(value) {
  const scope = clean(value);
  return RESTAURANT_SCOPES.has(scope) ? scope : "all";
}

function normalizePlanCode(value) {
  const plan = clean(value);
  return PLAN_CODES.has(plan) ? plan : "monthly";
}

function signupBillingSelectionValid(input = {}) {
  const billingMode = clean(input.billingMode);
  const businessType = clean(input.businessType);
  if (!BILLING_MODES.has(billingMode) || !BUSINESS_TYPES.has(businessType)) return false;
  if (billingMode === "hybrid") return true;
  if (billingMode === "subscription") return PLAN_CODES.has(clean(input.planCode));
  if (businessType !== "retail" && !RESTAURANT_SCOPES.has(clean(input.restaurantRevenueShareScope))) return false;
  return true;
}

function normalizeSignupBilling(input = {}) {
  const billingMode = normalizeBillingMode(input.billingMode);
  const businessType = normalizeBusinessType(input.businessType);
  return {
    billingMode,
    businessType,
    planCode: normalizePlanCode(input.planCode),
    restaurantRevenueShareScope: billingMode === "hybrid"
      ? "delivery_only"
      : businessType === "retail"
      ? "all"
      : normalizeRestaurantScope(input.restaurantRevenueShareScope),
  };
}

function businessUnitsFor(value) {
  const type = normalizeBusinessType(value);
  if (type === "restaurant_cafe") return ["order_delivery"];
  if (type === "retail") return ["retail_pos"];
  return ["order_delivery", "retail_pos"];
}

function restaurantOrderEligible(orderType, scope = "all") {
  const normalizedType = clean(orderType);
  const normalizedScope = normalizeRestaurantScope(scope);
  if (normalizedScope === "delivery_only") return normalizedType === "delivery";
  if (normalizedScope === "storefront_only") return normalizedType !== "delivery";
  return true;
}

function revenueShareChannels(tenant = {}) {
  const enabled = tenant.revenueShareEnabled === true || clean(tenant.billingMode) === "revenue_share";
  const businessType = normalizeBusinessType(
    tenant.businessType || tenant.signupBilling?.businessType || tenant.revenueShareBusinessType || "both"
  );
  const restaurantScope = businessType === "retail" ? "all"
    : normalizeRestaurantScope(tenant.revenueShareRestaurantScope || "all");
  return {
    enabled,
    includeRestaurant: businessType === "restaurant_cafe" || businessType === "both",
    includeRetail: businessType === "retail" || (businessType === "both" && restaurantScope !== "delivery_only"),
    restaurantScope,
  };
}

// Only paid Delivery goods count toward the monthly threshold.
// The day the monthly threshold is reached (100%) and later days qualify;
// previous days are never charged.
function eligibleDeliveryShareDays(dailyDeliverySales = [], threshold = 10000) {
  const money = Number(threshold);
  if (!Number.isFinite(money) || money < 0 || money > 1000000000
    || Math.abs(money * 100 - Math.round(money * 100)) > 0.00001) {
    throw new RangeError("Invalid Delivery share threshold");
  }
  const thresholdCents = Math.round(money * 100);
  const byDay = new Map();
  for (const item of dailyDeliverySales) {
    const date = String(item?.date || "");
    const cents = item?.cents;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isSafeInteger(cents) || cents < 0) {
      throw new TypeError("Invalid paid Delivery daily amount");
    }
    byDay.set(date, (byDay.get(date) || 0) + cents);
  }
  const monthlyTotals = new Map();
  const days = new Set();
  for (const [date, cents] of [...byDay].sort((a, b) => a[0].localeCompare(b[0]))) {
    const month = date.slice(0, 7);
    const total = (monthlyTotals.get(month) || 0) + cents;
    monthlyTotals.set(month, total);
    if (cents > 0 && total >= thresholdCents) days.add(date);
  }
  return days;
}

module.exports = {
  BILLING_MODES,
  BUSINESS_TYPES,
  RESTAURANT_SCOPES,
  PLAN_CODES,
  normalizeBillingMode,
  normalizeBusinessType,
  normalizeRestaurantScope,
  normalizePlanCode,
  signupBillingSelectionValid,
  normalizeSignupBilling,
  businessUnitsFor,
  restaurantOrderEligible,
  revenueShareChannels,
  eligibleDeliveryShareDays,
};
