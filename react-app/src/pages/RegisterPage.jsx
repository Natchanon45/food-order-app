import { useEffect, useMemo, useState } from "react";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { onAuthStateChanged, reload } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "@/firebase/client";
import {
  activateSignup,
  ensureSignupUser,
  requestSignup,
  resendSignupVerification,
  sendSignupVerification,
} from "@/auth/authFlow";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ParityFooter } from "@/components/ParityFooter";
import {
  formatSubscriptionMoney,
  loadPublicSubscriptionPricing,
} from "@/data/subscriptionPricing";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

const emptyFields = {
  ownerName: "",
  phone: "",
  email: "",
  orderDeliveryShopName: "",
  retailPosShopName: "",
  slug: "",
  secretA: "",
  secretB: "",
};

const digits = value => String(value || "").replace(/\D/g, "").slice(0, 10);
const cleanSlug = value => String(value || "").trim().toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

function phoneFormat(value = "") {
  const raw = digits(value);
  const parts = [];
  if (raw[0]) parts.push(raw.slice(0, 1));
  if (raw.length > 1) parts.push(raw.slice(1, 5));
  if (raw.length > 5) parts.push(raw.slice(5, 9));
  if (raw.length > 9) parts.push(raw.slice(9, 10));
  return parts.filter(Boolean).join("-");
}

export function RegisterPage() {
  const { t, intlLocale, locale } = useI18n();
  const navigate = useNavigate();
  const [fields, setFields] = useState(emptyFields);
  const [billingMode, setBillingMode] = useState(() => {
    try { return JSON.parse(localStorage.getItem("penguin_signup_billing_choice") || "{}").billingMode || "subscription"; } catch { return "subscription"; }
  });
  const [businessType, setBusinessType] = useState(() => {
    try { return JSON.parse(localStorage.getItem("penguin_signup_billing_choice") || "{}").businessType || ""; } catch { return ""; }
  });
  const [planCode, setPlanCode] = useState(() => {
    try { return JSON.parse(localStorage.getItem("penguin_signup_billing_choice") || "{}").planCode || "monthly"; } catch { return "monthly"; }
  });
  const [restaurantRevenueShareScope, setRestaurantRevenueShareScope] = useState(() => {
    try { return JSON.parse(localStorage.getItem("penguin_signup_billing_choice") || "{}").restaurantRevenueShareScope || ""; } catch { return ""; }
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [registerStatus, setRegisterStatus] = useState({ text: "", error: false });
  const [verifyMode, setVerifyMode] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState({ text: t("auth.register.verify_waiting"), error: false });
  const [pricing, setPricing] = useState(null);
  const [pricingReady, setPricingReady] = useState(false);

  const stylesReady = useParityPage({
    bodyClass: "register-page",
    title: t("auth.register.title"),
    styles: ["register-page.css"],
  });

  useEffect(() => {
    try {
      localStorage.setItem("penguin_signup_billing_choice", JSON.stringify({
        billingMode,
        businessType,
        planCode,
        restaurantRevenueShareScope,
      }));
    } catch {}
  }, [billingMode, businessType, planCode, restaurantRevenueShareScope]);

  useEffect(() => {
    let alive = true;
    loadPublicSubscriptionPricing()
      .then(result => { if (alive) setPricing(result); })
      .catch(() => {})
      .finally(() => { if (alive) setPricingReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!location.search.includes("verify=1")) return undefined;
    return onAuthStateChanged(auth, async user => {
      if (!user) return;
      await reload(user).catch(() => {});
      setVerifyMode(true);
      setVerifyStatus({
        text: auth.currentUser?.emailVerified
          ? t("auth.register.status.email_verified")
          : t("auth.register.status.verify_first"),
        error: false,
      });
    });
  }, [t]);

  const slugPreview = useMemo(() => {
    const slug = cleanSlug(fields.slug) || "saas-test-shop";
    return `${location.origin}/s/${encodeURIComponent(slug)}/`;
  }, [fields.slug]);

  const includesRestaurant = businessType === "restaurant_cafe" || businessType === "both";
  const includesRetail = businessType === "retail" || businessType === "both";
  const revenueShareMode = billingMode === "revenue_share";

  const setField = (name, value) => {
    setFields(current => ({ ...current, [name]: value }));
  };

  const validationMessage = name => {
    if (name === "termsAccepted") return termsAccepted ? "" : t("auth.register.validation.accept_terms");
    if (name === "businessType") return businessType ? "" : t("auth.register.validation.business_type");
    if (name === "billingMode") return billingMode ? "" : t("auth.register.validation.billing_mode");
    if (name === "restaurantRevenueShareScope") {
      return revenueShareMode && includesRestaurant && !restaurantRevenueShareScope
        ? t("auth.register.validation.revenue_share_scope")
        : "";
    }
    const value = String(fields[name] || "").trim();
    const requiredField = ["ownerName","phone","email","slug","secretA","secretB"].includes(name)
      || (name === "orderDeliveryShopName" && includesRestaurant)
      || (name === "retailPosShopName" && includesRetail);
    if (requiredField && !value) {
      const labels = {
        ownerName: t("auth.register.fields.owner_name"),
        phone: t("auth.register.fields.phone"),
        email: t("auth.register.fields.email"),
        orderDeliveryShopName: t("auth.register.fields.order_delivery_shop"),
        retailPosShopName: t("auth.register.fields.retail_pos_shop"),
        slug: t("auth.register.fields.slug"),
        secretA: t("auth.register.fields.password"),
        secretB: t("auth.register.fields.password_confirmation"),
      };
      return t("auth.register.validation.required", { field: labels[name] || t("auth.register.fields.this_field") });
    }
    if (name === "phone" && digits(value).length !== 10) return t("auth.register.validation.phone_digits");
    if (name === "email" && value && !/^\S+@\S+\.\S+$/.test(value)) return t("auth.register.validation.email");
    if (name === "secretA" && value.length > 0 && value.length < 8) return t("auth.register.validation.password_min");
    if (name === "secretB" && value !== fields.secretA) return t("auth.register.validation.password_confirmation");
    return "";
  };

  const allValid = () => {
    setTried(true);
    const names = [
      "billingMode", "businessType", "ownerName", "phone", "email",
      ...(includesRestaurant ? ["orderDeliveryShopName"] : []),
      ...(includesRetail ? ["retailPosShopName"] : []),
      ...(revenueShareMode && includesRestaurant ? ["restaurantRevenueShareScope"] : []),
      "slug", "secretA", "secretB", "termsAccepted",
    ];
    const firstInvalid = names.find(name => validationMessage(name));
    if (firstInvalid) {
      requestAnimationFrame(() => document.getElementById(firstInvalid)?.focus?.());
      return false;
    }
    return true;
  };

  const submit = async event => {
    event.preventDefault();
    setRegisterStatus({ text: "", error: false });
    if (!allValid()) {
      setRegisterStatus({ text: t("auth.register.validation.incomplete"), error: true });
      return;
    }

    setBusy(true);
    try {
      const payload = {
        packageId: "premium",
        billingMode,
        businessType,
        planCode,
        restaurantRevenueShareScope: includesRestaurant ? restaurantRevenueShareScope : "all",
        ownerName: fields.ownerName.trim(),
        phone: digits(fields.phone),
        orderDeliveryShopName: includesRestaurant ? fields.orderDeliveryShopName.trim() : "",
        retailPosShopName: includesRetail ? fields.retailPosShopName.trim() : "",
        slug: cleanSlug(fields.slug),
        email: fields.email.trim().toLowerCase(),
        secret: fields.secretA,
      };

      const credential = await ensureSignupUser(payload.email, payload.secret);
      await sendSignupVerification(credential.user, "/register?verify=1");
      await requestSignup(payload);
      setFields(current => ({ ...current, slug: payload.slug }));
      setVerifyMode(true);
      setVerifyStatus({ text: t("auth.register.status.verify_sent"), error: false });
    } catch (error) {
      console.error(error);
      const code = String(error?.code || error?.message || "");
      let message = error?.message || t("auth.register.errors.signup_failed");
      if (code.includes("already-exists")) message = t("auth.register.errors.slug_exists");
      if (code.includes("REGISTER_EMAIL_ALREADY_USED")) message = t("auth.register.errors.owner_email_exists");
      if (code.includes("weak-password")) message = t("auth.register.validation.password_min");
      setRegisterStatus({ text: message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    setBusy(true);
    try {
      const result = await activateSignup();
      setVerifyStatus({
        text: t(result?.billingMode === "revenue_share"
          ? "auth.register.status.revenue_share_activated"
          : "auth.register.status.trial_activated"),
        error: false,
      });
      const query = result?.slug ? `?tenant=${encodeURIComponent(result.slug)}` : "";
      navigate(`/login${query}`, { replace: true });
    } catch (error) {
      console.error(error);
      const code = String(error?.message || "");
      const message = code.includes("REGISTER_EMAIL_NOT_VERIFIED")
        ? t("auth.register.status.verify_first")
        : t("auth.register.errors.activate_failed");
      setVerifyStatus({ text: message, error: true });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      const result = await resendSignupVerification("/register?verify=1");
      setVerifyStatus({
        text: result.alreadyVerified
          ? t("auth.register.status.email_verified")
          : t("auth.register.status.resend_sent"),
        error: false,
      });
    } catch (error) {
      console.error(error);
      setVerifyStatus({ text: t("auth.register.errors.resend_failed"), error: true });
    } finally {
      setBusy(false);
    }
  };

  const number = value => formatSubscriptionMoney(value, intlLocale);
  const config = pricing?.config;
  const annual = pricing?.pricing?.annual;
  const monthly = pricing?.pricing?.monthly;

  const monthlyVatText = config
    ? config.vatMode === "exclusive"
      ? t("auth.register.pricing.vat_excluded_payable", { rate: number(config.vatRate), amount: number(monthly?.payable) })
      : config.vatRate > 0
        ? t("auth.register.pricing.vat_included_amount", { rate: number(config.vatRate), amount: number(monthly?.vat) })
        : t("auth.register.pricing.vat_none")
    : "";

  const annualPeriod = config ? t("auth.register.pricing.months", { months: config.annualMonths }) : "";
  const annualDiscount = config && annual?.discountConfigured > 0
    ? config.discountType === "percent"
      ? t("auth.register.pricing.discount_percent", { value: number(config.discountValue) })
      : t("auth.register.pricing.discount_amount", { amount: number(annual.discountConfigured) })
    : "";

  const renderError = name => {
    if (!tried) return null;
    const message = validationMessage(name);
    return <div className={`field-error${message ? " show" : ""}`}>{message}</div>;
  };

  if (!stylesReady || !pricingReady) return <PageReadyOverlay />;

  return (
    <>
      <header className="app-header register-header">
        <div className="brand">
          <span className="brand-mark">PG</span>
          <span>{t("auth.register.title")}</span>
        </div>
        <Link className="btn btn-sm" to="/">
          <i className="bi bi-house-door app-icon"></i>
          <span>{t("auth.register.home")}</span>
        </Link>
        <LocaleSwitcher />
      </header>

      <main className="register-shell">
        <section className="register-hero">
          <h1>{t("auth.register.hero_title")}</h1>
          <p>{t("auth.register.hero_description")}</p>
        </section>

        <section className="register-grid">
          <section className="register-card">
            {!verifyMode ? (
              <form id="registerForm" className="register-form" noValidate onSubmit={submit}>
                <section className="full register-choice-section">
                  <div className="register-choice-heading">
                    <span className="register-choice-icon"><i className="bi bi-shop-window" aria-hidden="true"></i></span>
                    <div><b>{t("auth.register.business.title")}</b><small>{t("auth.register.business.help")}</small></div>
                  </div>
                  <div className="business-choice-grid">
                    {[
                      ["restaurant_cafe", "bi-cup-hot", "restaurant"],
                      ["retail", "bi-basket2", "retail"],
                      ["both", "bi-grid-1x2", "both"],
                    ].map(([value, icon, key]) => (
                      <label key={value} className={`business-option ${businessType === value ? "is-selected" : ""}`}>
                        <input id={value === "restaurant_cafe" ? "businessType" : `businessType-${value}`} type="radio" name="businessType" value={value} checked={businessType === value} onChange={() => setBusinessType(value)} />
                        <span className="business-option-icon"><i className={`bi ${icon}`} aria-hidden="true"></i></span>
                        <strong>{t(`auth.register.business.${key}.title`)}</strong>
                        <small>{t(`auth.register.business.${key}.help`)}</small>
                        <i className="bi bi-check-circle-fill business-check" aria-hidden="true"></i>
                      </label>
                    ))}
                  </div>
                  {renderError("businessType")}
                </section>

                <section className="full register-choice-section">
                  <div className="register-choice-heading">
                    <span className="register-choice-icon"><i className="bi bi-wallet2" aria-hidden="true"></i></span>
                    <div><b>{t("auth.register.billing.title")}</b><small>{t("auth.register.billing.help")}</small></div>
                  </div>
                  <div className="package-grid package-grid-two">
                    <label className={`package-option ${billingMode === "subscription" ? "is-selected" : ""}`}>
                      <input id="billingMode" type="radio" name="billingMode" value="subscription" checked={billingMode === "subscription"} onChange={() => setBillingMode("subscription")} />
                      <strong>{t("auth.register.billing.subscription.title")}</strong>
                      <i className="bi bi-check-circle-fill package-check" aria-hidden="true"></i>
                      <span className="package-price">{t("auth.register.billing.subscription.trial")}</span>
                      <small>
                        {t("auth.register.billing.subscription.monthly", { amount: number(config?.monthlyPrice || 590) })}
                        <br />
                        {t("auth.register.billing.subscription.yearly", {
                          regular: number(annual?.regularConfigured || 7080),
                          amount: number(annual?.configured || 5900),
                        })}
                      </small>
                    </label>
                    <label className={`package-option ${billingMode === "revenue_share" ? "is-selected" : ""}`}>
                      <input id="billingModeRevenueShare" type="radio" name="billingMode" value="revenue_share" checked={billingMode === "revenue_share"} onChange={() => setBillingMode("revenue_share")} />
                      <strong>{t("auth.register.billing.revenue_share.title")}</strong>
                      <i className="bi bi-check-circle-fill package-check" aria-hidden="true"></i>
                      <span className="package-price">{t("auth.register.billing.revenue_share.price")}</span>
                      <small>{t("auth.register.billing.revenue_share.help")}</small>
                    </label>
                  </div>
                  {renderError("billingMode")}
                </section>

                {!revenueShareMode ? (
                  <section className="full register-choice-section">
                    <div className="register-choice-heading">
                      <span className="register-choice-icon"><i className="bi bi-calendar2-check" aria-hidden="true"></i></span>
                      <div><b>{t("auth.register.subscription_cycle.title")}</b><small>{t("auth.register.subscription_cycle.help")}</small></div>
                    </div>
                    <div className="subscription-cycle-grid">
                      <label className={`cycle-option ${planCode === "monthly" ? "is-selected" : ""}`}>
                        <input type="radio" name="planCode" value="monthly" checked={planCode === "monthly"} onChange={() => setPlanCode("monthly")} />
                        <span><strong>{t("auth.register.subscription_cycle.monthly")}</strong><small>{number(config?.monthlyPrice || 590)} {t("auth.register.subscription_cycle.baht_per_month")}</small></span>
                        <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                      </label>
                      <label className={`cycle-option ${planCode === "yearly" ? "is-selected" : ""}`}>
                        <input type="radio" name="planCode" value="yearly" checked={planCode === "yearly"} onChange={() => setPlanCode("yearly")} />
                        <span><strong>{t("auth.register.subscription_cycle.yearly")}</strong><small><span className="old-price-slash">{number(annual?.regularConfigured || 7080)}</span> <b>{number(annual?.configured || 5900)}</b> {t("auth.register.subscription_cycle.baht_per_year")}</small></span>
                        <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                      </label>
                    </div>
                  </section>
                ) : null}

                {revenueShareMode && includesRestaurant ? (
                  <section className="full register-choice-section revenue-scope-section">
                    <div className="register-choice-heading">
                      <span className="register-choice-icon"><i className="bi bi-percent" aria-hidden="true"></i></span>
                      <div><b>{t("auth.register.revenue_scope.title")}</b><small>{t("auth.register.revenue_scope.help")}</small></div>
                    </div>
                    <div className="revenue-scope-grid">
                      {[
                        ["delivery_only", "bi-truck", "delivery"],
                        ["storefront_only", "bi-shop", "storefront"],
                        ["all", "bi-diagram-3", "all"],
                      ].map(([value, icon, key]) => (
                        <label key={value} className={`revenue-scope-option ${restaurantRevenueShareScope === value ? "is-selected" : ""}`}>
                          <input id={value === "delivery_only" ? "restaurantRevenueShareScope" : undefined} type="radio" name="restaurantRevenueShareScope" value={value} checked={restaurantRevenueShareScope === value} onChange={() => setRestaurantRevenueShareScope(value)} />
                          <span className="revenue-scope-icon"><i className={`bi ${icon}`} aria-hidden="true"></i></span>
                          <strong>{t(`auth.register.revenue_scope.${key}.title`)}</strong>
                          <small>{t(`auth.register.revenue_scope.${key}.help`)}</small>
                          <i className="bi bi-check-circle-fill revenue-scope-check" aria-hidden="true"></i>
                        </label>
                      ))}
                    </div>
                    {renderError("restaurantRevenueShareScope")}
                    {includesRetail ? <p className="field-help revenue-retail-rule"><i className="bi bi-info-circle" aria-hidden="true"></i><span>{t("auth.register.revenue_scope.retail_always")}</span></p> : null}
                  </section>
                ) : revenueShareMode && includesRetail ? (
                  <section className="full register-choice-section revenue-retail-only">
                    <div className="register-choice-heading">
                      <span className="register-choice-icon"><i className="bi bi-basket2" aria-hidden="true"></i></span>
                      <div><b>{t("auth.register.revenue_scope.retail_title")}</b><small>{t("auth.register.revenue_scope.retail_always")}</small></div>
                    </div>
                  </section>
                ) : null}

                <div className="register-form-grid">
                  <label>
                    {t("auth.register.fields.owner_name")}
                    <input id="ownerName" required value={fields.ownerName} onChange={e => setField("ownerName", e.target.value)} maxLength="120" autoComplete="name" />
                    {renderError("ownerName")}
                  </label>
                  <label>
                    {t("auth.register.fields.phone")}
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={fields.phone}
                      onChange={e => setField("phone", digits(e.target.value))}
                      onBlur={() => setField("phone", phoneFormat(fields.phone))}
                      maxLength="30"
                      autoComplete="tel"
                      inputMode="numeric"
                      placeholder={t("auth.register.phone_placeholder")}
                    />
                    {renderError("phone")}
                  </label>
                  <label className="full">
                    {t("auth.register.fields.email")}
                    <input id="email" type="email" required value={fields.email} onChange={e => setField("email", e.target.value)} maxLength="120" autoComplete="email" />
                    {renderError("email")}
                  </label>

                  {includesRestaurant ? (
                    <label className={includesRetail ? "" : "full"}>
                      {t("auth.register.fields.order_delivery_shop")} <span className="label-small">{t("auth.register.order_delivery_hint")}</span>
                      <input id="orderDeliveryShopName" required value={fields.orderDeliveryShopName} onChange={e => setField("orderDeliveryShopName", e.target.value)} maxLength="120" />
                      {renderError("orderDeliveryShopName")}
                    </label>
                  ) : null}
                  {includesRetail ? (
                    <label className={includesRestaurant ? "" : "full"}>
                      {t("auth.register.fields.retail_pos_shop")} <span className="label-small">{t("auth.register.retail_pos_hint")}</span>
                      <input id="retailPosShopName" required value={fields.retailPosShopName} onChange={e => setField("retailPosShopName", e.target.value)} maxLength="120" />
                      {renderError("retailPosShopName")}
                    </label>
                  ) : null}
                  {includesRestaurant && includesRetail ? <p className="full field-help">{t("auth.register.same_shop_help")}</p> : null}

                  <label className="full">
                    {t("auth.register.fields.slug")} <span className="label-small">{t("auth.register.slug_help")}</span>
                    <input
                      id="slug"
                      required
                      value={fields.slug}
                      onChange={e => setField("slug", e.target.value)}
                      maxLength="50"
                      placeholder="saas-test-shop"
                      autoComplete="off"
                    />
                    {renderError("slug")}
                  </label>
                  <div className="full slug-preview" id="slugPreview">{slugPreview}</div>

                  <label>
                    {t("auth.register.fields.password")}
                    <input id="secretA" type="password" required value={fields.secretA} onChange={e => setField("secretA", e.target.value)} minLength="8" maxLength="100" autoComplete="new-password" />
                    {renderError("secretA")}
                  </label>
                  <label>
                    {t("auth.register.fields.password_confirmation")}
                    <input id="secretB" type="password" required value={fields.secretB} onChange={e => setField("secretB", e.target.value)} minLength="8" maxLength="100" autoComplete="new-password" />
                    {renderError("secretB")}
                  </label>
                </div>

                <p className="register-note">{t("auth.register.after_signup_note")}</p>
                <label className="terms-box">
                  <input id="termsAccepted" type="checkbox" required checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                  <span>{t("auth.register.terms_text")}</span>
                </label>
                {renderError("termsAccepted")}

                <p id="registerStatus" className={`register-status${registerStatus.text ? "" : " hidden"}${registerStatus.error ? " error" : ""}`}>
                  {registerStatus.text}
                </p>

                <div className="register-actions">
                  <button id="submitRegister" className="btn btn-primary" type="submit" disabled={busy || !termsAccepted}>
                    <i className="bi bi-send-check app-icon"></i>
                    <span>{t("auth.register.submit")}</span>
                  </button>
                  <Link className="btn" to="/login">
                    <i className="bi bi-box-arrow-in-right app-icon"></i>
                    <span>{t("auth.register.login")}</span>
                  </Link>
                </div>
              </form>
            ) : (
              <div id="verifyBox" className="verify-box show">
                <h2>{t("auth.register.verify_title")}</h2>
                <p className="register-note">{t("auth.register.verify_description")}</p>
                <p id="verifyStatus" className={`register-status${verifyStatus.error ? " error" : ""}`}>{verifyStatus.text}</p>
                <div className="register-actions">
                  <button id="activateTrial" className="btn btn-primary" type="button" onClick={activate} disabled={busy}>
                    <i className="bi bi-patch-check app-icon"></i>
                    <span>{t("auth.register.activate")}</span>
                  </button>
                  <button id="resendEmail" className="btn" type="button" onClick={resend} disabled={busy}>
                    <i className="bi bi-envelope app-icon"></i>
                    <span>{t("auth.register.resend")}</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="register-card plan-card">
            <span className="plan-badge">
              <i className={`bi ${revenueShareMode ? "bi-percent" : "bi-stars"}`} aria-hidden="true"></i>
              <span>{t(revenueShareMode ? "auth.register.aside.share_badge" : "auth.register.aside.subscription_badge")}</span>
            </span>
            <h2>{t(revenueShareMode ? "auth.register.aside.share_title" : "auth.register.aside.subscription_title")}</h2>
            {revenueShareMode ? (
              <>
                <p className="plan-price share-plan-price">{t("auth.register.aside.share_price")}</p>
                <p className="plan-next-price">{t("auth.register.aside.share_rate_note")}</p>
                <div className="plan-selection-summary">
                  <span><i className="bi bi-shop-window" aria-hidden="true"></i>{t("auth.register.aside.business")}</span>
                  <strong>{businessType ? t(`auth.register.business.${businessType === "restaurant_cafe" ? "restaurant" : businessType}.title`) : t("auth.register.aside.not_selected")}</strong>
                  {includesRestaurant ? (
                    <>
                      <span><i className="bi bi-diagram-3" aria-hidden="true"></i>{t("auth.register.aside.restaurant_scope")}</span>
                      <strong>{t(`auth.register.revenue_scope.${restaurantRevenueShareScope === "delivery_only" ? "delivery" : restaurantRevenueShareScope === "storefront_only" ? "storefront" : "all"}.title`)}</strong>
                    </>
                  ) : null}
                  {includesRetail ? (
                    <>
                      <span><i className="bi bi-basket2" aria-hidden="true"></i>{t("auth.register.aside.retail_scope")}</span>
                      <strong>{t("auth.register.revenue_scope.retail_short")}</strong>
                    </>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <p className="plan-price">0฿ <small>{t("auth.register.plans.first_month_suffix")}</small></p>
                {planCode === "monthly" ? (
                  <p className="plan-next-price">
                    {t("auth.register.pricing.next_month", { amount: number(config?.monthlyPrice || 590) })}
                    {monthlyVatText ? <span className="plan-vat-note">{monthlyVatText}</span> : null}
                  </p>
                ) : (
                  <p className="plan-year-price">
                    <span className="old-price-slash">{number(annual?.regularConfigured || 7080)}</span>{" "}
                    <span className="new-year-price">{number(annual?.configured || 5900)}/{t("auth.register.subscription_cycle.year_suffix")}</span>
                    {annualDiscount ? <small className="plan-discount-label">{annualDiscount}</small> : null}
                  </p>
                )}
              </>
            )}
            <ul>
              {includesRestaurant ? <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("auth.register.aside.restaurant_feature")}</span></li> : null}
              {includesRetail ? <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("auth.register.retail_pos_feature")}</span></li> : null}
              <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("auth.register.owner_permission")}</span></li>
              <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t(revenueShareMode ? "auth.register.aside.share_admin_note" : "auth.register.trial_start")}</span></li>
            </ul>
          </aside>
        </section>
      </main>

      <ParityFooter />
    </>
  );
}
