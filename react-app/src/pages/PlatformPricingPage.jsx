import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import {
  DEFAULT_SUBSCRIPTION_PRICING,
  calculateSubscriptionPricing,
  formatSubscriptionMoney,
  loadAdminSubscriptionPricing,
  normalizeSubscriptionPricing,
  saveAdminSubscriptionPricing,
  subscriptionVatLabel,
} from "@/data/subscriptionPricing";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `app-toast ${type === "error" ? "error" : "success"}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `<span class="app-toast-icon" aria-hidden="true"><i class="bi bi-${type === "error" ? "x-circle" : "check-circle"} app-icon"></i></span><span class="app-toast-message"></span>`;
  el.querySelector(".app-toast-message").textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  window.setTimeout(() => {
    el.classList.remove("show");
    window.setTimeout(() => el.remove(), 250);
  }, 3200);
}

export function PlatformPricingPage() {
  const authState = useAuth();
  const { profile } = authState;
  const { t, intlLocale, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("platform.pricing.meta_title"),
    bodyClass: "platform-pricing-page",
    styles: ["platform-pricing-page.css", "super-admin-header.css"],
    attributes: { "data-roles": "super_admin" },
  });
  const [config, setConfig] = useState(DEFAULT_SUBSCRIPTION_PRICING);
  const [loading, setLoading] = useState(true);
  const [initialReady, setInitialReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const lastVatRate = useRef(7);

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await loadAdminSubscriptionPricing();
      setConfig(data.config);
      if (Number(data.config.vatRate) > 0) lastVatRate.current = Number(data.config.vatRate);
    } catch (error) {
      console.error("PLATFORM_PRICING_LOAD_FAILED", error);
      setConfig(DEFAULT_SUBSCRIPTION_PRICING);
      setMessage("");
      showToast(t("platform.pricing.load_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role !== "super_admin") return undefined;
    let alive = true;
    setInitialReady(false);
    load().finally(() => { if (alive) setInitialReady(true); });
    return () => { alive = false; };
  }, [profile?.role]);

  const update = patch => {
    setConfig(current => normalizeSubscriptionPricing({ ...current, ...patch }));
  };

  const setVatMode = mode => {
    setConfig(current => {
      const currentRate = Number(current.vatRate || 0);
      if (mode === "none") {
        if (currentRate > 0) lastVatRate.current = currentRate;
        return normalizeSubscriptionPricing({ ...current, vatMode: "none", vatRate: 0 });
      }
      return normalizeSubscriptionPricing({
        ...current,
        vatMode: mode,
        vatRate: currentRate > 0 ? currentRate : (lastVatRate.current > 0 ? lastVatRate.current : 7),
      });
    });
  };

  const reset = () => {
    lastVatRate.current = DEFAULT_SUBSCRIPTION_PRICING.vatRate;
    setConfig(DEFAULT_SUBSCRIPTION_PRICING);
    setMessage("");
  };

  const result = useMemo(() => calculateSubscriptionPricing(config), [config]);
  const money = value => `${formatSubscriptionMoney(value, intlLocale)} ฿`;
  const vatLabel = subscriptionVatLabel(result.config, t, value => formatNumber(value, { maximumFractionDigits: 2 }));

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const data = await saveAdminSubscriptionPricing(config);
      setConfig(data.config);
      if (Number(data.config.vatRate) > 0) lastVatRate.current = Number(data.config.vatRate);
      setMessage("");
      showToast(t("platform.pricing.save_success"));
    } catch (error) {
      console.error("PLATFORM_PRICING_SAVE_FAILED", error);
      setMessage("");
      showToast(t("platform.pricing.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (authState.status === "loading" || !stylesReady || (profile?.role === "super_admin" && !initialReady)) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fplatform%2Fpricing" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="super-admin-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><span>{t("platform.pricing.header_title")}</span></div>
          <Link className="btn btn-sm super-admin-header-back" to="/platform"><i className="bi bi-arrow-left" aria-hidden="true"></i><span>{t("platform.pricing.back")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main className="platform-pricing-shell">
        <section className="hero">
          <h1>{t("platform.pricing.hero_title")}</h1>
          <p>{t("platform.pricing.hero_description")}</p>
        </section>

        <section className="platform-pricing-grid">
          <form id="pricingForm" className="card platform-pricing-form-card" onSubmit={submit}>
            <div className="section-title"><h2>Premium</h2></div>
            <div className="platform-pricing-fields">
              <label>
                <span>{t("platform.pricing.monthly")}</span>
                <input id="pricingMonthlyPrice" type="number" min="0.01" max="1000000" step="0.01" required value={config.monthlyPrice} onChange={e => update({ monthlyPrice: e.target.value })} />
              </label>
              <label>
                <span>{t("platform.pricing.months")}</span>
                <input id="pricingAnnualMonths" type="number" min="1" max="60" step="1" required value={config.annualMonths} onChange={e => update({ annualMonths: e.target.value })} />
              </label>
              <label>
                <span>{t("platform.pricing.discount_type")}</span>
                <select id="pricingDiscountType" value={config.discountType} onChange={e => update({ discountType: e.target.value })}>
                  <option value="none">{t("platform.pricing.discount_none")}</option>
                  <option value="amount">{t("platform.pricing.discount_amount")}</option>
                  <option value="percent">{t("platform.pricing.discount_percent")}</option>
                </select>
              </label>
              <label>
                <span>{t("platform.pricing.discount_value")}</span>
                <span className="platform-pricing-inline-input">
                  <input
                    id="pricingDiscountValue"
                    type="number"
                    min="0"
                    step={config.discountType === "percent" ? "0.01" : "1"}
                    max={config.discountType === "percent" ? "100" : String(result.annual.regularConfigured)}
                    disabled={config.discountType === "none"}
                    value={config.discountValue}
                    onChange={e => update({ discountValue: e.target.value })}
                  />
                  <span id="discountValueSuffix">{config.discountType === "percent" ? "%" : t("platform.pricing.baht")}</span>
                </span>
              </label>
              <label>
                <span>{t("platform.pricing.vat_mode")}</span>
                <select id="pricingVatMode" value={config.vatMode} onChange={e => setVatMode(e.target.value)}>
                  <option value="inclusive">{t("platform.pricing.vat_inclusive")}</option>
                  <option value="exclusive">{t("platform.pricing.vat_exclusive")}</option>
                  <option value="none">{t("platform.pricing.vat_none")}</option>
                </select>
              </label>
              <label>
                <span>{t("platform.pricing.vat_rate")}</span>
                <input
                  id="pricingVatRate"
                  type="number"
                  min="0"
                  max="30"
                  step="0.01"
                  required={config.vatMode !== "none"}
                  disabled={config.vatMode === "none"}
                  value={config.vatRate}
                  onChange={e => {
                    const value = Number(e.target.value || 0);
                    if (value > 0) lastVatRate.current = value;
                    update({ vatRate: value });
                  }}
                />
              </label>
            </div>
            {message ? <p id="pricingStorageMessage">{message}</p> : <p id="pricingStorageMessage" hidden></p>}
            <div className="platform-pricing-actions">
              <button id="pricingReset" className="btn" type="button" onClick={reset}>{t("platform.pricing.reset")}</button>
              <button id="pricingSave" className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? t("platform.pricing.saving") : <><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform.pricing.save")}</span></>}
              </button>
            </div>
          </form>
          <aside className="card platform-pricing-preview-card">
            <div className="section-title"><h2>{t("platform.pricing.preview_title")}</h2></div>
            <p className="platform-pricing-monthly">{t("platform.pricing.monthly_label")} <strong id="previewMonthly">{money(result.monthly.configured)}</strong></p>
            <div className="platform-pricing-price-hero">
              <small>{t("platform.pricing.annual_label")}</small>
              <span id="previewRegular" className="platform-pricing-strike" hidden={result.annual.discountConfigured <= 0.009}>{money(result.annual.regularConfigured)}</span>
              <span id="previewDiscounted" className="platform-pricing-final">{money(result.annual.configured)}</span>
              <span id="previewVatLabel" className="platform-pricing-vat-label">{vatLabel}</span>
            </div>
            <div className="platform-pricing-breakdown">
              <div><span>{t("platform.pricing.regular")}</span><strong id="previewRegularBreakdown">{money(result.annual.regularConfigured)}</strong></div>
              <div><span>{t("platform.pricing.discount")}</span><strong id="previewDiscount">- {money(result.annual.discountConfigured)}</strong></div>
              <div><span>{t("platform.pricing.net")}</span><strong id="previewNet">{money(result.annual.net)}</strong></div>
              <div><span>{t("platform.pricing.vat")}</span><strong id="previewVat">{money(result.annual.vat)}</strong></div>
              <div><span>{t("platform.pricing.payable")}</span><strong id="previewPayable">{money(result.annual.payable)}</strong></div>
            </div>
          </aside>
        </section>
      </main>

      <ParityFooter />
    </>
  );
}
