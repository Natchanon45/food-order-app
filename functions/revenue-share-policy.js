const BILLING_MODES = new Set(["subscription", "revenue_share"]);
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
    restaurantRevenueShareScope: businessType === "retail"
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
    tenant.revenueShareBusinessType
      || tenant.businessType
      || tenant.signupBusinessType
      || "both"
  );
  return {
    enabled,
    includeRestaurant: businessType === "restaurant_cafe" || businessType === "both",
    includeRetail: businessType === "retail" || businessType === "both",
    restaurantScope: businessType === "retail"
      ? "all"
      : normalizeRestaurantScope(tenant.revenueShareRestaurantScope || "all"),
  };
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
};
