import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

export const DEFAULT_SUBSCRIPTION_PRICING = Object.freeze({
  planId: "premium",
  currency: "THB",
  monthlyPrice: 590,
  annualMonths: 12,
  discountType: "amount",
  discountValue: 1180,
  vatMode: "inclusive",
  vatRate: 7,
});

const round2 = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeSubscriptionPricing(input = {}) {
  return {
    planId: "premium",
    currency: "THB",
    monthlyPrice: Math.max(0, round2(finite(input.monthlyPrice, 590))),
    annualMonths: Math.max(1, Math.round(finite(input.annualMonths, 12))),
    discountType: ["none", "amount", "percent"].includes(String(input.discountType || ""))
      ? String(input.discountType) : "amount",
    discountValue: Math.max(0, round2(finite(input.discountValue, 1180))),
    vatMode: ["inclusive", "exclusive", "none"].includes(String(input.vatMode || ""))
      ? String(input.vatMode) : "inclusive",
    vatRate: String(input.vatMode || "") === "none"
      ? 0
      : Math.max(0, round2(finite(input.vatRate, 7))),
  };
}

export function calculateSubscriptionPricing(input = {}) {
  const config = normalizeSubscriptionPricing(input);
  const regular = round2(config.monthlyPrice * config.annualMonths);
  let discount = 0;
  if (config.discountType === "amount") discount = Math.min(regular, config.discountValue);
  if (config.discountType === "percent") {
    discount = round2(regular * Math.min(100, config.discountValue) / 100);
  }
  const discounted = round2(Math.max(0, regular - discount));
  const breakdown = configured => {
    if (config.vatMode === "none") {
      return { configured, net: configured, vat: 0, payable: configured };
    }
    if (config.vatMode === "exclusive") {
      const vat = round2(configured * config.vatRate / 100);
      return { configured, net: configured, vat, payable: round2(configured + vat) };
    }
    const net = config.vatRate > 0
      ? round2(configured / (1 + config.vatRate / 100))
      : configured;
    return { configured, net, vat: round2(configured - net), payable: configured };
  };
  const monthly = breakdown(config.monthlyPrice);
  const annualRegular = breakdown(regular);
  const annual = breakdown(discounted);
  return {
    config,
    monthly,
    annual: {
      ...annual,
      regularConfigured: regular,
      regularPayable: annualRegular.payable,
      discountConfigured: discount,
      discountPayable: round2(annualRegular.payable - annual.payable),
    },
  };
}

export async function loadPublicSubscriptionPricing() {
  try {
    const response = await httpsCallable(functions, "getPublicSubscriptionPricing")({});
    const config = normalizeSubscriptionPricing(response?.data?.config || DEFAULT_SUBSCRIPTION_PRICING);
    return { config, pricing: calculateSubscriptionPricing(config), source: "remote" };
  } catch (error) {
    console.warn("SUBSCRIPTION_PRICING_FALLBACK", error?.code || error?.message || error);
    const config = normalizeSubscriptionPricing(DEFAULT_SUBSCRIPTION_PRICING);
    return { config, pricing: calculateSubscriptionPricing(config), source: "fallback" };
  }
}

export function formatSubscriptionMoney(value, locale = "th-TH") {
  const amount = round2(value);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function loadAdminSubscriptionPricing() {
  const response = await httpsCallable(functions, "getSubscriptionPricing")({});
  const config = normalizeSubscriptionPricing(response?.data?.config || DEFAULT_SUBSCRIPTION_PRICING);
  return {
    exists: response?.data?.exists === true,
    config,
    pricing: calculateSubscriptionPricing(config),
  };
}

export async function saveAdminSubscriptionPricing(input = {}) {
  const config = normalizeSubscriptionPricing(input);
  const response = await httpsCallable(functions, "updateSubscriptionPricing")(config);
  const saved = normalizeSubscriptionPricing(response?.data?.config || config);
  return { config: saved, pricing: calculateSubscriptionPricing(saved) };
}

export function subscriptionVatLabel(config, t, formatNumber) {
  if (config.vatMode === "none") return t("platform.pricing.vat_none_label");
  return config.vatMode === "inclusive"
    ? t("platform.pricing.vat_included_label", { rate: formatNumber(config.vatRate) })
    : t("platform.pricing.vat_excluded_label", { rate: formatNumber(config.vatRate) });
}
