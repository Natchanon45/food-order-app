const PRICING_DOC = Object.freeze({ collection: "platformSettings", id: "subscriptionPricing" });
const DEFAULT_PRICING = Object.freeze({
  planId: "premium",
  currency: "THB",
  monthlyPrice: 590,
  annualMonths: 12,
  discountType: "amount",
  discountValue: 1180,
  vatMode: "inclusive",
  vatRate: 7,
});

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}
function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function normalizePricing(input = {}) {
  const discountType = ["none", "amount", "percent"].includes(String(input.discountType || ""))
    ? String(input.discountType) : DEFAULT_PRICING.discountType;
  const vatMode = ["inclusive", "exclusive", "none"].includes(String(input.vatMode || ""))
    ? String(input.vatMode) : DEFAULT_PRICING.vatMode;
  return {
    planId: "premium",
    currency: "THB",
    monthlyPrice: Math.max(0, round2(finite(input.monthlyPrice, DEFAULT_PRICING.monthlyPrice))),
    annualMonths: Math.max(1, Math.round(finite(input.annualMonths, DEFAULT_PRICING.annualMonths))),
    discountType,
    discountValue: Math.max(0, round2(finite(input.discountValue, DEFAULT_PRICING.discountValue))),
    vatMode,
    vatRate: vatMode === "none"
      ? 0
      : Math.max(0, round2(finite(input.vatRate, DEFAULT_PRICING.vatRate))),
  };
}

function calculatePricing(input = {}) {
  const config = normalizePricing(input);
  const annualRegularConfigured = round2(config.monthlyPrice * config.annualMonths);
  let discountConfigured = 0;
  if (config.discountType === "amount") discountConfigured = Math.min(annualRegularConfigured, config.discountValue);
  if (config.discountType === "percent") {
    discountConfigured = round2(annualRegularConfigured * Math.min(100, config.discountValue) / 100);
  }
  const annualDiscountedConfigured = round2(Math.max(0, annualRegularConfigured - discountConfigured));
  const taxFactor = 1 + (config.vatRate / 100);
  const breakdown = configured => {
    if (config.vatMode === "none") {
      return { configured, net: configured, vat: 0, payable: configured };
    }
    if (config.vatMode === "exclusive") {
      const vat = round2(configured * config.vatRate / 100);
      return { configured, net: configured, vat, payable: round2(configured + vat) };
    }
    const net = config.vatRate > 0 ? round2(configured / taxFactor) : configured;
    return { configured, net, vat: round2(configured - net), payable: configured };
  };
  const monthly = breakdown(config.monthlyPrice);
  const annualRegular = breakdown(annualRegularConfigured);
  const annual = breakdown(annualDiscountedConfigured);
  return {
    config,
    monthly,
    annual: {
      ...annual,
      regularConfigured: annualRegularConfigured,
      regularPayable: annualRegular.payable,
      discountConfigured,
      discountPayable: round2(annualRegular.payable - annual.payable),
    },
  };
}

async function loadPricing(db) {
  const snapshot = await db.collection(PRICING_DOC.collection).doc(PRICING_DOC.id).get();
  return normalizePricing(snapshot.exists ? snapshot.data() : DEFAULT_PRICING);
}

function pricingSnapshot(config = DEFAULT_PRICING) {
  const calculated = calculatePricing(config);
  return { ...calculated.config, monthly: calculated.monthly, annual: calculated.annual };
}

module.exports = { PRICING_DOC, DEFAULT_PRICING, normalizePricing, calculatePricing, loadPricing, pricingSnapshot };
