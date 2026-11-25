import { BankalertStripePlatformSettings } from "@/components/BankalertStripePlatformSettings";
import { useEffect, useRef, useState } from "react";
import { PlatformCardAccordionHeader } from "@/components/PlatformCardAccordionHeader";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PlatformReceiverBankSelect } from "@/components/PlatformReceiverBankSelect";
import { DynamicField } from "@/components/DynamicField";
import { sweetConfirm } from "@/components/sweetDialog";
import { loadPlatformReceiptReceiver, savePlatformReceiptReceiver } from "@/data/platformReceiptReceiver";
import "@/ui/platform-receiver-redesign.css";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { applyPlatformBranding } from "@/components/PlatformBrandingRuntime";
import { loadPlatformBranding, savePlatformBranding } from "@/data/platformBrandingService";
import { EMPTY_PLATFORM_ADMIN_NOTIFICATIONS, loadPlatformAdminNotificationSummary } from "@/data/platformAdminNotifications";
import {
  loadPlatformGoogleApis,
  loadPlatformLalamove,
  registerPlatformLalamoveWebhook,
  savePlatformGoogleApis,
  savePlatformLalamove,
  testPlatformLalamove,
} from "@/data/platformSettingsService";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

const BRANDING_ITEMS = [
  { key: "logo", fallback: "PENGUIN", accept: "image/png,image/jpeg,image/webp", recommendationKey: "logo_recommended" },
  { key: "favicon", fallbackIcon: "bi bi-window", accept: "image/png,image/x-icon,image/vnd.microsoft.icon", recommendationKey: "favicon_recommended" },
  { key: "appIcon", fallbackIcon: "bi bi-app", accept: "image/png,image/jpeg,image/webp", recommendationKey: "app_icon_recommended" },
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
  receiver: {},
  revision: 0,
  configured: false,
  promptPayStorageReady: false,
  paymentRoutingEnabled: false,
};

const EMPTY_LALAMOVE = {
  environment: "sandbox",
  apiKeyConfigured: false, apiKeyMasked: "",
  apiSecretConfigured: false, apiSecretMasked: "",
  ready: false,
};

// A failed or slow remote read must never hold the entire Superadmin page.
function boundedPlatformRead(promise, timeoutMs=25000) {
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{
    timer=window.setTimeout(()=>reject(Error("PLATFORM_READ_TIMEOUT")),timeoutMs);
  })]).finally(()=>window.clearTimeout(timer));
}

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

function ControlCard({ titleId, icon, title, description, badge = "", badgeId, badgeClass = "", children, className = "", anchorId = "" }) {
  const [expanded, setExpanded] = useState(() => Boolean(anchorId && window.location.hash === "#" + anchorId));
  useEffect(() => {
    if (!anchorId || window.location.hash !== "#" + anchorId) return;
    setExpanded(true);
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(anchorId);
      el?.scrollIntoView({behavior:"smooth",block:"start"});
      el?.focus({preventScroll:true});
    });
    return () => cancelAnimationFrame(frame);
  }, [anchorId]);
  const panelId = `${titleId}Panel`;
  return (
    <section id={anchorId || undefined} tabIndex={anchorId ? -1 : undefined} className={`card platform-google-api-card platform-card-collapsible ${className}`}
      data-expanded={expanded} aria-labelledby={titleId}>
      <PlatformCardAccordionHeader
        titleId={titleId} panelId={panelId} icon={icon} title={title}
        description={description} badge={badge} badgeId={badgeId}
        badgeClass={badgeClass} expanded={expanded}
        onToggle={() => setExpanded(value => !value)}
      />
      <div id={panelId} className="platform-card-accordion-panel" hidden={!expanded}>
        {children}
      </div>
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
  const { t, raw, formatNumber, intlLocale } = useI18n();
  const stylesReady = useParityPage({
    title: t("platform.meta.title"),
    styles: ["platform-control-center.css", "super-admin-header.css"],
    attributes: { "data-roles": "super_admin" },
  });

  const [branding, setBranding] = useState(EMPTY_BRANDING);
  const [brandingFiles, setBrandingFiles] = useState({ logo: null, favicon: null, appIcon: null });
  const [brandingClear, setBrandingClear] = useState({ logo: false, favicon: false, appIcon: false });
  const [brandingBusy, setBrandingBusy] = useState(true);
  const [brandingLoadError, setBrandingLoadError] = useState(false);
  const [brandingReadReady, setBrandingReadReady] = useState(false);
  const [initialBrandingReady, setInitialBrandingReady] = useState(false);
  const [brandingPreview, setBrandingPreview] = useState({ logo: "", favicon: "", appIcon: "" });

  const [google, setGoogle] = useState(EMPTY_GOOGLE);
  const [googleInput, setGoogleInput] = useState({ mapsBrowserKey: "", routesApiKey: "", visionApiKey: "" });
  const [googleClear, setGoogleClear] = useState({ mapsBrowserKey: false, routesApiKey: false, visionApiKey: false });
  const [googleBusy, setGoogleBusy] = useState(true);
  const [initialGoogleReady, setInitialGoogleReady] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState(false);
  const [googleReadReady, setGoogleReadReady] = useState(false);

  const [slip, setSlip] = useState(EMPTY_SLIP);
  const [receiverUnconfirmed, setReceiverUnconfirmed] = useState(false);
  const [receiverPersisted, setReceiverPersisted] = useState(false);
  const [slipBusy, setSlipBusy] = useState(true);
  const [initialSlipReady, setInitialSlipReady] = useState(false);
  const [slipLoadError, setSlipLoadError] = useState(false);
  const [slipReadReady, setSlipReadReady] = useState(false);

  const [lalamove, setLalamove] = useState(EMPTY_LALAMOVE);
  const [lalamoveInput, setLalamoveInput] = useState({ apiKey: "", apiSecret: "" });
  const [lalamoveClear, setLalamoveClear] = useState({ apiKey: false, apiSecret: false });
  const [lalamoveBusy, setLalamoveBusy] = useState(true);
  const [lalamoveLoadError, setLalamoveLoadError] = useState(false);
  const [lalamoveReadReady, setLalamoveReadReady] = useState(false);
  const [initialLalamoveReady, setInitialLalamoveReady] = useState(false);
  const [lalamoveWebhookBusy, setLalamoveWebhookBusy] = useState(false);
  const [lalamoveWebhookStatus, setLalamoveWebhookStatus] = useState("");
  const [lalamoveError, setLalamoveError] = useState("");
  const [lalamoveTesting, setLalamoveTesting] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState(EMPTY_PLATFORM_ADMIN_NOTIFICATIONS);
  const [adminNotificationsLoading, setAdminNotificationsLoading] = useState(true);
  const [initialNotificationsReady, setInitialNotificationsReady] = useState(false);
  const [notificationsReadError,setNotificationsReadError]=useState(false);

  const googleStatusText = (configured, masked, clearing = false) => {
    if (clearing) return t("platform.google_api.clear_pending");
    return configured
      ? t("platform.google_api.configured", { masked: masked || "••••" })
      : t("platform.google_api.not_configured");
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
    const next = {...EMPTY_SLIP,...(item || {}),receiver:{...(item?.receiver || {})}};
    setSlip(next);
    setReceiverPersisted(next.configured === true && next.revision > 0);
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
    setInitialBrandingReady(false);
    setInitialGoogleReady(false);
    setInitialSlipReady(false);
    setInitialLalamoveReady(false);

    setBrandingBusy(true);
    setBrandingLoadError(false);
    setBrandingReadReady(false);
    boundedPlatformRead(loadPlatformBranding())
      .then(item => {
        if (!active) return;
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("PLATFORM_BRANDING_READ_INVALID");
        setBrandingReadReady(true);
        setBrandingLoadError(false);
        setBranding({ ...EMPTY_BRANDING, ...item });
        setBrandingFiles({ logo: null, favicon: null, appIcon: null });
        setBrandingClear({ logo: false, favicon: false, appIcon: false });
        setBrandingPreview({ logo: "", favicon: "", appIcon: "" });
      })
      .catch(error => {
        console.error("PLATFORM_BRANDING_LOAD_FAILED", error);
        if (active) {
          setBrandingReadReady(false);
          setBrandingLoadError(true);
          showToast(t("platform.branding.load_failed"), "error");
        }
      })
      .finally(() => {
        if (active) {
          setBrandingBusy(false);
          setInitialBrandingReady(true);
        }
      });

    setGoogleBusy(true);
    setGoogleLoadError(false);
    setGoogleReadReady(false);
    boundedPlatformRead(loadPlatformGoogleApis())
      .then(data => {
        if (!active) return;
        if (!data?.item || typeof data.item !== "object" || Array.isArray(data.item)) throw new Error("PLATFORM_GOOGLE_READ_INVALID");
        applyGoogle(data.item);
        setGoogleReadReady(true);
        setGoogleLoadError(false);
      })
      .catch(error => {
        console.error("PLATFORM_GOOGLE_API_LOAD_FAILED", error);
        if (active) {
          setGoogleReadReady(false);
          setGoogleLoadError(true);
          showToast(t("platform.google_api.load_failed"), "error");
        }
      })
      .finally(() => {
        if (active) {
          setGoogleBusy(false);
          setInitialGoogleReady(true);
        }
      });

    setSlipBusy(true);
    setSlipLoadError(false);
    setSlipReadReady(false);
    boundedPlatformRead(loadPlatformReceiptReceiver()).then(item => ({item}))
      .then(data => {
        if (!active) return;
        if (!data?.item || typeof data.item !== "object" || Array.isArray(data.item)) throw new Error("PLATFORM_SLIP_READ_INVALID");
        applySlip(data.item);
        setSlipReadReady(true);
        setSlipLoadError(false);
      })
      .catch(error => {
        console.error("PLATFORM_SLIP_LOAD_FAILED", error);
        if (active) {
          setSlipReadReady(false);
          setSlipLoadError(true);
          showToast("โหลดข้อมูลบัญชีผู้รับเงินกลางไม่สำเร็จ", "error");
        }
      })
      .finally(() => {
        if (active) {
          setSlipBusy(false);
          setInitialSlipReady(true);
        }
      });

    setLalamoveBusy(true);
    setLalamoveLoadError(false);
    setLalamoveReadReady(false);
    boundedPlatformRead(loadPlatformLalamove())
      .then(data => {
        if (!active) return;
        if (!data?.item || typeof data.item !== "object" || Array.isArray(data.item)) throw new Error("PLATFORM_LALAMOVE_READ_INVALID");
        applyLalamove(data.item);
        setLalamoveReadReady(true);
        setLalamoveLoadError(false);
      })
      .catch(error => {
        console.error("PLATFORM_LALAMOVE_LOAD_FAILED", error);
        if (active) {
          setLalamoveReadReady(false);
          setLalamoveLoadError(true);
          setLalamoveError(t("platform.lalamove.load_failed"));
          showToast(t("platform.lalamove.load_failed"), "error");
        }
      })
      .finally(() => {
        if (active) {
          setLalamoveBusy(false);
          setInitialLalamoveReady(true);
        }
      });

    return () => { active = false; };
  }, [profile?.role, t]);

  useEffect(() => {
    if (profile?.role !== "super_admin") return undefined;
    let active = true;
    let refreshing=false;
    const refresh = async () => {
      if(refreshing)return;
      refreshing=true;
      try {
        const summary = await boundedPlatformRead(loadPlatformAdminNotificationSummary({ force: true }));
        if (active) {setAdminNotifications(summary);setNotificationsReadError(summary?.partial===true);}
      } catch (error) {
        console.error("PLATFORM_ADMIN_NOTIFICATIONS_LOAD_FAILED", error);
        if(active){setNotificationsReadError(true);setAdminNotifications(EMPTY_PLATFORM_ADMIN_NOTIFICATIONS);}
      } finally {
        refreshing=false;
        if (active) {
          setAdminNotificationsLoading(false);
          setInitialNotificationsReady(true);
        }
      }
    };
    setAdminNotificationsLoading(true);
    setInitialNotificationsReady(false);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [profile?.role]);

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
    if (authState.status !== "ready" || profile?.role !== "super_admin" || brandingBusy || brandingLoadError || !brandingReadReady) return;
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
    if (authState.status !== "ready" || profile?.role !== "super_admin" || googleBusy || googleLoadError || !googleReadReady) return;
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
      // Provider keys and the bank receiver are now independent. Saving a
      // Google API key must never clobber a locally edited bank account.
    } catch (error) {
      console.error("PLATFORM_GOOGLE_API_SAVE_FAILED", error);
      showToast(t("platform.google_api.save_failed"), "error");
    } finally {
      setGoogleBusy(false);
    }
  };

  const saveReceiptReceiver = async event => {
    event?.preventDefault?.();
    if (authState.status !== "ready" || profile?.role !== "super_admin" ||
        slipBusy || slipLoadError || !slipReadReady || receiverUnconfirmed) return;
    const receiver=slip.receiver||{};
    const accountNumber=String(receiver.accountNumber||"").replace(/[-\s]/g,"");
    if(!/^01[0-9]{3}$/.test(receiver.accountType||"")||
       !/^[0-9]{4,20}$/.test(accountNumber)||
       !(String(receiver.accountNameTH||"").trim()||String(receiver.accountNameEN||"").trim())||
       (receiver.promptPayType==="phone"&&!/^0[0-9]{9}$/.test(receiver.promptPayId||""))||
       (receiver.promptPayType==="citizen"&&!/^[0-9]{13}$/.test(receiver.promptPayId||""))){
      showToast("กรุณาตรวจสอบบัญชีธนาคารและหมายเลขพร้อมเพย์", "error");
      return;
    }
    const confirmed=await sweetConfirm(
      "ยืนยันเปลี่ยนบัญชีรับเงินกลาง? การบันทึกบัญชีนี้ไม่ใช่หลักฐานว่ารับชำระแล้ว และจะไม่เปิดอนุมัติใบแจ้งหนี้อัตโนมัติ",
      {title:"ยืนยันบัญชีผู้รับเงินกลาง",type:"warning",
        confirmText:"ยืนยันบันทึก",cancelText:"กลับ",confirmIcon:"shield-check"},
    );
    if(!confirmed)return;
    setSlipBusy(true);
    try{
      const item=await savePlatformReceiptReceiver(
        {...receiver,accountNumber},Number(slip.revision||0));
      applySlip(item);
      showToast("บันทึกบัญชีผู้รับเงินกลางแล้ว");
    }catch(error){
      console.error("PLATFORM_RECEIPT_RECEIVER_SAVE_FAILED",error?.code||error?.message);
      const code=String(error?.code||"");
      if(error?.message==="RECEIVER_SAVE_UNCONFIRMED"||
         code.includes("failed-precondition")){
        setReceiverUnconfirmed(true);
        showToast("ยังยืนยันการบันทึกไม่ได้ กรุณารีโหลดและตรวจสอบบัญชีก่อนบันทึกซ้ำ","error");
      }else showToast("บันทึกบัญชีรับเงินกลางไม่สำเร็จ","error");
    }finally{setSlipBusy(false);}
  };

  const saveLalamove = async (event, { silent = false } = {}) => {
    event?.preventDefault?.();
    // The source calls saveLalamove from testLalamove while the busy flag is set.
    if (authState.status !== "ready" || profile?.role !== "super_admin" || lalamoveLoadError || !lalamoveReadReady) throw new Error("PLATFORM_LALAMOVE_NOT_READY");
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
    if (authState.status !== "ready" || profile?.role !== "super_admin" || lalamoveBusy || lalamoveLoadError || !lalamoveReadReady || lalamoveTesting) return;
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
    if (authState.status !== "ready" || profile?.role !== "super_admin" || lalamoveBusy || lalamoveWebhookBusy || lalamoveLoadError || !lalamoveReadReady) return;
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

  const initialReady = initialBrandingReady && initialGoogleReady && initialSlipReady && initialLalamoveReady && initialNotificationsReady;

  if (authState.status === "loading" || !stylesReady) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (authState.status === "error") return <main role="alert" data-platform-auth-error>{t("shared.state.load_failed")}</main>;
  if (!profile) return <Navigate to="/login?next=%2Fplatform" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  const receiverTypes = Object.fromEntries(
    Object.entries(raw("platform.slip_verification.receiver_account_types") || {})
      .filter(([code]) => /^01[0-9]{3}$/.test(code)),
  );
  const lalamoveBadge = lalamoveTesting
    ? t("platform.lalamove.testing")
    : (lalamoveError || (lalamove.ready
      ? t("platform.lalamove.connection_ready", { environment: lalamove.environment })
      : t("platform.lalamove.connection_not_ready")));
  const failedSettings = [
    brandingLoadError && t("platform.branding.title"),
    googleLoadError && t("platform.google_api.title"),
    slipLoadError && "บัญชีผู้รับเงินกลาง",
    lalamoveLoadError && t("platform.lalamove.title"),
    notificationsReadError && "การแจ้งเตือน",
  ].filter(Boolean);
  const notificationTotal = Number(adminNotifications?.total || 0);
  const walletNotificationCount = Number(adminNotifications?.wallet?.total || 0);
  const revenueNotificationCount = Number(adminNotifications?.revenueShare?.total || 0);

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="brand"><span className="brand-mark">PG</span><span>{t("platform.header.title")}</span></div>
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

        {!initialReady && <p role="status" className="platform-receiver-promptpay-help">กำลังโหลดการตั้งค่าแต่ละส่วน สามารถเข้าเมนูจัดการร้านค้าได้ตามปกติ</p>}
        {failedSettings.length>0 &&
          <div className="card" role="alert" style={{padding:12,marginBottom:12}}>
            โหลดข้อมูลบางส่วนไม่สำเร็จ: {failedSettings.join(" · ")} <button type="button" className="btn btn-sm" onClick={()=>location.reload()}><i className="bi bi-arrow-clockwise" aria-hidden="true"/> โหลดใหม่</button>
          </div>}
        <section className="nav-cards platform-cards">
          <Link className={`card nav-card platform-tenant-notification-card${notificationTotal > 0 ? " has-notifications" : ""}`} to="/admin/tenants" data-platform-tenant-notifications={notificationTotal}>
            <span className="platform-nav-card-icon"><i className="bi bi-arrow-left-right app-icon" aria-hidden="true"></i>{notificationTotal > 0 ? <b className="platform-nav-notification-badge" aria-label={t("platform.notifications.total_aria", { count: formatNumber(notificationTotal) })}>{formatNumber(notificationTotal)}</b> : null}</span>
            <strong>{t("platform.cards.tenants.title")}</strong>
            <small>{t("platform.cards.tenants.description")}</small>
            {!adminNotificationsLoading && notificationTotal > 0 ? (
              <span className="platform-nav-notification-breakdown" aria-label={t("platform.notifications.scope")}>
                {walletNotificationCount > 0 ? <span className="wallet"><i className="bi bi-wallet2" aria-hidden="true"></i>{t("platform.notifications.wallet", { count: formatNumber(walletNotificationCount) })}</span> : null}
                {revenueNotificationCount > 0 ? <span className="revenue"><i className="bi bi-receipt-cutoff" aria-hidden="true"></i>{t("platform.notifications.revenue_share", { count: formatNumber(revenueNotificationCount) })}</span> : null}
              </span>
            ) : null}
          </Link>
          <Link className="card nav-card" to="/platform/owners"><i className="bi bi-people app-icon" aria-hidden="true"></i><strong>{t("platform.cards.owners.title")}</strong><small>{t("platform.cards.owners.description")}</small></Link>
          <Link className="card nav-card" to="/platform/contact"><i className="bi bi-chat-heart app-icon" aria-hidden="true"></i><strong>{t("platform.cards.contact.title")}</strong><small>{t("platform.cards.contact.description")}</small></Link>
          <Link className="card nav-card" to="/platform/pricing"><i className="bi bi-credit-card app-icon" aria-hidden="true"></i><strong>ช่องทางรับเงิน</strong><small>Stripe, โอนเงิน และเพดาน Delivery</small></Link>
          {/* Hybrid invoice review route and its existing data are retained; the Platform launch card is temporarily hidden. */}
        </section>

        <div id="platformStripeSettings"><BankalertStripePlatformSettings /></div>

        <ControlCard titleId="platformBrandingTitle" icon="bi bi-palette" title={t("platform.branding.title")} description={t("platform.branding.description")} badge={t("shared.user_menu.roles.super_admin")} className="platform-branding-card">
          <form id="platformBrandingForm" className="platform-google-api-form" noValidate onSubmit={saveBranding}>
            <div className="platform-branding-grid">
              {BRANDING_ITEMS.map(item => {
                const urlKey = item.key === "appIcon" ? "appIconUrl" : `${item.key}Url`;
                const configuredKey = item.key === "appIcon" ? "appIconConfigured" : `${item.key}Configured`;
                const previewUrl = brandingPreview[item.key] || (brandingClear[item.key] ? "" : branding[urlKey] || "");
                const configured = Boolean(brandingFiles[item.key] || (!brandingClear[item.key] && branding[configuredKey]));
                const inputId = `platformBrandingInput-${item.key}`;
                return (
                  <article className={`platform-branding-item platform-branding-item-${item.key}`} key={item.key}>
                    <div className="platform-branding-preview" data-branding-preview={item.key}>
                      {previewUrl ? <img src={previewUrl} alt="" /> : null}
                      <span data-branding-fallback hidden={Boolean(previewUrl)}>{item.fallbackIcon ? <i className={item.fallbackIcon} aria-hidden="true"></i> : item.fallback}</span>
                    </div>
                    <div className="platform-branding-copy">
                      <strong>{t(`platform.branding.${item.key === "appIcon" ? "app_icon" : item.key}`)}</strong>
                      <small>{t(`platform.branding.${item.key === "appIcon" ? "app_icon_help" : item.key + "_help"}`)}</small>
                      <small className="platform-branding-size"><i className="bi bi-aspect-ratio" aria-hidden="true"></i><span>{t(`platform.branding.${item.recommendationKey}`)}</span></small>
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
                      disabled={brandingBusy || brandingLoadError || !brandingReadReady}
                      onChange={event => chooseBrandingFile(item.key, event.target.files?.[0])}
                    />
                    <div className="platform-branding-buttons">
                      <button className="btn btn-sm" type="button" data-branding-pick={item.key} disabled={brandingBusy || brandingLoadError || !brandingReadReady} onClick={() => document.getElementById(inputId)?.click()}>
                        <i className="bi bi-upload" aria-hidden="true"></i><span>{t("platform.branding.choose_file")}</span>
                      </button>
                      <button className="btn btn-sm" type="button" data-branding-clear={item.key} disabled={brandingBusy || brandingLoadError || !brandingReadReady} onClick={() => clearBranding(item.key)}>
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
              <button className="btn btn-primary" id="savePlatformBrandingButton" type="submit" disabled={brandingBusy || brandingLoadError || !brandingReadReady}><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform.branding.save")}</span></button>
            </div>
          </form>
        </ControlCard>

        <ControlCard titleId="platformGoogleApiTitle" icon="bi bi-google" title={t("platform.google_api.title")} description={t("platform.google_api.description")} badge={t("shared.user_menu.roles.super_admin")} className="platform-google-services-card">
          <form id="platformGoogleApiForm" className="platform-google-api-form" noValidate onSubmit={saveGoogle}>
            <div className="platform-google-api-grid">
              <SecretField
                id="platformGoogleMapsBrowserApiKey" clearId="clearPlatformGoogleMapsBrowserApiKey"
                placeholder={t("platform.google_api.placeholder_new")} label={t("platform.google_api.maps_browser_key")}
                help={t("platform.google_api.maps_browser_help")} clearText={t("platform.google_api.clear")}
                value={googleInput.mapsBrowserKey} disabled={googleBusy || googleLoadError || !googleReadReady}
                statusId="platformGoogleMapsBrowserApiStatus"
                status={googleLoadError ? t("platform.google_api.load_failed") : googleStatusText(google.mapsBrowserConfigured, google.mapsBrowserMasked, googleClear.mapsBrowserKey)}
                onChange={value => { setGoogleInput(current => ({ ...current, mapsBrowserKey: value })); if (value) setGoogleClear(current => ({ ...current, mapsBrowserKey: false })); }}
                onClear={() => { setGoogleInput(current => ({ ...current, mapsBrowserKey: "" })); setGoogleClear(current => ({ ...current, mapsBrowserKey: true })); }}
              />
              <SecretField
                id="platformGoogleRoutesApiKey" clearId="clearPlatformGoogleRoutesApiKey"
                placeholder={t("platform.google_api.placeholder_new")} label={t("platform.google_api.routes_api_key")}
                help={t("platform.google_api.routes_api_help")} clearText={t("platform.google_api.clear")}
                value={googleInput.routesApiKey} disabled={googleBusy || googleLoadError || !googleReadReady}
                statusId="platformGoogleRoutesApiStatus"
                status={googleLoadError ? t("platform.google_api.load_failed") : googleStatusText(google.routesApiConfigured, google.routesApiMasked, googleClear.routesApiKey)}
                onChange={value => { setGoogleInput(current => ({ ...current, routesApiKey: value })); if (value) setGoogleClear(current => ({ ...current, routesApiKey: false })); }}
                onClear={() => { setGoogleInput(current => ({ ...current, routesApiKey: "" })); setGoogleClear(current => ({ ...current, routesApiKey: true })); }}
              />
              <SecretField
                id="platformGoogleVisionApiKey" clearId="clearPlatformGoogleVisionApiKey"
                placeholder={t("platform.google_api.placeholder_new")} label={t("platform.google_api.vision_api_key")}
                help={t("platform.google_api.vision_api_help")} clearText={t("platform.google_api.clear")}
                value={googleInput.visionApiKey} disabled={googleBusy || googleLoadError || !googleReadReady}
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
              <button className="btn btn-primary" id="savePlatformGoogleApiButton" type="submit" disabled={googleBusy || googleLoadError || !googleReadReady}><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform.google_api.save")}</span></button>
            </div>
          </form>
        </ControlCard>

        <ControlCard
          titleId="platformSlipVerificationTitle" icon="bi bi-bank"
          title="บัญชีผู้รับเงินกลาง"
          description="จัดการบัญชีปลายทางสำหรับรับค่าบริการ ส่วนแบ่งรายวัน และการเติมเครดิต Lalamove"
          badge={slipBusy ? "กำลังโหลด" : slipLoadError || !slipReadReady ? "อ่านข้อมูลไม่สำเร็จ" : receiverUnconfirmed ? "รอตรวจสอบผลบันทึก" : receiverPersisted ? "ตั้งค่าบัญชีแล้ว" : "ยังไม่ได้ตั้งค่า"}
          badgeId="platformSlipVerificationStatus"
          badgeClass={receiverPersisted && slipReadReady && !slipLoadError && !receiverUnconfirmed ? "is-ready" : "is-error"}
          className="platform-slip-verification-card"
          anchorId="platformReceiverSettings"
        >
          <div className="platform-receiver-intro" role="note">
            <div className="platform-receiver-intro-icon"><i className="bi bi-shield-check" aria-hidden="true"/></div>
            <div><strong>บัญชีรับชำระของระบบกลาง</strong>
              <p>กำหนดบัญชีให้ถูกต้องก่อนเปิดรับโอนจากร้านค้า โดยข้อมูลนี้เป็นเพียงบัญชีผู้รับ ไม่ใช่หลักฐานยืนยันว่าได้รับเงินจริง</p></div>
          </div>
          {slipLoadError && <p role="alert" className="platform-receiver-promptpay-help">ไม่สามารถอ่านบัญชีผู้รับเงินกลางได้ ข้อมูลยังไม่ยืนยันและไม่สามารถบันทึกได้</p>}
          <form id="platformReceiptRecipientForm" className="platform-google-api-form" noValidate onSubmit={saveReceiptReceiver}>
            <h3 className="platform-receiver-section-title">รายละเอียดบัญชีรับเงิน</h3>
            <div className="platform-receiver-bank-grid">
                <PlatformReceiverBankSelect
                  dynamicLabel="ธนาคารผู้รับเงิน"
                  id="platformReceiptReceiverAccountType"
                  value={receiverTypes[slip.receiver?.accountType] ? slip.receiver.accountType : ""}
                  options={receiverTypes}
                  disabled={slipBusy || slipLoadError || !slipReadReady || receiverUnconfirmed}
                  searchPlaceholder={t("platform.slip_verification.receiver_search_placeholder")}
                  noResultsText={t("platform.slip_verification.receiver_no_results")}
                  loadMoreText={t("platform.slip_verification.receiver_load_more")}
                  onChange={accountType => setSlip(current=>({...current,receiver:{...current.receiver,accountType, ...(!/^01[0-9]{3}$/.test(current.receiver?.accountType||"")?{accountNumber:""}:{})}}))}
                />
              <DynamicField id="platformReceiptReceiverAccountNumber" label="เลขบัญชีธนาคารที่รับเงินจริง" value={/^01[0-9]{3}$/.test(slip.receiver?.accountType||"") ? slip.receiver?.accountNumber || "" : ""}>
                <input className="input" id="platformReceiptReceiverAccountNumber" maxLength="20" inputMode="numeric"
                  value={/^01[0-9]{3}$/.test(slip.receiver?.accountType||"") ? slip.receiver?.accountNumber || "" : ""} disabled={slipBusy || slipLoadError || !slipReadReady || receiverUnconfirmed}
                  onChange={event=>setSlip(current=>({...current,receiver:{...current.receiver,accountNumber:event.target.value}}))}/>
              </DynamicField>
              <DynamicField id="platformReceiptReceiverNameTH" label="ชื่อบัญชีผู้รับ (ภาษาไทย)" value={slip.receiver?.accountNameTH || ""}>
                <input className="input" id="platformReceiptReceiverNameTH" maxLength="180"
                  value={slip.receiver?.accountNameTH || ""} disabled={slipBusy || slipLoadError || !slipReadReady || receiverUnconfirmed}
                  onChange={event=>setSlip(current=>({...current,receiver:{...current.receiver,accountNameTH:event.target.value}}))}/>
              </DynamicField>
              <DynamicField id="platformReceiptReceiverNameEN" label="ชื่อบัญชีผู้รับ (ภาษาอังกฤษ)" value={slip.receiver?.accountNameEN || ""}>
                <input className="input" id="platformReceiptReceiverNameEN" maxLength="180"
                  value={slip.receiver?.accountNameEN || ""} disabled={slipBusy || slipLoadError || !slipReadReady || receiverUnconfirmed}
                  onChange={event=>setSlip(current=>({...current,receiver:{...current.receiver,accountNameEN:event.target.value}}))}/>
              </DynamicField>
            </div>
            <section className="platform-receiver-promptpay">
              <h3 className="platform-receiver-section-title">รายละเอียดพร้อมเพย์</h3>
              <p className="platform-receiver-promptpay-help">ใช้สร้าง QR รับชำระเงินเท่านั้น โปรดตรวจสอบว่าหมายเลขพร้อมเพย์ผูกกับบัญชีธนาคารด้านบนจริง</p>
              {slip.promptPayStorageReady !== true && <p role="status" className="platform-receiver-promptpay-help">ระบบยังไม่พร้อมจัดเก็บข้อมูลพร้อมเพย์แยกจากบัญชีธนาคาร</p>}
              <div className="platform-receiver-promptpay-grid">
                <DynamicField id="platformReceiptPromptPayType" kind="select" label="ประเภทพร้อมเพย์" value={slip.receiver?.promptPayType || "none"}>
                  <select id="platformReceiptPromptPayType" className="input" value={slip.receiver?.promptPayType || ""} disabled={slipBusy || slipLoadError || !slipReadReady || receiverUnconfirmed || slip.promptPayStorageReady !== true}
                    onChange={event=>setSlip(current=>({...current,receiver:{...current.receiver,promptPayType:event.target.value,promptPayId:""}}))}>
                    <option value="">ไม่ใช้พร้อมเพย์</option>
                    <option value="phone">หมายเลขโทรศัพท์</option>
                    <option value="citizen">เลขบัตรประชาชน</option>
                  </select>
                </DynamicField>
                {slip.receiver?.promptPayType && <DynamicField id="platformReceiptPromptPayId" label={slip.receiver.promptPayType==="phone"?"หมายเลขโทรศัพท์พร้อมเพย์":"เลขบัตรประชาชนพร้อมเพย์"} value={slip.receiver?.promptPayId || ""}>
                  <input id="platformReceiptPromptPayId" className="input" inputMode="numeric" autoComplete="off" maxLength={slip.receiver.promptPayType==="phone"?10:13} value={slip.receiver?.promptPayId || ""} disabled={slipBusy || slipLoadError || !slipReadReady || receiverUnconfirmed || slip.promptPayStorageReady !== true}
                    onChange={event=>setSlip(current=>({...current,receiver:{...current.receiver,promptPayId:event.target.value.replace(/[^0-9]/g,"")}}))}/>
                </DynamicField>}
              </div>
              {slip.receiver?.accountType && !/^01[0-9]{3}$/.test(slip.receiver.accountType) && <p role="alert">ข้อมูลเดิมไม่ใช่บัญชีธนาคาร กรุณาเลือกธนาคารและกรอกบัญชีที่รับเงินจริงก่อนบันทึก</p>}
            </section>
            <div className="platform-receiver-uses" aria-label="การใช้งานบัญชีรับเงิน">
              <span><i className="bi bi-check-circle" aria-hidden="true"/> ค่าบริการ Platform</span>
              <span><i className="bi bi-check-circle" aria-hidden="true"/> ส่วนแบ่งรายวัน</span>
              <span><i className="bi bi-check-circle" aria-hidden="true"/> เติมเครดิต Lalamove</span>
            </div>
            <p role="note" className="platform-receiver-promptpay-help">บัญชีที่บันทึกใน Firebase ยังไม่เปิดใช้เป็นช่องทางรับชำระอัตโนมัติ ต้องตรวจสอบระบบจับคู่ธุรกรรมและอนุมัติแยกต่างหาก</p>
            {slip.legacyUnconfirmed && <p role="note" className="platform-receiver-promptpay-help">พบข้อมูลบัญชีเดิมจากระบบตรวจสลิป กรุณาตรวจสอบรายละเอียดและยืนยันบันทึกก่อนใช้งาน</p>}
            {receiverUnconfirmed && <p role="alert" className="platform-receiver-promptpay-help">ยังยืนยันผลการบันทึกไม่ได้ กรุณารีโหลดก่อนดำเนินการต่อ</p>}
            <div className="platform-google-api-actions">
              <button className="btn btn-primary" id="savePlatformReceiptRecipientButton" type="submit"
                disabled={slipBusy || slipLoadError || !slipReadReady || receiverUnconfirmed}>
                <i className="bi bi-floppy" aria-hidden="true"/> บันทึกบัญชีผู้รับ
              </button>
            </div>
          </form>
          <div className="platform-receiver-footnote" role="note">
            <i className="bi bi-info-circle" aria-hidden="true"/>
            <span>ระบบตรวจสลิปใช้สำหรับอ่านหลักฐานประกอบ การรับเงินอัตโนมัติผ่าน PG Connect จะตรวจแจ้งเตือน LINE ตามเงื่อนไขที่เลือกไว้ และบันทึกประวัติแยกจาก Stripe</span>
          </div>
        </ControlCard>

        <ControlCard
          titleId="platformLalamoveTitle" icon="bi bi-truck"
          title={t("platform.lalamove.title")} description={t("platform.lalamove.description")}
          badge={lalamoveBadge} badgeId="platformLalamoveConnectionStatus"
          badgeClass={lalamove.ready && !lalamoveError && !lalamoveLoadError ? "is-ready" : "is-error"}
          className="platform-lalamove-card"
        >
          <form id="platformLalamoveForm" className="platform-google-api-form" noValidate onSubmit={saveLalamove}>
            <div className="platform-google-api-grid">
              <div className="field platform-google-api-field">
                <label htmlFor="platformLalamoveEnvironment">{t("platform.lalamove.environment")}</label>
                <select className="input" id="platformLalamoveEnvironment" value={lalamove.environment} disabled={lalamoveBusy || lalamoveLoadError || !lalamoveReadReady} onChange={event => setLalamove(current => ({ ...current, environment: event.target.value, ready: false }))}>
                  <option value="sandbox">{t("platform.lalamove.sandbox")}</option>
                  <option value="production">{t("platform.lalamove.production")}</option>
                </select>
                <small>{t("platform.lalamove.phase_help")}</small>
              </div>
              <SecretField
                id="platformLalamoveApiKey" clearId="clearPlatformLalamoveApiKey"
                placeholder={t("platform.lalamove.placeholder_new")} label={t("platform.lalamove.api_key")}
                clearText={t("platform.lalamove.clear")} value={lalamoveInput.apiKey} disabled={lalamoveBusy || lalamoveLoadError || !lalamoveReadReady}
                statusId="platformLalamoveApiKeyStatus"
                status={lalamoveLoadError ? t("platform.lalamove.load_failed") : lalamoveCredentialText(lalamove.apiKeyConfigured, lalamove.apiKeyMasked, lalamoveClear.apiKey)}
                onChange={value => { setLalamoveInput(current => ({ ...current, apiKey: value })); if (value) setLalamoveClear(current => ({ ...current, apiKey: false })); }}
                onClear={() => { setLalamoveInput(current => ({ ...current, apiKey: "" })); setLalamoveClear(current => ({ ...current, apiKey: true })); }}
              />
              <SecretField
                id="platformLalamoveApiSecret" clearId="clearPlatformLalamoveApiSecret"
                placeholder={t("platform.lalamove.placeholder_new")} label={t("platform.lalamove.api_secret")}
                clearText={t("platform.lalamove.clear")} value={lalamoveInput.apiSecret} disabled={lalamoveBusy || lalamoveLoadError || !lalamoveReadReady}
                statusId="platformLalamoveApiSecretStatus"
                status={lalamoveLoadError ? t("platform.lalamove.load_failed") : lalamoveCredentialText(lalamove.apiSecretConfigured, lalamove.apiSecretMasked, lalamoveClear.apiSecret)}
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
                disabled={lalamoveBusy || lalamoveWebhookBusy || lalamoveLoadError || !lalamoveReadReady}
                onClick={registerLalamoveWebhook}
              ><i className="bi bi-broadcast" aria-hidden="true"></i><span>{lalamoveWebhookBusy ? t("platform.lalamove.webhook_registering") : t("platform.lalamove.webhook_register")}</span></button>
              <button className="btn" id="testPlatformLalamoveButton" type="button" disabled={lalamoveBusy || lalamoveLoadError || !lalamoveReadReady} onClick={testLalamove}><i className="bi bi-plug" aria-hidden="true"></i><span>{t("platform.lalamove.test")}</span></button>
              <button className="btn btn-primary" id="savePlatformLalamoveButton" type="submit" disabled={lalamoveBusy || lalamoveLoadError || !lalamoveReadReady}><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform.lalamove.save")}</span></button>
            </div>
          </form>
        </ControlCard>

        <ControlCard titleId="platformScopeTitle" icon="bi bi-info-circle"
          title={t("platform.scope.title")} className="platform-scope-card">
          <p className="menu-category platform-scope-description">{t("platform.scope.description")}</p>
        </ControlCard>
      </main>

      <ParityFooter />
    </>
  );
}
