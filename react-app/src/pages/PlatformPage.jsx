import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { applyPlatformBranding } from "@/components/PlatformBrandingRuntime";
import { loadPlatformBranding, savePlatformBranding } from "@/data/platformBrandingService";
import {
  loadPlatformGoogleApis,
  loadPlatformLalamove,
  loadPlatformSlipVerification,
  registerPlatformLalamoveWebhook,
  savePlatformGoogleApis,
  savePlatformLalamove,
  savePlatformSlipVerification,
  testPlatformLalamove,
  testPlatformSlipVerification,
} from "@/data/platformSettingsService";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

const BRANDING_ITEMS = [
  { key: "logo", fallback: "FOD", accept: "image/png,image/jpeg,image/webp" },
  { key: "favicon", fallbackIcon: "bi bi-window", accept: "image/png,image/x-icon,image/vnd.microsoft.icon" },
  { key: "appIcon", fallbackIcon: "bi bi-app", accept: "image/png,image/jpeg,image/webp" },
];

const EMPTY_BRANDING = {
  logoUrl: "", faviconUrl: "", appIconUrl: "",
  logoConfigured: false, faviconConfigured: false, appIconConfigured: false,
};

async function validateBrandingFile(kind, file) {
  if (!file) return;
  const allowed = kind === "favicon"
    ? ["image/png", "image/x-icon", "image/vnd.microsoft.icon"]
    : ["image/png", "image/jpeg", "image/webp"];
  const maxBytes = (kind === "favicon" ? 2 : 4) * 1024 * 1024;
  if (!allowed.includes(String(file.type || "").toLowerCase()) || file.size > maxBytes) {
    throw new Error("PLATFORM_BRANDING_INVALID");
  }
  if (kind !== "appIcon") return;

  const url = URL.createObjectURL(file);
  try {
    const size = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = url;
    });
    if (size.width < 192 || size.height < 192 || size.width !== size.height) {
      throw new Error("PLATFORM_BRANDING_INVALID");
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

const EMPTY_GOOGLE = {
  mapsBrowserConfigured: false, mapsBrowserMasked: "",
  routesApiConfigured: false, routesApiMasked: "",
  visionApiConfigured: false, visionApiMasked: "",
};

const EMPTY_SLIP = {
  provider: "google_vision",
  slip2GoApiUrl: "",
  slip2GoSecretConfigured: false,
  slip2GoSecretMasked: "",
  slip2GoReady: false,
  googleVisionReady: false,
  receiver: {},
};

const EMPTY_LALAMOVE = {
  environment: "sandbox",
  apiKeyConfigured: false, apiKeyMasked: "",
  apiSecretConfigured: false, apiSecretMasked: "",
  ready: false,
};

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

function ensureExternalStyle(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function ensureExternalScript(id, src) {
  const existing = document.getElementById(id);
  if (existing) {
    if (existing.dataset.loaded === "true") return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

async function ensureSelect2Runtime() {
  ensureExternalStyle("platformSelect2Style", "/assets/vendor/select2/select2-4.0.13.min.css?v=20260914-002");
  if (!window.jQuery) {
    await ensureExternalScript("platformJqueryScript", "/assets/vendor/jquery/jquery-3.7.1.min.js?v=20260914-002");
  }
  if (!window.jQuery?.fn?.select2) {
    await ensureExternalScript("platformSelect2Script", "/assets/vendor/select2/select2-4.0.13.min.js?v=20260914-002");
  }
}

function ControlCard({ titleId, icon, title, description, badge = "Super Admin", badgeId, badgeClass = "", children, className = "" }) {
  return (
    <section className={`card platform-google-api-card ${className}`} aria-labelledby={titleId}>
      <div className="section-title platform-google-api-title">
        <div>
          <h2 id={titleId}><i className={icon} aria-hidden="true"></i> {title}</h2>
          <p>{description}</p>
        </div>
        <span className={`badge${badgeClass ? ` ${badgeClass}` : ""}`} id={badgeId}>{badge}</span>
      </div>
      {children}
    </section>
  );
}

function SecretField({
  id, label, help, status, statusId, clearText, clearId, placeholder,
  value, onChange, onClear, disabled = false,
}) {
  return (
    <div className="field platform-google-api-field">
      <label htmlFor={id}>{label}</label>
      <input
        className="input"
        id={id}
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
      />
      <small id={statusId || `${id}Status`}>{status}</small>
      {help ? <small>{help}</small> : null}
      <button className="btn btn-sm" id={clearId} type="button" disabled={disabled} onClick={onClear}>
        <i className="bi bi-trash" aria-hidden="true"></i><span>{clearText}</span>
      </button>
    </div>
  );
}

export function PlatformPage() {
  const authState = useAuth();
  const { profile } = authState;
  const { t, raw } = useI18n();
  const stylesReady = useParityPage({
    title: t("platform.meta.title"),
    styles: ["platform-control-center.css", "super-admin-header.css"],
    attributes: { "data-roles": "super_admin" },
  });

  const [branding, setBranding] = useState(EMPTY_BRANDING);
  const [brandingFiles, setBrandingFiles] = useState({ logo: null, favicon: null, appIcon: null });
  const [brandingClear, setBrandingClear] = useState({ logo: false, favicon: false, appIcon: false });
  const [brandingBusy, setBrandingBusy] = useState(true);
  const [brandingPreview, setBrandingPreview] = useState({ logo: "", favicon: "", appIcon: "" });

  const [google, setGoogle] = useState(EMPTY_GOOGLE);
  const [googleInput, setGoogleInput] = useState({ mapsBrowserKey: "", routesApiKey: "", visionApiKey: "" });
  const [googleClear, setGoogleClear] = useState({ mapsBrowserKey: false, routesApiKey: false, visionApiKey: false });
  const [googleBusy, setGoogleBusy] = useState(true);
  const [googleLoadError, setGoogleLoadError] = useState(false);

  const [slip, setSlip] = useState(EMPTY_SLIP);
  const [slipSecret, setSlipSecret] = useState("");
  const [slipClearSecret, setSlipClearSecret] = useState(false);
  const [slipBusy, setSlipBusy] = useState(true);
  const [slipQuota, setSlipQuota] = useState("");
  const [slipLoadError, setSlipLoadError] = useState(false);
  const receiverAccountTypeRef = useRef(null);

  const [lalamove, setLalamove] = useState(EMPTY_LALAMOVE);
  const [lalamoveInput, setLalamoveInput] = useState({ apiKey: "", apiSecret: "" });
  const [lalamoveClear, setLalamoveClear] = useState({ apiKey: false, apiSecret: false });
  const [lalamoveBusy, setLalamoveBusy] = useState(true);
  const [lalamoveWebhookBusy, setLalamoveWebhookBusy] = useState(false);
  const [lalamoveWebhookStatus, setLalamoveWebhookStatus] = useState("");
  const [lalamoveError, setLalamoveError] = useState("");
  const [lalamoveTesting, setLalamoveTesting] = useState(false);

  const googleStatusText = (configured, masked, clearing = false) => {
    if (clearing) return t("platform.google_api.clear_pending");
    return configured
      ? t("platform.google_api.configured", { masked: masked || "••••" })
      : t("platform.google_api.not_configured");
  };
  const slipSecretText = (configured, masked, clearing = false) => {
    if (clearing) return t("platform.slip_verification.clear_pending");
    return configured
      ? t("platform.slip_verification.configured", { masked: masked || "••••" })
      : t("platform.slip_verification.not_configured");
  };
  const lalamoveCredentialText = (configured, masked, clearing = false) => {
    if (clearing) return t("platform.lalamove.clear_pending");
    return configured
      ? t("platform.lalamove.configured", { masked: masked || "••••" })
      : t("platform.lalamove.not_configured");
  };

  const applyGoogle = item => {
    setGoogle({ ...EMPTY_GOOGLE, ...(item || {}) });
    setGoogleInput({ mapsBrowserKey: "", routesApiKey: "", visionApiKey: "" });
    setGoogleClear({ mapsBrowserKey: false, routesApiKey: false, visionApiKey: false });
  };

  const applySlip = item => {
    const next = { ...EMPTY_SLIP, ...(item || {}), receiver: { ...(item?.receiver || {}) } };
    setSlip(next);
    setSlipSecret("");
    setSlipClearSecret(false);
  };

  const applyLalamove = item => {
    setLalamove({ ...EMPTY_LALAMOVE, ...(item || {}) });
    setLalamoveInput({ apiKey: "", apiSecret: "" });
    setLalamoveClear({ apiKey: false, apiSecret: false });
    setLalamoveWebhookStatus("");
    setLalamoveError("");
  };

  useEffect(() => {
    if (profile?.role !== "super_admin") return;
    let active = true;

    setBrandingBusy(true);
    loadPlatformBranding()
      .then(item => {
        if (!active) return;
        setBranding({ ...EMPTY_BRANDING, ...item });
        setBrandingFiles({ logo: null, favicon: null, appIcon: null });
        setBrandingClear({ logo: false, favicon: false, appIcon: false });
        setBrandingPreview({ logo: "", favicon: "", appIcon: "" });
      })
      .catch(error => {
        console.error("PLATFORM_BRANDING_LOAD_FAILED", error);
        if (active) showToast(t("platform.branding.load_failed"), "error");
      })
      .finally(() => { if (active) setBrandingBusy(false); });

    setGoogleBusy(true);
    setGoogleLoadError(false);
    loadPlatformGoogleApis()
      .then(data => {
        if (!active) return;
        applyGoogle(data.item);
        setGoogleLoadError(false);
      })
      .catch(error => {
        console.error("PLATFORM_GOOGLE_API_LOAD_FAILED", error);
        if (active) {
          setGoogleLoadError(true);
          showToast(t("platform.google_api.load_failed"), "error");
        }
      })
      .finally(() => { if (active) setGoogleBusy(false); });

    setSlipBusy(true);
    setSlipLoadError(false);
    loadPlatformSlipVerification()
      .then(data => {
        if (!active) return;
        applySlip(data.item);
        setSlipLoadError(false);
        setSlipQuota(t("platform.slip_verification.quota_not_checked"));
      })
      .catch(error => {
        console.error("PLATFORM_SLIP_LOAD_FAILED", error);
        if (active) {
          setSlipLoadError(true);
          showToast(t("platform.slip_verification.load_failed"), "error");
        }
      })
      .finally(() => { if (active) setSlipBusy(false); });

    setLalamoveBusy(true);
    loadPlatformLalamove()
      .then(data => { if (active) applyLalamove(data.item); })
      .catch(error => {
        console.error("PLATFORM_LALAMOVE_LOAD_FAILED", error);
        if (active) {
          setLalamoveError(t("platform.lalamove.load_failed"));
          showToast(t("platform.lalamove.load_failed"), "error");
        }
      })
      .finally(() => { if (active) setLalamoveBusy(false); });

    return () => { active = false; };
  }, [profile?.role, t]);

  useEffect(() => {
    if (profile?.role !== "super_admin") return undefined;
    let active = true;
    let select = null;

    ensureSelect2Runtime()
      .then(() => {
        if (!active || !receiverAccountTypeRef.current || !window.jQuery?.fn?.select2) return;
        const jq = window.jQuery;
        select = jq(receiverAccountTypeRef.current);
        if (!select.hasClass("select2-hidden-accessible")) {
          select.select2({
            width: "100%",
            minimumResultsForSearch: 0,
            allowClear: true,
            placeholder: t("platform.slip_verification.receiver_search_placeholder"),
            matcher(params, data) {
              const term = String(params.term || "").trim().toLocaleLowerCase();
              if (!term) return data;
              const haystack = `${data.text || ""} ${data.id || ""}`.toLocaleLowerCase();
              return haystack.includes(term) ? data : null;
            },
            language: {
              searching: () => t("platform.slip_verification.receiver_searching"),
              noResults: () => t("platform.slip_verification.receiver_no_results"),
            },
          });
        }
        select
          .off("change.platformReact")
          .on("change.platformReact", () => {
            const value = String(select.val() || "");
            setSlip(current => ({
              ...current,
              receiver: { ...(current.receiver || {}), accountType: value },
            }));
          });
        select.val(slip.receiver?.accountType || "").trigger("change.select2");
      })
      .catch(error => console.error("PLATFORM_SELECT2_LOAD_FAILED", error));

    return () => {
      active = false;
      if (!select) return;
      select.off("change.platformReact");
      if (select.hasClass("select2-hidden-accessible")) select.select2("destroy");
    };
  }, [profile?.role, t]);

  useEffect(() => {
    const element = receiverAccountTypeRef.current;
    const jq = window.jQuery;
    if (!element || !jq?.fn?.select2) return;
    const select = jq(element);
    if (!select.hasClass("select2-hidden-accessible")) return;
    select.val(slip.receiver?.accountType || "").trigger("change.select2");
  }, [slip.receiver?.accountType]);

  const chooseBrandingFile = async (kind, file) => {
    if (!file) return;
    try {
      await validateBrandingFile(kind, file);
      const previousPreview = brandingPreview[kind];
      if (previousPreview) URL.revokeObjectURL(previousPreview);
      const preview = URL.createObjectURL(file);
      setBrandingFiles(current => ({ ...current, [kind]: file }));
      setBrandingClear(current => ({ ...current, [kind]: false }));
      setBrandingPreview(current => ({ ...current, [kind]: preview }));
    } catch (error) {
      console.error("PLATFORM_BRANDING_FILE_INVALID", kind, error);
      showToast(t("platform.branding.save_failed"), "error");
    }
  };

  const clearBranding = kind => {
    const previousPreview = brandingPreview[kind];
    if (previousPreview) URL.revokeObjectURL(previousPreview);
    setBrandingFiles(current => ({ ...current, [kind]: null }));
    setBrandingClear(current => ({ ...current, [kind]: true }));
    setBrandingPreview(current => ({ ...current, [kind]: "" }));
  };

  const saveBranding = async event => {
    event.preventDefault();
    setBrandingBusy(true);
    try {
      const item = await savePlatformBranding({ files: brandingFiles, clear: brandingClear });
      Object.values(brandingPreview).filter(Boolean).forEach(url => URL.revokeObjectURL(url));
      setBranding({ ...EMPTY_BRANDING, ...item });
      setBrandingFiles({ logo: null, favicon: null, appIcon: null });
      setBrandingClear({ logo: false, favicon: false, appIcon: false });
      setBrandingPreview({ logo: "", favicon: "", appIcon: "" });
      applyPlatformBranding(item);
      showToast(t("platform.branding.save_success"));
    } catch (error) {
      console.error("PLATFORM_BRANDING_SAVE_FAILED", error);
      showToast(t("platform.branding.save_failed"), "error");
    } finally {
      setBrandingBusy(false);
    }
  };

  const saveGoogle = async event => {
    event.preventDefault();
    setGoogleBusy(true);
    try {
      const data = await savePlatformGoogleApis({
        ...googleInput,
        clearMapsBrowserKey: googleClear.mapsBrowserKey,
        clearRoutesApiKey: googleClear.routesApiKey,
        clearVisionApiKey: googleClear.visionApiKey,
      });
      applyGoogle(data.item);
      setGoogleLoadError(false);
      showToast(t("platform.google_api.save_success"));
      const slipData = await loadPlatformSlipVerification().catch(() => null);
      if (slipData?.item) applySlip(slipData.item);
    } catch (error) {
      console.error("PLATFORM_GOOGLE_API_SAVE_FAILED", error);
      showToast(t("platform.google_api.save_failed"), "error");
    } finally {
      setGoogleBusy(false);
    }
  };

  const saveSlip = async event => {
    event?.preventDefault?.();
    setSlipBusy(true);
    try {
      const receiver = slip.receiver || {};
      const data = await savePlatformSlipVerification({
        provider: slip.provider,
        slip2GoApiUrl: slip.slip2GoApiUrl,
        slip2GoSecret: slipSecret,
        clearSlip2GoSecret: slipClearSecret,
        receiverAccountType: receiver.accountType || "",
        receiverNameTh: receiver.accountNameTH || "",
        receiverNameEn: receiver.accountNameEN || "",
        receiverAccountNumber: receiver.accountNumber || "",
      });
      applySlip(data.item);
      setSlipLoadError(false);
      setSlipQuota(t("platform.slip_verification.quota_not_checked"));
      showToast(t("platform.slip_verification.save_success"));
      return data.item;
    } catch (error) {
      console.error("PLATFORM_SLIP_SAVE_FAILED", error);
      const invalidUrl = String(error?.message || "").includes("SLIP2GO_API_URL_INVALID");
      showToast(t(invalidUrl ? "platform.slip_verification.api_url_invalid" : "platform.slip_verification.save_failed"), "error");
      throw error;
    } finally {
      setSlipBusy(false);
    }
  };

  const testSlip = async () => {
    setSlipBusy(true);
    setSlipQuota(t("platform.slip_verification.testing"));
    try {
      const data = await testPlatformSlipVerification();
      const result = data.result || {};
      if (data.ok === false) {
        const details = [
          result.status || "",
          result.httpStatus ? `HTTP ${result.httpStatus}` : "",
          result.code ? `Code ${result.code}` : "",
          result.message || "",
        ].filter(Boolean).join(" • ");
        setSlipQuota(`${t("platform.slip_verification.test_failed")}${details ? ` — ${details}` : ""}`);
        const error = new Error(result.status || "SLIP2GO_TEST_FAILED");
        error.slipResult = result;
        throw error;
      }
      const account = result.data || {};
      setSlipQuota(t("platform.slip_verification.quota_ready", {
        package: account.package || "-",
        remaining: account.estimatedQuotaSlip ?? account.tokenRemaining ?? "-",
      }));
      showToast(t("platform.slip_verification.test_success"));
    } catch (error) {
      console.error("PLATFORM_SLIP_TEST_FAILED", error);
      if (!error?.slipResult) {
        const technical = [error?.code, error?.message].filter(Boolean).join(" • ");
        setSlipQuota(`${t("platform.slip_verification.test_failed")}${technical ? ` — ${technical}` : ""}`);
      }
      showToast(t("platform.slip_verification.test_failed"), "error");
    } finally {
      setSlipBusy(false);
    }
  };

  const saveLalamove = async (event, { silent = false } = {}) => {
    event?.preventDefault?.();
    setLalamoveBusy(true);
    setLalamoveError("");
    try {
      const data = await savePlatformLalamove({
        environment: lalamove.environment,
        apiKey: lalamoveInput.apiKey,
        apiSecret: lalamoveInput.apiSecret,
        clearApiKey: lalamoveClear.apiKey,
        clearApiSecret: lalamoveClear.apiSecret,
      });
      applyLalamove(data.item);
      if (!silent) showToast(t("platform.lalamove.save_success"));
      return data.item;
    } catch (error) {
      console.error("PLATFORM_LALAMOVE_SAVE_FAILED", error);
      setLalamoveError(t("platform.lalamove.save_failed"));
      if (!silent) showToast(t("platform.lalamove.save_failed"), "error");
      throw error;
    } finally {
      setLalamoveBusy(false);
    }
  };

  const testLalamove = async () => {
    setLalamoveBusy(true);
    setLalamoveTesting(true);
    setLalamoveError("");
    try {
      await saveLalamove(null, { silent: true });
      const data = await testPlatformLalamove();
      applyLalamove(data.item);
      showToast(t("platform.lalamove.test_success"));
    } catch (error) {
      console.error("PLATFORM_LALAMOVE_TEST_FAILED", error);
      const prefixMismatch = String(error?.message || "").includes("LALAMOVE_CREDENTIAL_PREFIX_MISMATCH");
      const message = t(prefixMismatch ? "platform.lalamove.prefix_mismatch" : "platform.lalamove.test_failed");
      setLalamoveError(message);
      showToast(message, "error");
    } finally {
      setLalamoveTesting(false);
      setLalamoveBusy(false);
    }
  };

  const webhookUrl = `${location.origin}/api/lalamove/webhook`;
  const webhookPublicHttps = location.protocol === "https:"
    && !["localhost", "127.0.0.1", "::1"].includes(location.hostname.toLowerCase());

  const registerLalamoveWebhook = async () => {
    if (!webhookPublicHttps) {
      const message = t("platform.lalamove.webhook_https_required");
      setLalamoveWebhookStatus(message);
      showToast(message, "error");
      return;
    }
    setLalamoveWebhookBusy(true);
    setLalamoveWebhookStatus(t("platform.lalamove.webhook_registering"));
    try {
      const result = await registerPlatformLalamoveWebhook({ url: webhookUrl });
      const registeredUrl = String(result?.url || webhookUrl);
      setLalamoveWebhookStatus(registeredUrl);
      showToast(t("platform.lalamove.webhook_success"));
      if (registeredUrl !== webhookUrl) console.info("LALAMOVE_WEBHOOK_REGISTERED_URL", registeredUrl);
    } catch (error) {
      console.error("PLATFORM_LALAMOVE_WEBHOOK_FAILED", error);
      const httpsRequired = String(error?.message || "").includes("LALAMOVE_WEBHOOK_PUBLIC_HTTPS_REQUIRED");
      const message = t(httpsRequired ? "platform.lalamove.webhook_https_required" : "platform.lalamove.webhook_failed");
      setLalamoveWebhookStatus(message);
      showToast(message, "error");
    } finally {
      setLalamoveWebhookBusy(false);
    }
  };

  if (authState.status === "loading" || !stylesReady) {
    return <PageReadyOverlay context="LUKKAJA" title={t("shared.state.loading")} message={t("shared.state.please_wait")} progress={72} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fplatform" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  const receiverTypes = raw("platform.slip_verification.receiver_account_types") || {};
  const slipReady = slip.provider === "google_vision" ? slip.googleVisionReady === true : slip.slip2GoReady === true;
  const lalamoveBadge = lalamoveTesting
    ? t("platform.lalamove.testing")
    : (lalamoveError || (lalamove.ready
      ? t("platform.lalamove.connection_ready", { environment: lalamove.environment })
      : t("platform.lalamove.connection_not_ready")));

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="brand"><span className="brand-mark">FOD</span><span>{t("platform.header.title")}</span></div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0, order: -100 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main className="container platform-shell">
        <section className="hero platform-hero">
          <h1>{t("platform.hero.title")}</h1>
          <p>{t("platform.hero.description")}</p>
        </section>

        <section className="nav-cards platform-cards">
          <Link className="card nav-card" to="/admin/tenants"><i className="bi bi-arrow-left-right app-icon" aria-hidden="true"></i><strong>{t("platform.cards.tenants.title")}</strong><small>{t("platform.cards.tenants.description")}</small></Link>
          <Link className="card nav-card" to="/platform/owners"><i className="bi bi-people app-icon" aria-hidden="true"></i><strong>{t("platform.cards.owners.title")}</strong><small>{t("platform.cards.owners.description")}</small></Link>
          <Link className="card nav-card" to="/platform/contact"><i className="bi bi-chat-heart app-icon" aria-hidden="true"></i><strong>{t("platform.cards.contact.title")}</strong><small>{t("platform.cards.contact.description")}</small></Link>
          <Link className="card nav-card" to="/platform/pricing"><i className="bi bi-tags app-icon" aria-hidden="true"></i><strong>{t("platform.cards.pricing.title")}</strong><small>{t("platform.cards.pricing.description")}</small></Link>
        </section>

        <ControlCard titleId="platformBrandingTitle" icon="bi bi-palette" title={t("platform.branding.title")} description={t("platform.branding.description")} className="platform-branding-card">
          <form id="platformBrandingForm" className="platform-google-api-form" noValidate onSubmit={saveBranding}>
            <div className="platform-branding-grid">
              {BRANDING_ITEMS.map(item => {
                const urlKey = item.key === "appIcon" ? "appIconUrl" : `${item.key}Url`;
                const configuredKey = item.key === "appIcon" ? "appIconConfigured" : `${item.key}Configured`;
                const previewUrl = brandingPreview[item.key] || (brandingClear[item.key] ? "" : branding[urlKey] || "");
                const configured = Boolean(brandingFiles[item.key] || (!brandingClear[item.key] && branding[configuredKey]));
                const inputId = `platformBrandingInput-${item.key}`;
                return (
                  <article className="platform-branding-item" key={item.key}>
                    <div className="platform-branding-preview" data-branding-preview={item.key}>
                      {previewUrl ? <img src={previewUrl} alt="" /> : null}
                      <span data-branding-fallback hidden={Boolean(previewUrl)}>{item.fallbackIcon ? <i className={item.fallbackIcon} aria-hidden="true"></i> : item.fallback}</span>
                    </div>
                    <div className="platform-branding-copy">
                      <strong>{t(`platform.branding.${item.key === "appIcon" ? "app_icon" : item.key}`)}</strong>
                      <small>{t(`platform.branding.${item.key === "appIcon" ? "app_icon_help" : item.key + "_help"}`)}</small>
                      <small data-branding-status={item.key}>
                        {brandingClear[item.key]
                          ? t("platform.branding.clear_pending")
                          : t(configured ? "platform.branding.configured" : "platform.branding.not_configured")}
                      </small>
                    </div>
                    <input
                      id={inputId}
                      type="file"
                      hidden
                      data-branding-input={item.key}
                      accept={item.accept}
                      disabled={brandingBusy}
                      onChange={event => chooseBrandingFile(item.key, event.target.files?.[0])}
                    />
                    <div className="platform-branding-buttons">
                      <button className="btn btn-sm" type="button" data-branding-pick={item.key} disabled={brandingBusy} onClick={() => document.getElementById(inputId)?.click()}>
                        <i className="bi bi-upload" aria-hidden="true"></i><span>{t("platform.branding.choose_file")}</span>
                      </button>
                      <button className="btn btn-sm" type="button" data-branding-clear={item.key} disabled={brandingBusy} onClick={() => clearBranding(item.key)}>
                        <i className="bi bi-trash" aria-hidden="true"></i><span>{t("platform.branding.clear")}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="platform-google-api-notes">
              <p><i className="bi bi-info-circle" aria-hidden="true"></i><span>{t("platform.branding.runtime_help")}</span></p>
              <p><i className="bi bi-phone" aria-hidden="true"></i><span>{t("platform.branding.pwa_help")}</span></p>
            </div>
            <div className="platform-google-api-actions">
              <button className="btn btn-primary" id="savePlatformBrandingButton" type="submit" disabled={brandingBusy}><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform.branding.save")}</span></button>
            </div>
          </form>
        </ControlCard>

        <ControlCard titleId="platformGoogleApiTitle" icon="bi bi-google" title={t("platform.google_api.title")} description={t("platform.google_api.description")} className="platform-google-services-card">
          <form id="platformGoogleApiForm" className="platform-google-api-form" noValidate onSubmit={saveGoogle}>
            <div className="platform-google-api-grid">
              <SecretField
                id="platformGoogleMapsBrowserApiKey" clearId="clearPlatformGoogleMapsBrowserApiKey"
                placeholder={t("platform.google_api.placeholder_new")} label={t("platform.google_api.maps_browser_key")}
                help={t("platform.google_api.maps_browser_help")} clearText={t("platform.google_api.clear")}
                value={googleInput.mapsBrowserKey} disabled={googleBusy}
                statusId="platformGoogleMapsBrowserApiStatus"
                status={googleLoadError ? t("platform.google_api.load_failed") : googleStatusText(google.mapsBrowserConfigured, google.mapsBrowserMasked, googleClear.mapsBrowserKey)}
                onChange={value => { setGoogleInput(current => ({ ...current, mapsBrowserKey: value })); if (value) setGoogleClear(current => ({ ...current, mapsBrowserKey: false })); }}
                onClear={() => { setGoogleInput(current => ({ ...current, mapsBrowserKey: "" })); setGoogleClear(current => ({ ...current, mapsBrowserKey: true })); }}
              />
              <SecretField
                id="platformGoogleRoutesApiKey" clearId="clearPlatformGoogleRoutesApiKey"
                placeholder={t("platform.google_api.placeholder_new")} label={t("platform.google_api.routes_api_key")}
                help={t("platform.google_api.routes_api_help")} clearText={t("platform.google_api.clear")}
                value={googleInput.routesApiKey} disabled={googleBusy}
                statusId="platformGoogleRoutesApiStatus"
                status={googleLoadError ? t("platform.google_api.load_failed") : googleStatusText(google.routesApiConfigured, google.routesApiMasked, googleClear.routesApiKey)}
                onChange={value => { setGoogleInput(current => ({ ...current, routesApiKey: value })); if (value) setGoogleClear(current => ({ ...current, routesApiKey: false })); }}
                onClear={() => { setGoogleInput(current => ({ ...current, routesApiKey: "" })); setGoogleClear(current => ({ ...current, routesApiKey: true })); }}
              />
              <SecretField
                id="platformGoogleVisionApiKey" clearId="clearPlatformGoogleVisionApiKey"
                placeholder={t("platform.google_api.placeholder_new")} label={t("platform.google_api.vision_api_key")}
                help={t("platform.google_api.vision_api_help")} clearText={t("platform.google_api.clear")}
                value={googleInput.visionApiKey} disabled={googleBusy}
                statusId="platformGoogleVisionApiStatus"
                status={googleLoadError ? t("platform.google_api.load_failed") : googleStatusText(google.visionApiConfigured, google.visionApiMasked, googleClear.visionApiKey)}
                onChange={value => { setGoogleInput(current => ({ ...current, visionApiKey: value })); if (value) setGoogleClear(current => ({ ...current, visionApiKey: false })); }}
                onClear={() => { setGoogleInput(current => ({ ...current, visionApiKey: "" })); setGoogleClear(current => ({ ...current, visionApiKey: true })); }}
              />
            </div>
            <div className="platform-google-api-notes">
              <p><i className="bi bi-shield-lock" aria-hidden="true"></i><span>{t("platform.google_api.security_help")}</span></p>
              <p><i className="bi bi-signpost-split" aria-hidden="true"></i><span>{t("platform.google_api.fallback_help")}</span></p>
            </div>
            <div className="platform-google-api-actions">
              <button className="btn btn-primary" id="savePlatformGoogleApiButton" type="submit" disabled={googleBusy}><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform.google_api.save")}</span></button>
            </div>
          </form>
        </ControlCard>

        <ControlCard
          titleId="platformSlipVerificationTitle" icon="bi bi-shield-check"
          title={t("platform.slip_verification.title")} description={t("platform.slip_verification.description")}
          badge={slipLoadError ? t("platform.slip_verification.load_failed") : t(slipReady ? "platform.slip_verification.ready" : "platform.slip_verification.not_ready")}
          badgeId="platformSlipVerificationStatus" badgeClass={slipReady && !slipLoadError ? "is-ready" : "is-error"}
          className="platform-slip-verification-card"
        >
          <form id="platformSlipVerificationForm" className="platform-google-api-form" noValidate onSubmit={saveSlip}>
            <div className="platform-google-api-grid">
              <div className="field platform-google-api-field">
                <label htmlFor="platformSlipVerificationProvider">{t("platform.slip_verification.provider")}</label>
                <select className="input" id="platformSlipVerificationProvider" value={slip.provider} disabled={slipBusy} onChange={event => setSlip(current => ({ ...current, provider: event.target.value }))}>
                  <option value="google_vision">{t("platform.slip_verification.providers.google_vision")}</option>
                  <option value="slip2go">{t("platform.slip_verification.providers.slip2go")}</option>
                  <option value="slip2go_fallback_vision">{t("platform.slip_verification.providers.slip2go_fallback_vision")}</option>
                </select>
                <small>{t("platform.slip_verification.provider_help")}</small>
              </div>
              <div className="field platform-google-api-field">
                <label htmlFor="platformSlip2GoApiUrl">{t("platform.slip_verification.api_url")}</label>
                <input className="input" id="platformSlip2GoApiUrl" type="url" maxLength="255" autoComplete="off" spellCheck={false} placeholder="https://...slip2go.com" value={slip.slip2GoApiUrl} disabled={slipBusy} onChange={event => setSlip(current => ({ ...current, slip2GoApiUrl: event.target.value }))} />
                <small>{t("platform.slip_verification.api_url_help")}</small>
              </div>
              <SecretField
                id="platformSlip2GoSecret" clearId="clearPlatformSlip2GoSecret"
                placeholder={t("platform.slip_verification.secret_placeholder")} label={t("platform.slip_verification.secret")}
                clearText={t("platform.slip_verification.clear")} value={slipSecret} disabled={slipBusy}
                statusId="platformSlip2GoSecretStatus"
                status={slipSecretText(slip.slip2GoSecretConfigured, slip.slip2GoSecretMasked, slipClearSecret)}
                onChange={value => { setSlipSecret(value); if (value) setSlipClearSecret(false); }}
                onClear={() => { setSlipSecret(""); setSlipClearSecret(true); }}
              />
            </div>

            <div className="platform-slip-receiver-grid">
              <div className="field">
                <label htmlFor="platformSlip2GoReceiverAccountType">{t("platform.slip_verification.receiver_account_type")}</label>
                <select ref={receiverAccountTypeRef} className="input" id="platformSlip2GoReceiverAccountType" value={slip.receiver?.accountType || ""} disabled={slipBusy} onChange={event => setSlip(current => ({ ...current, receiver: { ...current.receiver, accountType: event.target.value } }))}>
                  {Object.entries(receiverTypes).map(([value, label]) => <option value={value} key={value || "none"}>{label}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="platformSlip2GoReceiverNameTh">{t("platform.slip_verification.receiver_name_th")}</label><input className="input" id="platformSlip2GoReceiverNameTh" maxLength="180" disabled={slipBusy} value={slip.receiver?.accountNameTH || ""} onChange={event => setSlip(current => ({ ...current, receiver: { ...current.receiver, accountNameTH: event.target.value } }))} /></div>
              <div className="field"><label htmlFor="platformSlip2GoReceiverNameEn">{t("platform.slip_verification.receiver_name_en")}</label><input className="input" id="platformSlip2GoReceiverNameEn" maxLength="180" disabled={slipBusy} value={slip.receiver?.accountNameEN || ""} onChange={event => setSlip(current => ({ ...current, receiver: { ...current.receiver, accountNameEN: event.target.value } }))} /></div>
              <div className="field"><label htmlFor="platformSlip2GoReceiverAccountNumber">{t("platform.slip_verification.receiver_account_number")}</label><input className="input" id="platformSlip2GoReceiverAccountNumber" maxLength="80" disabled={slipBusy} value={slip.receiver?.accountNumber || ""} onChange={event => setSlip(current => ({ ...current, receiver: { ...current.receiver, accountNumber: event.target.value } }))} /></div>
            </div>
            <small className="platform-slip-receiver-help">{t("platform.slip_verification.receiver_help")}</small>

            <div className="platform-google-api-notes">
              <p><i className="bi bi-shield-lock" aria-hidden="true"></i><span>{t("platform.slip_verification.security_help")}</span></p>
              <p><i className="bi bi-arrow-repeat" aria-hidden="true"></i><span>{t("platform.slip_verification.fallback_help")}</span></p>
              <p><i className="bi bi-speedometer2" aria-hidden="true"></i><span id="platformSlip2GoQuotaStatus">{slipQuota || t("platform.slip_verification.quota_not_checked")}</span></p>
            </div>
            <div className="platform-google-api-actions platform-lalamove-actions">
              <button className="btn" id="testPlatformSlip2GoButton" type="button" disabled={slipBusy} onClick={testSlip}><i className="bi bi-plug" aria-hidden="true"></i><span>{t("platform.slip_verification.test")}</span></button>
              <button className="btn btn-primary" id="savePlatformSlipVerificationButton" type="submit" disabled={slipBusy}><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform.slip_verification.save")}</span></button>
            </div>
          </form>
        </ControlCard>

        <ControlCard
          titleId="platformLalamoveTitle" icon="bi bi-truck"
          title={t("platform.lalamove.title")} description={t("platform.lalamove.description")}
          badge={lalamoveBadge} badgeId="platformLalamoveConnectionStatus"
          badgeClass={lalamove.ready && !lalamoveError ? "is-ready" : "is-error"}
          className="platform-lalamove-card"
        >
          <form id="platformLalamoveForm" className="platform-google-api-form" noValidate onSubmit={saveLalamove}>
            <div className="platform-google-api-grid">
              <div className="field platform-google-api-field">
                <label htmlFor="platformLalamoveEnvironment">{t("platform.lalamove.environment")}</label>
                <select className="input" id="platformLalamoveEnvironment" value={lalamove.environment} disabled={lalamoveBusy} onChange={event => setLalamove(current => ({ ...current, environment: event.target.value, ready: false }))}>
                  <option value="sandbox">{t("platform.lalamove.sandbox")}</option>
                  <option value="production">{t("platform.lalamove.production")}</option>
                </select>
                <small>{t("platform.lalamove.phase_help")}</small>
              </div>
              <SecretField
                id="platformLalamoveApiKey" clearId="clearPlatformLalamoveApiKey"
                placeholder={t("platform.lalamove.placeholder_new")} label={t("platform.lalamove.api_key")}
                clearText={t("platform.lalamove.clear")} value={lalamoveInput.apiKey} disabled={lalamoveBusy}
                statusId="platformLalamoveApiKeyStatus"
                status={lalamoveCredentialText(lalamove.apiKeyConfigured, lalamove.apiKeyMasked, lalamoveClear.apiKey)}
                onChange={value => { setLalamoveInput(current => ({ ...current, apiKey: value })); if (value) setLalamoveClear(current => ({ ...current, apiKey: false })); }}
                onClear={() => { setLalamoveInput(current => ({ ...current, apiKey: "" })); setLalamoveClear(current => ({ ...current, apiKey: true })); }}
              />
              <SecretField
                id="platformLalamoveApiSecret" clearId="clearPlatformLalamoveApiSecret"
                placeholder={t("platform.lalamove.placeholder_new")} label={t("platform.lalamove.api_secret")}
                clearText={t("platform.lalamove.clear")} value={lalamoveInput.apiSecret} disabled={lalamoveBusy}
                statusId="platformLalamoveApiSecretStatus"
                status={lalamoveCredentialText(lalamove.apiSecretConfigured, lalamove.apiSecretMasked, lalamoveClear.apiSecret)}
                onChange={value => { setLalamoveInput(current => ({ ...current, apiSecret: value })); if (value) setLalamoveClear(current => ({ ...current, apiSecret: false })); }}
                onClear={() => { setLalamoveInput(current => ({ ...current, apiSecret: "" })); setLalamoveClear(current => ({ ...current, apiSecret: true })); }}
              />
            </div>
            <div className="platform-google-api-notes">
              <p><i className="bi bi-shield-lock" aria-hidden="true"></i><span>{t("platform.lalamove.security_help")}</span></p>
              <p><i className="bi bi-info-circle" aria-hidden="true"></i><span>{t("platform.lalamove.phase_help")}</span></p>
              <p><i className="bi bi-broadcast" aria-hidden="true"></i><span><strong>{t("platform.lalamove.webhook_title")}</strong><br /><code id="platformLalamoveWebhookUrl">{webhookUrl}</code><br /><small id="platformLalamoveWebhookStatus">{lalamoveWebhookStatus || t("platform.lalamove.webhook_help")}</small></span></p>
            </div>
            <div className="platform-google-api-actions platform-lalamove-actions">
              <button
                className="btn"
                id="registerPlatformLalamoveWebhookButton"
                type="button"
                disabled={lalamoveBusy || lalamoveWebhookBusy}
                onClick={registerLalamoveWebhook}
              ><i className="bi bi-broadcast" aria-hidden="true"></i><span>{lalamoveWebhookBusy ? t("platform.lalamove.webhook_registering") : t("platform.lalamove.webhook_register")}</span></button>
              <button className="btn" id="testPlatformLalamoveButton" type="button" disabled={lalamoveBusy} onClick={testLalamove}><i className="bi bi-plug" aria-hidden="true"></i><span>{t("platform.lalamove.test")}</span></button>
              <button className="btn btn-primary" id="savePlatformLalamoveButton" type="submit" disabled={lalamoveBusy}><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform.lalamove.save")}</span></button>
            </div>
          </form>
        </ControlCard>

        <section className="card platform-scope-card">
          <div className="section-title"><h2>{t("platform.scope.title")}</h2></div>
          <p className="menu-category platform-scope-description">{t("platform.scope.description")}</p>
        </section>
      </main>

      <ParityFooter />
    </>
  );
}
