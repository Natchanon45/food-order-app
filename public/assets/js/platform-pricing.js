import translations from "./platform-pricing-translations.js?v=20260920-001";
import { configureI18n, applyTranslations, getIntlLocale, t } from "./i18n.js?v=20260903-202";
import { toast } from "./ui.js?v=20260920-003";
import { getSubscriptionPricing, updateSubscriptionPricing } from "./platform-tenant-service.js?v=20260920-001";
import {
  DEFAULT_SUBSCRIPTION_PRICING,
  calculateSubscriptionPricing,
  formatSubscriptionMoney,
  subscriptionVatLabel,
} from "./subscription-pricing-client.js?v=20260920-001";

configureI18n(translations);
applyTranslations();
document.title = t("pricing.meta.title");

const form = document.querySelector("#pricingForm");
const monthly = document.querySelector("#pricingMonthlyPrice");
const months = document.querySelector("#pricingAnnualMonths");
const discountType = document.querySelector("#pricingDiscountType");
const discountValue = document.querySelector("#pricingDiscountValue");
const vatMode = document.querySelector("#pricingVatMode");
const vatRate = document.querySelector("#pricingVatRate");
const saveButton = document.querySelector("#pricingSave");
const resetButton = document.querySelector("#pricingReset");
const nodes = {
  monthly: document.querySelector("#previewMonthly"),
  regular: document.querySelector("#previewRegular"),
  regularBreakdown: document.querySelector("#previewRegularBreakdown"),
  discounted: document.querySelector("#previewDiscounted"),
  discount: document.querySelector("#previewDiscount"),
  net: document.querySelector("#previewNet"),
  vat: document.querySelector("#previewVat"),
  payable: document.querySelector("#previewPayable"),
  vatLabel: document.querySelector("#previewVatLabel"),
};

function payload() {
  return {
    monthlyPrice: Number(monthly.value || 0),
    annualMonths: Number(months.value || 12),
    discountType: discountType.value,
    discountValue: Number(discountValue.value || 0),
    vatMode: vatMode.value,
    vatRate: Number(vatRate.value || 0),
  };
}

function money(value) { return `${formatSubscriptionMoney(value, getIntlLocale())} ฿`; }

function renderPreview() {
  const result = calculateSubscriptionPricing(payload());
  const { config, monthly: monthlyPrice, annual } = result;
  nodes.monthly.textContent = money(monthlyPrice.configured);
  nodes.regular.textContent = money(annual.regularConfigured);
  nodes.regular.hidden = annual.discountConfigured <= 0.009;
  nodes.regularBreakdown.textContent = money(annual.regularConfigured);
  nodes.discounted.textContent = money(annual.configured);
  nodes.discount.textContent = `- ${money(annual.discountConfigured)}`;
  nodes.net.textContent = money(annual.net);
  nodes.vat.textContent = money(annual.vat);
  nodes.payable.textContent = money(annual.payable);
  nodes.vatLabel.textContent = subscriptionVatLabel(config, document.documentElement.lang || "th");
  discountValue.disabled = discountType.value === "none";
  discountValue.step = discountType.value === "percent" ? "0.01" : "1";
  discountValue.max = discountType.value === "percent" ? "100" : String(result.annual.regularConfigured);
  document.querySelector("#discountValueSuffix").textContent = discountType.value === "percent" ? "%" : (document.documentElement.lang === "en" ? "THB" : "บาท");
}

function fill(config) {
  monthly.value = config.monthlyPrice;
  months.value = config.annualMonths;
  discountType.value = config.discountType;
  discountValue.value = config.discountValue;
  vatMode.value = config.vatMode;
  vatRate.value = config.vatRate;
  renderPreview();
}

async function load() {
  try {
    const response = await getSubscriptionPricing();
    fill(response.data?.config || DEFAULT_SUBSCRIPTION_PRICING);
  } catch (error) {
    console.error(error);
    fill(DEFAULT_SUBSCRIPTION_PRICING);
    toast(t("pricing.toast.loadFailed"), "error");
  }
}
form.addEventListener("input", renderPreview);
form.addEventListener("change", renderPreview);
resetButton.addEventListener("click", () => fill(DEFAULT_SUBSCRIPTION_PRICING));
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  saveButton.disabled = true;
  const original = saveButton.textContent;
  saveButton.textContent = t("pricing.form.saving");
  try {
    const response = await updateSubscriptionPricing(payload());
    fill(response.data?.config || payload());
    toast(t("pricing.toast.saved"));
  } catch (error) {
    console.error(error);
    toast(t("pricing.toast.failed"), "error");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = original;
  }
});

await load();
