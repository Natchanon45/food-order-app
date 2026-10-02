import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { useAuth } from "@/auth/AuthProvider";
import { CashierOrderNotifier } from "@/components/CashierOrderNotifier";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { sweetConfirm, sweetPrompt } from "@/components/sweetDialog";
import { storage } from "@/firebase/client";
import {
  assignWalkInTable,
  cancelLalamoveDispatch,
  cancelOperationalOrder,
  moveTableSession,
  placeLalamoveDispatch,
  quoteLalamoveDispatch,
  refreshLalamoveDispatch,
  updateOperationalOrder,
  updateOperationalTable,
  watchOperationalOrders,
  watchOperationalTables,
} from "@/data/operationalData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";
import { qrDataUrl } from "@/utils/localQr";

const LALAMOVE_STATUS_COOLDOWN_MS = 10000;
const FINISHED_LALAMOVE = new Set(["COMPLETED", "CANCELED", "CANCELLED", "REJECTED", "EXPIRED"]);

function cashierRoute(path = "") {
  return `/cashier${path}`;
}

function translated(t, key, fallback) {
  const value = t(key);
  return value === key ? fallback : value;
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

function valueToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(Number(value.seconds) * 1000);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function displayTime(order) { return order.createdAt || order.createdAtText || order.updatedAt; }
function isLalamoveDelivery(order) {
  return order?.orderType === "delivery" && String(order?.deliveryProvider || "").toLowerCase() === "lalamove";
}
function lalamoveStatus(order) { return String(order?.lalamoveOrderStatus || "").toUpperCase(); }
function lalamoveDispatchFinished(order) { return FINISHED_LALAMOVE.has(lalamoveStatus(order)); }
function lalamoveCanCancel(order) {
  return Boolean(order?.lalamoveOrderId)
    && !["PICKED_UP", "COMPLETED", "CANCELED", "CANCELLED", "REJECTED", "EXPIRED"].includes(lalamoveStatus(order));
}
function lalamoveCanRetry(order) {
  return Boolean(order?.lalamoveOrderId) && ["CANCELED", "CANCELLED", "REJECTED", "EXPIRED"].includes(lalamoveStatus(order));
}
function isLalamoveCod(order) {
  return isLalamoveDelivery(order)
    && String(order?.paymentMethod || "").toLowerCase() === "cod"
    && order?.lalamoveCodEnabled === true;
}
function lalamoveDispatchReady(order) {
  const paymentReady = order?.paymentStatus === "paid"
    || (isLalamoveCod(order) && order?.paymentStatus === "unpaid");
  return isLalamoveDelivery(order)
    && paymentReady
    && ["ready", "served", "paid"].includes(String(order?.status || "").toLowerCase());
}
function isWaitingQueuePlaceholder(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return Boolean(order?.waitingQueueId)
    && Number(order?.roundNumber || 0) === 0
    && items.length === 0
    && Number(order?.totalAmount ?? order?.total ?? 0) === 0;
}
function activeOrders(orders) {
  return orders.filter(order => {
    if (isWaitingQueuePlaceholder(order) || order.status === "cancelled") return false;
    if (order.status !== "paid") return true;
    return isLalamoveDelivery(order) && !lalamoveDispatchFinished(order);
  });
}
function isWalkIn(order) { return order?.orderType === "walkin"; }
function isTableOrder(order) {
  const type = String(order?.orderType || "").toLowerCase();
  if (type === "table") return true;
  if (["delivery", "takeaway", "walkin"].includes(type)) return false;
  return Boolean(order?.tableCode && order?.tableToken);
}
function isServed(order) { return order?.status === "served"; }
function tableGroupKey(order) { return order.tableToken || `table:${order.tableCode}`; }
function queueSequence(order) {
  const explicit = Number(order?.queueSequence);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const parsed = Number(String(order?.queueNo || "").replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function normalizeCashierOrders(orders = []) {
  return orders.map(order => order.orderType === "takeaway"
    && order.status === "served"
    && order.pickupStatus !== "picked_up"
    ? { ...order, status: "ready", pickupStatus: order.pickupStatus === "served" ? "ready" : order.pickupStatus }
    : order);
}

function QueueHeading({ order, title, t, formatTime }) {
  return <div className="order-heading-with-queue">
    <span className="order-queue-badge"><small>{t("cashier.queue.number")}</small><strong>{order.queueNo || "-"}</strong></span>
    <div><h2 style={{ margin: 0 }}>{title}</h2><small>{formatTime(displayTime(order))}</small></div>
  </div>;
}
function ItemRows({ order, t, money }) {
  return <ul className="order-items">{(order.items || []).map((item, index) => (
    <li key={`${order.id}-${index}`} style={item.cancelled ? { opacity: .5, textDecoration: "line-through" } : undefined}>
      <div>{Number(item.qty || 0)} × {String(item.name || "")}{item.isGift === true ? ` ${t("cashier.items.gift_suffix")}` : ""}
        <strong style={{ float: "right" }}>{item.cancelled ? t("cashier.items.cancelled") : money(Number(item.qty || 0) * Number(item.price || 0))}</strong>
      </div>
      {item.note || item.replacedFromName || (item.originalQty && Number(item.originalQty) !== Number(item.qty)) ? (
        <div className="menu-category" style={{ marginTop: 3, lineHeight: 1.35 }}>
          {item.note ? <small><strong>{t("cashier.items.note_label")}</strong> {item.note}</small> : null}
          {item.note && (item.replacedFromName || (item.originalQty && Number(item.originalQty) !== Number(item.qty))) ? <br /> : null}
          {item.replacedFromName ? <small><strong>{t("cashier.items.changed_from_label")}</strong> {item.replacedFromName}</small> : null}
          {item.replacedFromName && item.originalQty && Number(item.originalQty) !== Number(item.qty) ? <br /> : null}
          {item.originalQty && Number(item.originalQty) !== Number(item.qty) ? <small><strong>{t("cashier.items.original_qty_label")}</strong> {item.originalQty}</small> : null}
        </div>
      ) : null}
    </li>
  ))}</ul>;
}
function OrderNote({ order, t }) {
  return order.note ? <div className="card" style={{ marginTop: 10, padding: "10px 12px", boxShadow: "none", background: "#fff8e8" }}>
    <strong>{t("cashier.items.order_note_title")}</strong><div style={{ marginTop: 4 }}>{order.note}</div>
  </div> : null;
}
function paymentLabel(order, t) {
  if (order.paymentStatus === "paid" && order.status === "served") return t("cashier.payment.paid_waiting_close");
  if (order.paymentStatus === "paid") return t("cashier.payment.confirmed");
  if (order.paymentStatus === "pending_verification") return t("cashier.payment.slip_pending");
  if (order.paymentMethod === "cod") return t("cashier.payment.cod");
  return t("cashier.payment.waiting");
}
function statusLabel(order, t) {
  const key = `shared.status.${order?.status || "pending"}`;
  return t(key);
}
function LalamoveDispatch({ order, t, money, busy, onQuote, onPlace, onRefresh, onCancel }) {
  if (!isLalamoveDelivery(order)) return null;
  const id = String(order.lalamoveOrderId || "");
  const status = lalamoveStatus(order);
  const codLine = isLalamoveCod(order)
    ? <div className="menu-category" style={{ marginTop: 4, fontWeight: 700, color: "#7c5a00" }}>{t("cashier.lalamove.cod_collect", { amount: money(Number(order.lalamoveCodAmount || order.totalAmount || 0)) })}</div>
    : null;

  if (id) {
    const shareLink = String(order.lalamoveShareLink || "");
    const canTrack = shareLink && !["CANCELED", "CANCELLED", "REJECTED", "EXPIRED"].includes(status);
    const statusKey = status ? `cashier.lalamove.statuses.${status.toLowerCase()}` : "cashier.lalamove.status_waiting";
    return <div className="card" style={{ marginTop: 10, padding: "10px 12px", boxShadow: "none", background: "#f1fbf5" }}>
      <div className="order-head"><strong>{t("cashier.lalamove.title")}</strong><span className="badge">{t(statusKey)}</span></div>
      <div className="menu-category" style={{ marginTop: 4 }}>{t("cashier.lalamove.order_id")}: {id}</div>
      {codLine}
      <div className="order-actions" style={{ marginTop: 8 }}>
        {canTrack ? <a className={status === "COMPLETED" ? "btn btn-sm" : "btn btn-warning btn-sm"} href={shareLink} target="_blank" rel="noopener noreferrer"><i className={status === "COMPLETED" ? "bi bi-receipt" : "bi bi-geo-alt"}></i><span>{t(status === "COMPLETED" ? "cashier.lalamove.delivery_details" : "cashier.lalamove.tracking")}</span></a> : null}
        {!lalamoveCanRetry(order) && !lalamoveDispatchFinished(order) ? <button className="btn btn-sm" type="button" disabled={busy} onClick={() => onRefresh(order)}><i className="bi bi-arrow-clockwise app-icon"></i><span>{t("cashier.lalamove.refresh")}</span></button> : null}
        {lalamoveCanRetry(order) ? <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => onQuote(order)}><i className="bi bi-arrow-clockwise app-icon"></i><span>{t("cashier.lalamove.retry")}</span></button> : null}
        {lalamoveCanCancel(order) ? <button className="btn btn-danger btn-sm" type="button" disabled={busy} onClick={() => onCancel(order)}><i className="bi bi-x-circle app-icon"></i><span>{t("cashier.lalamove.cancel")}</span></button> : null}
      </div>
    </div>;
  }

  if (!lalamoveDispatchReady(order)) {
    return <div className="card" style={{ marginTop: 10, padding: "10px 12px", boxShadow: "none", background: "#f8fbf9" }}>
      <strong>{t("cashier.lalamove.title")}</strong>
      <div className="menu-category" style={{ marginTop: 4 }}>{t(isLalamoveCod(order) ? "cashier.lalamove.waiting_ready_cod" : "cashier.lalamove.waiting_ready")}</div>
    </div>;
  }

  const quote = order.lalamoveDispatchQuote || {};
  const quoteFee = Number(quote.fee ?? order.lalamoveDispatchFee);
  const difference = Math.max(0, Number(order.lalamoveDispatchPriceDifference || 0));
  const hasQuote = Boolean(String(quote.quotationId || "")) && Number.isFinite(quoteFee);
  if (!hasQuote) return <div className="card" style={{ marginTop: 10, padding: "10px 12px", boxShadow: "none", background: "#f8fbf9" }}>
    <strong>{t("cashier.lalamove.title")}</strong>{codLine}
    <div className="order-actions" style={{ marginTop: 8 }}><button className="btn btn-warning" type="button" disabled={busy} onClick={() => onQuote(order)}><i className="bi bi-search app-icon"></i><span>{t("cashier.lalamove.quote_latest")}</span></button></div>
  </div>;

  const checkoutFee = Number(order.deliveryBaseFee || 0);
  return <div className="card" style={{ marginTop: 10, padding: "10px 12px", boxShadow: "none", background: "#f1fbf5" }}>
    <strong>{t("cashier.lalamove.title")}</strong>{codLine}
    <div style={{ marginTop: 5 }}>{t("cashier.lalamove.quote_summary", { checkout: money(checkoutFee), current: money(quoteFee) })}</div>
    <div className="menu-category" style={{ marginTop: 5, ...(difference > .009 ? { color: "#9a3412" } : {}) }}>
      {difference > .009 ? t("cashier.lalamove.difference_warning", { amount: money(difference) }) : t("cashier.lalamove.no_difference")}
    </div>
    <div className="order-actions" style={{ marginTop: 8 }}>
      <button className="btn btn-warning" type="button" disabled={busy} onClick={() => onQuote(order)}><i className="bi bi-search app-icon"></i><span>{t("cashier.lalamove.requote")}</span></button>
      <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onPlace(order, quoteFee)}><i className="bi bi-check-circle app-icon"></i><span>{t(difference > .009 ? "cashier.lalamove.approve_and_call" : "cashier.lalamove.call")}</span></button>
    </div>
  </div>;
}

function DeliveryCard({ order, t, money, formatTime, slipUrl, busy, actions }) {
  const dispatchedLocked = order.lalamoveOrderId && !lalamoveDispatchFinished(order);
  return <article className="card order-card">
    <div className="order-head"><QueueHeading order={order} title={`Delivery: ${order.recipientName || t("cashier.delivery.recipient_fallback")}`} t={t} formatTime={formatTime} /><span className="badge">{statusLabel(order, t)}</span></div>
    <p><span className={"badge" + (order.paymentStatus === "paid" ? "" : " warning")}>{paymentLabel(order, t)}</span><br /><strong>{t("cashier.delivery.phone")}</strong> {order.recipientPhone || "-"}<br /><strong>{t("cashier.delivery.address")}</strong> {order.deliveryAddress || "-"}</p>
    <ItemRows order={order} t={t} money={money} />
    <OrderNote order={order} t={t} />
    <div className="order-head" style={{ marginTop: 10 }}><strong>{t("cashier.delivery.net_total")}</strong><strong className="price">{money(order.totalAmount)} {t("cashier.common.baht")}</strong></div>
    <LalamoveDispatch order={order} t={t} money={money} busy={busy} onQuote={actions.quote} onPlace={actions.place} onRefresh={actions.refresh} onCancel={actions.cancelLalamove} />
    <div className="order-actions" style={{ marginTop: 12 }}>
      <a className="btn btn-dark" href={cashierRoute(`/receipt/?order=${encodeURIComponent(order.id)}`)} target="_blank" rel="noopener noreferrer"><i className="bi bi-printer app-icon"></i><span>{t("cashier.common.print")}</span></a>
      {slipUrl ? <a className="btn btn-warning" href={slipUrl} target="_blank" rel="noopener noreferrer"><i className="bi bi-eye app-icon"></i><span>{t("cashier.payment.view_slip")}</span></a>
        : order.paymentSlipPath ? <button className="btn btn-warning" type="button" disabled><i className="bi bi-eye app-icon"></i><span>{t("cashier.payment.loading_slip")}</span></button> : null}
      {order.paymentStatus !== "paid" && !isLalamoveCod(order) ? <button className="btn btn-primary cashier-payment-action" type="button" disabled={busy} onClick={() => actions.pay(order)}><i className="bi bi-cash-coin app-icon" aria-hidden="true"></i><span>{t("cashier.payment.receive")}</span></button> : null}
      {dispatchedLocked
        ? <button className="btn btn-primary" type="button" disabled title={t("cashier.lalamove.local_cancel_locked")}><i className="bi bi-truck app-icon"></i><span>{t("cashier.lalamove.dispatched")}</span></button>
        : <button className="btn btn-danger" type="button" disabled={busy} onClick={() => actions.cancelOrder(order)}><i className="bi bi-x-circle app-icon"></i><span>{t("cashier.actions.cancel_all")}</span></button>}
    </div>
  </article>;
}

function TakeawayCard({ order, t, money, formatTime, busy, actions }) {
  const paid = order.paymentStatus === "paid";
  const ready = order.status === "ready" || order.pickupStatus === "called";
  return <article className="card order-card">
    <div className="order-head"><QueueHeading order={order} title="Take Away" t={t} formatTime={formatTime} /><span className={"badge" + (order.pickupStatus === "called" ? " warning" : "")}>{order.pickupStatus === "called" ? t("cashier.takeaway.queue_called") : statusLabel(order, t)}</span></div>
    <p><strong>{t("cashier.takeaway.customer")}</strong> {order.customerName || "-"}<br /><strong>{t("cashier.takeaway.phone")}</strong> {order.customerPhone || "-"}<br /><span className={"badge" + (paid ? "" : " warning")}>{paid ? t("cashier.payment.paid") : t("cashier.payment.waiting")}</span></p>
    <ItemRows order={order} t={t} money={money} /><OrderNote order={order} t={t} />
    <div className="order-head" style={{ marginTop: 10 }}><strong>{t("cashier.takeaway.net_total")}</strong><strong className="price">{money(order.totalAmount)} {t("cashier.common.baht")}</strong></div>
    <div className="order-actions" style={{ marginTop: 12 }}>
      <a className="btn btn-dark" href={cashierRoute(`/receipt/?order=${encodeURIComponent(order.id)}`)} target="_blank" rel="noopener noreferrer"><i className="bi bi-printer app-icon"></i><span>{t("cashier.common.print")}</span></a>
      {!paid ? <button className="btn btn-primary cashier-payment-action" type="button" disabled={busy} onClick={() => actions.pay(order)}><i className="bi bi-cash-coin app-icon" aria-hidden="true"></i><span>{t("cashier.payment.receive")}</span></button> : null}
      {ready && order.pickupStatus !== "called" ? <button className="btn btn-warning" type="button" disabled={busy} onClick={() => actions.callPickup(order)}><i className="bi bi-receipt app-icon"></i><span>{t("cashier.actions.call_pickup")}</span></button> : null}
      {ready || order.pickupStatus === "called" ? <button className="btn cashier-pickup-done-action" type="button" disabled={busy} onClick={() => actions.pickupDone(order)}><i className="bi bi-check-circle app-icon"></i><span>{t("cashier.actions.handed_over")}</span></button> : null}
      <button className="btn btn-danger" type="button" disabled={busy} onClick={() => actions.cancelOrder(order)}><i className="bi bi-x-circle app-icon"></i><span>{t("cashier.actions.cancel_all")}</span></button>
    </div>
  </article>;
}

function walkInTableUnavailable(table, order, active) {
  const code = String(table?.code || table?.id || "").trim().toUpperCase();
  if (!code || table?.active === false) return true;
  const ownerId = String(table?.walkInOrderId || "");
  const ownedByCurrent = ownerId && ownerId === String(order?.id || "");
  if (String(table?.orderToken || "").trim()) return true;
  if (String(table?.status || "").toLowerCase() === "occupied" && !ownedByCurrent) return true;
  return active.some(row => isWalkIn(row)
    && row?.serviceType === "dine_in"
    && String(row?.id || "") !== String(order?.id || "")
    && String(row?.tableCode || "").trim().toUpperCase() === code);
}

function WalkInCard({ order, tables, active, t, money, formatTime, busy, actions }) {
  const dineIn = order.serviceType === "dine_in";
  const [tableCode, setTableCode] = useState(String(order.tableCode || ""));
  useEffect(() => setTableCode(String(order.tableCode || "")), [order.id, order.tableCode]);
  const title = t(dineIn ? "quick_order.cashier.dine_in_title" : "quick_order.cashier.takeaway_title");
  const tableText = order.tableCode ? t("quick_order.cashier.table", { table: order.tableCode }) : t("quick_order.cashier.table_unassigned");
  return <article className="card order-card walkin-order-card">
    <div className="order-head"><QueueHeading order={order} title={title} t={t} formatTime={formatTime} /><span className="badge">{t("quick_order.cashier.paid")}</span></div>
    <p><strong>{dineIn ? tableText : t("quick_order.service.takeaway")}</strong>{order.customerName ? <><br />{order.customerName}</> : null}</p>
    <ItemRows order={order} t={t} money={money} /><OrderNote order={order} t={t} />
    {dineIn ? <div className="field" style={{ marginTop: 10 }}>
      <label>{t("quick_order.table.label")}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select className="input" data-walkin-table-select={order.id} style={{ minWidth: 180, flex: 1 }} value={tableCode} disabled={busy} onChange={e => setTableCode(e.target.value)}>
          <option value="">{t("quick_order.table.select_placeholder")}</option>
          {[...tables].filter(table => table.active !== false).sort((a,b) => String(a.code || "").localeCompare(String(b.code || ""), undefined, { numeric: true })).map(table => {
            const value = String(table.code || table.id || "");
            const unavailable = walkInTableUnavailable(table, order, active);
            return <option value={value} disabled={unavailable} key={table.id}>{String(table.name || table.code || table.id || "")}{unavailable ? ` — ${t("quick_order.table.unavailable")}` : ""}</option>;
          })}
        </select>
        <button className="btn btn-sm" type="button" disabled={busy} onClick={() => actions.assignWalkIn(order, tableCode)}><i className="bi bi-check-circle app-icon"></i><span>{t("quick_order.cashier.assign_table")}</span></button>
      </div>
    </div> : null}
    <div className="order-head" style={{ marginTop: 12 }}><strong>{t("cashier.table.total")}</strong><strong className="price">{money(order.totalAmount)} {t("cashier.common.baht")}</strong></div>
    <div className="order-actions" style={{ marginTop: 12 }}>
      <a className="btn btn-dark" href={cashierRoute(`/receipt/?order=${encodeURIComponent(order.id)}`)} target="_blank" rel="noopener noreferrer"><i className="bi bi-printer app-icon"></i><span>{t("cashier.common.print")}</span></a>
      <button className="btn btn-danger" type="button" disabled={busy} onClick={() => actions.cancelOrder(order)}><i className="bi bi-x-circle app-icon"></i><span>{t("cashier.actions.cancel_all")}</span></button>
    </div>
  </article>;
}

function TableBillCard({ group, t, money, formatTime, busy, actions }) {
  const sorted = [...group].sort((a,b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0));
  const first = sorted[0];
  const total = sorted.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const unpaid = sorted.filter(order => order.paymentStatus !== "paid");
  const servedCount = sorted.filter(isServed).length;
  const ids = sorted.map(order => order.id).join(",");
  return <article className="card order-card">
    <div className="order-head">
      <QueueHeading order={first} title={t("cashier.table.title", { table: first.tableCode })} t={t} formatTime={() => t("cashier.table.open_rounds_summary", { rounds: sorted.length, served: servedCount })} />
      <span className={"badge" + (unpaid.length ? " warning" : "")}>{t(unpaid.length ? "cashier.table.waiting_payment" : "cashier.table.paid_waiting_served")}</span>
    </div>
    {sorted.map(order => <section className="card" style={{ padding: 12, marginTop: 10, boxShadow: "none", background: "#f8fbf9" }} key={order.id}>
      <div className="order-head"><strong>{t("cashier.table.round", { round: order.roundNumber || 1 })}</strong><small>{formatTime(displayTime(order))}</small></div>
      <div className="menu-category">{t("cashier.table.kitchen_status")} {statusLabel(order, t)} • {t(order.paymentStatus === "paid" ? "cashier.payment.paid_short" : "cashier.payment.unpaid")}</div>
      <ItemRows order={order} t={t} money={money} /><OrderNote order={order} t={t} />
      <div className="order-head" style={{ marginTop: 8 }}><span>{t("cashier.table.round_total")}</span><strong>{money(order.totalAmount)} {t("cashier.common.baht")}</strong></div>
      <div className="order-actions" style={{ marginTop: 8 }}><button className="btn btn-danger btn-sm" type="button" disabled={busy} onClick={() => actions.cancelOrder(order)}><i className="bi bi-x-circle app-icon"></i><span>{t("cashier.actions.cancel_all")}</span></button></div>
    </section>)}
    <div className="order-head" style={{ marginTop: 14, paddingTop: 12, borderTop: "2px solid #dfe8e2" }}><strong>{t("cashier.table.total")}</strong><strong className="price">{money(total)} {t("cashier.common.baht")}</strong></div>
    <div className="order-actions" style={{ marginTop: 12 }}>
      <a className="btn btn-dark" href={cashierRoute(`/receipt/?orders=${encodeURIComponent(ids)}`)} target="_blank" rel="noopener noreferrer"><i className="bi bi-printer app-icon"></i><span>{t("cashier.common.print")}</span></a>
      {unpaid.length ? <>
        <button className="btn btn-warning" type="button" disabled={busy} onClick={() => actions.moveTable(sorted)}><i className="bi bi-arrow-left-right app-icon"></i><span>{t("cashier.table_move.button")}</span></button>
        <button className="btn btn-primary cashier-payment-action" type="button" disabled={busy} onClick={() => actions.payTable(sorted)}><i className="bi bi-cash-coin app-icon" aria-hidden="true"></i><span>{t("cashier.payment.receive")}</span></button>
      </> : <button className="btn btn-primary" type="button" disabled><i className="bi bi-check-circle app-icon"></i><span>{t("cashier.payment.paid_short")}</span></button>}
    </div>
  </article>;
}

function TableMoveDialog({ value, tables, fromCode, busy, t, onClose, onConfirm }) {
  if (!value) return null;
  return <div className="sweet-dialog-backdrop show">
    <div className="sweet-dialog" role="dialog" aria-modal="true">
      <div className="sweet-dialog-icon warning"><i className="bi bi-arrow-left-right app-icon"></i></div>
      <h2 className="sweet-dialog-title">{t("cashier.table_move.dialog_title")}</h2>
      <p className="sweet-dialog-message">{t("cashier.table_move.dialog_message", { table: fromCode })}</p>
      <select id="moveTableTarget" className="input" value={value.targetId} disabled={busy} onChange={e => value.setTargetId(e.target.value)}>
        {tables.map(table => <option value={table.id} key={table.id}>{table.name || t("cashier.table_move.table_fallback", { table: table.code || table.id })}</option>)}
      </select>
      <div className="sweet-dialog-actions has-cancel" style={{ marginTop: 18 }}>
        <button className="sweet-dialog-button sweet-dialog-cancel" type="button" disabled={busy} onClick={onClose}>{t("cashier.common.cancel")}</button>
        <button className="sweet-dialog-button sweet-dialog-confirm" type="button" disabled={busy || !value.targetId} onClick={onConfirm}>{t("cashier.table_move.confirm_selection")}</button>
      </div>
    </div>
  </div>;
}

function TakeawayQrModal({ open, url, t, onClose, onCopy }) {
  if (!open) return null;
  const src = qrDataUrl(url, { size: 260, margin: 4 });
  return <div id="takeawayQrModal">
    <div className="takeaway-qr-backdrop" data-close-takeaway-qr onClick={onClose}></div>
    <section className="takeaway-qr-card" role="dialog" aria-modal="true" aria-labelledby="takeawayQrTitle">
      <button className="takeaway-qr-close" type="button" data-close-takeaway-qr aria-label={t("cashier.takeaway_tools.close")} onClick={onClose}><i className="bi bi-x-lg app-icon"></i></button>
      <h2 id="takeawayQrTitle">{t("cashier.takeaway_tools.qr_title")}</h2>
      <p>{t("cashier.takeaway_tools.qr_help")}</p>
      <img src={src} alt={t("cashier.takeaway_tools.qr_alt")} />
      <input value={url} readOnly aria-label={t("cashier.takeaway_tools.link_aria")} />
      <div className="order-actions">
        <button className="btn btn-warning" type="button" id="copyTakeawayQrUrl" onClick={onCopy}><i className="bi bi-clipboard app-icon"></i><span>{t("cashier.takeaway_tools.copy_link")}</span></button>
        <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer"><i className="bi bi-box-arrow-up-right app-icon"></i><span>{t("cashier.takeaway_tools.open_page")}</span></a>
      </div>
    </section>
  </div>;
}

function lalamoveErrorText(error, t, money) {
  const code = String(error?.message || error?.code || "").replace(/^FirebaseError:\s*/i, "");
  const provider = String(error?.serverResponse?.providerError || "");
  if (code.includes("LALAMOVE_PRICE_DIFFERENCE_APPROVAL_REQUIRED")) return t("cashier.lalamove.price_changed");
  if (code.includes("LALAMOVE_ORDER_NOT_READY")) return t("cashier.lalamove.not_ready_error");
  if (code.includes("LALAMOVE_ACCOUNT_NOT_READY")) return t("cashier.lalamove.account_not_ready");
  if (code.includes("FOD_WALLET_INSUFFICIENT_BALANCE")) return t("cashier.lalamove.fod_wallet_insufficient", {
    balance: money(error?.serverResponse?.walletBalance || 0),
    required: money(error?.serverResponse?.requiredAmount || 0),
  });
  if (code.includes("FOD_WALLET_STORAGE_MISSING")) return t("cashier.lalamove.fod_wallet_storage_missing");
  if (code.includes("FOD_WALLET_BUSY")) return t("cashier.lalamove.fod_wallet_busy");
  if (code.includes("LALAMOVE_SENDER_CONTACT_REQUIRED")) return t("cashier.lalamove.sender_contact_required");
  if (code.includes("LALAMOVE_RECIPIENT_CONTACT_REQUIRED")) return t("cashier.lalamove.recipient_contact_required");
  if (code.includes("LALAMOVE_ORDER_CANCEL_FORBIDDEN") || /ERR_CANCELLATION_FORBIDDEN/i.test(provider)) return t("cashier.lalamove.cancel_forbidden");
  if (code.includes("LALAMOVE_ORDER_CANCEL_FAILED")) return t("cashier.lalamove.cancel_failed");
  if (/ERR_OUT_OF_SERVICE_AREA/i.test(provider)) return t("cashier.lalamove.out_of_service_area");
  if (/ERR_INVALID_QUOTATION_ID/i.test(provider)) return t("cashier.lalamove.quotation_expired");
  if (/ERR_INSUFFICIENT_CREDIT/i.test(provider)) return t("cashier.lalamove.insufficient_credit");
  if (/ERR_INVALID_FIELD|ERR_REQUIRED_FIELD|ERR_MISSING_FIELD/i.test(provider)) return t("cashier.lalamove.provider_payload_invalid");
  if (/ERR_RATE_LIMIT_EXCEEDED/i.test(provider) || error?.code === "RESOURCE_EXHAUSTED") return t("cashier.lalamove.rate_limited");
  return t("cashier.lalamove.generic_error", { code: provider || code || "UNKNOWN" });
}

export function CashierPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate: formatI18nDate } = useI18n();
  const stylesReady = useParityPage({
    title: t("cashier.meta.title"),
    bodyClass: "order-delivery-workspace cashier-page",
    styles: [
      "app.css", "icons.css", "sweet-dialog.css", "cashier-refresh.css",
      "order-delivery-workspace-theme.css", "page-ready-state.css",
    ],
  });

  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [slipUrls, setSlipUrls] = useState({});
  const [takeawayQrOpen, setTakeawayQrOpen] = useState(false);
  const [moveGroup, setMoveGroup] = useState(null);
  const [moveTargetId, setMoveTargetId] = useState("");
  const refreshAt = useRef(new Map());
  const allowedRole = ["owner", "admin", "manager", "cashier"].includes(profile?.role);

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatTime = value => {
    const date = valueToDate(value);
    if (!date) return "-";
    return formatI18nDate(date, {
      calendar: "gregory",
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }) || "-";
  };
  const normalizedOrders = useMemo(() => normalizeCashierOrders(orders), [orders]);
  const active = useMemo(() => activeOrders(normalizedOrders), [normalizedOrders]);
  const takeawayUrl = tenant?.slug
    ? new URL(`/s/${encodeURIComponent(tenant.slug)}/takeaway/`, location.origin).toString()
    : "";

  useEffect(() => {
    if (!tenant?.id || !allowedRole) return undefined;
    let alive = true;
    let ready = false;
    setLoading(true);
    setLoadError("");

    // Laravel MASTER opens Cashier from the realtime orders subscription.
    // Do not block the whole page on the heavier operational snapshot
    // (settings + menus + tables + orders + held bills).
    const markReady = () => {
      if (!alive || ready) return;
      ready = true;
      setLoading(false);
    };

    const watchdog = window.setTimeout(() => {
      if (!alive || ready) return;
      console.warn("CASHIER_INITIAL_LOAD_TIMEOUT");
      setLoadError(t("cashier.loading.failed"));
      markReady();
    }, 8000);

    const stopOrders = watchOperationalOrders(tenant.id, rows => {
      if (!alive) return;
      setOrders(rows);
      setLoadError("");
      markReady();
    }, error => {
      console.error("CASHIER_ORDER_WATCH_FAILED", error);
      if (!alive) return;
      setLoadError(t("cashier.loading.failed"));
      markReady();
    });

    const stopTables = watchOperationalTables(tenant.id, rows => {
      if (alive) setTables(rows);
    }, error => {
      console.error("CASHIER_TABLE_WATCH_FAILED", error);
      if (alive) setLoadError(current => current || t("cashier.loading.failed"));
    });

    return () => {
      alive = false;
      window.clearTimeout(watchdog);
      stopOrders?.();
      stopTables?.();
    };
  }, [tenant?.id, allowedRole, t]);

  useEffect(() => {
    let alive = true;
    const missing = active.filter(order => order.orderType === "delivery"
      && order.paymentSlipPath && !order.paymentSlipUrl && !slipUrls[order.id]);
    if (!missing.length) return undefined;
    Promise.all(missing.map(async order => {
      try {
        const url = await getDownloadURL(storageRef(storage, order.paymentSlipPath));
        return [order.id, url];
      } catch {
        const direct = /^https?:\/\//.test(String(order.paymentSlipPath || "")) ? order.paymentSlipPath : "";
        return [order.id, direct];
      }
    })).then(entries => {
      if (!alive) return;
      setSlipUrls(current => ({ ...current, ...Object.fromEntries(entries.filter(([,url]) => url)) }));
    });
    return () => { alive = false; };
  }, [active, slipUrls]);

  const cards = useMemo(() => {
    const groups = new Map();
    active.filter(isTableOrder).forEach(order => {
      const key = tableGroupKey(order);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(order);
    });
    return [
      ...[...groups.values()].map(group => ({ type: "table", key: tableGroupKey(group[0]), group, order: group[0] })),
      ...active.filter(isWalkIn).map(order => ({ type: "walkin", key: order.id, order })),
      ...active.filter(order => order.orderType === "takeaway").map(order => ({ type: "takeaway", key: order.id, order })),
      ...active.filter(order => order.orderType === "delivery").map(order => ({ type: "delivery", key: order.id, order })),
    ].sort((a,b) => String(b.order.queueDate || "").localeCompare(String(a.order.queueDate || ""))
      || queueSequence(b.order) - queueSequence(a.order)
      || (valueToDate(displayTime(b.order))?.getTime() || 0) - (valueToDate(displayTime(a.order))?.getTime() || 0));
  }, [active]);

  useEffect(() => {
    if (!tenant?.id || !tables.length) return;
    const byToken = new Map();
    normalizedOrders.filter(order => isTableOrder(order)
      && !["paid", "cancelled"].includes(order.status)
      && order.tableToken).forEach(order => {
      if (!byToken.has(order.tableToken)) byToken.set(order.tableToken, []);
      byToken.get(order.tableToken).push(order.id);
    });
    tables.filter(table => table.status === "occupied" && table.orderToken).forEach(table => {
      const ids = (byToken.get(table.orderToken) || []).map(String).sort();
      const current = (table.orderIds || []).map(String).sort();
      if (ids.length && ids.join("|") !== current.join("|")) {
        updateOperationalTable(tenant.id, table.id, { orderIds: ids }).catch(error => console.error("CASHIER_TABLE_ORDER_IDS_SYNC_FAILED", error));
      }
    });
  }, [tenant?.id, normalizedOrders, tables]);

  const updateOrder = async (orderId, patch) => {
    const updated = await updateOperationalOrder(tenant.id, orderId, patch);
    setOrders(current => current.map(row => row.id === orderId ? updated : row));
    return updated;
  };
  const closeTableAfterPayment = async rounds => {
    const first = rounds[0];
    if (!first?.tableCode || first.orderType === "takeaway") return;
    const table = tables.find(row => String(row.code || row.id).toUpperCase() === String(first.tableCode).toUpperCase());
    if (table && (!first.tableToken || table.orderToken === first.tableToken)) {
      await updateOperationalTable(tenant.id, table.id, {
        status: "available", orderToken: "", sessionStartedAt: null, currentRound: 0, orderIds: [],
      });
    }
  };
  const openReceiptPrintWindow = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) printWindow.opener = null;
    return printWindow;
  };
  const printOrder = (printWindow, orderId) => {
    const url = cashierRoute(`/receipt/?order=${encodeURIComponent(orderId)}&autoprint=1`);
    if (printWindow && !printWindow.closed) printWindow.location.replace(url);
    else location.assign(url);
  };
  const printTable = (printWindow, rounds) => {
    const ids = rounds.map(order => order.id).filter(Boolean).join(",");
    const url = cashierRoute(`/receipt/?orders=${encodeURIComponent(ids)}&autoprint=1`);
    if (printWindow && !printWindow.closed) printWindow.location.replace(url);
    else location.assign(url);
  };
  const closePrintWindow = printWindow => {
    if (printWindow && !printWindow.closed) printWindow.close();
  };

  const pay = async order => {
    if (!order || busyKey) return;
    const ok = await sweetConfirm(t("cashier.payment.confirm_message"), {
      title: t("cashier.payment.confirm_title"),
      confirmText: t("cashier.common.confirm"),
      cancelText: t("cashier.common.cancel"),
      type: "warning",
    });
    if (!ok) return;
    const printWindow = openReceiptPrintWindow();
    setBusyKey(`pay:${order.id}`);
    try {
      const now = new Date().toISOString();
      const patch = { paymentStatus: "paid", paidAt: now };
      if (order.orderType === "delivery" && order.status === "served") {
        patch.status = "paid";
        patch.completedAt = now;
      }
      await updateOrder(order.id, patch);
      showToast(order.orderType === "takeaway"
        ? t("cashier.toasts.takeaway_payment_saved")
        : patch.status === "paid" && isLalamoveDelivery(order)
          ? t("cashier.lalamove.payment_ready_dispatch")
          : patch.status === "paid"
            ? t("cashier.toasts.delivery_paid_closed")
            : t("cashier.toasts.payment_saved_waiting_rider"));
      printOrder(printWindow, order.id);
    } catch (error) {
      closePrintWindow(printWindow);
      console.error("CASHIER_PAYMENT_FAILED", error);
      showToast(t("cashier.toasts.payment_failed"), "error");
    } finally {
      setBusyKey("");
    }
  };

  const payTable = async rounds => {
    const payable = rounds.filter(order => order.paymentStatus !== "paid");
    if (!payable.length || busyKey) return;
    const total = payable.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const ok = await sweetConfirm(
      `${t("cashier.table.confirm_payment", { table: rounds[0].tableCode, amount: money(total) })}\n\n${t("cashier.table.payment_serving_help")}`,
      {
        title: t("cashier.table.payment_title"),
        confirmText: t("cashier.common.confirm"),
        cancelText: t("cashier.common.cancel"),
        type: "warning",
      },
    );
    if (!ok) return;
    const printWindow = openReceiptPrintWindow();
    setBusyKey(`table-pay:${tableGroupKey(rounds[0])}`);
    try {
      const now = new Date().toISOString();
      await Promise.all(payable.map(order => {
        const patch = { paymentStatus: "paid", paidAt: now };
        if (isServed(order)) { patch.status = "paid"; patch.completedAt = now; }
        return updateOperationalOrder(tenant.id, order.id, patch);
      }));
      const allWillClose = rounds.every(order => order.status === "paid" || isServed(order));
      if (allWillClose) await closeTableAfterPayment(rounds);
      showToast(t(allWillClose ? "cashier.toasts.table_paid_closed" : "cashier.toasts.table_paid_waiting_kitchen", { table: rounds[0].tableCode }));
      printTable(printWindow, rounds);
    } catch (error) {
      closePrintWindow(printWindow);
      console.error("CASHIER_TABLE_PAYMENT_FAILED", error);
      showToast(t("cashier.toasts.table_payment_failed"), "error");
    } finally {
      setBusyKey("");
    }
  };

  const callPickup = async order => {
    setBusyKey(`pickup-call:${order.id}`);
    try {
      await updateOrder(order.id, { pickupStatus: "called", pickupCalledAt: new Date().toISOString() });
      showToast(t("cashier.toasts.pickup_called"));
    } catch (error) {
      console.error(error);
      showToast(t("cashier.toasts.status_update_failed"), "error");
    } finally { setBusyKey(""); }
  };
  const pickupDone = async order => {
    setBusyKey(`pickup-done:${order.id}`);
    try {
      const now = new Date().toISOString();
      await updateOrder(order.id, {
        status: "paid", paymentStatus: "paid", paidAt: now, completedAt: now,
        pickupStatus: "picked_up", pickedUpAt: now,
      });
      showToast(t("cashier.toasts.takeaway_handed_over"));
    } catch (error) {
      console.error(error);
      showToast(t("cashier.toasts.status_update_failed"), "error");
    } finally { setBusyKey(""); }
  };

  const cancelOrder = async order => {
    if (!order || busyKey) return;
    const targetLabel = order.orderType === "delivery"
      ? t("cashier.cancel_order.delivery_target", { customer: order.recipientName || t("cashier.cancel_order.customer_fallback") })
      : order.orderType === "takeaway"
        ? t("cashier.cancel_order.takeaway_target", { queue: order.queueNo || "" })
        : isWalkIn(order)
          ? t(order.serviceType === "dine_in" ? "quick_order.cashier.dine_in_title" : "quick_order.cashier.takeaway_title")
          : t("cashier.cancel_order.table_target", { table: order.tableCode || "-", round: order.roundNumber || 1 });
    const ok = await sweetConfirm(
      `${t("cashier.cancel_order.message", { target: targetLabel })}\n\n${t("cashier.cancel_order.warning")}`,
      {
        title: t("cashier.cancel_order.title"),
        confirmText: t("cashier.common.confirm"),
        cancelText: t("cashier.common.cancel"),
        type: "warning",
      },
    );
    if (!ok) return;
    setBusyKey(`cancel:${order.id}`);
    const optimistic = {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    };
    setOrders(current => current.map(row => row.id === order.id ? { ...row, ...optimistic } : row));
    try {
      const cancelled = await cancelOperationalOrder(tenant.id, order.id);
      setOrders(current => current.map(row => row.id === order.id ? { ...row, ...cancelled } : row));
      if (isTableOrder(order) && order.tableCode) {
        const hasOther = normalizedOrders.some(row => row.id !== order.id
          && row.tableToken === order.tableToken
          && !["paid", "cancelled"].includes(row.status));
        if (!hasOther) await closeTableAfterPayment([order]);
      }
      showToast(t("cashier.toasts.order_cancelled"));
    } catch (error) {
      setOrders(current => current.map(row => row.id === order.id ? order : row));
      console.error("CASHIER_CANCEL_ORDER_FAILED", error);
      showToast(t("cashier.toasts.status_update_failed"), "error");
    } finally { setBusyKey(""); }
  };

  const assignTable = async (order, tableCode) => {
    if (!order?.id || busyKey) return;
    setBusyKey(`assign:${order.id}`);
    try {
      const result = await assignWalkInTable(tenant.id, order.id, tableCode);
      const updated = result?.item || result;
      if (updated?.id) setOrders(current => current.map(row => row.id === updated.id ? { ...row, ...updated } : row));
      showToast(t("quick_order.table.assigned"));
    } catch (error) {
      console.error("CASHIER_WALKIN_ASSIGN_FAILED", error);
      showToast(t(error?.code === "TABLE_NOT_AVAILABLE"
        ? "quick_order.table.unavailable_error"
        : "quick_order.table.assignment_failed"), "error");
    } finally { setBusyKey(""); }
  };

  const quoteLalamove = async order => {
    setBusyKey(`ll-quote:${order.id}`);
    try {
      const result = await quoteLalamoveDispatch(tenant.id, order.id);
      const dispatch = result?.item || result || {};
      showToast(t("cashier.lalamove.quote_ready", { amount: money(dispatch.quoteFee || 0) }));
    } catch (error) {
      console.error("CASHIER_LALAMOVE_QUOTE_FAILED", error);
      showToast(lalamoveErrorText(error, t, money), "error");
    } finally { setBusyKey(""); }
  };

  const placeLalamove = async (order, approvedFee) => {
    const checkoutFee = Number(order.deliveryBaseFee || 0);
    const currentFee = Number(approvedFee || 0);
    const difference = Math.max(0, currentFee - checkoutFee);
    const ok = await sweetConfirm(
      difference > .009
        ? t("cashier.lalamove.confirm_difference", { checkout: money(checkoutFee), current: money(currentFee), difference: money(difference) })
        : t("cashier.lalamove.confirm_call", { amount: money(currentFee) }),
      {
        title: t("cashier.lalamove.confirm_title"),
        confirmText: t("cashier.common.confirm"),
        cancelText: t("cashier.common.cancel"),
        type: difference > .009 ? "warning" : "info",
      },
    );
    if (!ok) return;
    setBusyKey(`ll-place:${order.id}`);
    try {
      const result = await placeLalamoveDispatch(tenant.id, order.id, {
        approveDifference: difference > .009,
        approvedFee: currentFee,
      });
      const dispatch = result?.item || result || {};
      showToast(
        dispatch.walletDebitPending ? t("cashier.lalamove.fod_wallet_debit_pending") : t("cashier.lalamove.placed"),
        dispatch.walletDebitPending ? "error" : "success",
      );
    } catch (error) {
      console.error("CASHIER_LALAMOVE_PLACE_FAILED", error);
      showToast(lalamoveErrorText(error, t, money), "error");
    } finally { setBusyKey(""); }
  };

  const refreshLalamove = async order => {
    const previous = Number(refreshAt.current.get(order.id) || 0);
    const remaining = LALAMOVE_STATUS_COOLDOWN_MS - (Date.now() - previous);
    if (remaining > 0) {
      showToast(t("cashier.lalamove.refresh_cooldown", { seconds: Math.ceil(remaining / 1000) }), "warning");
      return;
    }
    refreshAt.current.set(order.id, Date.now());
    setBusyKey(`ll-refresh:${order.id}`);
    try {
      await refreshLalamoveDispatch(tenant.id, order.id);
      showToast(t("cashier.lalamove.status_refreshed"));
    } catch (error) {
      console.error("CASHIER_LALAMOVE_REFRESH_FAILED", error);
      showToast(lalamoveErrorText(error, t, money), "error");
      if (error?.code !== "RESOURCE_EXHAUSTED") refreshAt.current.delete(order.id);
    } finally { setBusyKey(""); }
  };

  const cancelLalamove = async order => {
    const ok = await sweetConfirm(t("cashier.lalamove.cancel_confirm"), {
      title: t("cashier.lalamove.cancel_title"),
      confirmText: t("cashier.lalamove.cancel_confirm_button"),
      cancelText: t("cashier.common.cancel"),
      type: "warning",
    });
    if (!ok) return;
    setBusyKey(`ll-cancel:${order.id}`);
    try {
      await cancelLalamoveDispatch(tenant.id, order.id);
      showToast(t("cashier.lalamove.cancel_success"));
    } catch (error) {
      console.error("CASHIER_LALAMOVE_CANCEL_FAILED", error);
      showToast(lalamoveErrorText(error, t, money), "error");
    } finally { setBusyKey(""); }
  };

  const openMoveTable = rounds => {
    const source = rounds[0];
    const available = tables.filter(table => table.active !== false
      && (!table.status || table.status === "available")
      && !table.walkInOrderId
      && String(table.code || table.id) !== String(source.tableCode));
    if (!available.length) {
      showToast(t("cashier.table_move.no_available_tables"), "error");
      return;
    }
    setMoveTargetId(String(available[0].id));
    setMoveGroup({ rounds, available });
  };

  const confirmMoveTable = async () => {
    if (!moveGroup?.rounds?.length || !moveTargetId || busyKey) return;
    const rounds = moveGroup.rounds;
    const source = rounds[0];
    const target = moveGroup.available.find(table => String(table.id) === String(moveTargetId));
    const label = target?.name || target?.code || moveTargetId;
    const ok = await sweetConfirm(
      `${t("cashier.table_move.confirm_message", { from: source.tableCode, to: label })}\n\n${t("cashier.table_move.confirm_warning")}`,
      {
        title: t("cashier.table_move.confirm_title"),
        confirmText: t("cashier.table_move.confirm_action"),
        cancelText: t("cashier.common.cancel"),
        type: "warning",
      },
    );
    if (!ok) return;
    setBusyKey(`move:${tableGroupKey(source)}`);
    try {
      await moveTableSession(tenant.id, {
        fromTableCode: source.tableCode,
        fromTableToken: source.tableToken,
        toTableId: moveTargetId,
        orders: rounds.map(order => ({ id: order.id })),
      });
      showToast(t("cashier.table_move.success", { from: source.tableCode, to: label }));
      setMoveGroup(null);
      setMoveTargetId("");
    } catch (error) {
      console.error("CASHIER_TABLE_MOVE_FAILED", error);
      const key = error?.code === "SOURCE_TABLE_NOT_ACTIVE" ? "cashier.table_move.source_not_active"
        : error?.code === "TARGET_TABLE_NOT_AVAILABLE" ? "cashier.table_move.target_not_available"
          : error?.code === "MOVE_ORDER_NOT_UNPAID" ? "cashier.table_move.order_not_unpaid"
            : "cashier.table_move.failed";
      showToast(key === "cashier.table_move.failed" ? t(key, { code: error?.code || "UNKNOWN" }) : t(key), "error");
    } finally { setBusyKey(""); }
  };

  const copyTakeawayLink = async () => {
    if (!takeawayUrl) {
      showToast(translated(t, "cashier.takeaway_tools.store_unavailable", "Store information is unavailable. Refresh the page and try again."), "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(takeawayUrl);
      showToast(t("cashier.takeaway_tools.copy_done"));
    } catch {
      await sweetPrompt(t("cashier.takeaway_tools.copy_blocked"), takeawayUrl, {
        title: t("cashier.takeaway_tools.copy_title"),
        confirmText: t("cashier.takeaway_tools.close"),
        readOnly: true,
      });
    }
  };

  const actions = {
    pay,
    payTable,
    callPickup,
    pickupDone,
    cancelOrder,
    assignWalkIn: assignTable,
    quote: quoteLalamove,
    place: placeLalamove,
    refresh: refreshLalamove,
    cancelLalamove,
    moveTable: openMoveTable,
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (allowedRole && loading)) {
    return <PageReadyOverlay context={t("cashier.header.title")} title={t("cashier.loading.title")} message={t("cashier.loading.preparing")} progress={76} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fcashier" replace />;
  if (!allowedRole) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header">
        <div className="brand"><span className="brand-mark">PG</span>{t("cashier.header.title")}</div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <CashierOrderNotifier orders={orders} onToast={showToast} surface="cashier" />
          <UserMenu profile={profile} />
        </div>
      </header>

      <div id="demoBanner"></div>

      <main className="container cashier-shell">
        <section className="hero cashier-hero">
          <div className="cashier-hero-copy">
            <div className="cashier-hero-title-row">
              <h1>{t("cashier.hero.title")}</h1>
              <div className="cashier-hero-actions">
                <a className="btn cashier-hero-order-btn" href={cashierRoute("/quick-order")} aria-label={t("quick_order.entry.button")} title={t("quick_order.entry.description")}>
                  <i className="bi bi-lightning-charge app-icon" aria-hidden="true"></i>
                  <span>{translated(t, "quick_order.entry.short_button", t("kitchen.actions.accept"))}</span>
                </a>
              </div>
            </div>
            <p>{t("cashier.hero.description")}</p>
          </div>
        </section>

        <section className="cashier-action-bar" aria-label={t("cashier.takeaway_tools.aria_label")}>
          <div className="cashier-action-title"><strong>{t("cashier.takeaway_tools.title")}</strong><span>{t("cashier.takeaway_tools.subtitle")}</span></div>
          <div className="cashier-actions">
            <a className="btn btn-primary" href={cashierRoute("/waiting-queue")} aria-label={t("cashier.takeaway_tools.waiting_queue_aria")} title={t("cashier.takeaway_tools.waiting_queue_aria")}><i className="bi bi-person-standing app-icon"></i><span>{t("cashier.takeaway_tools.waiting_queue")}</span></a>
            <button className="btn btn-primary" type="button" id="showTakeawayQr" aria-label={t("cashier.takeaway_tools.show_qr_aria")} title={t("cashier.takeaway_tools.show_qr_aria")} onClick={() => takeawayUrl ? setTakeawayQrOpen(true) : showToast(translated(t, "cashier.takeaway_tools.store_unavailable", "Store information is unavailable. Refresh the page and try again."), "error")}><i className="bi bi-qr-code app-icon"></i><span>{t("cashier.takeaway_tools.qr_label")}</span></button>
            <a className="btn btn-warning" id="openTakeawayOrder" href={takeawayUrl || undefined} target="_blank" rel="noopener noreferrer" aria-label={t("cashier.takeaway_tools.open_order_aria")} title={t("cashier.takeaway_tools.open_order_aria")}><i className="bi bi-plus-lg app-icon"></i><span>{t("cashier.takeaway_tools.open_order")}</span></a>
            <button className="btn cashier-copy-action" type="button" id="copyTakeawayUrl" aria-label={t("cashier.takeaway_tools.copy_link_aria")} title={t("cashier.takeaway_tools.copy_link_aria")} onClick={copyTakeawayLink}><i className="bi bi-clipboard app-icon"></i><span>{t("cashier.takeaway_tools.copy_link")}</span></button>
          </div>
        </section>

        <section className="cashier-workspace" aria-labelledby="cashierQueueTitle">
          <header className="cashier-section-head">
            <div><h2 id="cashierQueueTitle">{t("cashier.queue.title")}</h2><p>{t("cashier.queue.description")}</p></div>
            <span id="cashierOrderCount" className="cashier-order-count">{t("cashier.queue.count", { count: cards.length })}</span>
          </header>
          {loadError ? <div className="upload-error" role="alert">{loadError}</div> : null}
          <div id="orderGrid" className="cashier-order-grid">
            {cards.length ? cards.map(card => {
              const busy = Boolean(busyKey);
              if (card.type === "table") return <TableBillCard key={card.key} group={card.group} t={t} money={money} formatTime={formatTime} busy={busy} actions={actions} />;
              if (card.type === "walkin") return <WalkInCard key={card.key} order={card.order} tables={tables} active={active} t={t} money={money} formatTime={formatTime} busy={busy} actions={actions} />;
              if (card.type === "takeaway") return <TakeawayCard key={card.key} order={card.order} t={t} money={money} formatTime={formatTime} busy={busy} actions={actions} />;
              return <DeliveryCard key={card.key} order={card.order} t={t} money={money} formatTime={formatTime} slipUrl={card.order.paymentSlipUrl || slipUrls[card.order.id] || ""} busy={busy} actions={actions} />;
            }) : <div className="cashier-empty"><span className="cashier-empty-mark" aria-hidden="true"></span><strong>{t("cashier.queue.empty_title")}</strong><span>{t("cashier.queue.empty_help")}</span></div>}
          </div>
        </section>
      </main>

      <TableMoveDialog
        value={moveGroup ? { targetId: moveTargetId, setTargetId: setMoveTargetId } : null}
        tables={moveGroup?.available || []}
        fromCode={moveGroup?.rounds?.[0]?.tableCode || ""}
        busy={Boolean(busyKey)}
        t={t}
        onClose={() => { if (!busyKey) { setMoveGroup(null); setMoveTargetId(""); } }}
        onConfirm={confirmMoveTable}
      />
      <TakeawayQrModal open={takeawayQrOpen} url={takeawayUrl} t={t} onClose={() => setTakeawayQrOpen(false)} onCopy={copyTakeawayLink} />
      <ParityFooter />
    </>
  );
}
