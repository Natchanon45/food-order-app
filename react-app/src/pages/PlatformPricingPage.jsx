import { useEffect, useMemo, useRef, useState } from "react";
import { sweetConfirm } from "@/components/sweetDialog";
import "@/ui/platform-threshold-schedule.css";
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
  loadDeliveryThresholdVersions,
  appendDeliveryThresholdVersion,
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
  const [storageReady, setStorageReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // No resubmission after an uncertain billing write until the page is reloaded.
  const [saveUnconfirmed, setSaveUnconfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const lastVatRate = useRef(7);

  const [thresholdVersions,setThresholdVersions]=useState([]);
  const [thresholdBaseline,setThresholdBaseline]=useState(null);
  const [thresholdScheduleDate,setThresholdScheduleDate]=useState("");
  const [thresholdScheduleAmount,setThresholdScheduleAmount]=useState("");
  const [thresholdScheduleBusy,setThresholdScheduleBusy]=useState(false);
  const [thresholdScheduleUnconfirmed,setThresholdScheduleUnconfirmed]=useState(false);
  const [thresholdScheduleError,setThresholdScheduleError]=useState("");
  const [thresholdScheduleReady,setThresholdScheduleReady]=useState(false);
  const [thresholdScheduleWriteEnabled,setThresholdScheduleWriteEnabled]=useState(false);
  const reloadThresholdSchedule=async()=>{
    const response={data:await loadDeliveryThresholdVersions()};
    if (!response?.data?.ok || !Array.isArray(response.data.versions)) throw new Error("M7_THRESHOLD_SCHEDULE_READ_FAILED");
    setThresholdVersions(response.data.versions);
    const immutableBaselineCents = response.data.versions.length > 0
      ? response.data.versions[0].baselineThresholdCents
      : response.data.baselineThresholdCents;
    if (!Number.isSafeInteger(immutableBaselineCents) || immutableBaselineCents < 100)
      throw new Error("M7_THRESHOLD_BASELINE_UNAVAILABLE");
    setThresholdBaseline(immutableBaselineCents / 100);
    setThresholdScheduleWriteEnabled(response.data.writeEnabled===true);
    setThresholdScheduleReady(true);
  };

  const load = async () => {
    setLoading(true);
    setMessage("");
    setStorageReady(false);
    setLoadError(false);
    try {
      const data = await loadAdminSubscriptionPricing();
      setConfig(data.config);
      setStorageReady(data.storageReady === true);
      try { await reloadThresholdSchedule(); setThresholdScheduleError(""); }
      catch(error){ setThresholdScheduleReady(false); setThresholdScheduleWriteEnabled(false); setThresholdScheduleError("โหลดประวัติเพดาน Delivery จาก Firebase ไม่สำเร็จ กรุณาโหลดใหม่"); }
      if (Number(data.config.vatRate) > 0) lastVatRate.current = Number(data.config.vatRate);
    } catch (error) {
      console.error("PLATFORM_PRICING_LOAD_FAILED", error);
      setConfig(DEFAULT_SUBSCRIPTION_PRICING);
      setLoadError(true);
      setMessage(t("platform.pricing.load_failed"));
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
    // Reset Premium inputs without ever overwriting the immutable cap.
    setConfig(current => normalizeSubscriptionPricing({
      ...DEFAULT_SUBSCRIPTION_PRICING,
      deliveryThreshold: current.deliveryThreshold,
    }));
    setMessage("");
  };

  const scheduleThreshold=async(event)=>{
    event.preventDefault();
    if (authState.status !== "ready" || profile?.role !== "super_admin" || !storageReady || loadError || thresholdScheduleBusy || thresholdScheduleUnconfirmed || !thresholdScheduleReady || !thresholdScheduleWriteEnabled) return;
    const amount=Number(thresholdScheduleAmount);
    const thresholdCents=Math.round(amount*100);
    const baselineAmount=thresholdBaseline;
    const baselineThresholdCents=Math.round(baselineAmount*100);
    if (!thresholdScheduleDate || !Number.isFinite(baselineAmount) || baselineAmount<=0 ||
      Math.abs(baselineAmount*100-baselineThresholdCents)>0.00001 || !Number.isSafeInteger(baselineThresholdCents) ||
      !Number.isFinite(amount) || amount<=0 ||
      Math.abs(amount*100-thresholdCents)>0.00001 || !Number.isSafeInteger(thresholdCents)) {
      setThresholdScheduleError("กรุณากรอกวันที่มีผลและเพดาน Delivery ที่ถูกต้อง");return;
    }
    setThresholdScheduleBusy(true);setThresholdScheduleError("");
    try{
      const formattedDate = thresholdScheduleDate.split("-").reverse().join("/");
      const confirmed = await sweetConfirm(
        "ยืนยันประกาศเพดาน Delivery ใหม่ "+money(amount)+" มีผลวันที่ "+
        formattedDate+"?\nเพดานเดิม "+money(baselineAmount)+
        " จะไม่เปลี่ยนย้อนหลัง และประกาศแล้วไม่สามารถแก้ไขหรือลบเวอร์ชันได้",
        {title:"ยืนยันการประกาศเพดาน Delivery",type:"warning",
          confirmText:"ยืนยันประกาศ",confirmIcon:"calendar2-check",cancelText:"กลับ"},
      );
      if (!confirmed) return;
      const response={data:await appendDeliveryThresholdVersion({effectiveOn:thresholdScheduleDate,thresholdCents,baselineThresholdCents})};
      if (!response?.data?.ok || response.data.thresholdCents!==thresholdCents || response.data.effectiveOn!==thresholdScheduleDate)
        throw new Error("M7_THRESHOLD_SCHEDULE_ACK_INVALID");
      await reloadThresholdSchedule();
      setThresholdScheduleDate("");setThresholdScheduleAmount("");
      showToast("บันทึกเพดาน Delivery พร้อมวันที่มีผลแล้ว");
    }catch(error){
      console.error("M7_THRESHOLD_SCHEDULE_SAVE_FAILED",error);
      const code=String(error?.code || "");
      if (!["functions/invalid-argument","functions/failed-precondition","functions/permission-denied","functions/unauthenticated"].includes(code) || error.message==="M7_THRESHOLD_SCHEDULE_ACK_INVALID"){
        setThresholdScheduleUnconfirmed(true);
        setThresholdScheduleError("ยังยืนยันผลบันทึกไม่ได้ กรุณาโหลดหน้าใหม่และตรวจประวัติก่อนบันทึกซ้ำ");
      }else if (String(error?.message || "").includes("DELIVERY_THRESHOLD_BASELINE_LOCKED"))
        setThresholdScheduleError("เพดานเดิมถูกล็อกไว้และไม่ตรงกับข้อมูลล่าสุด กรุณาโหลดหน้าใหม่ก่อนกำหนดเวอร์ชันราคา");
      else setThresholdScheduleError("บันทึกไม่ได้: วันเริ่มมีผลต้องเป็นวันในอนาคตและใหม่กว่าทุกรายการเดิม โดยเพดานต้องไม่ซ้ำกับเวอร์ชันล่าสุด");
    }finally{setThresholdScheduleBusy(false);}
  };

  const result = useMemo(() => calculateSubscriptionPricing(config), [config]);
  const bangkokToday = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const value = key => parts.find(part => part.type === key)?.value || "";
    return [value("year"), value("month"), value("day")].join("-");
  }, []);
  const thresholdEarliestDate = useMemo(() => {
    const nextDay = date => new Date(Date.parse(date+"T00:00:00Z")+86400000).toISOString().slice(0,10);
    const first = nextDay(bangkokToday);
    const last = thresholdVersions.at(-1)?.effectiveOn;
    return last && last >= first ? nextDay(last) : first;
  }, [bangkokToday, thresholdVersions]);
  const money = value => `${formatSubscriptionMoney(value, intlLocale)} ฿`;
  const vatLabel = subscriptionVatLabel(result.config, t, value => formatNumber(value, { maximumFractionDigits: 2 }));

  const submit = async event => {
    event.preventDefault();
    if (authState.status !== "ready" || profile?.role !== "super_admin" || !storageReady || loadError || saving || saveUnconfirmed) return;
    setSaving(true);
    setMessage("");
    try {
      const data = await saveAdminSubscriptionPricing(config);
      if (data.storageReady !== true) throw new Error("SUBSCRIPTION_PRICING_STORAGE_NOT_READY");
      setConfig(data.config);
      if (Number(data.config.vatRate) > 0) lastVatRate.current = Number(data.config.vatRate);
      setMessage("");
      showToast(t("platform.pricing.save_success"));
    } catch (error) {
      console.error("PLATFORM_PRICING_SAVE_FAILED", error);
      if (error?.message === "SUBSCRIPTION_PRICING_WRITE_UNCONFIRMED") {
        setSaveUnconfirmed(true);
        setMessage("ไม่สามารถยืนยันราคาที่บันทึกกับ Firebase ได้ โปรดรีโหลดหน้านี้และตรวจสอบราคาปัจจุบันก่อนดำเนินการต่อ");
      } else {
        setMessage("");
      }
      showToast(t("platform.pricing.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };


  if (authState.status === "loading" || !stylesReady || (authState.status === "ready" && profile?.role === "super_admin" && !initialReady)) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (authState.status !== "ready") return <main role="alert" data-platform-pricing-auth-error>ตรวจสอบสิทธิ์กับ PENGUIN ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่</main>;
  if (!profile) return <Navigate to="/login?next=%2Fplatform%2Fpricing" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="super-admin-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><span>{t("platform.pricing.header_title")}</span></div>
          <Link className="btn btn-sm super-admin-header-back platform-pricing-back" to="/platform"><i className="bi bi-arrow-left" aria-hidden="true"></i><span>{t("platform.pricing.back")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main className="platform-pricing-shell">
        <section className="hero platform-pricing-hero">
          <span className="platform-pricing-hero-icon" aria-hidden="true"><i className="bi bi-gem"></i></span>
          <div className="platform-pricing-hero-content">
            <h1>{t("platform.pricing.hero_title")}</h1>
            <p>{t("platform.pricing.hero_description")}</p>
          </div>
        </section>

        <section className="platform-pricing-grid">
          <form id="pricingForm" className="card platform-pricing-form-card" onSubmit={submit}>
            <div className="section-title platform-pricing-section-heading">
              <span className="platform-pricing-heading-icon" aria-hidden="true"><i className="bi bi-sliders2"></i></span>
              <div>
                <h2>Premium</h2>
                <p>{intlLocale.startsWith("th") ? "จัดการราคาสมาชิกและเงื่อนไข Delivery" : "Manage membership pricing and Delivery settings"}</p>
              </div>
            </div>
            <div className="platform-pricing-fields">
              <label>
                <span className="platform-pricing-field-label"><i className="bi bi-calendar-month" aria-hidden="true"></i><span>{t("platform.pricing.monthly")}</span></span>
                <input id="pricingMonthlyPrice" type="number" min="0.01" max="1000000" step="0.01" required value={config.monthlyPrice} onChange={e => update({ monthlyPrice: e.target.value })} />
              </label>
              <label>
                <span className="platform-pricing-field-label"><i className="bi bi-truck" aria-hidden="true"></i><span>{intlLocale.startsWith("th") ? "เกณฑ์ยอด Delivery สะสมต่อเดือน (บาท)" : "Monthly paid Delivery threshold (THB)"}</span></span>
                <input id="pricingDeliveryThreshold" type="number" min="0" max="1000000000" step="0.01" required
                  readOnly
                  aria-readonly="true"
                  value={config.deliveryThreshold} />
                <small className="platform-pricing-locked-note"><i className="bi bi-lock" aria-hidden="true"/> อ่านอย่างเดียว · ประกาศเพดานใหม่พร้อมวันที่มีผลด้านล่าง</small>
              </label>
              <label className="platform-pricing-quota-field" style={{gridColumn:"1 / -1"}}>
                <span className="platform-pricing-field-label"><i className="bi bi-shield-check" aria-hidden="true"></i><span>{intlLocale.startsWith("th")
                  ? "จำนวนครั้งตรวจสลิป Slip2Go ต่อรอบบิล (ครั้ง)"
                  : "Slip2Go verification quota per billing cycle (checks)"}</span></span>
                <input id="pricingMonthlySlipQuota" type="number" min="0" max="1000000" step="1" required
                  style={{maxWidth:280}}
                  value={config.monthlySlipQuota} onChange={e => update({monthlySlipQuota:e.target.value})}/>
                <small className="platform-pricing-quota-help" style={{display:"block",marginTop:7,fontSize:12,color:"#61766a",lineHeight:1.5}}>{intlLocale.startsWith("th")
                  ? "นับเฉพาะบิลที่ส่งตรวจ Slip2Go จริง ไม่รวมการตรวจซ้ำ เมื่อยอด Delivery ถึงเพดานจะใช้งานได้ไม่จำกัด"
                  : "Counts unique bills sent to Slip2Go. Unlimited after reaching the paid Delivery threshold."}</small>
              </label>
              <label>
                <span className="platform-pricing-field-label"><i className="bi bi-percent" aria-hidden="true"></i><span>{intlLocale.startsWith("th") ? "ส่วนแบ่ง Platform จากยอด Delivery (%)" : "Platform share of paid Delivery (%)"}</span></span>
                <input id="pricingDeliveryShareRate" type="number" min="0" max="100" step="0.01" required
                  value={config.deliveryShareRate} onChange={e => update({ deliveryShareRate: e.target.value })} />
              </label>
              <label>
                <span className="platform-pricing-field-label"><i className="bi bi-calendar2-range" aria-hidden="true"></i><span>{t("platform.pricing.months")}</span></span>
                <input id="pricingAnnualMonths" type="number" min="1" max="60" step="1" required value={config.annualMonths} onChange={e => update({ annualMonths: e.target.value })} />
              </label>
              <label>
                <span className="platform-pricing-field-label"><i className="bi bi-tag" aria-hidden="true"></i><span>{t("platform.pricing.discount_type")}</span></span>
                <select id="pricingDiscountType" value={config.discountType} onChange={e => update({ discountType: e.target.value })}>
                  <option value="none">{t("platform.pricing.discount_none")}</option>
                  <option value="amount">{t("platform.pricing.discount_amount")}</option>
                  <option value="percent">{t("platform.pricing.discount_percent")}</option>
                </select>
              </label>
              <label>
                <span className="platform-pricing-field-label"><i className="bi bi-cash-coin" aria-hidden="true"></i><span>{t("platform.pricing.discount_value")}</span></span>
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
                <span className="platform-pricing-field-label"><i className="bi bi-receipt" aria-hidden="true"></i><span>{t("platform.pricing.vat_mode")}</span></span>
                <select id="pricingVatMode" value={config.vatMode} onChange={e => setVatMode(e.target.value)}>
                  <option value="inclusive">{t("platform.pricing.vat_inclusive")}</option>
                  <option value="exclusive">{t("platform.pricing.vat_exclusive")}</option>
                  <option value="none">{t("platform.pricing.vat_none")}</option>
                </select>
              </label>
              <label>
                <span className="platform-pricing-field-label"><i className="bi bi-calculator" aria-hidden="true"></i><span>{t("platform.pricing.vat_rate")}</span></span>
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
            <div className="field-help platform-pricing-info-note" role="note">
              <i className="bi bi-info-circle" aria-hidden="true"></i>
              <p>{intlLocale.startsWith("th")
                ? "คิดเฉพาะยอดสินค้าผ่าน Delivery ที่ชำระแล้ว ไม่รวมค่าส่ง เมื่อยอดสะสมรายเดือนเกินเกณฑ์ จะเริ่มคิดส่วนแบ่งตั้งแต่วันที่เกินเกณฑ์ โดยไม่คิดย้อนหลังวันก่อนหน้า"
                : "Paid Delivery merchandise only, excluding shipping. Revenue share starts on the day monthly sales exceed the threshold, without charging earlier days."}</p>
            </div>
            {message ? <p id="pricingStorageMessage">{message}</p> : <p id="pricingStorageMessage" hidden></p>}
            <div className="platform-pricing-actions">
              <button id="pricingReset" className="btn platform-pricing-reset" type="button" onClick={reset} disabled={saving}>
                <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                <span>{t("platform.pricing.reset")}</span>
              </button>
              <button id="pricingSave" className="btn btn-primary platform-pricing-save" type="submit" disabled={saving || loading || !storageReady || loadError || saveUnconfirmed}>
                <i className={`bi ${saving ? "bi-arrow-repeat" : "bi-floppy"}`} aria-hidden="true"></i>
                <span>{saving ? t("platform.pricing.saving") : t("platform.pricing.save")}</span>
              </button>
            </div>
          </form>
          <aside className="card platform-pricing-preview-card">
            <div className="section-title platform-pricing-section-heading">
              <span className="platform-pricing-heading-icon" aria-hidden="true"><i className="bi bi-eye"></i></span>
              <div>
                <h2>{t("platform.pricing.preview_title")}</h2>
                <p>{intlLocale.startsWith("th") ? "ตัวอย่างราคาที่แสดงให้ลูกค้า" : "Live customer-facing price preview"}</p>
              </div>
            </div>
            <p className="platform-pricing-monthly"><i className="bi bi-calendar-check" aria-hidden="true"></i><span>{t("platform.pricing.monthly_label")}</span> <strong id="previewMonthly">{money(result.monthly.configured)}</strong></p>
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
        <section className="card platform-threshold-schedule" id="platformThresholdSchedule" aria-label="กำหนดเพดาน Delivery ตามรอบบิล">
          <div className="platform-threshold-schedule-header">
            <span className="platform-threshold-schedule-icon" aria-hidden="true"><i className="bi bi-calendar2-week" /></span>
            <div className="platform-threshold-schedule-heading">
              <h2>กำหนดเพดาน Delivery พร้อมวันที่มีผล</h2>
              <p>ตั้งค่าราคากลางครั้งเดียว ทุกร้านจะใช้เมื่อเริ่มรอบบิลใหม่ของตัวเองหลังวันที่มีผล โดยไม่เปลี่ยนรอบที่กำลังดำเนินอยู่</p>
            </div>
          </div>
          <div className="platform-threshold-baseline" role="note">
            <span className="platform-threshold-baseline-icon" aria-hidden="true"><i className="bi bi-shield-lock"/></span>
            <span><strong>เพดานฐานเดิม (อ่านอย่างเดียว): {thresholdBaseline === null ? "—" : money(thresholdBaseline)}</strong>
              <small>ค่าเดิมเป็นข้อมูลอ้างอิงแบบอ่านอย่างเดียว · เวอร์ชันใหม่เริ่มใช้ตามรอบบิลของแต่ละร้านหลังวันที่ประกาศ</small></span>
          </div>
          <form className="platform-threshold-schedule-form" onSubmit={scheduleThreshold}>
            <label><span className="platform-threshold-field-title"><i className="bi bi-lock" aria-hidden="true"/> เพดานเดิมก่อนวันที่มีผล (บาท)</span>
              <input id="deliveryThresholdBaselineAmount" type="number" required step="0.01" min="1"
                value={thresholdBaseline === null ? "" : String(thresholdBaseline)}
                readOnly aria-readonly="true"/>
              <small className="platform-threshold-field-caption">ล็อกตามข้อมูลเดิม ไม่อนุญาตให้เปลี่ยนย้อนหลัง</small>
            </label>
            <label><span className="platform-threshold-field-title"><i className="bi bi-calendar-event" aria-hidden="true"/> วันที่มีผล (วัน/เดือน/ปี)</span>
              <input id="deliveryThresholdEffectiveOn" type="date" required min={thresholdEarliestDate} value={thresholdScheduleDate}
                onChange={e=>{setThresholdScheduleDate(e.target.value);setThresholdScheduleError("");}}/>
              <small className="platform-threshold-field-caption">เลือกวันในอนาคต · ใช้เมื่อร้านเริ่มรอบบิลใหม่</small>
            </label>
            <label><span className="platform-threshold-field-title"><i className="bi bi-graph-up-arrow" aria-hidden="true"/> เพดาน Delivery ใหม่ (บาท)</span>
              <input id="deliveryThresholdScheduledAmount" type="number" min="1" max="1000000000" step="0.01" required
                placeholder="กรอกเพดานใหม่" value={thresholdScheduleAmount}
                onChange={e=>{setThresholdScheduleAmount(e.target.value);setThresholdScheduleError("");}}/>
              <small className="platform-threshold-field-caption">ประกาศล่วงหน้าโดยไม่เปลี่ยนยอดของรอบปัจจุบัน</small>
            </label>
            <div className="platform-threshold-schedule-actions">
              <button type="submit" className="btn btn-primary" id="saveScheduledDeliveryThreshold"
                disabled={!thresholdScheduleReady || !thresholdScheduleWriteEnabled || thresholdScheduleBusy || thresholdScheduleUnconfirmed || !thresholdScheduleDate || !thresholdScheduleAmount}>
                <i className={"bi "+(thresholdScheduleBusy ? "bi-arrow-repeat" : "bi-calendar2-check")} aria-hidden="true"/>
                <span>{thresholdScheduleBusy ? "กำลังบันทึก…" : "กำหนดเพดานใหม่"}</span>
              </button>
            </div>
          </form>
          {thresholdScheduleError && <p role="alert" className="platform-threshold-schedule-error"><i className="bi bi-exclamation-circle" aria-hidden="true"/> {thresholdScheduleError}</p>}
          <div className="platform-threshold-schedule-history">
            <div className="platform-threshold-history-heading">
              <span className="platform-threshold-history-icon" aria-hidden="true"><i className="bi bi-clock-history"/></span>
              <div><h3>ประวัติราคากลางที่ประกาศแล้ว</h3><p>ประกาศย้อนหลังแบบอ่านอย่างเดียว ไม่สามารถแก้ไขหรือลบเวอร์ชันเดิมได้</p></div>
              <span className="platform-threshold-history-count">{thresholdScheduleReady ? `${thresholdVersions.length} เวอร์ชัน` : "—"}</span>
            </div>
            {!thresholdScheduleReady ? <p role="status">ยังไม่สามารถยืนยันประวัติเพดานจาก Firebase ได้</p> : thresholdVersions.length ?
              <div className="platform-threshold-history-table-wrap"><table>
                <thead><tr><th><i className="bi bi-calendar-check" aria-hidden="true"/> เริ่มมีผล</th><th><i className="bi bi-truck" aria-hidden="true"/> เพดาน Delivery</th><th>สถานะ</th></tr></thead>
                <tbody>{thresholdVersions.map(row=><tr key={row.effectiveOn}>
                  <td>{row.effectiveOn.split("-").reverse().join("/")}</td>
                  <td><strong>{money(row.thresholdCents/100)}</strong></td>
                  <td><span className="platform-threshold-history-lock"><i className="bi bi-lock" aria-hidden="true"/> ประกาศแล้ว</span></td>
                </tr>)}</tbody>
              </table></div>
              : <div className="platform-threshold-history-empty" role="status">
                <span aria-hidden="true"><i className="bi bi-calendar2-plus"/></span>
                <div><strong>ยังไม่มีเวอร์ชันราคาใหม่</strong>
                  <p>ร้านเดิมใช้เงื่อนไขเดิมตามรอบบิล เมื่อประกาศเพดานใหม่ ประวัติจะปรากฏที่นี่โดยอัตโนมัติ</p>
                </div>
              </div>}
          </div>
        </section>
      </main>

      <ParityFooter />
    </>
  );
}
