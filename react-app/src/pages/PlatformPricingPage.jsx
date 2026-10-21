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
import {
  loadAdminHybridBillingSettings, saveAdminHybridBillingSettings,
  getAdminHybridRegistrationReady, setAdminHybridRegistrationReady
} from "@/data/hybridBillingSettings";
import {
  getPlatformHybridInvoices, getPlatformHybridPaymentDestination, hybridSlipUrl,
  issueTenantHybridInvoices, reconcileTenantHybridBilling,
  reviewTenantHybridPayment, setTenantHybridBillingLive,
  updateHybridBillingPaymentDestination,
} from "@/data/hybridBillingLedger";
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
  const [hybridConfig, setHybridConfig] = useState(null);
  const [hybridLoading, setHybridLoading] = useState(true);
  const [hybridSaving, setHybridSaving] = useState(false);
  const [hybridBank, setHybridBank] = useState({ bankName: "", accountName: "", accountNumber: "" });
  const [hybridTenantId, setHybridTenantId] = useState("");
  const [hybridThroughDate, setHybridThroughDate] = useState(() =>
    new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }));
  const [hybridReviewNote, setHybridReviewNote] = useState("");
  const [hybridInvoices, setHybridInvoices] = useState([]);
  const [hybridTenantLive, setHybridTenantLive] = useState(false);
  const [hybridConfirm, setHybridConfirm] = useState("");
  const [hybridRegistrationReady, setHybridRegistrationReady] = useState(false);
  const [hybridBusy, setHybridBusy] = useState(false);
  const [hybridMessage, setHybridMessage] = useState("");

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
    let mounted = true;
    loadAdminHybridBillingSettings()
      .then(config => { if (mounted) setHybridConfig(config); })
      .catch(error => {
        console.error("HYBRID_SETTINGS_LOAD_FAILED", error);
        if (mounted) showToast(t("hybrid_billing.failed"), "error");
      })
      .finally(() => { if (mounted) setHybridLoading(false); });
    return () => { mounted = false; };
  }, [profile?.role]);

  useEffect(() => {
    if (profile?.role !== "super_admin") return;
    getAdminHybridRegistrationReady()
      .then(setHybridRegistrationReady)
      .catch(error => console.error("HYBRID_REGISTRATION_STATUS_LOAD_FAILED", error));
    getPlatformHybridPaymentDestination()
      .then(destination => {
        if (destination) setHybridBank(destination);
      })
      .catch(error => console.error("HYBRID_BANK_LOAD_FAILED", error));
  }, [profile?.role]);

  const loadHybridTenant = async () => {
    if (!hybridTenantId.trim()) return;
    setHybridBusy(true); setHybridMessage("");
    try {
      const result = await getPlatformHybridInvoices(hybridTenantId.trim());
      setHybridInvoices(result.items || []);
      setHybridTenantLive(result.live === true);
    } catch (error) {
      console.error("HYBRID_ADMIN_INVOICES_FAILED", error);
      setHybridMessage("ไม่สามารถโหลดใบแจ้งค่าบริการได้");
    } finally { setHybridBusy(false); }
  };
  const toggleHybridRegistration = async () => {
    setHybridBusy(true); setHybridMessage("");
    try {
      const enabled = await setAdminHybridRegistrationReady(!hybridRegistrationReady);
      setHybridRegistrationReady(enabled);
      setHybridMessage(enabled ? "เปิดลงทะเบียน Hybrid แล้ว" : "ปิดรับสมัคร Hybrid แล้ว");
    } catch (error) {
      console.error("HYBRID_REGISTRATION_SWITCH_FAILED", error);
      setHybridMessage(String(error?.message || "เปลี่ยนสถานะไม่ได้"));
    } finally { setHybridBusy(false); }
  };
  const saveHybridBank = async event => {
    event.preventDefault(); setHybridBusy(true);
    try {
      const data = await updateHybridBillingPaymentDestination(hybridBank);
      setHybridBank(data.destination);
      setHybridMessage("บันทึกบัญชีรับค่าบริการสำเร็จ");
    } catch (error) {
      console.error("HYBRID_BANK_SAVE_FAILED", error);
      setHybridMessage("ไม่สามารถบันทึกบัญชีรับเงินได้");
    } finally { setHybridBusy(false); }
  };
  const adminHybridAction = async action => {
    if (!hybridTenantId.trim()) return;
    setHybridBusy(true); setHybridMessage("");
    try {
      if (action === "issue") {
        await issueTenantHybridInvoices(hybridTenantId.trim(), hybridThroughDate);
        setHybridMessage("ตรวจสอบข้อมูลและออกบิลที่ถึงกำหนดแล้ว");
      } else if (action === "reconcile") {
        await reconcileTenantHybridBilling(hybridTenantId.trim());
        setHybridMessage("ตรวจสอบสถานะค้างชำระแล้ว");
      } else if (action === "enable" || action === "disable") {
        await setTenantHybridBillingLive(hybridTenantId.trim(), action === "enable");
        setHybridMessage(action === "enable" ? "เปิดใช้งานออกบิล Hybrid ให้ Tenant แล้ว" : "หยุดการออกบิล Hybrid สำหรับ Tenant แล้ว");
        setHybridConfirm("");
      }
      const response = await getPlatformHybridInvoices(hybridTenantId.trim());
      setHybridInvoices(response.items || []);
      setHybridTenantLive(response.live === true);
    } catch (error) {
      console.error("HYBRID_ADMIN_ACTION_FAILED", error);
      setHybridMessage(String(error?.message || "ดำเนินการไม่สำเร็จ"));
    } finally { setHybridBusy(false); }
  };
  const reviewHybrid = async (invoice, action) => {
    if (!invoice.payment?.id || hybridBusy) return;
    setHybridBusy(true); setHybridMessage("");
    try {
      await reviewTenantHybridPayment(hybridTenantId.trim(), invoice.id,
        invoice.payment.id, action, hybridReviewNote);
      const data = await getPlatformHybridInvoices(hybridTenantId.trim());
      setHybridInvoices(data.items || []);
      setHybridMessage(action === "approve" ? "ยืนยันชำระเงินแล้ว" : "ปฏิเสธหลักฐานแล้ว");
    } catch (error) {
      console.error("HYBRID_REVIEW_FAILED", error);
      setHybridMessage(String(error?.message || "ตรวจสอบหลักฐานไม่สำเร็จ"));
    } finally { setHybridBusy(false); }
  };
  const openHybridSlip = async invoice => {
    try {
      const url = await hybridSlipUrl(invoice.payment?.slipPath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("HYBRID_SLIP_OPEN_FAILED", error);
      setHybridMessage("เปิดหลักฐานชำระไม่ได้");
    }
  };

  const saveHybrid = async event => {
    event.preventDefault();
    if (!hybridConfig) return;
    setHybridSaving(true);
    try {
      const config = await saveAdminHybridBillingSettings(hybridConfig);
      setHybridConfig(config);
      showToast(t("hybrid_billing.saved"));
    } catch (error) {
      console.error("HYBRID_SETTINGS_SAVE_FAILED", error);
      showToast(t("hybrid_billing.failed"), "error");
    } finally {
      setHybridSaving(false);
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
          <form className="card platform-pricing-form-card" id="hybridBillingForm" onSubmit={saveHybrid}>
            <div className="section-title"><h2><i className="bi bi-graph-up-arrow" aria-hidden="true"></i> {t("hybrid_billing.title")}</h2></div>
            <p>{t("hybrid_billing.description")}</p>
            <p className="field-help">{t("hybrid_billing.first_month")}</p>
            {hybridConfig ? (
              <div className="platform-pricing-fields">
                {[
                  ["monthlyFee", "monthly", 0.01, 1000000, 0.01],
                  ["deliveryThreshold", "threshold", 0.01, 1000000000, 0.01],
                  ["deliveryShareRate", "rate", 0, 100, 0.01],
                  ["monthlySlipQuota", "quota", 0, 1000000, 1],
                ].map(([field, key, min, max, step]) => (
                  <label key={field}>
                    <span>{t(`hybrid_billing.${key}`)}</span>
                    <input id={`hybrid-${field}`} type="number" required min={min} max={max}
                      step={step} value={hybridConfig[field]} onChange={e => setHybridConfig(current => ({
                        ...current, [field]: e.target.value
                      }))} />
                  </label>
                ))}
              </div>
            ) : <p role="alert">{hybridLoading ? t("shared.state.loading") : t("hybrid_billing.failed")}</p>}
            <div className="platform-pricing-actions">
              <button className="btn btn-primary" type="submit" disabled={!hybridConfig || hybridSaving}>
                <i className="bi bi-floppy" aria-hidden="true"></i><span>{t("hybrid_billing.save")}</span>
              </button>
            </div>
          </form>
          <aside className="card platform-pricing-preview-card">
            <div className="section-title"><h2>{t("hybrid_billing.title")}</h2></div>
            <p>{t("hybrid_billing.description")}</p>
            {hybridConfig ? (
              <div className="platform-pricing-breakdown">
                <div><span>{t("hybrid_billing.monthly")}</span><strong>{money(Number(hybridConfig.monthlyFee))}</strong></div>
                <div><span>{t("hybrid_billing.threshold")}</span><strong>{money(Number(hybridConfig.deliveryThreshold))}</strong></div>
                <div><span>{t("hybrid_billing.rate")}</span><strong>{hybridConfig.deliveryShareRate}%</strong></div>
                <div><span>{t("hybrid_billing.quota")}</span><strong>{hybridConfig.monthlySlipQuota}</strong></div>
              </div>
            ) : null}
          </aside>
        </section>
        <section className="platform-pricing-grid" aria-label="จัดการค่าบริการ Hybrid Billing">
          <form className="card platform-pricing-form-card" onSubmit={saveHybridBank}>
            <div className="section-title"><h2>บัญชีรับค่าบริการ Hybrid Billing</h2></div>
            <p className="field-help">บัญชี PENGUIN สำหรับให้ Tenant โอนค่าบริการ ไม่ใช่บัญชีรับยอดขายลูกค้า</p>
            <p>การเปิดรับสมัคร Hybrid: <strong>{hybridRegistrationReady ? "เปิด" : "ปิด"}</strong></p>
            <button className="btn btn-sm" type="button" disabled={hybridBusy || (!hybridRegistrationReady && hybridConfirm !== "ENABLE")}
              onClick={toggleHybridRegistration}>
              {hybridRegistrationReady ? "ปิดรับสมัครใหม่" : "เปิดรับสมัครใหม่ (ต้องพิมพ์ ENABLE ในส่วน Tenant)"}
            </button>
            <div className="platform-pricing-fields">
              {[
                ["bankName", "ธนาคาร"], ["accountName", "ชื่อบัญชี"], ["accountNumber", "เลขบัญชี"],
              ].map(([key, label]) => (
                <label key={key}><span>{label}</span>
                  <input value={hybridBank[key]} required
                    onChange={event => setHybridBank(current => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
            </div>
            <button className="btn btn-primary" disabled={hybridBusy} type="submit">บันทึกบัญชีรับชำระ</button>
          </form>
          <div className="card platform-pricing-form-card">
            <div className="section-title"><h2>ออกบิล / ตรวจสอบการชำระของ Tenant</h2></div>
            <p className="field-help">ระบบแยกจาก Revenue Share เดิม เปิดใช้งานเป็นราย Tenant เมื่อยืนยันข้อมูลแล้วเท่านั้น</p>
            <div className="platform-pricing-fields">
              <label><span>Tenant ID</span>
                <input value={hybridTenantId} onChange={e => setHybridTenantId(e.target.value)} />
              </label>
              <label><span>คำนวณถึงวันที่ (วันปิดยอดแล้ว)</span>
                <input type="date" value={hybridThroughDate} onChange={e => setHybridThroughDate(e.target.value)} />
              </label>
              <label><span>รหัสยืนยันการเปิดเรียกเก็บเงินจริง</span>
                <input value={hybridConfirm} onChange={e => setHybridConfirm(e.target.value)}
                  placeholder="พิมพ์ ENABLE เพื่อยืนยัน" />
              </label>
            </div>
            <div className="platform-pricing-actions">
              <button type="button" className="btn btn-sm" disabled={hybridBusy} onClick={loadHybridTenant}>โหลดบิล</button>
              <button type="button" className="btn btn-sm" disabled={hybridBusy || !hybridTenantLive} onClick={() => adminHybridAction("issue")}>ออกบิล</button>
              <button type="button" className="btn btn-sm" disabled={hybridBusy || !hybridTenantLive} onClick={() => adminHybridAction("reconcile")}>ตรวจยอดค้าง</button>
              <button type="button" className="btn btn-sm" disabled={hybridBusy || hybridTenantLive || hybridConfirm !== "ENABLE"}
                onClick={() => adminHybridAction("enable")}>เปิดใช้งาน Tenant นี้</button>
              <button type="button" className="btn btn-sm" disabled={hybridBusy || !hybridTenantLive}
                onClick={() => adminHybridAction("disable")}>หยุดออกบิล</button>
            </div>
            <p>สถานะ: <strong>{hybridTenantLive ? "เปิดออกบิล" : "ยังไม่เปิดออกบิล"}</strong></p>
            <label><span>หมายเหตุการตรวจสอบ</span>
              <input value={hybridReviewNote} onChange={e => setHybridReviewNote(e.target.value)} />
            </label>
            {hybridMessage ? <p role="status">{hybridMessage}</p> : null}
            <div className="hybrid-report-table-scroll">
              <table>
                <thead><tr><th>เลขบิล</th><th>จำนวนเงิน</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                <tbody>{hybridInvoices.length ? hybridInvoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td>{invoice.id}</td><td>{money(invoice.amount)}</td><td>{invoice.state}</td>
                    <td>{invoice.payment?.status === "pending" ? (
                      <div className="platform-pricing-actions">
                        <button type="button" className="btn btn-sm" disabled={hybridBusy} onClick={() => openHybridSlip(invoice)}>ดูสลิป</button>
                        <button type="button" className="btn btn-sm" disabled={hybridBusy} onClick={() => reviewHybrid(invoice, "approve")}>อนุมัติ</button>
                        <button type="button" className="btn btn-sm" disabled={hybridBusy} onClick={() => reviewHybrid(invoice, "reject")}>ปฏิเสธ</button>
                      </div>
                    ) : "—"}</td>
                  </tr>
                )) : <tr><td colSpan="4">ยังไม่มีบิลของ Tenant ที่เลือก</td></tr>}</tbody>
              </table>
            </div>
          </div>
        </section>
        <p className="field-help">{t("hybrid_billing.legacy")}</p>
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
