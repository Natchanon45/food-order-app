import { useEffect, useMemo, useState } from "react";
import { getPublicOrder, getPublicStoreSettings, resolvePublicTenant } from "@/data/publicStorefrontData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

function ts(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(value?.seconds)) return Number(value.seconds) * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
function activeItems(order) { return (order?.items || []).filter(item => !item?.cancelled); }
function subtotal(order) { return activeItems(order).reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0); }
function deliveryFee(order, sub = subtotal(order)) {
  if (order?.status === "cancelled" || order?.orderType !== "delivery") return 0;
  const stored = Math.max(0, Number(order?.deliveryFee || 0) || 0);
  if (order?.freeShippingApplied === true) return 0;
  const total = Number(order?.totalAmount);
  return Number.isFinite(total) && sub + stored > total + 0.009 ? Math.max(0, total - sub) : stored;
}
function total(order) {
  if (order?.status === "cancelled") return 0;
  const sub = subtotal(order);
  const stored = Number(order?.totalAmount);
  if (order?.orderType === "delivery") return Number.isFinite(stored) ? Math.max(0, stored) : sub + deliveryFee(order, sub);
  return sub;
}

function Metric({ icon, label, value, totalMetric = false }) {
  return <div className={"verify-metric" + (totalMetric ? " verify-metric-total" : "")}>
    <div className="verify-metric-label"><i className={"bi bi-" + icon}></i><span>{label}</span></div>
    <div className="verify-metric-value">{value}</div>
  </div>;
}

function OrderItems({ order, money, t }) {
  const rows = activeItems(order);
  return <ul className="order-items verify-items">
    {rows.length ? rows.map((item, index) => <li key={(item.menuId || item.name || "item") + index}>
      <span>{Number(item.qty || 0)} × {item.name}{item.isGift === true ? " " + t("verify.gift_suffix") : ""}</span>
      <strong>{money(Number(item.qty || 0) * Number(item.price || 0))}</strong>
    </li>) : <li><span>{t("verify.no_billable_items")}</span><strong>—</strong></li>}
  </ul>;
}

export function VerifyPage() {
  const { t, intlLocale, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("verify.meta_title"),
    bodyClass: "verify-page",
    styles: ["app.css", "icons.css", "verify-page.css"],
  });
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const tenantSlug = String(params.get("tenant") || "").trim().toLowerCase();
  const orderId = String(params.get("order") || "").trim();
  const orderIds = useMemo(() => String(params.get("orders") || "").split(",").map(v => v.trim()).filter(Boolean), []);
  const [tenant, setTenant] = useState(null);
  const [settings, setSettings] = useState({});
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatTime = value => {
    const ms = ts(value);
    return ms ? new Date(ms).toLocaleString(intlLocale, { dateStyle: "medium", timeStyle: "short" }) : "-";
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErrorText("");
      try {
        if (!tenantSlug) throw new Error(t("verify.errors.missing_tenant"));
        const nextTenant = await resolvePublicTenant(tenantSlug);
        const ids = orderIds.length ? orderIds : orderId ? [orderId] : [];
        if (!ids.length) throw new Error(t(orderIds.length ? "verify.errors.order_not_found" : "verify.errors.missing_order"));
        const [nextSettings, rows] = await Promise.all([
          getPublicStoreSettings(nextTenant),
          Promise.all(ids.map(id => getPublicOrder(nextTenant, id))),
        ]);
        const valid = rows.filter(Boolean).sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0));
        if (!valid.length) throw new Error(t("verify.errors.order_not_found"));
        if (!alive) return;
        setTenant(nextTenant); setSettings(nextSettings || {}); setOrders(valid);
      } catch (error) {
        console.warn("VERIFY_REACT_LOAD_FAILED", error?.message || error);
        if (alive) setErrorText(error?.message || t("verify.errors.generic"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tenantSlug, orderId, orderIds.join(","), t]);

  if (!stylesReady) return null;
  const shopName = String(settings?.orderDeliveryShopName || settings?.shopName || tenant?.name || t("verify.shop_fallback")).trim();
  const first = orders[0];
  const merged = orderIds.length > 0;
  const paymentText = order => {
    if (order?.paymentStatus === "paid" || order?.status === "paid") return t("verify.payment.paid");
    if (order?.paymentMethod === "cod") return t("verify.payment.cod");
    if (order?.paymentStatus === "pending_verification") return t("verify.payment.pending_verification");
    return t("verify.payment.unpaid");
  };
  const typeText = order => order?.orderType === "delivery"
    ? t("verify.order_type.delivery")
    : order?.orderType === "takeaway"
      ? t("verify.order_type.takeaway", { queue: order.queueNo || "" }).trim()
      : t("verify.order_type.table", { table: order?.tableCode || "-" });

  return <>
    <header className="app-header verify-header"><div className="brand verify-brand"><span className="brand-mark">PG</span><span className="verify-brand-title">{t("verify.header.title")}</span></div></header>
    <main className="container verify-container">
      <section className="hero verify-hero">
        <div className="verify-hero-copy"><span className="verify-hero-icon"><i className="bi bi-shield-check"></i></span><div><h1>{t("verify.hero.title")}</h1><p>{t("verify.hero.description")}</p></div></div>
        <span className="verify-trust-badge"><i className="bi bi-cloud-check"></i><span>{t("verify.latest_badge")}</span></span>
      </section>
      <section className="card verify-result-card">
        {loading ? <div className="verify-loading"><span className="verify-loading-icon"><i className="bi bi-arrow-repeat"></i></span><span>{t("verify.loading")}</span></div> : null}
        {errorText ? <div className="verify-error"><span className="verify-error-icon"><i className="bi bi-exclamation-circle"></i></span><strong>{errorText}</strong></div> : null}
        {!loading && !errorText && first ? <>
          <div className="verify-shop-head">
            <div className="verify-shop-identity"><span className="verify-shop-icon"><i className="bi bi-shop"></i></span><div className="verify-shop-copy"><h2>{shopName}</h2><p>{[settings.shopAddress, settings.shopPhone ? t("verify.fields.phone") + " " + settings.shopPhone : ""].filter(Boolean).join(" • ") || " "}</p></div></div>
            <span className="verify-latest-badge"><i className="bi bi-patch-check"></i><span>{t("verify.latest_badge")}</span></span>
          </div>
          <div className="verify-card-body">
            {merged ? <>
              <div className="verify-summary-grid">
                <Metric icon="diagram-3" label={t("verify.fields.type")} value={t("verify.summary.merged_table", { table: first.tableCode || "-" })} />
                <Metric icon="layers" label={t("verify.fields.rounds")} value={t("verify.summary.round_count", { count: orders.length })} />
                <Metric icon="calendar3" label={t("verify.fields.date")} value={formatTime(first.createdAt || first.createdAtText)} />
                <Metric icon="credit-card" label={t("verify.fields.payment")} value={orders.every(o => ["paid","cancelled"].includes(o.status) || o.paymentStatus === "paid") ? t("verify.payment.paid") : t("verify.payment.unpaid")} />
                <Metric icon="cash-stack" label={t("verify.fields.net_total")} value={money(orders.reduce((sum, o) => sum + total(o), 0)) + " " + t("verify.units.baht")} totalMetric />
              </div>
              <div className="verify-rounds">{orders.map(order => <section className={"verify-round-card" + (order.status === "cancelled" ? " is-cancelled" : "")} key={order.id}>
                <div className="verify-round-title"><i className="bi bi-receipt"></i><span>{t("verify.round.title", { round: order.roundNumber || 1 })}{order.status === "cancelled" ? t("verify.round.cancelled_suffix") : ""}</span></div>
                <OrderItems order={order} money={money} t={t} />
              </section>)}</div>
            </> : <>
              <div className="verify-summary-grid">
                <Metric icon="hash" label={t("verify.fields.order_number")} value={String(first.id || orderId).slice(0,12).toUpperCase()} />
                <Metric icon="calendar3" label={t("verify.fields.date")} value={formatTime(first.createdAt || first.createdAtText)} />
                <Metric icon="bag-check" label={t("verify.fields.type")} value={typeText(first)} />
                <Metric icon="activity" label={t("verify.fields.latest_status")} value={t("shared.status." + String(first.status || "pending"))} />
                <Metric icon="credit-card" label={t("verify.fields.payment")} value={paymentText(first)} />
                <Metric icon="cash-stack" label={t("verify.fields.net_total")} value={money(total(first)) + " " + t("verify.units.baht")} totalMetric />
              </div>
              {first.orderType === "delivery" ? <section className="verify-detail-panel">
                <div className="verify-detail-title"><i className="bi bi-truck"></i><span>{t("verify.order_type.delivery")}</span></div>
                <p><strong>{t("verify.fields.recipient")}:</strong> {first.recipientName || "-"}<br/><strong>{t("verify.fields.phone")}:</strong> {first.recipientPhone || "-"}<br/><strong>{t("verify.fields.address")}:</strong> {first.deliveryAddress || "-"}<br/><strong>{t("verify.fields.delivery_fee")}:</strong> {money(deliveryFee(first))} {t("verify.units.baht")}</p>
              </section> : null}
              <section className="verify-items-panel"><OrderItems order={first} money={money} t={t} /></section>
              {(first.items || []).some(item => item?.cancelled) ? <p className="menu-category">{t("verify.cancelled_items_note")}</p> : null}
            </>}
          </div>
        </> : null}
      </section>
    </main>
  </>;
}
