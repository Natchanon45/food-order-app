import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicOrder, getPublicStoreSettings, resolvePublicTenant, watchPublicOrder } from "@/data/publicStorefrontData";
import { PublicStorefrontFooter, PublicStorefrontHeader } from "@/components/PublicStorefront";
import { REACT_RELEASE } from "@/config/release";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { qrDataUrl } from "@/utils/localQr";

function valueMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(value?.seconds)) return Number(value.seconds) * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
function activeItems(order) { return (order?.items || []).filter(item => !item?.cancelled); }

export function DeliverySuccessPage() {
  const { slug = "" } = useParams();
  const { t, intlLocale, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("delivery.success.meta_title"),
    bodyClass: "delivery-success-page",
    styles: ["app.css", "icons.css", "receipt-layout.css", "delivery-success-tracking.css", "shared-responsive.css"],
  });
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const orderId = String(params.get("order") || "").trim();
  const [tenant, setTenant] = useState(null);
  const [settings, setSettings] = useState({});
  const [order, setOrder] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(true);
  const receiptRef = useRef(null);

  useEffect(() => {
    let alive = true;
    let stop = null;
    (async () => {
      setLoading(true);
      setErrorText("");
      try {
        if (!slug) throw new Error(t("delivery.checkout.errors.tenant_not_ready"));
        if (!orderId) throw new Error(t("delivery.success.errors.missing_order_number"));
        const nextTenant = await resolvePublicTenant(slug);
        const [nextSettings, initial] = await Promise.all([
          getPublicStoreSettings(nextTenant),
          getPublicOrder(nextTenant, orderId),
        ]);
        if (!initial) throw new Error(t("delivery.success.errors.order_not_found"));
        if (!alive) return;
        setTenant(nextTenant); setSettings(nextSettings || {}); setOrder(initial);
        stop = watchPublicOrder(nextTenant, orderId, next => { if (alive && next) setOrder(next); });
        try { sessionStorage.removeItem("delivery_checkout_draft:" + slug); } catch {}
      } catch (error) {
        console.error("DELIVERY_SUCCESS_REACT_LOAD_FAILED", error);
        if (alive) setErrorText(error?.message || t("delivery.success.errors.order_not_found"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; stop?.(); };
  }, [slug, orderId, t]);

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const items = activeItems(order);
  const subtotal = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  const fee = order?.status === "cancelled" ? 0 : Math.max(0, Number(order?.deliveryFee || 0) || 0);
  const total = order?.status === "cancelled" ? 0 : Number.isFinite(Number(order?.totalAmount)) ? Number(order.totalAmount) : subtotal + fee;
  const createdMs = valueMs(order?.createdAt || order?.createdAtText);
  const verifyUrl = tenant && order ? location.origin + "/verify?tenant=" + encodeURIComponent(tenant.slug || slug) + "&order=" + encodeURIComponent(order.id || orderId) : "";
  const qr = verifyUrl ? qrDataUrl(verifyUrl, { size: 160, margin: 4 }) : "";
  const shopName = String(settings?.orderDeliveryShopName || settings?.shopName || tenant?.name || t("delivery.success.receipt.shop_fallback")).trim();
  const paymentText = order?.paymentStatus === "paid" || order?.status === "paid"
    ? t("delivery.success.payment.paid")
    : order?.paymentMethod === "cod"
      ? t("delivery.success.payment.cod")
      : order?.paymentStatus === "pending_verification"
        ? t("delivery.success.payment.pending_verification")
        : t("delivery.success.payment.unpaid");

  const download = async () => {
    const node = receiptRef.current;
    if (!node) return;
    try {
      const printWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!printWindow) return;
      const styleVersion = encodeURIComponent(REACT_RELEASE.build);
      printWindow.document.write("<!doctype html><html><head><title>" + t("delivery.success.meta_title") + "</title><link rel='stylesheet' href='/react/parity/css/app.css?v=" + styleVersion + "'><link rel='stylesheet' href='/react/parity/css/receipt-layout.css?v=" + styleVersion + "'></head><body>" + node.outerHTML + "<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}<\/script></body></html>");
      printWindow.document.close();
    } catch (error) {
      console.error("DELIVERY_SUCCESS_PRINT_FAILED", error);
    }
  };

  if (!stylesReady) return null;
  return <>
    <PublicStorefrontHeader title={t("delivery.success.header.title")} />
    <main className="container">
      <div className="dialog-actions" style={{ justifyContent: "space-between", margin: "18px 0" }}>
        <Link className="btn" to={slug ? "/s/" + encodeURIComponent(slug) + "/delivery" : "/"}><i className="bi bi-arrow-left app-icon"></i><span>{t("delivery.success.header.order_again")}</span></Link>
        <button className="btn btn-primary" type="button" disabled={!order} onClick={download}><i className="bi bi-printer app-icon"></i><span>{t("delivery.success.actions.download")}</span></button>
      </div>
      {loading ? <section className="card empty">{t("delivery.success.tracking.loading")}</section> : null}
      {errorText ? <section className="card empty">{errorText}</section> : null}
      {order ? <section className="receipt" id="customerReceipt" ref={receiptRef}>
        <div className="receipt-header">
          <h1>{shopName}</h1>
          <div>{settings.shopAddress || ""}</div>
          <div>{settings.shopPhone ? t("delivery.success.shop_phone", { phone: settings.shopPhone }) : ""}</div>
          <strong>{t("delivery.success.receipt.evidence")}</strong>
        </div>
        <hr className="receipt-rule"/>
        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.order_number")}</span><strong>{String(order.id || orderId).slice(0,12).toUpperCase()}</strong></div>
        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.date")}</span><span>{createdMs ? new Date(createdMs).toLocaleString(intlLocale) : "-"}</span></div>
        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.payment")}</span><strong>{paymentText}</strong></div>
        <hr className="receipt-rule"/>
        <div><strong>{t("delivery.success.receipt.fields.recipient")}:</strong> {order.recipientName || "-"}</div>
        <div><strong>{t("delivery.success.receipt.fields.phone")}:</strong> {order.recipientPhone || "-"}</div>
        <div><strong>{t("delivery.success.receipt.fields.address")}:</strong> {order.deliveryAddress || "-"}</div>
        <div><strong>{t("delivery.success.receipt.fields.zone")}:</strong> {order.deliveryZoneLabel || order.deliveryZone || "-"}</div>
        <hr className="receipt-rule"/>
        <table className="receipt-items receipt-items-3col"><thead><tr><th>{t("delivery.success.receipt.fields.item")}</th><th className="num receipt-unit">{t("delivery.success.receipt.fields.price")}</th><th className="num receipt-line-total">{t("delivery.success.receipt.fields.total")}</th></tr></thead>
          <tbody>{items.map((item,index)=><tr key={(item.menuId||item.name||"item")+index}><td>{Number(item.qty||0)} × {item.name}</td><td className="num">{money(item.price)}</td><td className="num">{money(Number(item.qty||0)*Number(item.price||0))}</td></tr>)}</tbody>
        </table>
        <hr className="receipt-rule"/>
        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.subtotal")}</span><span>{money(subtotal)} {t("delivery.success.receipt.unit_baht")}</span></div>
        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.delivery_fee")}</span><span>{money(fee)} {t("delivery.success.receipt.unit_baht")}</span></div>
        <div className="receipt-row receipt-total"><span>{t("delivery.success.receipt.fields.net_total")}</span><span>{money(total)} {t("delivery.success.receipt.unit_baht")}</span></div>
        {order.note ? <><hr className="receipt-rule"/><strong>{t("delivery.success.receipt.fields.note")}</strong><div>{order.note}</div></> : null}
        <hr className="receipt-rule"/>
        <div className="receipt-header">
          {qr ? <img src={qr} width="120" height="120" alt={t("delivery.success.receipt.verify_qr.title")} /> : null}
          <div>{t("delivery.success.receipt.verify_qr.title")}</div>
          <small>{t("delivery.success.receipt.verify_qr.note")}</small>
          {verifyUrl ? <a href={verifyUrl} target="_blank" rel="noreferrer">{t("delivery.success.actions.verify_latest")}</a> : null}
        </div>
      </section> : null}
    </main>
    <PublicStorefrontFooter/>
  </>;
}
