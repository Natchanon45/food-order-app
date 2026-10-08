import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { useAuth } from "@/auth/AuthProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { watchCustomerDisplay } from "@/data/operationalData";
import { qrDataUrl } from "@/utils/localQr";

const DEFAULT_DISPLAY_ID = "main-register";
const safeId = value => String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || DEFAULT_DISPLAY_ID;
const millis = value => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") {
    const result = Number(value.toMillis());
    return Number.isFinite(result) ? result : 0;
  }
  if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
  if (value instanceof Date) {
    const result = value.getTime();
    return Number.isFinite(result) ? result : 0;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value, formatNumber) => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PosCustomerDisplayPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("pos_customer_display.meta_title"),
    bodyClass: "pos-customer-display-page",
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "pos-locale-switcher-placement.css",
      "retail-customer-display.css",
      "retail-customer-display-responsive.css",
      "retail-customer-display-qr-consistency.css",
    ],
  });
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const displayId = useMemo(() => safeId(params.get("displayId") || params.get("registerId") || DEFAULT_DISPLAY_ID), [params]);
  const registerId = useMemo(() => safeId(params.get("registerId") || "iphone-01", "iphone-01"), [params]);
  const [snapshot, setSnapshot] = useState(null);
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [pairingOpen, setPairingOpen] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return undefined;
    setReady(false);
    const stop = watchCustomerDisplay(
      tenant.id,
      displayId,
      value => { setSnapshot(value || null); setReady(true); },
      error => { console.error("POS_CUSTOMER_DISPLAY_WATCH_FAILED", error); setReady(true); },
    );
    return stop;
  }, [tenant?.id, displayId]);

  useEffect(() => {
    const handler = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      console.warn("POS_CUSTOMER_DISPLAY_FULLSCREEN_FAILED", error);
    }
  };

  const items = useMemo(() => [...(Array.isArray(snapshot?.items) ? snapshot.items : [])]
    .sort((a, b) => (Number(b.touchedAt || 0) - Number(a.touchedAt || 0)) || (Number(b.sortIndex || 0) - Number(a.sortIndex || 0))), [snapshot?.items]);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const updatedAt = millis(snapshot?.updatedAt);
  const payment = snapshot?.paymentQr || null;
  const localPaymentQr = useMemo(() => {
    try { return payment?.payload ? qrDataUrl(payment.payload, { size: 320, margin: 4 }) : ""; }
    catch { return ""; }
  }, [payment?.payload]);
  const primaryPaymentQr = String(payment?.qrImageUrl || "");
  const [paymentQrSrc, setPaymentQrSrc] = useState("");
  const [paymentQrFailed, setPaymentQrFailed] = useState(false);
  useEffect(() => {
    setPaymentQrFailed(false);
    setPaymentQrSrc(payment?.error ? "" : (primaryPaymentQr || localPaymentQr));
  }, [payment?.error, primaryPaymentQr, localPaymentQr]);
  const paymentVisible = Boolean(payment && snapshot?.status !== "paid");
  const pairingUrl = useMemo(() => {
    const targetPath = displayId.startsWith("quick-order-") ? "/cashier/quick-order" : "/pos";
    const url = new URL(targetPath, location.origin);
    url.searchParams.set("registerId", registerId);
    url.searchParams.set("displayId", displayId);
    return url.href;
  }, [registerId, displayId]);
  const pairingQr = useMemo(() => qrDataUrl(pairingUrl, { size: 260, margin: 4 }), [pairingUrl]);

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (tenant?.id && !ready)) {
    return <PageReadyOverlay context={t("pos_customer_display.header.title")} title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fpos%2Fcustomer-display" replace />;
  if (!tenant) return <Navigate to="/" replace />;

  return (
    <div className="display-shell">
      <header className="display-header">
        <div className="brand"><div><strong>{t("pos_customer_display.header.title")}</strong><span>{t("pos_customer_display.header.subtitle")}</span></div></div>
        <div id="displayStatus" className="display-status">
          {updatedAt
            ? t("pos_customer_display.status.connected", { display: snapshot?.displayId || displayId })
            : t("pos_customer_display.status.waiting", { display: displayId })}
        </div>
        <div id="displayHeaderActions" className="display-header-actions" data-pos-locale-switcher-target>
          <button id="customerDisplayFullscreen" className="display-header-button" type="button" aria-label={t(fullscreen ? "pos_customer_display.header.fullscreen_exit" : "pos_customer_display.header.fullscreen_open")} title={t(fullscreen ? "pos_customer_display.header.fullscreen_exit" : "pos_customer_display.header.fullscreen_open")} onClick={toggleFullscreen}>
            <i className={"bi " + (fullscreen ? "bi-fullscreen-exit" : "bi-arrows-fullscreen")} aria-hidden="true"></i>
          </button>
          <div id="displayPairingCard" className={"pairing-card pairing-card-compact" + (pairingOpen ? " is-open" : "")}>
            <button className="pairing-toggle" type="button" aria-label={t("pos_customer_display.pairing.show_aria")} title={t("pos_customer_display.pairing.show_aria")} aria-expanded={pairingOpen} onClick={() => setPairingOpen(value => !value)}>
              <span className="pairing-mini-icon" aria-hidden="true"><i className="bi bi-qr-code"></i></span>
            </button>
            <div id="pairingPanel" className="pairing-panel" aria-label={t("pos_customer_display.pairing.panel_aria")}>
              <div className="pairing-copy">
                <div className="pairing-label">{t("pos_customer_display.pairing.label")}</div>
                <strong>{t("pos_customer_display.pairing.scan")}</strong>
                <span>{t("pos_customer_display.pairing.display", { display: displayId })}</span>
                <small>{t("pos_customer_display.pairing.help")}</small>
                <a className="pairing-link" href={pairingUrl} target="_blank" rel="noopener noreferrer">{t("pos_customer_display.pairing.open")}</a>
              </div>
              <div className="pairing-qr-wrap"><img className="pairing-qr" src={pairingQr} alt={t("pos_customer_display.pairing.qr_alt", { display: displayId })} /><div className="pairing-display-id">{displayId}</div></div>
            </div>
          </div>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
        </div>
      </header>

      <main className="display-main">
        <section className="welcome-card">
          <div><div className="customer-label">{t("pos_customer_display.customer.label")}</div><div id="customerName" className="customer-name">{snapshot?.customerDisplayName || snapshot?.customerName || t("pos_customer_display.customer.walk_in")}</div><div id="customerPhone" className="customer-phone">{snapshot?.customerDisplayPhone || ""}</div></div>
          <div className="promo-box">{t("pos_customer_display.customer.notice")}</div>
        </section>

        <section className="cart-card">
          <div className="cart-head"><h1>{t("pos_customer_display.cart.title")}</h1><span id="cartCount" className="cart-count">{t("pos_customer_display.cart.count", { count: formatNumber(totalQuantity) })}</span></div>
          <div id="cartList" className="cart-list">
            {items.length ? items.map((item, index) => <article className="cart-item" key={item.id || index}><div><strong>{item.name}</strong><small>{item.meta || ""} • {t("pos_customer_display.cart.quantity", { quantity: formatNumber(Number(item.qty || 0)) })}</small></div><div className="cart-item-total">{money(item.total, formatNumber)}</div></article>) : <div className="cart-empty">{t("pos_customer_display.cart.empty")}</div>}
          </div>
        </section>

        <section className="total-card">
          <div className="total-summary">
            <div className="total-row"><span>{t("pos_customer_display.total.subtotal")}</span><strong id="subtotal">{money(snapshot?.subtotal, formatNumber)}</strong></div>
            <div className="total-row"><span>{t("pos_customer_display.total.discount")}</span><strong id="discount">{money(snapshot?.discount, formatNumber)}</strong></div>
            <div className="total-row"><span>{t("pos_customer_display.total.before_vat")}</span><strong id="beforeVat">{money(snapshot?.beforeVat, formatNumber)}</strong></div>
            <div className="total-row"><span>VAT</span><strong id="vatAmount">{money(snapshot?.vatAmount, formatNumber)}</strong></div>
            <div className="total-row"><span>{t("pos_customer_display.total.vat_mode")}</span><strong id="vatMode">{snapshot?.vatMode === "exclude" ? t("pos_customer_display.total.exclude_vat") : snapshot?.vatMode === "include" ? t("pos_customer_display.total.include_vat") : "-"}</strong></div>
            <div className="total-row grand-row"><span>{t("pos_customer_display.total.net_total")}</span><strong id="grandTotal">{money(snapshot?.total, formatNumber)}</strong></div>
          </div>

          <section id="paymentQrPanel" className="payment-qr-card" hidden={!paymentVisible}>
            <div className="payment-qr-copy"><span>{t("pos_customer_display.payment.title")}</span><strong id="paymentQrAmount">{t("pos_customer_display.payment.amount", { amount: money(payment?.amount, formatNumber) })}</strong><p id="paymentQrVerify">{payment?.error ? t("pos_customer_display.payment.setup_wait") : (payment?.accountName || payment?.shopName || "-")}</p></div>
            <div className="payment-qr-image-wrap">
              <div className="thai-qr-payment-header" aria-label="Thai QR Payment"><img className="thai-qr-payment-logo" src="/assets/images/payment-branding/thai-qr-payment.svg" alt="Thai QR Payment" /></div>
              <div className="payment-qr-body">
                <div className="promptpay-brand"><img className="promptpay-brand-logo" src="/assets/images/payment-branding/promptpay.svg" alt="PromptPay" /></div>
                <div className="payment-qr-code">
                  <img id="paymentQrImage" className="payment-qr-image" src={paymentQrSrc || undefined} alt={t("pos_customer_display.payment.qr_alt")} hidden={!paymentQrSrc || Boolean(payment?.error) || paymentQrFailed} onError={() => { if (localPaymentQr && paymentQrSrc !== localPaymentQr) setPaymentQrSrc(localPaymentQr); else { setPaymentQrSrc(""); setPaymentQrFailed(true); } }} />
                  <span className="thai-qr-center-mark" aria-hidden="true"><img src="/assets/images/payment-branding/thai-qr-payment-mark.png" alt="" /></span>
                  <div id="paymentQrError" className="payment-qr-error" hidden={!payment?.error && !paymentQrFailed}>{payment?.error || (paymentQrFailed ? t("pos_customer_display.payment.qr_wait") : "")}</div>
                </div>
              </div>
            </div>
          </section>
          <div id="paidState" className="paid-state">{t("pos_customer_display.payment.thanks")}</div>
        </section>
      </main>
      <footer className="display-footer"><span></span><span id="updatedAt">{updatedAt ? t("pos_customer_display.status.updated", { time: new Date(updatedAt).toLocaleTimeString("th-TH") }) : ""}</span></footer>
    </div>
  );
}
