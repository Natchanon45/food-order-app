import { CompanionConfirmedQr } from "@/components/CompanionConfirmedQr";
import { DeliveryPaymentCorrection } from "@/components/DeliveryPaymentCorrection";
import { ReceiptOriginalItemRow, RevisedOrderNet, OrderCancellationWatermark } from "@/components/OrderRevisionDisplay";
import { deliveryReceiptTotals } from "@/utils/deliveryReceiptTotal.mjs";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { Link, useParams } from "react-router-dom";
import { getPublicOrder, getPublicStoreSettings, resolvePublicTenant, watchPublicOrder } from "@/data/publicStorefrontData";
import { PublicStorefrontFooter, PublicStorefrontHeader, showStorefrontToast } from "@/components/PublicStorefront";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { qrDataUrl } from "@/utils/localQr";
import { deliveryReceiptPaymentLabel, deliveryReceiptZoneLabel, deliveryReceiptItemLabel } from "@/utils/deliveryReceiptPresentation";
import { deliverySuccessCustomerState } from "@/utils/deliverySuccessCustomerState";

function valueMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(value?.seconds)) return Number(value.seconds) * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDeliveryTime(value) {
  const ms = valueMs(value);
  if (!ms) return "-";
  return new Intl.DateTimeFormat("en-GB-u-ca-gregory", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms)).replace(",", "");
}

function activeItems(order) {
  return (order?.items || []).filter(item => !item?.cancelled);
}

function trackingState(order = {}) {
  const local = String(order.status || "pending").toLowerCase();
  const lala = String(order.lalamoveOrderStatus || "").toUpperCase();

  if (local === "cancelled") {
    return { key: "canceled", progress: 0, terminal: true };
  }
  if (["CANCELED", "CANCELLED", "REJECTED", "EXPIRED"].includes(lala)) {
    return { key: "dispatch_retry", progress: 3, terminal: false };
  }
  if (lala === "COMPLETED") return { key: "completed", progress: 5, terminal: true };
  if (lala === "PICKED_UP") return { key: "picked_up", progress: 4, terminal: false };
  if (lala === "ON_GOING") return { key: "on_going", progress: 3, terminal: false };
  if (lala === "ASSIGNING_DRIVER") return { key: "assigning_driver", progress: 3, terminal: false };

  const map = {
    pending: ["pending", 0],
    accepted: ["accepted", 1],
    cooking: ["cooking", 2],
    ready: ["ready", 3],
    served: ["served", 4],
    paid: ["paid", 5],
  };
  const state = map[local] || ["unknown", 0];
  return { key: state[0], progress: state[1], terminal: local === "paid" };
}

function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  const existing = document.querySelector('script[data-delivery-html2canvas]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(window.html2canvas), { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.async = true;
    script.dataset.deliveryHtml2canvas = "true";
    script.addEventListener("load", () => resolve(window.html2canvas), { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

async function receiptBlob(node) {
  const html2canvas = await loadHtml2Canvas();
  if (!html2canvas) throw new Error("HTML2CANVAS_UNAVAILABLE");
  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const canvas = await html2canvas(node, {
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
  });
  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("RECEIPT_IMAGE_FAILED")), "image/png", 1);
  });
}

export function DeliverySuccessPage() {
  const { slug = "" } = useParams();
  const { t, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("delivery.success.meta_title"),
    bodyClass: "order-delivery-workspace od-receipt-page delivery-success-page",
    styles: [
      "app.css",
      "receipt-layout.css",
      "icons.css",
      "order-delivery-workspace-theme.css",
      "delivery-success-tracking.css",
      "delivery-success-customer-actions.css",
    ],
  });

  const params = useMemo(() => new URLSearchParams(location.search), []);
  const orderId = String(params.get("order") || "").trim();
  const [tenant, setTenant] = useState(null);
  const [settings, setSettings] = useState({});
  const [order, setOrder] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
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

        setTenant(nextTenant);
        setSettings(nextSettings || {});
        setOrder(initial);
        stop = watchPublicOrder(nextTenant, orderId, next => {
          if (alive && next) setOrder(next);
        });

        try {
          sessionStorage.removeItem("delivery_checkout_draft:" + slug);
        } catch {}
      } catch (error) {
        console.error("DELIVERY_SUCCESS_REACT_LOAD_FAILED", error);
        if (alive) setErrorText(error?.message || t("delivery.success.errors.order_not_found"));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      stop?.();
    };
  }, [slug, orderId, t]);

  const money = value => formatNumber(Number(value || 0), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const items = activeItems(order);
  const fee = order?.status === "cancelled" ? 0 : Math.max(0, Number(order?.deliveryFee || 0) || 0);
  const total = order?.status === "cancelled" ? 0 : Number(order?.totalAmount || 0);
  const subtotal = Number.isFinite(Number(order?.subtotalAmount))
    ? Number(order.subtotalAmount)
    : Math.max(0, total - fee);
  const verifyUrl = tenant && order
    ? location.origin + "/verify/?tenant=" + encodeURIComponent(tenant.slug || slug) + "&order=" + encodeURIComponent(order.id || orderId)
    : "";
  const verifyQr = verifyUrl ? qrDataUrl(verifyUrl, { size: 120, margin: 4 }) : "";
  const shopName = String(settings?.shopName || t("delivery.success.receipt.shop_fallback")).trim();

  // Receipt copy is informational: the saved order remains pending_verification
  // until the server verifies payment or the authorized cashier approves it.
  const paymentText = deliveryReceiptPaymentLabel(order, t);
  const deliveryZoneText = deliveryReceiptZoneLabel(order, t);

  // The badge is environment-only: it never authorizes or discovers money.
  // Set VITE_SHOW_PAYMENT_SANDBOX_BADGE=false for a future live Stripe release.
  const showStripeSandboxBadge = import.meta.env.VITE_SHOW_PAYMENT_SANDBOX_BADGE !== "false";
  const successView = deliverySuccessCustomerState(order, {
    sandboxBadge: showStripeSandboxBadge,
  });
  const orderAgainHref = slug ? "/s/" + encodeURIComponent(slug) + "/delivery" : "/";
  const mayShowReceipt = Boolean(order && !successView.hideReceipt &&
    !(order?.paymentQrMode === "confirmed_order_5m" &&
      order?.paymentStatus === "pending_verification"));
  const showToolbar = Boolean(order && !successView.hideToolbar &&
    !(order?.paymentQrMode === "confirmed_order_5m" &&
      order?.paymentStatus === "pending_verification"));

  const tracking = trackingState(order || {});
  const trackingText = t("delivery.success.tracking.statuses." + tracking.key);
  const trackingSteps = [
    "received",
    "accepted",
    "cooking",
    "ready",
    "picked_up",
    "delivered",
  ];
  const shareLink = String(order?.lalamoveShareLink || "").trim();
  const showTrackLink = Boolean(shareLink)
    && !["canceled", "dispatch_retry", "completed"].includes(tracking.key);

  const download = async () => {
    const node = receiptRef.current;
    if (!node || !order || downloading) return;

    setDownloading(true);
    try {
      const blob = await receiptBlob(node);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "delivery-order-" + String(order.id || orderId).slice(0, 12).toUpperCase() + ".png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      showStorefrontToast(t("delivery.success.actions.downloaded"));
    } catch (error) {
      console.error("DELIVERY_SUCCESS_DOWNLOAD_FAILED", error);
      showStorefrontToast(t("delivery.success.actions.download_failed"), "error");
    } finally {
      setDownloading(false);
    }
  };

  if (!stylesReady || loading) return <PageReadyOverlay />;

  return <>
    <PublicStorefrontHeader
      title={t("delivery.success.header.title")}
      action={!showToolbar ? <Link className="btn btn-sm" id="orderAgainLink" to={orderAgainHref}><i className="bi bi-plus-circle app-icon" aria-hidden="true"></i><span>{t("delivery.success.header.order_again")}</span></Link> : null}
    />

    <main className="receipt-page">
      {order?.paymentQrMode === "confirmed_order_5m" &&
        <CompanionConfirmedQr tenant={tenant} order={order}
          orderId={orderId} onToast={showStorefrontToast} />}

      {/* Three high-frequency customer controls sit immediately below the
          storefront header in one equal-width card on mobile and desktop. */}
      {showToolbar && <nav className="receipt-toolbar delivery-receipt-actions"
        aria-label="การดำเนินการกับคำสั่งซื้อ">
        <a className="btn delivery-receipt-action" id="verifyLatestLink"
          href={verifyUrl || "#"} target="_blank" rel="noopener noreferrer"
          aria-label={t("delivery.success.actions.verify_latest")}
          title={t("delivery.success.actions.verify_latest")}>
          <span className="delivery-receipt-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="25" height="25" fill="none"
              stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"
              strokeLinejoin="round" focusable="false">
              <path d="M2 12c2.5-4.2 5.8-6.3 10-6.3s7.5 2.1 10 6.3c-2.5 4.2-5.8 6.3-10 6.3S4.5 16.2 2 12Z"/>
              <circle cx="12" cy="12" r="3.2"/>
            </svg>
          </span>
          <span className="delivery-receipt-action-label">
            {t("delivery.success.actions.verify_latest")}
          </span>
        </a>
        <button className="btn btn-primary delivery-receipt-action"
          id="saveImageButton" type="button" disabled={!mayShowReceipt || downloading}
          aria-label={t(downloading ? "delivery.success.actions.creating_image" :
            "delivery.success.actions.download")}
          aria-busy={downloading}
          title={t(downloading ? "delivery.success.actions.creating_image" :
            "delivery.success.actions.download")} onClick={download}>
          <span className="delivery-receipt-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
              strokeLinejoin="round" focusable="false">
              <path d="M12 3v12m-5-5 5 5 5-5"/>
              <path d="M4 17v3h16v-3"/>
            </svg>
          </span>
          <span className="delivery-receipt-action-label">
            {t(downloading ? "delivery.success.actions.creating_image" :
              "delivery.success.actions.download")}
          </span>
        </button>
        <Link className="delivery-mobile-order-again" id="orderAgainMobileLink"
          to={orderAgainHref} aria-label={t("delivery.success.header.order_again")}
          title={t("delivery.success.header.order_again")}>
          <span className="delivery-receipt-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="23" height="23" fill="none"
              stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
              strokeLinejoin="round" focusable="false">
              <path d="M5 9h14l1 12H4L5 9Z"/>
              <path d="M8 9V6a4 4 0 0 1 8 0v3"/>
              <path d="M12 12v6m-3-3h6"/>
            </svg>
          </span>
        </Link>
      </nav>}

      {successView.orderReceived && <section className="card customer-order-received"
        id="customerQROrderReceived" role="status" data-paid={successView.verifiedPaid}>
        <span className="customer-order-received-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
            stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"
            strokeLinejoin="round" focusable="false">
            <path d="M5 12.5l4.5 4.5L19 7"/>
          </svg>
        </span>
        <div className="customer-order-received-copy">
          <h2>{successView.title}</h2>
          <p>{successView.note}</p>
          <small>เลขที่บิล {successView.billNo}</small>
          <div className="customer-payment-badges" aria-label="ช่องทางการชำระเงิน">
            <span className="customer-payment-badge" data-payment-method={successView.payment}>
              <i className={successView.payment === "stripe" ?
                "bi bi-credit-card" : successView.payment === "promptpay" ?
                  "bi bi-qr-code" : "bi bi-wallet2"} aria-hidden="true"/>
              {successView.badge}
            </span>
            {successView.showSandboxBadge && <span
              className="customer-payment-badge customer-payment-badge-sandbox"
              data-sandbox-badge="true">Sandbox</span>}
          </div>
        </div>
      </section>}

      {(successView.stripePending || successView.stripeFailed) &&
        <section className="card customer-stripe-payment-status"
          id="customerStripePaymentStatus" role="status"
          data-payment-state={successView.stripeFailed ? "failed" : "pending"}>
          <span className="customer-stripe-payment-status-icon" aria-hidden="true">
            <i className={successView.stripeFailed ?
              "bi bi-exclamation-circle" : "bi bi-clock-history"}/>
          </span>
          <div className="customer-stripe-payment-status-copy">
            <h2>{successView.stripeFailed ?
              "รายการชำระเงินไม่สำเร็จ" : "รอการยืนยันจาก Stripe"}</h2>
            <p>{successView.stripeFailed ?
              "รายการนี้ยังไม่ยืนยันการชำระเงิน หากมีการตัดเงินจริงกรุณาติดต่อร้านก่อนชำระซ้ำ" :
              "คำสั่งซื้อยังไม่ยืนยันชำระเงิน กรุณาตรวจสอบสถานะผ่านหน้าติดตามคำสั่งซื้อ"}</p>
            <div className="customer-payment-badges" aria-label="ช่องทางการชำระเงิน">
              <span className="customer-payment-badge" data-payment-method="stripe">Stripe</span>
              {successView.showSandboxBadge && <span
                className="customer-payment-badge customer-payment-badge-sandbox"
                data-sandbox-badge="true">Sandbox</span>}
            </div>
          </div>
        </section>}

      {!successView.stripePending && !successView.stripeFailed &&
        !(order?.paymentQrMode==="confirmed_order_5m"&&order?.paymentStatus==="pending_verification"&&order?.companionKitchenRelease?.status!=="admitted_unverified")&&<section className="delivery-tracking-card" id="deliveryTrackingCard">
        <div className="delivery-tracking-head">
          <div>
            <h2>{t("delivery.success.tracking.title")}</h2>
            <p id="deliveryTrackingMessage">{loading ? t("delivery.success.tracking.loading") : trackingText}</p>
          </div>
          <span className="delivery-tracking-badge" id="deliveryTrackingBadge">
            {loading ? t("delivery.success.tracking.loading_short") : trackingText}
          </span>
        </div>

        <ol className="delivery-tracking-timeline" id="deliveryTrackingTimeline">
          {trackingSteps.map((key, index) => {
            const done = index < tracking.progress || (tracking.terminal && tracking.progress === 5);
            const current = index === tracking.progress && !(tracking.terminal && tracking.progress === 5);
            return <li
              className={"delivery-tracking-step" + (done ? " is-done" : "") + (current ? " is-current" : "")}
              data-tracking-step={index}
              key={key}
            >
              <span className="delivery-tracking-label">{t("delivery.success.tracking.steps." + key)}</span>
            </li>;
          })}
        </ol>

        <div className="delivery-tracking-actions">
          <span className="delivery-tracking-updated" id="deliveryTrackingUpdated">
            {order ? t("delivery.success.tracking.updated", { time: formatDeliveryTime(order.updatedAt || order.createdAt) }) : ""}
          </span>
          <a
            className="btn btn-primary"
            id="customerLalamoveTrackLink"
            href={shareLink || "#"}
            target="_blank"
            rel="noopener"
            hidden={!showTrackLink}
          >
            <i className="bi bi-truck app-icon" aria-hidden="true"></i><span>{t("delivery.success.tracking.track_driver")}</span>
          </a>
        </div>
      </section>}

      {loading ? <section className="card empty">{t("delivery.success.tracking.loading")}</section> : null}
      {errorText ? <section className="card empty">{errorText}</section> : null}

      {order?.paymentStatus === "pending_verification" &&
        <section className="card delivery-payment-review-card" id="customerPaymentReviewNotice"
          role="status" aria-live="polite" data-public-order-unverified="true">
          <div className="delivery-payment-review-header">
            <span className="delivery-payment-review-icon" aria-hidden="true">
              <i className="bi bi-shield-check" /></span>
            <div className="delivery-payment-review-heading">
              <small>การตรวจสอบยอดชำระ</small>
              <h3>ยังไม่ยืนยันรับเงิน</h3>
            </div>
            <span className="badge warning">รอตรวจสอบ</span>
          </div>
          <p>บันทึกออเดอร์แล้ว แต่หลักฐานธนาคารหรือการแจ้งเงินเข้ายังไม่ใช่ผลยืนยันการชำระเงิน
            โปรดอย่าโอนเงินซ้ำ หากโอนแล้วกรุณาติดต่อร้านค้าพร้อมสลิปต้นฉบับของรายการเดิม</p>
          {order?.companionKitchenRelease?.status === "admitted_unverified" &&
            <p>รายการนี้เข้าครัวในสถานะรอตรวจรับเงินจริงโดยร้านค้า
              และยังไม่อนุญาตเรียกผู้จัดส่งจากการแจ้งเงินเข้าที่ยังไม่ผ่านการยืนยัน</p>}
          <DeliveryPaymentCorrection tenant={tenant} order={order}
            orderId={orderId} onToast={showStorefrontToast}/>
        </section>}
      {mayShowReceipt ? <section className="receipt" id="customerReceipt" ref={receiptRef}>
        <OrderCancellationWatermark order={order} t={t} />
        <div className="receipt-header">
          <h1 id="shopName">{shopName}</h1>
          <div id="shopAddress">{settings.shopAddress || ""}</div>
          <div id="shopPhone">{settings.shopPhone ? t("delivery.success.shop_phone", { phone: settings.shopPhone }) : ""}</div>
          <strong>{t("delivery.success.receipt.evidence")}</strong>
        </div>

        <hr className="receipt-rule" />

        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.order_number")}</span><strong id="receiptNumber">{String(order.id || orderId).slice(0, 12).toUpperCase()}</strong></div>
        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.date")}</span><span id="receiptDate">{formatDeliveryTime(order.createdAt || order.createdAtText)}</span></div>
        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.payment")}</span><strong id="receiptPayment">{paymentText}</strong></div>

        <hr className="receipt-rule" />

        <div><strong>{t("delivery.success.receipt.fields.recipient")}:</strong> <span id="receiptRecipient">{order.recipientName || "-"}</span></div>
        <div><strong>{t("delivery.success.receipt.fields.phone")}:</strong> <span id="receiptPhone">{order.recipientPhone || "-"}</span></div>
        <div><strong>{t("delivery.success.receipt.fields.address")}:</strong> <span id="receiptAddress">{order.deliveryAddress || "-"}</span></div>
        <div><strong>{t("delivery.success.receipt.fields.zone")}:</strong> <span id="receiptDeliveryZone">{deliveryZoneText}</span></div>

        <hr className="receipt-rule" />

        <table className="receipt-items receipt-items-3col">
          <thead>
            <tr>
              <th>{t("delivery.success.receipt.fields.item")}</th>
              <th className="num receipt-unit">{t("delivery.success.receipt.fields.price")}</th>
              <th className="num receipt-line-total">{t("delivery.success.receipt.fields.total")}</th>
            </tr>
          </thead>
          <tbody id="receiptItems">
            {items.map((item, index) => <Fragment key={(item.menuId || item.name || "item") + index}>
              <ReceiptOriginalItemRow item={item} money={money}/>
              <tr>
              <td className="receipt-item-name">
                <div className="receipt-item-line">
                  <span className="receipt-item-text" title={item.name}>{deliveryReceiptItemLabel(item)}</span>
                </div>
                {item.note ? <div className="receipt-item-note">{item.note}</div> : null}
              </td>
              <td className="num receipt-unit">{money(item.price)}</td>
              <td className="num receipt-line-total">{money(Number(item.qty || 0) * Number(item.price || 0))}</td>
              </tr>
            </Fragment>)}
          </tbody>
        </table>

        <hr className="receipt-rule" />

        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.subtotal")}</span><span><span id="receiptSubtotal">{money(subtotal)}</span> {t("delivery.success.receipt.unit_baht")}</span></div>
        <div className="receipt-row"><span>{t("delivery.success.receipt.fields.delivery_fee")}</span><span><span id="receiptDeliveryFee">{money(fee)}</span> {t("delivery.success.receipt.unit_baht")}</span></div>
        <div className="receipt-row delivery-before-discount-total">
          <span>ยอดรวมก่อนส่วนลด</span>
          <span><strong id="receiptBeforeDiscountTotal">{money(deliveryReceiptTotals(order,subtotal).beforeDiscount)}</strong> {t("delivery.success.receipt.unit_baht")}</span>
        </div>
        {Number(order?.deliveryPromotionDiscount || 0)>0 &&
          <div className="receipt-row delivery-promotion-discount-row" id="receiptDeliveryPromotionDiscount">
            <span>ส่วนลดค่าจัดส่งตามยอดอาหาร</span>
            <span>−{money(order.deliveryPromotionDiscount)} {t("delivery.success.receipt.unit_baht")}</span>
          </div>}
        <div className="receipt-row receipt-total">
          <span>{t("delivery.success.receipt.fields.net_total")}</span>
          <span id="receiptTotal"><RevisedOrderNet order={order} current={total}
            money={money} unit={t("delivery.success.receipt.unit_baht")} /></span>
        </div>

        <div id="receiptNoteWrap" hidden={!order.note}>
          <hr className="receipt-rule" />
          <strong>{t("delivery.success.receipt.fields.note")}</strong>
          <div id="receiptNote">{order.note || ""}</div>
        </div>

        <hr className="receipt-rule" />

        <div className="receipt-header">
          <div id="verifyQr" style={{ width: 120, height: 120, margin: "0 auto" }}>
            {verifyQr ? <img src={verifyQr} width="120" height="120" alt={t("delivery.success.receipt.verify_qr.title")} /> : null}
          </div>
          <div>{t("delivery.success.receipt.verify_qr.title")}</div>
          <small>{t("delivery.success.receipt.verify_qr.note")}</small>
        </div>
      </section> : null}
    </main>

    <PublicStorefrontFooter />
  </>;
}
