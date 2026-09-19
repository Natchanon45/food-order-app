import "./form-validation-ui.js?v=20260731-080";
import {
  auth, functions, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, reload, onAuthStateChanged, httpsCallable,
} from "./firebase-config.js?v=20260704-003";
import {
  loadPublicSubscriptionPricing,
  formatSubscriptionMoney,
  subscriptionVatLabel,
} from "./subscription-pricing-client.js?v=20260920-001";
import translations from "./public-register-translations.js?v=20260920-001";
import {
  configureI18n, applyTranslations, getLocale, getIntlLocale, t,
} from "./i18n.js?v=20260903-202";

configureI18n(translations);
applyTranslations();
document.title = t("register.meta.title");

const $ = selector => document.querySelector(selector);
const form = $("#registerForm");
const verifyBox = $("#verifyBox");
const slug = $("#slug");
const slugPreview = $("#slugPreview");
const registerStatus = $("#registerStatus");
const verifyStatus = $("#verifyStatus");
const submitButton = $("#submitRegister");
const activateButton = $("#activateTrial");
const resendButton = $("#resendEmail");
const terms = $("#termsAccepted");
const phone = $("#phone");
const requestSignup = httpsCallable(functions, "requestTrialTenantSignup");
const activateSignup = httpsCallable(functions, "activateTrialTenantSignup");

let busy = false;
let tried = false;
if (form) form.noValidate = true;

function injectValidationCss() {
  if ($("#reg-val-css")) return;
  document.head.insertAdjacentHTML("beforeend", `
    <style id="reg-val-css">
      #registerForm input{background:#f4f6f5!important;border-color:#d7e0da!important}
      #registerForm input:focus{background:#fff!important;outline:3px solid rgba(21,148,71,.14)!important;border-color:#159447!important}
      #registerForm .field-error{display:block;visibility:hidden;min-height:17px;margin:6px 0 0;color:#d92d20;font-size:12px;font-weight:500;line-height:1.35}
      #registerForm .field-error.show{visibility:visible}
      .plan-year-price{background:#e7f8ee!important;border:1px solid #9fd0b3!important;box-shadow:0 8px 18px rgba(21,148,71,.10)!important}
      .old-price-slash{position:relative;display:inline-block;color:#b42318!important;font-size:18px!important;font-weight:1000!important;padding:0 2px}
      .old-price-slash:after{content:"";position:absolute;left:-2px;right:-2px;top:52%;height:1px;background:#111;transform:rotate(-12deg);transform-origin:center}
      .plan-year-price .new-year-price{color:#08702f!important;font-size:22px!important;font-weight:1000!important}
    </style>
  `);
}
async function renderPricing() {
  const { config, pricing } = await loadPublicSubscriptionPricing();
  const locale = getLocale();
  const number = value => formatSubscriptionMoney(value, getIntlLocale());
  const money = value => locale === "en" ? `THB ${number(value)}` : `${number(value)}฿`;
  const annual = pricing.annual;
  const hasDiscount = annual.discountConfigured > 0.009;
  const discountText = config.discountType === "percent"
    ? t("register.pricing.discountPercent", { value: number(config.discountValue) })
    : t("register.pricing.discountAmount", { amount: number(annual.discountConfigured) });

  const premium = document.querySelector('.package-option input[value="premium"]')?.closest(".package-option");
  const small = premium?.querySelector("small");
  const next = document.querySelector(".plan-next-price");
  const year = document.querySelector(".plan-year-price");

  const monthlyVat = config.vatMode === "exclusive"
    ? t("register.pricing.excludedPayable", {
        rate: number(config.vatRate),
        amount: number(pricing.monthly.payable),
      })
    : subscriptionVatLabel(config, locale);

  if (small) {
    small.innerHTML = `${t("register.pricing.nextMonth", { amount: number(pricing.monthly.configured) })}<br>${monthlyVat}<br>${t("register.pricing.trialLine")}`;
  }
  if (next) {
    next.innerHTML = `${t("register.pricing.nextMonth", { amount: number(pricing.monthly.configured) })} <span class="plan-vat-note">${monthlyVat}</span>`;
  }
  if (year) {
    const oldPrice = hasDiscount ? `<span class="old-price-slash">${money(annual.regularConfigured)}</span> ` : "";
    const discountLabel = hasDiscount ? `<small class="plan-discount-label">${discountText}</small>` : "";
    const special = hasDiscount ? `${t("register.pricing.special")} ` : "";
    const period = t("register.pricing.months", { months: config.annualMonths });
    const vatDetail = config.vatMode === "exclusive"
      ? t("register.pricing.excludedPayable", { rate: number(config.vatRate), amount: number(annual.payable) })
      : t("register.pricing.includedVat", { rate: number(config.vatRate), amount: number(annual.vat) });
    year.innerHTML = `${special}${oldPrice}<span class="new-year-price">${money(annual.configured)}/${period}</span>${discountLabel}<small class="plan-tax-detail">${vatDetail}</small>`;
  }
}

function digits(value = "") {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function phoneFormat(value = "") {
  const raw = digits(value);
  const parts = [];
  if (raw[0]) parts.push(raw.slice(0, 1));
  if (raw.length > 1) parts.push(raw.slice(1, 5));
  if (raw.length > 5) parts.push(raw.slice(5, 9));
  if (raw.length > 9) parts.push(raw.slice(9, 10));
  return parts.filter(Boolean).join("-");
}

function cleanSlug(value = "") {
  return String(value || "").trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function storeUrl(value) {
  return `${location.origin}/s/${encodeURIComponent(value || "saas-test-shop")}/`;
}

function selectedPlan() {
  return document.querySelector('input[name="packagePlan"]:checked')?.value || "premium";
}
function setRegisterStatus(message = "", error = false) {
  registerStatus.textContent = message;
  registerStatus.classList.toggle("hidden", !message);
  registerStatus.classList.toggle("error", error);
}

function setVerifyStatus(message = "", error = false) {
  verifyStatus.textContent = message;
  verifyStatus.classList.toggle("error", error);
}

function setLoading(value) {
  busy = value;
  submitButton.disabled = busy || !terms?.checked;
  activateButton.disabled = busy;
  resendButton.disabled = busy;
}

function syncPlanSelection() {
  document.querySelectorAll(".package-option").forEach(card => {
    card.classList.toggle("is-selected", Boolean(card.querySelector('input[type="radio"]')?.checked));
  });
  if (selectedPlan() !== "premium") {
    setRegisterStatus(t("register.status.unavailablePlan"), true);
  } else if (registerStatus.textContent === t("register.status.unavailablePlan")) {
    setRegisterStatus("");
  }
}

function errorElement(input) {
  const termsBox = input.closest(".terms-box");
  const label = input.closest("label");
  const host = termsBox || label || input.parentElement;
  let error;
  if (label && !termsBox) {
    error = label.querySelector(":scope>.field-error");
    if (!error) {
      error = document.createElement("div");
      error.className = "field-error";
      label.append(error);
    }
    return error;
  }
  error = host?.nextElementSibling;
  if (!error || !error.classList?.contains("field-error")) {
    error = document.createElement("div");
    error.className = "field-error";
    host?.after(error);
  }
  return error;
}

function inputLabel(input) {
  const label = input.closest("label");
  const text = (label?.childNodes?.[0]?.textContent || label?.textContent || "")
    .replace(/\s+/g, " ").trim();
  return text || t("register.validation.fallbackLabel");
}

function validationMessage(input) {
  const value = String(input.value || "").trim();
  if (input.type === "checkbox") return input.checked ? "" : t("register.validation.acceptTerms");
  if (input.required && !value) return t("register.validation.required", { label: inputLabel(input) });
  if (input.id === "phone" && digits(value).length !== 10) return t("register.validation.phone");
  if (input.type === "email" && value && !/^\S+@\S+\.\S+$/.test(value)) return t("register.validation.email");
  if (input.id === "secretA" && value.length > 0 && value.length < 8) return t("register.validation.passwordMin");
  if (input.id === "secretB" && value !== $("#secretA").value) return t("register.validation.passwordMismatch");
  return "";
}

const requiredSelectors = [
  "#ownerName", "#phone", "#email", "#orderDeliveryShopName", "#retailPosShopName",
  "#slug", "#secretA", "#secretB", "#termsAccepted",
];

function showValidation(input, force = tried) {
  if (!force) return true;
  const message = validationMessage(input);
  const box = input.closest(".terms-box") || input;
  const error = errorElement(input);
  input.classList.toggle("field-invalid", Boolean(message));
  box.classList?.toggle("field-invalid", Boolean(message));
  error.textContent = message;
  error.classList.toggle("show", Boolean(message));
  return !message;
}

function isValid() {
  tried = true;
  const inputs = requiredSelectors.map($).filter(Boolean);
  const valid = inputs.every(input => showValidation(input, true));
  if (!valid) inputs.find(input => validationMessage(input))?.focus?.();
  return valid;
}
function signupPayload() {
  if (!isValid()) throw Error(t("register.validation.checkRequired"));
  if (selectedPlan() !== "premium") throw Error(t("register.status.unavailablePlan"));
  return {
    packageId: selectedPlan(),
    ownerName: $("#ownerName").value.trim(),
    phone: digits($("#phone").value),
    orderDeliveryShopName: $("#orderDeliveryShopName").value.trim(),
    retailPosShopName: $("#retailPosShopName").value.trim(),
    slug: cleanSlug(slug.value),
    email: $("#email").value.trim().toLowerCase(),
    secret: $("#secretA").value,
  };
}

async function sendVerification(user) {
  if (!user) throw Error(t("register.status.accountNotFound"));
  await reload(user).catch(() => {});
  if (auth.currentUser?.emailVerified) return { alreadyVerified: true };
  await sendEmailVerification(auth.currentUser || user, {
    url: `${location.origin}/register/?verify=1`,
    handleCodeInApp: false,
  });
  return { alreadyVerified: false };
}

async function ensureUser(payload) {
  try {
    return await createUserWithEmailAndPassword(auth, payload.email, payload.secret);
  } catch (error) {
    if (!String(error?.code || error?.message || "").includes("email-already-in-use")) throw error;
    try {
      return await signInWithEmailAndPassword(auth, payload.email, payload.secret);
    } catch {
      throw Error(t("register.status.emailUsed"));
    }
  }
}

async function submitRegistration(event) {
  event.preventDefault();
  setRegisterStatus("");
  if (!isValid()) {
    setRegisterStatus(t("register.validation.checkRequired"), true);
    return;
  }
  setLoading(true);
  try {
    const payload = signupPayload();
    slug.value = payload.slug;
    slugPreview.textContent = storeUrl(payload.slug);
    const credential = await ensureUser(payload);
    await sendVerification(credential.user);
    await requestSignup(payload);
    form.classList.add("hidden");
    verifyBox.classList.add("show");
    setVerifyStatus(t("register.status.verificationSent"));
  } catch (error) {
    const code = String(error?.code || error?.message || "");
    let message = error?.message || t("register.status.signupFailed");
    if (code.includes("already-exists")) message = t("register.status.slugUsed");
    if (code.includes("weak-password")) message = t("register.validation.passwordMin");
    setRegisterStatus(message, true);
  } finally {
    setLoading(false);
  }
}

async function activateStore() {
  setLoading(true);
  try {
    const user = auth.currentUser;
    if (!user) throw Error(t("register.status.loginFirst"));
    await reload(user);
    if (!auth.currentUser.emailVerified) throw Error(t("register.status.emailUnverified"));
    const response = await activateSignup({});
    const tenantSlug = response.data?.slug || "";
    setVerifyStatus(t("register.status.activated"));
    location.href = tenantSlug ? `/login?tenant=${encodeURIComponent(tenantSlug)}` : "/login";
  } catch (error) {
    setVerifyStatus(error?.message || t("register.status.activateFailed"), true);
  } finally {
    setLoading(false);
  }
}

async function resendVerification() {
  setLoading(true);
  try {
    const result = await sendVerification(auth.currentUser);
    setVerifyStatus(result.alreadyVerified ? t("register.status.verifiedReady") : t("register.status.resendSent"));
  } catch (error) {
    setVerifyStatus(error?.message || t("register.status.resendFailed"), true);
  } finally {
    setLoading(false);
  }
}
injectValidationCss();
renderPricing().catch(error => console.warn("REGISTER_PRICING_RENDER_FAILED", error));

if (phone) {
  phone.placeholder = t("register.form.phonePlaceholder");
  phone.inputMode = "numeric";
  phone.addEventListener("input", () => {
    phone.value = digits(phone.value);
    showValidation(phone);
  });
  phone.addEventListener("blur", () => {
    phone.value = phoneFormat(phone.value);
    showValidation(phone);
  });
}

requiredSelectors.map($).filter(Boolean).forEach(input => {
  errorElement(input);
  input.addEventListener("input", () => showValidation(input));
  input.addEventListener("change", () => showValidation(input));
});

slug.addEventListener("input", () => {
  slugPreview.textContent = storeUrl(cleanSlug(slug.value));
});

document.querySelectorAll('input[name="packagePlan"]').forEach(input => {
  input.addEventListener("change", syncPlanSelection);
});

terms?.addEventListener("change", () => {
  submitButton.disabled = busy || !terms.checked;
  showValidation(terms);
});

syncPlanSelection();
submitButton.disabled = busy || !terms?.checked;
form.addEventListener("submit", submitRegistration);
activateButton.addEventListener("click", activateStore);
resendButton.addEventListener("click", resendVerification);

onAuthStateChanged(auth, async user => {
  if (user && location.search.includes("verify=1")) {
    await reload(user).catch(() => {});
    form.classList.add("hidden");
    verifyBox.classList.add("show");
    setVerifyStatus(
      auth.currentUser?.emailVerified
        ? t("register.status.verifiedReady")
        : t("register.status.clickVerify")
    );
  }
});
