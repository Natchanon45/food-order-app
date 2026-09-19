import {
  loadPublicSubscriptionPricing,
  formatSubscriptionMoney,
  subscriptionVatLabel,
} from "./subscription-pricing-client.js?v=20260920-001";
import { getIntlLocale, getLocale } from "./i18n.js?v=20260903-202";

function money(value) { return `${formatSubscriptionMoney(value, getIntlLocale())}฿`; }

function annualMarkup(config, annual) {
  const discount = annual.discountConfigured > 0.009;
  const oldPrice = discount ? `<span class="public-price-old">${money(annual.regularConfigured)}</span>` : "";
  const current = `<strong class="public-price-current">${money(annual.configured)}</strong>`;
  const discountText = discount
    ? (config.discountType === "percent" ? `ลด ${formatSubscriptionMoney(config.discountValue, getIntlLocale())}%` : `ลด ${money(annual.discountConfigured)}`)
    : "";
  const vatText = config.vatMode === "exclusive"
    ? `${subscriptionVatLabel(config, getLocale())} • ${getLocale() === "en" ? "payable" : "รวมชำระ"} ${money(annual.payable)}`
    : subscriptionVatLabel(config, getLocale());
  return `${oldPrice}${current}${discountText ? `<small>${discountText}</small>` : ""}<small>${vatText}</small>`;
}

async function render() {
  const { config, pricing } = await loadPublicSubscriptionPricing();
  const monthlyAmount = document.querySelector("#homePremiumMonthlyAmount");
  const vat = document.querySelector("#homePremiumVat");
  const annual = document.querySelector("#homePremiumAnnualPromo");
  if (monthlyAmount) monthlyAmount.textContent = money(pricing.monthly.configured);
  if (vat) vat.textContent = config.vatMode === "exclusive"
    ? `${subscriptionVatLabel(config, getLocale())} • ${getLocale() === "en" ? "payable" : "รวมชำระ"} ${money(pricing.monthly.payable)}`
    : subscriptionVatLabel(config, getLocale());
  if (annual) annual.innerHTML = annualMarkup(config, pricing.annual);
}

render().catch(error => console.warn("PUBLIC_PRICING_RENDER_FAILED", error));
