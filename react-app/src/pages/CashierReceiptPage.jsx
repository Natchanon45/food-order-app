import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { getOperationalOrder, getOperationalStoreSettings } from "@/data/operationalData";
import { normalizeOrderGiftItems } from "@/data/salesReportData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";
import { qrDataUrl } from "@/utils/localQr";

const ALLOWED = new Set(["owner", "admin", "manager", "cashier"]);
const BANGKOK = "Asia/Bangkok";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (Number.isFinite(Number(value?.seconds))) return new Date(Number(value.seconds) * 1000);
  const source = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(source)
    ? `${source.replace(" ", "T")}Z`
    : source;
  const date = value instanceof Date ? value : new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ReceiptItemName({ item, t }) {
  const details = [];
  if (item.note) details.push(item.note);
  if (item.originalQty && (
    Number(item.originalQty) !== Number(item.qty)
    || item.originalName
    || item.replacedFromName
  )) {
    details.push(`${t("cashier_documents.receipt.original_order_label")} ${item.originalName || item.replacedFromName || item.name} x ${item.originalQty}`);
  }
  const name = `${item.name || "-"}${item?.isGift === true ? ` ${t("cashier_documents.receipt.gift_suffix")}` : ""}`;
  return (
    <>
      <div className="receipt-item-line">
        <span className="receipt-item-text" title={name}>{name}</span>
        <span className="receipt-item-qty">x {item.qty}</span>
      </div>
      {details.map((text, index) => <div className="receipt-item-note" key={`${text}-${index}`}>{text}</div>)}
    </>
  );
}

export function CashierReceiptPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const stylesReady = useParityPage({
    title: t("cashier_documents.receipt.meta_title"),
    bodyClass: "order-delivery-workspace od-receipt-page",
    styles: ["app.css", "receipt-layout.css", "order-delivery-workspace-theme.css"],
    attributes: { "data-roles": "owner,admin,manager,cashier" },
  });

  const params = useMemo(() => new URLSearchParams(location.search), []);
  const ids = useMemo(() => {
    const combined = String(params.get("orders") || "").split(",").map(value => value.trim()).filter(Boolean);
    if (combined.length) return combined;
    const single = String(params.get("order") || "").trim();
    return single ? [single] : [];
  }, [params]);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [paperSize, setPaperSizeState] = useState(() => {
    try { return localStorage.getItem("receipt_paper_size") || "80"; } catch { return "80"; }
  });
  const printedRef = useRef(false);
  const allowed = ALLOWED.has(profile?.role);

  useEffect(() => {
    if (!tenant?.id || !allowed) return undefined;
    let alive = true;
    setError("");
    Promise.all([
      Promise.all(ids.map(id => getOperationalOrder(tenant.id, id))),
      getOperationalStoreSettings(tenant.id),
    ])
      .then(([loadedOrders, settings]) => {
        if (!alive) return;
        setSnapshot({ orders: loadedOrders.filter(Boolean), settings });
      })
      .catch(err => {
        console.error("CASHIER_RECEIPT_LOAD_FAILED", err);
        if (alive) setError(t("cashier_documents.receipt.load_failed"));
      });
    return () => { alive = false; };
  }, [tenant?.id, allowed, ids, t]);

  const orders = useMemo(() => {
    if (!snapshot || !ids.length) return [];
    const byId = new Map((snapshot.orders || []).map(order => [String(order.id), order]));
    return ids.map(id => byId.get(String(id))).filter(Boolean)
      .sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0));
  }, [snapshot, ids]);

  const combined = ids.length > 1;
  const first = orders[0] || null;
  const total = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const displayDate = value => {
    const date = toDate(value);
    if (!date) return "-";
    return (formatDate(date, {
      calendar: "gregory",
      timeZone: BANGKOK,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }) || "-").replace(",", "");
  };

  const setPaperSize = value => {
    setPaperSizeState(value);
    try { localStorage.setItem("receipt_paper_size", value); } catch {}
  };

  const receiptClass = `receipt${paperSize === "58" ? " size-58" : paperSize === "a4" ? " size-a4" : ""}`;
  const settings = snapshot?.settings || {};
  const isDelivery = !combined && first?.orderType === "delivery";
  const isTakeaway = !combined && first?.orderType === "takeaway";
  const isWalkIn = !combined && first?.orderType === "walkin";

  const paymentText = order => {
    if (order?.paymentStatus === "paid") {
      if (order.orderType === "walkin" && order.paymentMethod === "cash") {
        return `${t("cashier_documents.receipt.paid")} • ${t("quick_order.payment.cash")}`;
      }
      if (order.orderType === "walkin" && order.paymentMethod === "promptpay") {
        return `${t("cashier_documents.receipt.paid")} • ${t("quick_order.payment.promptpay")}`;
      }
      return t("cashier_documents.receipt.paid");
    }
    if (order?.paymentMethod === "cod") return t("cashier.payment.cod");
    return t("cashier_documents.receipt.unpaid");
  };

  const typeValue = (() => {
    if (!first) return "-";
    if (combined) return first.tableCode || "-";
    if (isDelivery) return t("cashier_documents.receipt.type_delivery");
    if (isTakeaway) return `${t("cashier_documents.receipt.type_takeaway")} ${first.queueNo || ""}`.trim();
    if (isWalkIn) {
      const walkInType = first.serviceType === "dine_in"
        ? t("quick_order.receipt.dine_in")
        : t("quick_order.receipt.takeaway");
      const locationText = first.serviceType === "dine_in"
        ? (first.tableCode
          ? t("quick_order.cashier.table", { table: first.tableCode })
          : t("quick_order.receipt.table_unassigned"))
        : (first.queueNo || "");
      return `${walkInType} ${locationText ? `• ${locationText}` : ""}`.trim();
    }
    return first.tableCode || "-";
  })();

  const receiptNumber = first
    ? (combined
      ? `TABLE-${first.tableCode || "-"}-${String(first.tableToken || first.id).slice(0, 8)}`.toUpperCase()
      : String(first.id || ids[0] || "").slice(0, 12).toUpperCase())
    : "-";
  const notes = combined ? orders.map(order => order.note).filter(Boolean) : (first?.note ? [first.note] : []);
  const verifyParams = new URLSearchParams();
  if (combined) verifyParams.set("orders", ids.join(","));
  else if (ids[0]) verifyParams.set("order", ids[0]);
  if (tenant?.slug) verifyParams.set("tenant", tenant.slug);
  const verifyUrl = `${location.origin}/verify/?${verifyParams.toString()}`;
  const verifyQr = first ? qrDataUrl(verifyUrl, { size: 180, margin: 4 }) : "";

  useEffect(() => {
    if (printedRef.current || params.get("autoprint") !== "1" || !first || error) return;
    printedRef.current = true;
    let cancelled = false;
    (async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      const image = document.querySelector("#verifyQr");
      if (image && !image.complete) {
        await Promise.race([
          new Promise(resolve => image.addEventListener("load", resolve, { once: true })),
          new Promise(resolve => image.addEventListener("error", resolve, { once: true })),
          new Promise(resolve => setTimeout(resolve, 1500)),
        ]);
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!cancelled) window.print();
    })();
    return () => { cancelled = true; };
  }, [first, error, params]);

  // A Quick Order receipt is printed in a script-opened tab. Close that tab
  // once the print dialog is dismissed instead of leaving an orphaned receipt.
  // If the browser blocks closing (same-tab fallback), return to Quick Order.
  useEffect(() => {
    if (params.get("closeafterprint") !== "quick-order") return undefined;
    const onAfterPrint = () => {
      window.setTimeout(() => {
        window.close();
        if (!window.closed) location.replace("/cashier/quick-order");
      }, 250);
    };
    window.addEventListener("afterprint", onAfterPrint, { once: true });
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [params]);

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (allowed && !snapshot && !error)) {
    return <PageReadyOverlay context={t("cashier_documents.receipt.header_title")} title={t("cashier.loading.title")} message={t("cashier.loading.preparing")} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fcashier%2Freceipt" replace />;
  if (!allowed) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  const missingMessage = !ids.length
    ? t("cashier_documents.receipt.missing_order")
    : (!first && !error ? t("cashier_documents.receipt.order_not_found") : error);

  const cashReceived = Number(first?.cashReceived);
  const changeAmount = Number(first?.changeAmount);
  const showCash = isWalkIn && first?.paymentMethod === "cash" && Number.isFinite(cashReceived) && Number.isFinite(changeAmount);

  return (
    <>
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div className="brand"><span className="brand-mark">PG</span>{t("cashier_documents.receipt.header_title")}</div>
          <Link className="btn btn-sm" to={params.get("closeafterprint") === "quick-order" ? "/cashier/quick-order" : "/cashier"}><i className="bi bi-arrow-left app-icon" aria-hidden="true"></i><span>{params.get("closeafterprint") === "quick-order" ? t("quick_order.meta.title") : t("cashier_documents.receipt.back")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <div id="demoBanner"></div>
      <main className="receipt-page">
        <div className="receipt-toolbar no-print">
          <label htmlFor="paperSize">{t("cashier_documents.receipt.paper_size")}</label>
          <select className="input" id="paperSize" style={{ width: "auto", minWidth: 130 }} value={paperSize} onChange={event => setPaperSize(event.target.value)}>
            <option value="80">{t("cashier_documents.receipt.paper_80")}</option>
            <option value="58">{t("cashier_documents.receipt.paper_58")}</option>
            <option value="a4">A4</option>
          </select>
          <button className="btn btn-primary" id="printButton" type="button" onClick={() => window.print()}><i className="bi bi-check-lg app-icon" aria-hidden="true"></i><span>{t("cashier_documents.receipt.print")}</span></button>
        </div>

        <section className={receiptClass} id="receipt">
          {missingMessage ? <div className="empty">{missingMessage}</div> : first ? (
            <>
              <div className="receipt-header">
                <h1 id="shopName">{settings.shopName || settings.storeName || tenant.name || "PENGUIN"}</h1>
                <div id="shopAddress">{settings.shopAddress || settings.address || ""}</div>
                <div id="shopPhone">{settings.shopPhone ? t("cashier_documents.receipt.shop_phone", { phone: settings.shopPhone }) : ""}</div>
                <strong id="receiptTitle">{t(combined ? "cashier_documents.receipt.combined_title" : "cashier_documents.receipt.title")}</strong>
              </div>
              <hr className="receipt-rule" />
              <div className="receipt-row">
                <span id="receiptTypeLabel">{combined ? t("cashier_documents.receipt.table") : (isDelivery || isTakeaway || isWalkIn ? t("cashier_documents.receipt.type") : t("cashier_documents.receipt.table"))}</span>
                <strong id="receiptTable">{typeValue}</strong>
              </div>
              <div className="receipt-row"><span>{t("cashier_documents.receipt.bill_number")}</span><span id="receiptNumber">{receiptNumber}</span></div>
              <div className="receipt-row"><span>{t("cashier_documents.receipt.date")}</span><span id="receiptDate">{displayDate(first.createdAt)}</span></div>
              <div className="receipt-row">
                <span>{t("cashier_documents.receipt.payment")}</span>
                <strong id="receiptPayment">{combined
                  ? t(orders.every(order => order.status === "paid" || order.paymentStatus === "paid") ? "cashier_documents.receipt.paid" : "cashier_documents.receipt.unpaid")
                  : paymentText(first)}</strong>
              </div>

              {isDelivery ? (
                <div id="deliveryInfo">
                  <hr className="receipt-rule" />
                  <div><strong>{t("cashier_documents.receipt.recipient")}:</strong> <span id="receiptRecipient">{first.recipientName || "-"}</span></div>
                  <div><strong>{t("cashier_documents.receipt.phone")}:</strong> <span id="receiptPhone">{first.recipientPhone || "-"}</span></div>
                  <div><strong>{t("cashier_documents.receipt.address")}:</strong> <span id="receiptAddress">{first.deliveryAddress || "-"}</span></div>
                  <div><strong>{t("cashier_documents.receipt.zone")}:</strong> <span id="receiptDeliveryZone">{first.deliveryZoneLabel || "-"}</span></div>
                </div>
              ) : null}

              <hr className="receipt-rule" />
              <table className="receipt-items receipt-items-3col">
                <thead><tr>
                  <th>{t("cashier_documents.receipt.item")}</th>
                  <th className="num receipt-unit">{t("cashier_documents.receipt.price")}</th>
                  <th className="num receipt-line-total">{t("cashier_documents.receipt.total")}</th>
                </tr></thead>
                <tbody id="receiptItems">
                  {combined ? orders.flatMap(order => [
                    <tr key={`round-${order.id}`}><td colSpan="3"><strong>{t("cashier_documents.receipt.round", { round: order.roundNumber || 1 })}</strong></td></tr>,
                    ...normalizeOrderGiftItems(order).filter(item => !item.cancelled).map((item, index) => (
                      <tr key={`${order.id}-${index}`}>
                        <td className="receipt-item-name"><ReceiptItemName item={item} t={t} /></td>
                        <td className="num receipt-unit">{money(Number(item.price))}</td>
                        <td className="num receipt-line-total">{money(Number(item.qty) * Number(item.price))}</td>
                      </tr>
                    )),
                  ]) : normalizeOrderGiftItems(first).map((item, index) => (
                    <tr key={`${first.id}-${index}`}>
                      <td className="receipt-item-name"><ReceiptItemName item={item} t={t} /></td>
                      <td className="num receipt-unit">{money(Number(item.price))}</td>
                      <td className="num receipt-line-total">{money(Number(item.qty) * Number(item.price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr className="receipt-rule" />

              {isDelivery ? (
                <div id="receiptDeliverySummary">
                  <div className="receipt-row"><span>{t("cashier_documents.receipt.food_subtotal")}</span><span><span id="receiptSubtotal">{money(first.subtotalAmount ?? Number(first.totalAmount || 0) - Number(first.deliveryFee || 0))}</span> {t("cashier.common.baht")}</span></div>
                  <div className="receipt-row"><span>{t("cashier_documents.receipt.delivery_fee")}</span><span><span id="receiptDeliveryFee">{money(first.deliveryFee || 0)}</span> {t("cashier.common.baht")}</span></div>
                </div>
              ) : null}
              <div className="receipt-row receipt-total"><span>{t("cashier_documents.receipt.net_total")}</span><span><span id="receiptTotal">{money(combined ? total : first.totalAmount)}</span> {t("cashier.common.baht")}</span></div>

              {showCash ? (
                <div id="receiptCashSummary">
                  <div className="receipt-row"><span>{t("quick_order.payment.cash_received")}</span><span><span id="receiptCashReceived">{money(cashReceived)}</span> {t("cashier.common.baht")}</span></div>
                  <div className="receipt-row"><span>{t("quick_order.payment.change")}</span><strong><span id="receiptChangeAmount">{money(changeAmount)}</span> {t("cashier.common.baht")}</strong></div>
                </div>
              ) : null}

              {notes.length ? (
                <div id="receiptNoteWrap" className="receipt-note">
                  <hr className="receipt-rule" />
                  <strong>{t("cashier_documents.receipt.note")}</strong>
                  <div id="receiptNote">{notes.join(" / ")}</div>
                </div>
              ) : null}

              <hr className="receipt-rule" />
              <div className="receipt-header">
                <img id="verifyQr" src={verifyQr} width="112" height="112" alt={t("cashier_documents.receipt.verify_qr_alt")} />
                <div>{t("cashier_documents.receipt.verify_instruction")}</div>
                <small id="verifyCode">{combined
                  ? t("cashier_documents.receipt.verify_combined", { rounds: orders.length, table: first.tableCode || "-" })
                  : t("cashier_documents.receipt.verify_single", { code: String(first.id || ids[0]).slice(0, 12).toUpperCase() })}</small>
              </div>
            </>
          ) : null}
        </section>
      </main>
      <ParityFooter />
    </>
  );
}
