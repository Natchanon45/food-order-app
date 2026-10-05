import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { useAuth } from "@/auth/AuthProvider";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { sweetConfirm } from "@/components/sweetDialog";
import { DEFAULT_POS_THEME, POS_THEME_OPTIONS, applyPosTheme, normalizePosTheme } from "@/config/posThemes";
import { loadPosStoreSettings, savePosStoreSettings } from "@/data/retailPosData";
import { loadPosRoleSettings } from "@/data/retailPosSystemData";
import { useParityPage } from "@/hooks/useParityPage";
import { useI18n } from "@/i18n/I18nProvider";
import { AdminMap } from "@/pages/AdminPage";
import { useTenant } from "@/tenant/TenantProvider";

const BUILTIN_POS_ROLES = new Set(["owner", "admin", "manager", "cashier", "stock", "kitchen"]);
const ROLE_SETTINGS_TIMEOUT_MS = 6000;
const INITIAL_DATA_TIMEOUT_MS = 10000;
const DEFAULTS = Object.freeze({
  shopName: "POS ร้านค้าปลีก",
  shopAddress: "",
  shopPhone: "",
  taxId: "",
  storeLatitude: "",
  storeLongitude: "",
  vatRegistered: "no",
  vatRate: 7,
  defaultVatMode: "include",
  taxBranchType: "headOffice",
  taxBranchCode: "",
  taxInvoiceName: "",
  taxInvoiceAddress: "",
  promptPayEnabled: "no",
  promptPayId: "",
  promptPayAccountName: "",
  receiptPaperSize: "80",
  receiptPrintMode: "ask",
  receiptThanks: "ขอบคุณที่ใช้บริการ",
  receiptFooter: "เอกสารฉบับนี้ออกโดยระบบของร้านตามข้อมูลด้านบน",
  loyaltyEnabled: "yes",
  spendPerPoint: 10,
  pointValue: 1,
  posTheme: DEFAULT_POS_THEME,
});
const cachedPosRoles = () => {
  try {
    const rows = JSON.parse(localStorage.getItem("retail_pos_roles_v1") || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};
const withTimeout = (promise, timeoutMs, code) => Promise.race([
  promise,
  new Promise((_, reject) => window.setTimeout(() => {
    const error = new Error(code); error.code = code; reject(error);
  }, timeoutMs)),
]);

function hasSettingsPermission(profile, roleRows, permission) {
  if (!profile) return false;
  const roleId = String(profile.roleId || profile.role || "");
  if (roleId === "owner") return true;
  const role = (Array.isArray(roleRows) ? roleRows : []).find(item => String(item?.id || "") === roleId);
  const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
  if (permissions.includes("*") || permissions.includes(permission)) return true;
  const hasGranular = permissions.some(key => String(key).startsWith("pos.settings."));
  if (hasGranular) return false;
  return roleId === "admin" || roleId === "manager";
}

function normalizedSettings(rows = {}) {
  const store = rows.store || {}, tax = rows.tax || {}, payment = rows.payment || {};
  const receipt = rows.receipt || {}, loyalty = rows.loyalty || {}, theme = rows.posTheme || {};
  return {
    ...DEFAULTS,
    ...store,
    ...tax,
    ...payment,
    ...receipt,
    shopName: String(store.shopName || DEFAULTS.shopName),
    taxId: String(tax.taxId || store.taxId || ""),
    vatRegistered: tax.vatRegistered === true || tax.vatRegistered === "yes" ? "yes" : "no",
    promptPayEnabled: payment.promptPayEnabled === true || payment.promptPayEnabled === "yes" ? "yes" : "no",
    receiptPrintMode: receipt.receiptPrintMode === "auto" ? "auto" : "ask",
    loyaltyEnabled: loyalty.enabled === false ? "no" : "yes",
    spendPerPoint: Math.max(.01, Number(loyalty.spendPerPoint || DEFAULTS.spendPerPoint)),
    pointValue: Math.max(.01, Number(loyalty.pointValue || DEFAULTS.pointValue)),
    storeLatitude: store.storeLatitude ?? "",
    storeLongitude: store.storeLongitude ?? "",
    posTheme: normalizePosTheme(theme.theme || DEFAULT_POS_THEME),
  };
}

export function PosSettingsPage() {
  const authState = useAuth(), tenantState = useTenant();
  const { profile, user: authUser } = authState, { tenant } = tenantState;
  const { t, formatNumber } = useI18n();
  const tr = useCallback((key, replacements = {}) => t(`pos_settings.${key}`, replacements), [t]);
  const stylesReady = useParityPage({
    title: tr("meta.title"),
    bodyClass: "pos-settings-page",
    attributes: { "data-module": "retail-pos-settings" },
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css", "retail-pos-font-local.css", "pos-locale-switcher-placement.css",
      "retail-pos.css", "retail-pos-settings.css", "retail-loyalty.css",
      "retail-settings-visual-dashboard.css", "retail-pos-navigation.css",
      "sweet-dialog.css", "page-ready-state.css",
    ],
  });

  const [form, setForm] = useState(() => ({ ...DEFAULTS }));
  const [initialReady, setInitialReady] = useState(false);
  const [roleRows, setRoleRows] = useState(() => cachedPosRoles());
  const [rolesReady, setRolesReady] = useState(() => {
    const session = getRetailPosSession(), roleId = String(session?.roleId || session?.role || "");
    return BUILTIN_POS_ROLES.has(roleId) || cachedPosRoles().length > 0;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const toastTimerRef = useRef(0);

  const posSession = useMemo(() => getRetailPosSession(), [
    authUser?.uid, profile?.id, profile?.uid, profile?.tenantId, profile?.role, profile?.roleId,
  ]);
  const posAccessProfile = useMemo(() => ({
    ...(profile || {}), ...(posSession || {}),
    role: posSession?.role || profile?.role || profile?.roleId || "",
    roleId: posSession?.roleId || posSession?.role || profile?.roleId || profile?.role || "",
  }), [profile, posSession]);
  const pagePermissions = useMemo(() => getPosPermissions(posAccessProfile, roleRows), [posAccessProfile, roleRows]);
  const canView = pagePermissions.has("pos.settings");
  const canEditStore = hasSettingsPermission(posAccessProfile, roleRows, "pos.settings.edit_store");
  const canEditLoyalty = hasSettingsPermission(posAccessProfile, roleRows, "pos.settings.edit_loyalty");
  const canReset = hasSettingsPermission(posAccessProfile, roleRows, "pos.settings.reset");
  const canSave = canEditStore || canEditLoyalty;

  const redirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!rolesReady) return "";
    if (!canView) {
      const first = firstAllowedPosPage(posAccessProfile, roleRows);
      return first === "/pos/forbidden"
        ? "/pos/forbidden/?permission=pos.settings&next=" + encodeURIComponent(requested)
        : first + "?from=permission";
    }
    return "";
  }, [authState.status, tenantState.status, stylesReady, profile, posAccessProfile, tenantState.status, tenant, rolesReady, canView, roleRows]);
  useEffect(() => { if (redirectTarget) location.replace(redirectTarget); }, [redirectTarget]);

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !profile) { setRoleRows([]); setRolesReady(true); return () => { alive = false; }; }
    const cached = cachedPosRoles(), roleId = String(posAccessProfile?.roleId || posAccessProfile?.role || "");
    if (cached.length) setRoleRows(cached);
    setRolesReady(BUILTIN_POS_ROLES.has(roleId) || cached.length > 0);
    withTimeout(loadPosRoleSettings(tenant.id), ROLE_SETTINGS_TIMEOUT_MS, "POS_ROLE_SETTINGS_TIMEOUT")
      .then(next => {
        if (!alive) return;
        const rows = Array.isArray(next) ? next : [];
        setRoleRows(rows);
        try { localStorage.setItem("retail_pos_roles_v1", JSON.stringify(rows)); } catch {}
      })
      .catch(loadError => {
        console.warn("POS_SETTINGS_ROLE_SETTINGS_LOAD_FAILED", loadError);
        if (alive && !cached.length && !BUILTIN_POS_ROLES.has(roleId)) setRoleRows([]);
      })
      .finally(() => { if (alive) setRolesReady(true); });
    return () => { alive = false; };
  }, [tenant?.id, profile, posAccessProfile?.roleId, posAccessProfile?.role]);

  const load = useCallback(async () => {
    if (!tenant?.id || !profile || !canView) return;
    const rows = await loadPosStoreSettings(tenant.id);
    const next = normalizedSettings(rows);
    setForm(next);
    applyPosTheme(next.posTheme, tenant.id);
  }, [tenant?.id, profile, canView]);

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget) {
      setInitialReady(false);
      return () => { alive = false; };
    }
    withTimeout(load(), INITIAL_DATA_TIMEOUT_MS, "POS_SETTINGS_INITIAL_LOAD_TIMEOUT")
      .catch(loadError => console.warn("POS_SETTINGS_LOAD_FAILED", loadError))
      .finally(() => { if (alive) setInitialReady(true); });
    return () => { alive = false; };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, load]);

  const showToast = useCallback((message, variant = "success") => {
    setToastType(variant === "error" ? "error" : "success"); setToastMessage(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(""), 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const change = useCallback((key, value) => {
    if (key === "posTheme") applyPosTheme(value, tenant?.id, { cache: false });
    setForm(current => ({ ...current, [key]: value }));
  }, [tenant?.id]);
  const locationValue = form.storeLatitude !== "" && form.storeLongitude !== ""
    ? { latitude: Number(form.storeLatitude), longitude: Number(form.storeLongitude) } : null;
  const setLocation = useCallback(loc => {
    if (!loc || !canEditStore) return;
    setMapError("");
    setForm(current => ({ ...current, storeLatitude: Number(loc.latitude), storeLongitude: Number(loc.longitude) }));
  }, [canEditStore]);
  const currentLocation = useCallback(() => {
    if (!canEditStore) return;
    if (!navigator.geolocation) { setMapError(tr("store_location.geolocation_unsupported")); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ latitude: Number(pos.coords.latitude.toFixed(7)), longitude: Number(pos.coords.longitude.toFixed(7)) }),
      () => setMapError(tr("store_location.geolocation_failed")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [canEditStore, setLocation, tr]);

  const normalizedForSave = useCallback(source => {
    const promptPayId = String(source.promptPayId || "").replace(/[^\d]/g, "").slice(0, 13);
    const vatRate = Math.min(100, Math.max(0, Number(source.vatRate || 0)));
    return {
      ...source,
      shopName: String(source.shopName || "").trim(),
      shopAddress: String(source.shopAddress || "").trim(),
      shopPhone: String(source.shopPhone || "").trim(),
      taxId: String(source.taxId || "").trim(),
      vatRate: source.vatRegistered === "yes" && vatRate <= 0 ? 7 : vatRate,
      promptPayId,
      receiptPrintMode: source.receiptPrintMode === "auto" ? "auto" : "ask",
      receiptThanks: String(source.receiptThanks || "").trim() || DEFAULTS.receiptThanks,
      receiptFooter: String(source.receiptFooter || "").trim() || DEFAULTS.receiptFooter,
      spendPerPoint: Math.max(.01, Number(source.spendPerPoint || DEFAULTS.spendPerPoint)),
      pointValue: Math.max(.01, Number(source.pointValue || DEFAULTS.pointValue)),
      posTheme: normalizePosTheme(source.posTheme),
    };
  }, []);

  const validate = useCallback((next, { store = true } = {}) => {
    if (!store) return "";
    if (!next.shopName) return tr("validation.store_name");
    if (next.vatRegistered === "yes" && !next.taxId) return tr("validation.tax_id");
    if (next.promptPayEnabled === "yes" && !next.promptPayId) return tr("validation.promptpay_id");
    if (next.promptPayEnabled === "yes" && ![10, 13].includes(next.promptPayId.length)) return tr("validation.promptpay_length");
    return "";
  }, [tr]);

  const submit = useCallback(async event => {
    event.preventDefault();
    if (!canSave || busy) return;
    const next = normalizedForSave(form);
    const validation = validate(next, { store: canEditStore });
    if (validation) { setError(validation); showToast(validation, "error"); return; }
    const sections = [
      ...(canEditStore ? ["store", "tax", "payment", "receipt", "pos-theme"] : []),
      ...(canEditLoyalty ? ["loyalty"] : []),
    ];
    setBusy(true); setError("");
    try {
      const saved = await savePosStoreSettings(tenant.id, next, { sections });
      const resolved = normalizedSettings(saved);
      setForm(resolved); applyPosTheme(resolved.posTheme, tenant.id);
      showToast(tr("actions.saved"));
    } catch (saveError) {
      console.error("POS_SETTINGS_SAVE_FAILED", saveError);
      const message = tr("visual.save_failed", { error: String(saveError?.message || "SAVE_FAILED") });
      setError(message); showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }, [canSave, busy, normalizedForSave, form, validate, canEditStore, canEditLoyalty, showToast, tenant?.id, tr]);

  const reset = useCallback(async () => {
    if (!canReset || busy) return;
    const approved = await sweetConfirm(tr("actions.reset_confirm"), {
      title: tr("visual.reset_title"),
      confirmText: tr("actions.reset"),
      cancelText: tr("visual.cancel"),
      type: "warning",
      confirmIcon: "arrow-clockwise",
    });
    if (!approved) return;
    setBusy(true); setError("");
    try {
      const saved = await savePosStoreSettings(tenant.id, DEFAULTS, {
        sections: ["store", "tax", "payment", "receipt", "pos-theme"],
      });
      const resolved = normalizedSettings(saved);
      setForm(resolved); applyPosTheme(DEFAULT_POS_THEME, tenant.id);
      showToast(tr("actions.reset_done"));
    } catch (resetError) {
      console.error("POS_SETTINGS_RESET_FAILED", resetError);
      const message = tr("visual.save_failed", { error: String(resetError?.message || "RESET_FAILED") });
      setError(message); showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }, [canReset, busy, tenant?.id, tr, showToast]);

  const selectedTheme = useMemo(() => POS_THEME_OPTIONS.find(option => option.id === form.posTheme) || POS_THEME_OPTIONS[0], [form.posTheme]);
  const sampleSpend = 100, sampleEarn = Math.floor(sampleSpend / Math.max(.01, Number(form.spendPerPoint || 10)));
  const sampleValue = 10 * Math.max(.01, Number(form.pointValue || 1));
  const storeReady = Boolean(String(form.shopName || "").trim());
  const vatReady = form.vatRegistered === "yes";
  const promptPayReady = form.promptPayEnabled === "yes" && [10, 13].includes(String(form.promptPayId || "").replace(/\D/g, "").length);
  const loyaltyReady = form.loyaltyEnabled === "yes";
  const displayName = form.taxInvoiceName || form.shopName || DEFAULTS.shopName;
  const displayAddress = form.taxInvoiceAddress || form.shopAddress;
  const paperText = form.receiptPaperSize === "a4" ? "A4" : form.receiptPaperSize + "mm";

  const needsReady = authState.status === "loading" || tenantState.status === "loading" || !stylesReady
    || Boolean(redirectTarget) || !rolesReady || (tenant?.id && profile && canView && !initialReady);
  if (needsReady) return <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;

  return <>
    <header className="pos-header" data-pos-supporting-header>
      <div className="app-title"><div><strong>{tr("page.title")}</strong><small>{tr("page.subtitle")}</small></div></div>
      <div className="header-actions"><LocaleSwitcher/><PosNavigation profile={posAccessProfile} currentKey="pos.settings"/></div>
    </header>

    <main className="settings-container" data-pos-supporting="settings">
      <section className="settings-visual-hero">
        <span className="settings-hero-orbit settings-hero-orbit-one"></span><span className="settings-hero-orbit settings-hero-orbit-two"></span>
        <div className="settings-hero-grid">
          <div className="settings-hero-copy">
            <div className="settings-hero-kicker"><i className="bi bi-sliders2" aria-hidden="true"></i><span>{tr("visual.kicker")}</span></div>
            <h1>{tr("page.title")}</h1><p>{tr("visual.hero_description")}</p>
            <div className="settings-hero-status"><i className="bi bi-palette2" aria-hidden="true"></i><span>{t(selectedTheme?.nameKey)}</span></div>
          </div>
          <div className="settings-hero-metrics">
            <article className={storeReady ? "is-ready" : "needs-setup"}><span><i className="bi bi-shop" aria-hidden="true"></i>{tr("visual.store_status")}</span><strong>{storeReady ? tr("visual.ready") : tr("visual.needs_setup")}</strong></article>
            <article className={vatReady ? "is-ready" : ""}><span><i className="bi bi-receipt" aria-hidden="true"></i>{tr("visual.vat_status")}</span><strong>{vatReady ? tr("tax.registered") : tr("tax.not_registered")}</strong></article>
            <article className={promptPayReady ? "is-ready" : ""}><span><i className="bi bi-qr-code" aria-hidden="true"></i>{tr("visual.promptpay_status")}</span><strong>{promptPayReady ? tr("promptpay.on") : tr("promptpay.off")}</strong></article>
            <article className={loyaltyReady ? "is-ready" : ""}><span><i className="bi bi-star-fill" aria-hidden="true"></i>{tr("visual.loyalty_status")}</span><strong>{loyaltyReady ? tr("loyalty.on") : tr("loyalty.off")}</strong></article>
          </div>
        </div>
      </section>

      <form id="storeSettingsForm" className="settings-control-form" onSubmit={submit}>
        <section className="panel settings-section-card settings-store-card">
          <div className="settings-section-heading"><span className="settings-section-icon store"><i className="bi bi-shop-window" aria-hidden="true"></i></span><div><h2>{tr("store.title")}</h2><p>{tr("store.description")}</p></div><span className="settings-access-badge">{canEditStore ? tr("visual.editable") : tr("visual.read_only")}</span></div>
          <div className="settings-grid">
            <label className="full">{tr("store.name")}<input id="shopName" maxLength={120} required disabled={!canEditStore || busy} placeholder={tr("store.name_placeholder")} value={form.shopName} onChange={event => change("shopName", event.target.value)}/></label>
            <label className="full">{tr("store.address")}<textarea id="shopAddress" maxLength={500} rows={3} disabled={!canEditStore || busy} placeholder={tr("store.address_placeholder")} value={form.shopAddress} onChange={event => change("shopAddress", event.target.value)}></textarea></label>
            <label>{tr("store.phone")}<input id="shopPhone" maxLength={30} inputMode="tel" disabled={!canEditStore || busy} placeholder={tr("store.phone_placeholder")} value={form.shopPhone} onChange={event => change("shopPhone", event.target.value)}/></label>
            <label>{tr("store.tax_id")}<input id="taxId" maxLength={20} inputMode="numeric" disabled={!canEditStore || busy} placeholder={tr("store.tax_id_placeholder")} value={form.taxId} onChange={event => change("taxId", event.target.value)}/></label>
          </div>
          <div className="store-location-picker">
            <div className="store-location-head"><div><strong>{tr("store_location.title")}</strong><p>{tr("store_location.description")}</p></div><button type="button" className="btn btn-secondary" disabled={!canEditStore || busy} onClick={currentLocation}><i className="bi bi-crosshair" aria-hidden="true"></i><span>{tr("store_location.use_current")}</span></button></div>
            <AdminMap tenantSlug={tenant.slug || profile.tenantSlug || ""} location={locationValue} onLocation={setLocation} onError={setMapError} t={t}/>
            <div className="store-location-footer"><span>{locationValue ? tr("store_location.ready") : tr("store_location.not_set")}</span><span>{locationValue ? locationValue.latitude + ", " + locationValue.longitude : ""}</span></div>
            {mapError ? <p className="settings-note">{mapError}</p> : null}
          </div>
        </section>

        <section className="panel settings-section-card pos-theme-settings-section settings-theme-card">
          <div className="settings-section-heading"><span className="settings-section-icon theme"><i className="bi bi-palette2" aria-hidden="true"></i></span><div><h2>{tr("theme.title")}</h2><p>{tr("theme.description")}</p></div></div>
          <div className="pos-theme-picker" role="radiogroup" aria-label={tr("theme.title")}>
            {POS_THEME_OPTIONS.map(option => <label className="pos-theme-choice" data-theme-preview={option.id} key={option.id}>
              <input type="radio" name="posTheme" value={option.id} disabled={!canEditStore || busy} checked={form.posTheme === option.id} onChange={event => change("posTheme", event.target.value)}/>
              <div><div className="pos-theme-choice-head"><span className="pos-theme-choice-number">{option.option}</span><strong>{t(option.nameKey)}</strong></div><p>{t(option.descriptionKey)}</p></div>
              <div className="pos-theme-mini"><div className="pos-theme-mini-bar"></div>{[0,1,2].map(index => <div className="pos-theme-mini-row" key={index}><span className="pos-theme-mini-icon"></span><span className="pos-theme-mini-line"></span><span className="pos-theme-mini-dot"></span></div>)}</div>
            </label>)}
          </div><p className="pos-theme-picker-note">{tr("theme.note")}</p>
        </section>

        <div className="settings-card-grid">
          <section className="panel settings-section-card settings-tax-card">
            <div className="settings-section-heading"><span className="settings-section-icon tax"><i className="bi bi-percent" aria-hidden="true"></i></span><div><h2>{tr("tax.title")}</h2><p>{tr("tax.description")}</p></div></div>
            <div className="settings-grid">
              <label>{tr("tax.status")}<select id="vatRegistered" disabled={!canEditStore || busy} value={form.vatRegistered} onChange={event => change("vatRegistered", event.target.value)}><option value="no">{tr("tax.not_registered")}</option><option value="yes">{tr("tax.registered")}</option></select></label>
              <label>{tr("tax.rate")}<input id="vatRate" type="number" min="0" max="100" step=".01" disabled={!canEditStore || busy} value={form.vatRate} onChange={event => change("vatRate", event.target.value)}/></label>
              <label>{tr("tax.default_mode")}<select id="defaultVatMode" disabled={!canEditStore || busy} value={form.defaultVatMode} onChange={event => change("defaultVatMode", event.target.value)}><option value="include">include VAT</option><option value="exclude">exclude VAT</option></select></label>
              <label>{tr("tax.branch")}<select id="taxBranchType" disabled={!canEditStore || busy} value={form.taxBranchType} onChange={event => change("taxBranchType", event.target.value)}><option value="headOffice">{tr("tax.head_office")}</option><option value="branch">{tr("tax.branch")}</option></select></label>
              <label>{tr("tax.branch_number")}<input id="taxBranchCode" maxLength={10} disabled={!canEditStore || busy} placeholder={tr("tax.branch_placeholder")} value={form.taxBranchCode} onChange={event => change("taxBranchCode", event.target.value)}/></label>
              <label className="full">{tr("tax.invoice_name")}<input id="taxInvoiceName" maxLength={150} disabled={!canEditStore || busy} placeholder={tr("tax.invoice_name_placeholder")} value={form.taxInvoiceName} onChange={event => change("taxInvoiceName", event.target.value)}/></label>
              <label className="full">{tr("tax.invoice_address")}<textarea id="taxInvoiceAddress" maxLength={500} rows={3} disabled={!canEditStore || busy} placeholder={tr("tax.invoice_address_placeholder")} value={form.taxInvoiceAddress} onChange={event => change("taxInvoiceAddress", event.target.value)}></textarea></label>
            </div><p className="settings-note">{tr("tax.note")}</p>
          </section>

          <section className="panel settings-section-card settings-payment-card">
            <div className="settings-section-heading"><span className="settings-section-icon payment"><i className="bi bi-qr-code-scan" aria-hidden="true"></i></span><div><h2>{tr("promptpay.title")}</h2><p>{tr("promptpay.description")}</p></div></div>
            <div className="settings-grid">
              <label>{tr("promptpay.enabled")}<select id="promptPayEnabled" disabled={!canEditStore || busy} value={form.promptPayEnabled} onChange={event => change("promptPayEnabled", event.target.value)}><option value="no">{tr("promptpay.off")}</option><option value="yes">{tr("promptpay.on")}</option></select></label>
              <label>{tr("promptpay.id")}<input id="promptPayId" maxLength={13} inputMode="numeric" disabled={!canEditStore || busy} placeholder={tr("promptpay.id_placeholder")} value={form.promptPayId} onChange={event => change("promptPayId", event.target.value.replace(/\D/g, "").slice(0,13))}/></label>
              <label className="full">{tr("promptpay.account_name")}<input id="promptPayAccountName" maxLength={120} disabled={!canEditStore || busy} placeholder={tr("promptpay.account_placeholder")} value={form.promptPayAccountName} onChange={event => change("promptPayAccountName", event.target.value)}/></label>
            </div><p className="settings-note">{tr("promptpay.note")}</p>
          </section>
        </div>

        <div className="settings-card-grid">
          <section className="panel settings-section-card settings-receipt-card">
            <div className="settings-section-heading"><span className="settings-section-icon receipt"><i className="bi bi-receipt-cutoff" aria-hidden="true"></i></span><div><h2>{tr("printing.title")}</h2><p>{tr("printing.description")}</p></div></div>
            <div className="settings-grid">
              <label>{tr("printing.paper_size")}<select id="receiptPaperSize" disabled={!canEditStore || busy} value={form.receiptPaperSize} onChange={event => change("receiptPaperSize", event.target.value)}><option value="58">58mm</option><option value="80">80mm</option><option value="a4">A4</option></select></label>
              <label>{tr("printing.after_sale")}<select id="receiptPrintMode" disabled={!canEditStore || busy} value={form.receiptPrintMode} onChange={event => change("receiptPrintMode", event.target.value)}><option value="ask">{tr("printing.ask")}</option><option value="auto">{tr("printing.auto")}</option></select></label>
              <label className="full">{tr("message.thanks")}<input id="receiptThanks" maxLength={150} disabled={!canEditStore || busy} placeholder={tr("message.thanks_placeholder")} value={form.receiptThanks} onChange={event => change("receiptThanks", event.target.value)}/></label>
              <label className="full">{tr("message.footer")}<textarea id="receiptFooter" maxLength={300} rows={3} disabled={!canEditStore || busy} placeholder={tr("message.footer_placeholder")} value={form.receiptFooter} onChange={event => change("receiptFooter", event.target.value)}></textarea></label>
            </div>
          </section>

          <section id="loyaltySettingsSection" className="panel settings-section-card settings-loyalty-card">
            <div className="settings-section-heading"><span className="settings-section-icon loyalty"><i className="bi bi-star-fill" aria-hidden="true"></i></span><div><h2>{tr("loyalty.title")}</h2><p>{tr("visual.loyalty_description")}</p></div><span className="settings-access-badge">{canEditLoyalty ? tr("visual.editable") : tr("visual.read_only")}</span></div>
            <div className="settings-grid">
              <label>{tr("loyalty.enabled")}<select id="loyaltyEnabled" disabled={!canEditLoyalty || busy} value={form.loyaltyEnabled} onChange={event => change("loyaltyEnabled", event.target.value)}><option value="yes">{tr("loyalty.on")}</option><option value="no">{tr("loyalty.off")}</option></select></label>
              <label>{tr("loyalty.spend_per_point")}<input id="loyaltySpendPerPoint" type="number" min=".01" step=".01" disabled={!canEditLoyalty || busy} value={form.spendPerPoint} onChange={event => change("spendPerPoint", event.target.value)}/></label>
              <label>{tr("loyalty.point_value")}<input id="loyaltyPointValue" type="number" min=".01" step=".01" disabled={!canEditLoyalty || busy} value={form.pointValue} onChange={event => change("pointValue", event.target.value)}/></label>
            </div>
            <div className="loyalty-settings-preview">
              <div><span>{tr("loyalty.sample_spend")}</span><strong id="loyaltyExampleSpend">{tr("loyalty.amount",{value:formatNumber(sampleSpend,{minimumFractionDigits:2,maximumFractionDigits:2})})}</strong></div>
              <div><span>{tr("loyalty.points_earned")}</span><strong id="loyaltyExampleEarn">{tr("loyalty.points",{value:formatNumber(sampleEarn)})}</strong></div>
              <div><span>{tr("loyalty.ten_points_value")}</span><strong id="loyaltyExampleValue">{tr("loyalty.amount",{value:formatNumber(sampleValue,{minimumFractionDigits:2,maximumFractionDigits:2})})}</strong></div>
            </div>
          </section>
        </div>

        <section className="panel settings-section-card settings-preview-card">
          <div className="settings-section-heading"><span className="settings-section-icon preview"><i className="bi bi-eye" aria-hidden="true"></i></span><div><h2>{tr("preview.title")}</h2><p>{tr("preview.description")}</p></div></div>
          <div className="settings-preview-layout">
            <div className="receipt-preview">
              <strong id="previewShopName">{displayName}</strong><span id="previewShopAddress">{displayAddress}</span>
              <span id="previewShopPhone">{form.shopPhone ? tr("preview.phone",{value:form.shopPhone}) : ""}</span>
              <span id="previewTaxId">{form.taxId ? tr("preview.tax_id",{value:form.taxId}) : ""}</span>
              <span id="previewTaxBranch">{form.taxBranchType === "branch" ? tr("preview.branch",{value:form.taxBranchCode || tr("preview.unspecified")}) : tr("tax.head_office")}</span>
              <small id="previewVatStatus">{vatReady ? tr("preview.vat_enabled",{rate:form.vatRate}) : tr("preview.vat_disabled")}</small>
              <small id="previewVatMode">{vatReady ? tr("preview.default_mode",{value:form.defaultVatMode === "exclude" ? "exclude VAT" : "include VAT"}) : ""}</small>
              <small id="previewPaperSize">{tr("preview.size",{value:paperText})}</small>
              <small id="previewPrintMode">{form.receiptPrintMode === "auto" ? tr("preview.auto_print") : tr("printing.ask")}</small>
              <small id="previewPromptPay">{promptPayReady ? tr("preview.promptpay_ready",{receiver:form.promptPayAccountName || displayName,id:form.promptPayId}) : tr("preview.promptpay_disabled")}</small>
              <hr/><span id="previewThanks">{form.receiptThanks}</span><small id="previewFooter">{form.receiptFooter}</small>
            </div>
            <div className="settings-preview-summary">
              <article><span><i className="bi bi-palette" aria-hidden="true"></i>{tr("theme.title")}</span><strong>{t(selectedTheme?.nameKey)}</strong></article>
              <article><span><i className="bi bi-receipt" aria-hidden="true"></i>{tr("tax.status")}</span><strong>{vatReady ? tr("tax.registered") : tr("tax.not_registered")}</strong></article>
              <article><span><i className="bi bi-qr-code" aria-hidden="true"></i>{tr("promptpay.title")}</span><strong>{promptPayReady ? tr("promptpay.on") : tr("promptpay.off")}</strong></article>
              <article><span><i className="bi bi-star" aria-hidden="true"></i>{tr("loyalty.title")}</span><strong>{loyaltyReady ? tr("loyalty.on") : tr("loyalty.off")}</strong></article>
            </div>
          </div>
        </section>

        <p id="settingsError" className="error-text">{error}</p>
        <div className="settings-actions">
          <button id="resetSettingsBtn" type="button" className="btn btn-secondary" hidden={!canReset} disabled={busy} onClick={reset}><i className="bi bi-arrow-clockwise" aria-hidden="true"></i><span>{tr("actions.reset")}</span></button>
          <button type="submit" className="btn btn-pay" hidden={!canSave} disabled={busy}><i className="bi bi-floppy" aria-hidden="true"></i><span>{busy ? tr("visual.saving") : tr("actions.save")}</span></button>
        </div>
      </form>
    </main>

    <div id="toast" className={`toast ${toastType}${toastMessage ? " show" : ""}`} role={toastType === "error" ? "alert" : "status"} aria-live="polite"><span className="app-toast-icon" aria-hidden="true"><i className={`bi bi-${toastType === "error" ? "x-circle" : "check-circle"} app-icon`}></i></span><span className="app-toast-message">{toastMessage}</span></div>
    <AppDeveloperPanel/>
  </>;
}
