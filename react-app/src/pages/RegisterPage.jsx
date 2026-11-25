import { useEffect, useMemo, useRef, useState } from "react";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { getIdToken, onAuthStateChanged, reload, signInWithEmailAndPassword } from "firebase/auth";
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
import { DynamicField } from "@/components/DynamicField";
import { MerchantServiceTerms } from "@/components/MerchantServiceTerms";
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
  const [businessType, setBusinessType] = useState(() => {
    try { return JSON.parse(localStorage.getItem("penguin_signup_billing_choice") || "{}").businessType || ""; } catch { return ""; }
  });
  const [planCode, setPlanCode] = useState(() => {
    try { return JSON.parse(localStorage.getItem("penguin_signup_billing_choice") || "{}").planCode || "monthly"; } catch { return "monthly"; }
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [registerStatus, setRegisterStatus] = useState({ text: "", error: false });
  const [verifyMode, setVerifyMode] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState({ text: t("auth.register.verify_waiting"), error: false });
  const [pricing, setPricing] = useState(null);
  const [pricingReady, setPricingReady] = useState(false);
  const automaticActivationUid = useRef("");
  const [needsPendingSignIn,setNeedsPendingSignIn] = useState(false);
  const [pendingEmail,setPendingEmail] = useState("");
  const [pendingPassword,setPendingPassword] = useState("");

  const stylesReady = useParityPage({
    bodyClass: "register-page",
    title: t("auth.register.title"),
    styles: ["register-page.css", "merchant-service-terms-port.css", "register-source-layout.css"],
  });

  useEffect(() => {
    try {
      localStorage.setItem("penguin_signup_billing_choice", JSON.stringify({
        businessType,
        planCode,
      }));
    } catch {}
  }, [businessType, planCode]);

  useEffect(() => {
    let alive = true;
    loadPublicSubscriptionPricing()
      .then(result => { if (alive) setPricing(result); })
      .catch(() => {})
      .finally(() => { if (alive) setPricingReady(true); });
    return () => { alive = false; };
  }, []);

  // The Firebase email link is NOT an authorization claim; only the native
  // verified Auth user and canonical server activation may create the Tenant.
  // Match Source's post-verification automatic activation without trusting
  // ?verify=1, a client-created UUID, or previously stored signup state.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("verify") !== "1") return undefined;
    let alive = true;
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!alive) return;
      setVerifyMode(true);
      if (!user) {
        setNeedsPendingSignIn(true);
        setVerifyStatus({text:t("auth.register.status.verify_first"),error:true});
        return;
      }
      setNeedsPendingSignIn(false);
      try {
        await reload(user);
      } catch {
        if (alive) setVerifyStatus({text:t("auth.register.errors.activate_failed"),error:true});
        return;
      }
      if (!alive) return;
      if (!user.emailVerified) {
        setVerifyStatus({text:t("auth.register.status.verify_first"),error:true});
        return;
      }
      if (automaticActivationUid.current === user.uid) return;
      automaticActivationUid.current = user.uid;
      setBusy(true);
      try {
        await getIdToken(user,true);
        const result = await activateSignup();
        if (!alive) return;
        setVerifyStatus({text:t("auth.register.status.trial_activated"),error:false});
        navigate("/login"+(result?.slug?"?tenant="+encodeURIComponent(result.slug):""),{replace:true});
      } catch (error) {
        if (alive) setVerifyStatus({
          text:String(error?.message||"").includes("REGISTER_EMAIL_NOT_VERIFIED")
            ? t("auth.register.status.verify_first")
            : t("auth.register.errors.activate_failed"),error:true,
        });
      } finally {
        if (alive) setBusy(false);
      }
    });
    return () => { alive = false; unsubscribe(); };
  }, [t,navigate]);

  const slugPreview = useMemo(() => {
    const slug = cleanSlug(fields.slug) || "saas-test-shop";
    return `${location.origin}/s/${encodeURIComponent(slug)}/`;
  }, [fields.slug]);

  const includesRestaurant = businessType === "restaurant_cafe" || businessType === "both";
  const includesRetail = businessType === "retail" || businessType === "both";

  const setField = (name, value) => {
    setFields(current => ({ ...current, [name]: value }));
  };

  const validationMessage = name => {
    if (name === "termsAccepted") return termsAccepted ? "" : t("auth.register.validation.accept_terms");
    if (name === "businessType") return businessType ? "" : t("auth.register.validation.business_type");
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
      "businessType", "ownerName", "phone", "email",
      ...(includesRestaurant ? ["orderDeliveryShopName"] : []),
      ...(includesRetail ? ["retailPosShopName"] : []),
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
    if (!allValid() || pricing?.source !== "remote") {
      setRegisterStatus({
        text: pricing?.source !== "remote"
          ? (String(intlLocale||"").toLowerCase().startsWith("th")
            ? "ไม่สามารถยืนยันราคาสมัครร้านจากระบบกลางได้ กรุณาลองใหม่"
            : "Current subscription pricing is unavailable. Please retry.")
          : t("auth.register.validation.incomplete"),
        error: true,
      });
      return;
    }

    setBusy(true);
    try {
      const payload = {
        packageId: "premium",
        billingMode: "subscription",
        businessType,
        planCode,
        ownerName: fields.ownerName.trim(),
        phone: digits(fields.phone),
        orderDeliveryShopName: includesRestaurant ? fields.orderDeliveryShopName.trim() : "",
        retailPosShopName: includesRetail ? fields.retailPosShopName.trim() : "",
        slug: cleanSlug(fields.slug),
        email: fields.email.trim().toLowerCase(),
        secret: fields.secretA,
      };

      const credential = await ensureSignupUser(payload.email, payload.secret);
      // Reserve and verify the Signup transaction before sending any email.
      // A rejected/duplicate slug must never send an invitation claiming a
      // shop exists. If mail delivery fails after a valid reservation, the
      // verified pending request remains recoverable via the Resend control.
      await requestSignup(payload);
      setFields(current => ({ ...current, slug: payload.slug }));
      setVerifyMode(true);
      try {
        const result = await sendSignupVerification(credential.user, "/register?verify=1");
        setVerifyStatus({
          text:result.alreadyVerified
            ? t("auth.register.status.email_verified")
            : t("auth.register.status.verify_sent"),
          error:false,
        });
      } catch {
        setVerifyStatus({text:t("auth.register.errors.resend_failed"),error:true});
      }
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

  // A Firebase email verification link may be opened on another browser.
  // Pending Owners have no users/{uid} staff profile yet, so normal Staff
  // Login cannot be used to resume them. Native Firebase Auth signs in the
  // same verified email identity, then the strict server activation decides
  // whether that identity has a matching pending reservation.
  const resumePending = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const credential=await signInWithEmailAndPassword(
        auth,pendingEmail.trim().toLowerCase(),pendingPassword,
      );
      setPendingPassword("");
      await reload(credential.user);
      if (!credential.user.emailVerified) {
        setVerifyStatus({text:t("auth.register.status.verify_first"),error:true});
      }
      // The verified onAuthStateChanged handler performs canonical activation.
    } catch {
      setVerifyStatus({
        text:t("auth.login.errors.invalid_credentials"),error:true,
      });
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    setBusy(true);
    try {
      const result = await activateSignup();
      setVerifyStatus({
        text: t("auth.register.status.trial_activated"),
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

  const number = value => pricing?.source === "remote" && typeof value === "number" && Number.isFinite(value) ? formatSubscriptionMoney(value, intlLocale) : "—";
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

  // Signup keeps its business-specific checks and reuses the shared validation UI styling.
  const fieldValidationProps = name => {
    if (!tried) return {};
    const invalid = Boolean(validationMessage(name));
    return {
      "data-validation-state": invalid ? "invalid" : "valid",
      "aria-invalid": invalid,
      "aria-describedby": invalid ? `${name}-validation` : undefined,
    };
  };

  const renderError = name => {
    if (!tried) return null;
    const message = validationMessage(name);
    return message ? (
      <div id={`${name}-validation`} className="bootstrap-invalid-feedback show" role="alert">
        {message}
      </div>
    ) : null;
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
                        <input id={value === "restaurant_cafe" ? "businessType" : `businessType-${value}`} type="radio" name="businessType" value={value} {...fieldValidationProps("businessType")} checked={businessType === value} onChange={() => setBusinessType(value)} />
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
                    <div>
                      <b>{t("auth.register.billing.subscription.title")}</b>
                      <small>{t("auth.register.billing.subscription.trial")} · {t("auth.register.billing.subscription.monthly", { amount: number(config?.monthlyPrice) })} · {t("auth.register.billing.subscription.yearly", { regular: number(annual?.regularConfigured), amount: number(annual?.configured) })}</small>
                    </div>
                  </div>
                </section>

                <section className="full register-choice-section">
                  <div className="register-choice-heading">
                    <span className="register-choice-icon"><i className="bi bi-calendar2-check" aria-hidden="true"></i></span>
                    <div><b>{t("auth.register.subscription_cycle.title")}</b><small>{t("auth.register.subscription_cycle.help")}</small></div>
                  </div>
                  <div className="subscription-cycle-grid">
                    <label className={`cycle-option ${planCode === "monthly" ? "is-selected" : ""}`}>
                      <input type="radio" name="planCode" value="monthly" checked={planCode === "monthly"} onChange={() => setPlanCode("monthly")} />
                      <span><strong>{t("auth.register.subscription_cycle.monthly")}</strong><small>{number(config?.monthlyPrice)} {t("auth.register.subscription_cycle.baht_per_month")}</small></span>
                      <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                    </label>
                    <label className={`cycle-option ${planCode === "yearly" ? "is-selected" : ""}`}>
                      <input type="radio" name="planCode" value="yearly" checked={planCode === "yearly"} onChange={() => setPlanCode("yearly")} />
                      <span><strong>{t("auth.register.subscription_cycle.yearly")}</strong><small><span className="old-price-slash">{number(annual?.regularConfigured)}</span> <b>{number(annual?.configured)}</b> {t("auth.register.subscription_cycle.baht_per_year")}</small></span>
                      <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                    </label>
                  </div>
                </section>

                <MerchantServiceTerms locale={intlLocale} pricing={pricing} context="registration" />

                <div className="register-form-grid">
                  <div className="register-dynamic-field">
                    <DynamicField id="ownerName" label={t("auth.register.fields.owner_name")} value={fields.ownerName}>
                      <input id="ownerName" {...fieldValidationProps("ownerName")} required value={fields.ownerName} onChange={e => setField("ownerName", e.target.value)} maxLength="120" autoComplete="name" />
                    </DynamicField>
                    {renderError("ownerName")}
                  </div>
                  <div className="register-dynamic-field">
                    <DynamicField id="phone" label={t("auth.register.fields.phone")} value={fields.phone}>
                      <input
                      id="phone" {...fieldValidationProps("phone")}
                      type="tel"
                      required
                      value={fields.phone}
                      onChange={e => setField("phone", digits(e.target.value))}
                      onBlur={() => setField("phone", phoneFormat(fields.phone))}
                      maxLength="30"
                      autoComplete="tel"
                      inputMode="numeric"
                    />
                    </DynamicField>
                    {renderError("phone")}
                  </div>
                  <div className="register-dynamic-field full">
                    <DynamicField id="email" label={t("auth.register.fields.email")} value={fields.email}>
                      <input id="email" {...fieldValidationProps("email")} type="email" required value={fields.email} onChange={e => setField("email", e.target.value)} maxLength="120" autoComplete="email" />
                    </DynamicField>
                    {renderError("email")}
                  </div>

                  {includesRestaurant ? (
                    <div className={includesRetail ? "register-inline-hint-field" : "register-inline-hint-field full"}>
                      <DynamicField id="orderDeliveryShopName" label={t("auth.register.fields.order_delivery_shop")}
                        inlineHint={t("auth.register.order_delivery_hint")} value={fields.orderDeliveryShopName}>
                        <input id="orderDeliveryShopName" {...fieldValidationProps("orderDeliveryShopName")} required value={fields.orderDeliveryShopName} onChange={e => setField("orderDeliveryShopName", e.target.value)} maxLength="120" />
                      </DynamicField>
                      {renderError("orderDeliveryShopName")}
                    </div>
                  ) : null}
                  {includesRetail ? (
                    <div className={includesRestaurant ? "register-inline-hint-field" : "register-inline-hint-field full"}>
                      <DynamicField id="retailPosShopName" label={t("auth.register.fields.retail_pos_shop")}
                        inlineHint={t("auth.register.retail_pos_hint")} value={fields.retailPosShopName}>
                        <input id="retailPosShopName" {...fieldValidationProps("retailPosShopName")} required value={fields.retailPosShopName} onChange={e => setField("retailPosShopName", e.target.value)} maxLength="120" />
                      </DynamicField>
                      {renderError("retailPosShopName")}
                    </div>
                  ) : null}
                  {includesRestaurant && includesRetail ? <p className="full field-help">{t("auth.register.same_shop_help")}</p> : null}

                  <div className="register-inline-hint-field full">
                    <DynamicField id="slug" label={t("auth.register.fields.slug")}
                      inlineHint={t("auth.register.slug_help")} value={fields.slug}>
                      <input
                        id="slug" {...fieldValidationProps("slug")}
                        required
                        value={fields.slug}
                        onChange={e => setField("slug", e.target.value)}
                        maxLength="50"
                        placeholder="saas-test-shop"
                        autoComplete="off"
                      />
                    </DynamicField>
                    {renderError("slug")}
                  </div>
                  <div className="full slug-preview" id="slugPreview">{slugPreview}</div>

                  <div className="register-dynamic-field">
                    <DynamicField id="secretA" label={t("auth.register.fields.password")} value={fields.secretA}>
                      <input id="secretA" {...fieldValidationProps("secretA")} type="password" required value={fields.secretA} onChange={e => setField("secretA", e.target.value)} minLength="8" maxLength="100" autoComplete="new-password" />
                    </DynamicField>
                    {renderError("secretA")}
                  </div>
                  <div className="register-dynamic-field">
                    <DynamicField id="secretB" label={t("auth.register.fields.password_confirmation")} value={fields.secretB}>
                      <input id="secretB" {...fieldValidationProps("secretB")} type="password" required value={fields.secretB} onChange={e => setField("secretB", e.target.value)} minLength="8" maxLength="100" autoComplete="new-password" />
                    </DynamicField>
                    {renderError("secretB")}
                  </div>
                </div>

                <p className="register-note">{t("auth.register.after_signup_note")}</p>
                <label className="terms-box">
                  <input id="termsAccepted" {...fieldValidationProps("termsAccepted")} type="checkbox" required checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
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
                {needsPendingSignIn ? <form id="resumePendingSignup" className="register-form"
                  onSubmit={resumePending} autoComplete="on">
                  <label>{t("auth.register.fields.email")}
                    <input id="resumePendingEmail" type="email" required
                      autoComplete="email" value={pendingEmail}
                      onChange={event=>setPendingEmail(event.target.value)} />
                  </label>
                  <label>{t("auth.register.fields.password")}
                    <input id="resumePendingPassword" type="password" required
                      autoComplete="current-password" value={pendingPassword}
                      onChange={event=>setPendingPassword(event.target.value)} />
                  </label>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    <i className="bi bi-box-arrow-in-right app-icon" aria-hidden="true"></i>
                    <span>{t("auth.register.login")}</span>
                  </button>
                </form> : null}
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
              <i className="bi bi-stars" aria-hidden="true"></i>
              <span>{t("auth.register.aside.subscription_badge")}</span>
            </span>
            <h2>{t("auth.register.aside.subscription_title")}</h2>
                <p className="plan-price">0฿ <small>{t("auth.register.plans.first_month_suffix")}</small></p>
                {planCode === "monthly" ? (
                  <p className="plan-next-price">
                    {t("auth.register.pricing.next_month", { amount: number(config?.monthlyPrice) })}
                    {monthlyVatText ? <span className="plan-vat-note">{monthlyVatText}</span> : null}
                  </p>
                ) : (
                  <p className="plan-year-price">
                    <span className="old-price-slash">{number(annual?.regularConfigured)}</span>{" "}
                    <span className="new-year-price">{number(annual?.configured)}/{t("auth.register.subscription_cycle.year_suffix")}</span>
                    {annualDiscount ? <small className="plan-discount-label">{annualDiscount}</small> : null}
                  </p>
                )}
            <ul>
              {includesRestaurant ? <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("auth.register.aside.restaurant_feature")}</span></li> : null}
              {includesRetail ? <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("auth.register.retail_pos_feature")}</span></li> : null}
              <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("auth.register.owner_permission")}</span></li>
              <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("auth.register.trial_start")}</span></li>
            </ul>
          </aside>
        </section>
      </main>

      <ParityFooter />
    </>
  );
}
