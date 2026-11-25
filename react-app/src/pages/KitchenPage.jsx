import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { CashierOrderNotifier } from "@/components/CashierOrderNotifier";
import { DeliveryOrderHeading } from "@/components/DeliveryOrderHeading";
import { TelegramOrderFocus } from "@/components/TelegramOrderFocus";
import { OriginalItemLine, RevisedOrderNet } from "@/components/OrderRevisionDisplay";
import { deliveryReceiptTotals } from "@/utils/deliveryReceiptTotal.mjs";
import "@/ui/kitchen-source-safe-actions.css";
import "@/ui/kitchen-source-delivery-heading.css";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { sweetConfirm } from "@/components/sweetDialog";
import {
  cancelUnpaidWalkIn,
  cancelReviewedWalkIn,
  updateDeferredWalkInKitchen,
  loadKitchenMenus,
  refreshLalamoveDispatch,
  settleTableSession,
  kitchenApplyOrderAction,
  watchOperationalOrders,
} from "@/data/operationalData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useLalamoveAutoRefresh } from "@/hooks/useLalamoveAutoRefresh";
import { useTenant } from "@/tenant/TenantProvider";
import { deliveryKitchenAdmitted } from "@/data/deliveryKitchenGate";
import { walkInKitchenPending, walkInKitchenStatus } from "@/data/walkInLifecycle.mjs";
import { isKitchenLocked, isLalamoveDelivery, lalamoveDispatchActive, lalamoveStatus } from "@/utils/kitchenOrderLock";

const ACTIVE_STATUSES = new Set(["pending", "accepted", "cooking", "ready", "served"]);
function kitchenWorkLocked(order) {
  const attempt=String(order?.lalamoveDispatchAttemptState||"").toLowerCase();
  const dispatch=String(order?.lalamoveDispatchStatus||"").toLowerCase();
  if (order?.lalamoveDispatchReservation?.id ||
      order?.lalamoveWalletDebitPending === true ||
      ["placing","confirmation_unknown","placed"].includes(attempt) ||
      ["placing","confirmation_unknown","placed"].includes(dispatch)) return true;
  return isKitchenLocked(order) && !(
    String(order?.status || "").toLowerCase() === "paid" && walkInKitchenPending(order)
  );
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
function displayTimeValue(order) {
  return order.createdAt || order.createdAtText || order.updatedAt;
}
function ageMinutes(order) {
  const date = valueToDate(displayTimeValue(order));
  return date ? Math.floor((Date.now() - date.getTime()) / 60000) : 0;
}
function isDelivery(order) { return order?.orderType === "delivery"; }
function isTakeaway(order) { return order?.orderType === "takeaway"; }
function isWalkIn(order) { return order?.orderType === "walkin"; }
function isTableOrder(order) {
  const type = String(order?.orderType || "").toLowerCase();
  if (type === "table") return true;
  if (["delivery", "takeaway", "walkin"].includes(type)) return false;
  return Boolean(order?.tableCode && order?.tableToken);
}
function tableGroupKey(order) { return order.tableToken || `table:${order.tableCode}`; }
function queueSequence(order) {
  const explicit = Number(order?.queueSequence);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const parsed = Number(String(order?.queueNo || "").replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function lalamoveDeliveryCompleted(order) {
  return isLalamoveDelivery(order) && lalamoveStatus(order) === "COMPLETED";
}
function lalamoveCompletionStale(order) {
  return lalamoveDeliveryCompleted(order)
    && !["paid", "completed"].includes(String(order?.status || "").toLowerCase());
}
function supportsItemServe(order) {
  return isTableOrder(order) || isWalkIn(order);
}
function activeItems(order) {
  return (Array.isArray(order?.items) ? order.items : []).filter(item => item?.cancelled !== true);
}
function isWaitingQueuePlaceholder(order) {
  return Boolean(order?.waitingQueueId)
    && Number(order?.roundNumber || 0) === 0
    && (Array.isArray(order?.items) ? order.items : []).length === 0
    && Number(order?.totalAmount ?? order?.total ?? 0) === 0;
}

function canServeItem(order, item) {
  return supportsItemServe(order)
    && order?.status === "ready"
    && item
    && item.cancelled !== true
    && item.served !== true;
}
function allItemsServed(order, items = order?.items || []) {
  const rows = (Array.isArray(items) ? items : []).filter(item => item?.cancelled !== true);
  return supportsItemServe(order) && rows.length > 0 && rows.every(item => item?.served === true);
}
function recalculateOrder(order, items) {
  const subtotalAmount = items.filter(item => !item.cancelled)
    .reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  const deliveryFee = isDelivery(order) && subtotalAmount > 0 ? Number(order.deliveryFee || 0) : 0;
  return { subtotalAmount, deliveryFee, totalAmount: subtotalAmount + deliveryFee };
}

function nextActions(order, t) {
  const status = walkInKitchenStatus(order);
  if (status === "pending") return [["accepted", t("kitchen.actions.accept"), "btn-primary", "check", "kitchen-accept-action"]];
  if (status === "accepted") return [["cooking", t("kitchen.actions.start"), "btn-warning", "hourglass-split", "kitchen-start-action"]];
  if (status === "cooking") return [["ready", isDelivery(order) ? t("kitchen.actions.ready_delivery") : t("kitchen.actions.ready_serve"), "btn-primary", "check-circle", "kitchen-ready-action"]];
  if (status === "ready" && isLalamoveDelivery(order)) return [];
  if (status === "ready") return [["served", isDelivery(order) ? t("kitchen.actions.rider_handoff") : t("kitchen.actions.served"), "btn-dark", "check-circle", "kitchen-served-action"]];
  return [];
}
function orderTitle(order, t) {
  if (isDelivery(order)) return t("kitchen.order.delivery_title", { name: order.recipientName || t("kitchen.order.unnamed") });
  if (isTakeaway(order)) return t("kitchen.order.takeaway_title");
  if (isWalkIn(order)) return order?.serviceType === "dine_in"
    ? t("quick_order.kitchen.dine_in_title") : t("quick_order.kitchen.takeaway_title");
  return t("kitchen.order.table_round_title", { table: order.tableCode, round: order.roundNumber || 1 });
}
function lockedItemLabel(order, t) {
  if (lalamoveDispatchActive(order)) return t("kitchen.lalamove.locked");
  if (isDelivery(order) && order?.status === "served") return t("kitchen.actions.rider_handoff");
  if (order?.status === "served") return t("kitchen.actions.served");
  if (order?.status === "paid") return t("kitchen.states.paid");
  return t("kitchen.states.locked");
}
function KitchenDeliveryPaymentBadge({ order, t }) {
    const paymentText = order.paymentMethod==="stripe_connect"&&order.paymentStatus!=="paid"
      ? "Stripe Connect: รอยืนยันการชำระเงิน"
      : order.paymentStatus === "paid"
      ? t("kitchen.order.payment_paid")
      : order.companionKitchenRelease?.status === "admitted_unverified"
        ? "รายการเงินเข้าตรงเงื่อนไข • ครัวเริ่มทำได้ (ยังไม่ยืนยันชำระ)"
      : order.companionAutoOCRReview?.status === "matched_unverified"
        ? "Google Vision OCR เทียบยอดแล้ว • รอตรวจรับชำระก่อนเริ่มทำอาหาร"
      : String(order.paymentMethod || "").toLowerCase() === "cod"
        ? t("kitchen.order.payment_cod") : t("kitchen.order.payment_unpaid");
    return <span className={"badge" + (order.paymentStatus === "paid" ? "" : " warning")}>{paymentText}</span>;
}
function KitchenInfo({ order, t }) {
  if (isDelivery(order)) {
    return <p><strong>{t("kitchen.order.phone")}</strong> {order.recipientPhone || "-"}<br /><strong>{t("kitchen.order.address")}</strong> {order.deliveryAddress || "-"}</p>;
  }
  if (isTakeaway(order)) return <p><span className="badge warning">{t("kitchen.order.takeaway_badge")}</span><br /><strong>{t("kitchen.order.customer")}</strong> {order.customerName || "-"}<br /><strong>{t("kitchen.order.phone")}</strong> {order.customerPhone || "-"}<br /><strong>{t("kitchen.order.queue")}</strong> {order.queueNo || "-"}</p>;
  if (isWalkIn(order)) {
    const tableText = order.serviceType === "dine_in"
      ? (order.tableCode ? t("quick_order.kitchen.table", { table: order.tableCode }) : t("quick_order.kitchen.table_unassigned"))
      : t("quick_order.service.takeaway");
    return <p><span className={"badge"+(order.paymentStatus === "paid" ? "" : " warning")}>{t(order.paymentStatus === "paid" ? "quick_order.cashier.paid" : "quick_order.deferred.unpaid")}</span><br /><strong>{tableText}</strong>{order.customerName ? <><br />{order.customerName}</> : null}</p>;
  }
  return null;
}
function DeliverySummary({ order, t, money }) {
  if (!isDelivery(order)) return null;
  return <div className="card" style={{ marginTop: 10, padding: "10px 12px", boxShadow: "none", background: "#f8fbf9" }}>
    <div className="receipt-row"><span>{t("kitchen.order.delivery_zone")}</span><strong>{order.deliveryZoneLabel || "-"}</strong></div>
    <div className="receipt-row"><span>{t("kitchen.order.food_subtotal")}</span><strong>{money(order.subtotalAmount ?? (Number(order.totalAmount || 0) - Number(order.deliveryFee || 0)))}</strong></div>
    <div className="receipt-row"><span>{t("kitchen.order.delivery_fee")}</span><strong>{money(order.deliveryFee || 0)}</strong></div>
    <div className="receipt-row delivery-before-discount-total"><span>ยอดรวมก่อนส่วนลด</span><strong data-kitchen-before-discount-total>{money(deliveryReceiptTotals(order).beforeDiscount)}</strong></div>
    {Number(order.deliveryPromotionDiscount || 0)>0 ? <div className="receipt-row delivery-promotion-discount-row" id="kitchenDeliveryPromotionDiscount"><span>ส่วนลดค่าจัดส่งตามยอดอาหาร</span><strong>−{money(order.deliveryPromotionDiscount)}</strong></div> : null}
  </div>;
}
function LalamoveNotice({ order, t }) {
  if (!isLalamoveDelivery(order) || order.status !== "ready") return null;
  const status = lalamoveStatus(order);
  let key = "waiting_dispatch";
  if (["ASSIGNING_DRIVER", "ON_GOING"].includes(status)) key = status.toLowerCase();
  else if (["CANCELED", "CANCELLED", "REJECTED", "EXPIRED"].includes(status)) key = "retry_required";
  return <div className="card" style={{ marginTop: 10, padding: "10px 12px", boxShadow: "none", background: "#f1fbf5" }}><strong>{t("kitchen.lalamove.title")}</strong><div className="menu-category" style={{ marginTop: 4 }}>{t(`kitchen.lalamove.${key}`)}</div></div>;
}

function KitchenOrderCard({
  order, nested = false, t, formatTime, money, onEditItem, onCancelItem, onServeItem, onCancelOrder, onStatus,
}) {
  const locked = kitchenWorkLocked(order);
  const overdue = ["pending", "accepted", "cooking"].includes(order?.status) && ageMinutes(order) >= 15;
  const statusText = isTakeaway(order) && order.status === "ready"
    ? t("kitchen.states.ready_to_serve")
    : t(`shared.status.${order.status || "pending"}`);
  const heading = nested ? (
    <div><h3 style={{ margin: 0 }}>{t("kitchen.order.round_title", { round: order.roundNumber || 1 })}</h3><small>{t("cashier_documents.receipt.bill_number")}: {order.billNo || order.billId || "-"} · {formatTime(displayTimeValue(order))}</small></div>
  ) : (
    <div className="order-heading-with-queue">
      <span className="order-queue-badge"><small>{t("cashier_documents.receipt.bill_number")}</small><strong>{order.billNo || order.billId || "-"}</strong></span>
      <div><h2 style={{ margin: 0 }}>{orderTitle(order, t)}</h2><small>{formatTime(displayTimeValue(order))}{order.queueNo ? " · " + t("kitchen.order.queue") + ": " + order.queueNo : ""}</small></div>
    </div>
  );
  const Tag = nested ? "section" : "article";
  return <Tag data-telegram-order-id={order.id} className={[
    "card", "order-card", nested ? "table-round-card" : "",
    isTakeaway(order) ? "takeaway-kitchen-card" : "",
    isWalkIn(order) ? "walkin-kitchen-card" : "",
    overdue ? "kitchen-order-overdue" : "",
  ].filter(Boolean).join(" ")}>
    {isDelivery(order) ? <>
      <DeliveryOrderHeading order={order} t={t} date={formatTime(displayTimeValue(order))} status={statusText}
        overdueLabel={overdue?t("kitchen.order.overdue",{count:ageMinutes(order)}):null} />
      {order.paymentStatus!=="paid"?<p className="delivery-staff-payment-detail"><KitchenDeliveryPaymentBadge order={order} t={t} /></p>:null}
    </> : <>
      <div className="order-head">{heading}<span className={"badge" + (isTakeaway(order) ? " warning" : "")}>{statusText}</span></div>
      {overdue ? <span className="badge warning kitchen-overdue-badge">{t("kitchen.order.overdue", { count: ageMinutes(order) })}</span> : null}
    </>}
    <KitchenInfo order={order} t={t} />
    <ul className="order-items">
      {(order.items || []).map((item, index) => (
        <li key={`${order.id}-${index}`} style={item.cancelled ? { opacity: .48, textDecoration: "line-through" } : undefined}>
          <OriginalItemLine item={item} money={money} />
          <strong>{Number(item.qty || 0)} × {String(item.name || "")}{item.isGift === true ? ` ${t("kitchen.order.gift_suffix")}` : ""}</strong>
          {item.kitchenAddOperationId ? <span className="badge warning" style={{marginLeft:6}}>{t("quick_order.deferred.new_items")}</span> : null}
          {item.note ? <><br /><small>{t("kitchen.order.item_note")} {item.note}</small></> : null}
          {item.cancelled ? <><br /><small>{t("kitchen.states.cancelled")}</small></>
            : item.kitchenPreviouslyServed ? <div className="kitchen-item-actions"><span className="badge">{t("quick_order.deferred.already_served")}</span><button className="btn btn-sm" type="button" disabled={locked || isWalkIn(order)} data-edit-item={order.id} data-item-index={index} onClick={() => onEditItem(order, index)}><i className="bi bi-pencil-square app-icon" aria-hidden="true"></i><span>{t("kitchen.actions.edit")}</span></button><button className="btn btn-danger btn-sm" type="button" disabled={locked || (isWalkIn(order) && order.paymentStatus === "paid")} data-cancel-item={order.id} data-item-index={index} onClick={() => onCancelItem(order, index)}><i className="bi bi-x-circle app-icon" aria-hidden="true"></i><span>{t("admin.common.delete")}</span></button></div>
            : supportsItemServe(order) && item.served === true
              ? <div className="kitchen-item-actions"><span className="badge">{t("kitchen.actions.served")}</span><button className="btn btn-sm" type="button" disabled={locked || isWalkIn(order)} data-edit-item={order.id} data-item-index={index} onClick={() => onEditItem(order, index)}><i className="bi bi-pencil-square app-icon" aria-hidden="true"></i><span>{t("kitchen.actions.edit")}</span></button><button className="btn btn-danger btn-sm" type="button" disabled={locked || (isWalkIn(order) && order.paymentStatus === "paid")} data-cancel-item={order.id} data-item-index={index} onClick={() => onCancelItem(order, index)}><i className="bi bi-x-circle app-icon" aria-hidden="true"></i><span>{t("admin.common.delete")}</span></button></div>
              : locked ? <div className="kitchen-item-actions kitchen-item-locked-actions"><span className="badge" title={lockedItemLabel(order, t)}><span className="kitchen-lock-label-full">{lockedItemLabel(order, t)}</span><span className="kitchen-lock-label-compact">{lalamoveDispatchActive(order) ? t("kitchen.lalamove.locked_compact") : lockedItemLabel(order, t)}</span></span></div>
                : <div className="kitchen-item-actions">
                    <button className="btn btn-sm" type="button" disabled={locked || isWalkIn(order)} data-edit-item={order.id} data-item-index={index} onClick={() => onEditItem(order, index)}><i className="bi bi-pencil-square app-icon" aria-hidden="true"></i><span>{t("kitchen.actions.edit")}</span></button>
                    <button className="btn btn-danger btn-sm" type="button" disabled={locked || (isWalkIn(order) && order.paymentStatus === "paid")} data-cancel-item={order.id} data-item-index={index} onClick={() => onCancelItem(order, index)}><i className="bi bi-x-circle app-icon" aria-hidden="true"></i><span>{t("admin.common.delete")}</span></button>
                    {canServeItem(order, item) ? <button className="btn btn-dark btn-sm kitchen-serve-item-action" type="button" data-serve-item={order.id} data-item-index={index} onClick={() => onServeItem(order, index)}><i className="bi bi-send-check app-icon" aria-hidden="true"></i><span>{t("kitchen.actions.serve_item")}</span></button> : null}
                  </div>}
        </li>
      ))}
    </ul>
    <DeliverySummary order={order} t={t} money={money} />
    {order.kitchenFinanceReviewRequired ? <div className="card kitchen-finance-review" role="status"
      style={{marginTop:10,padding:"10px 12px",border:"1px solid #e8cfa1",
        background:"#fff8e9",boxShadow:"none"}}>
      <strong>รายการครัวนี้ต้องตรวจสอบยอดชำระกับแคชเชียร์</strong>
      <div className="menu-category">ยอดรับชำระเดิมยังไม่เปลี่ยน และยังไม่มีการคืนเงินอัตโนมัติ
        {order.kitchenRevisedTotals?.totalAmount != null
          ? <span> · ยอดหลังแก้ไข {money(order.kitchenRevisedTotals.totalAmount)}</span> : null}
      </div>
    </div> : null}
    <LalamoveNotice order={order} t={t} />
    {order.note ? <p><strong>{t("kitchen.order.order_note")}</strong> {order.note}</p> : null}
    <div className="order-head" style={{ marginTop: 10 }}><strong>{t("kitchen.order.net_total")}</strong><strong className="price"><RevisedOrderNet order={order} current={order.totalAmount} money={money} /></strong></div>
    <div className="order-actions kitchen-order-actions kitchen-safe-order-actions" style={{ marginTop: 12 }}>
      {!locked ? <button className="btn btn-danger kitchen-cancel-order-action" type="button" data-cancel-order={order.id} onClick={() => onCancelOrder(order)}><i className="bi bi-x-circle app-icon" aria-hidden="true"></i><span>{t("kitchen.actions.cancel_order")}</span></button> : null}
      <div className="kitchen-primary-order-actions">
      {nextActions(order, t).map(([status, label, cls, icon, actionClass]) => (
        <button className={`btn ${cls} kitchen-status-action ${actionClass || ""}`} type="button" data-id={order.id} data-status={status} aria-label={label} key={status} onClick={() => onStatus(order, status)}>
          <i className={`bi bi-${icon}`} aria-hidden="true"></i><span>{label}</span>
        </button>
      ))}
      </div>
    </div>
  </Tag>;
}

function TableKitchenGroup(props) {
  const { group, t, formatTime, money } = props;
  const sorted = [...group].sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0));
  const first = sorted[0];
  return <article className="card order-card table-kitchen-group">
    <div className="order-head">
      <div className="order-heading-with-queue">
        <span className="order-queue-badge"><small>{t("kitchen.order.queue")}</small><strong>{first.queueNo || "-"}</strong></span>
        <div><h2 style={{ margin: 0 }}>{t("kitchen.order.table_title", { table: first.tableCode })}</h2><small>{t("kitchen.order.rounds_in_queue", { count: sorted.length })}</small></div>
      </div>
      <span className="badge">{t("kitchen.order.rounds_served", { served: sorted.filter(order => order.status === "served").length, total: sorted.length })}</span>
    </div>
    <div className="table-round-list">
      {sorted.map(order => <KitchenOrderCard {...props} key={order.id} order={order} nested t={t} formatTime={formatTime} money={money} />)}
    </div>
  </article>;
}

function KitchenItemEditor({ editor, menus, busy, t, money, onClose, onSave }) {
  const order = editor?.order;
  const index = editor?.index;
  const item = order?.items?.[index];
  const activeMenus = useMemo(() => menus.filter(menu => menu.active !== false), [menus]);
  const maxQty = Math.max(1, Number(item?.originalQty || item?.qty || 1));
  const [menuId, setMenuId] = useState(item?.menuId || item?.id || "");
  const [qty, setQty] = useState(Math.min(Number(item?.qty || 1), maxQty));
  const [note, setNote] = useState(item?.note || "");

  useEffect(() => {
    setMenuId(item?.menuId || item?.id || "");
    setQty(Math.min(Number(item?.qty || 1), maxQty));
    setNote(item?.note || "");
  }, [order?.id, index]);

  if (!order || !item) return null;
  return <div className="kitchen-item-editor-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section className="kitchen-item-editor" role="dialog" aria-modal="true" aria-labelledby="kitchenItemEditorTitle">
      <h2 id="kitchenItemEditorTitle" className="kitchen-item-editor-title"><span className="kitchen-item-editor-title-icon"><i className="bi bi-pencil-square app-icon" aria-hidden="true"></i></span><span>{t("kitchen.editor.title")}</span></h2>
      <div className="editor-grid">
        <div className="field">
          <label htmlFor="kitchenReplacementMenu">{t("kitchen.editor.menu")}</label>
          <select className="input" id="kitchenReplacementMenu" value={menuId} disabled={busy} onChange={e => setMenuId(e.target.value)}>
            {activeMenus.map(menu => <option value={menu.id} key={menu.id}>{menu.name} — {money(menu.price)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="kitchenReplacementQty">{t("kitchen.editor.quantity_available")}</label>
          <input className="input" id="kitchenReplacementQty" type="number" min="1" max={maxQty} step="1" value={qty} disabled={busy} onChange={e => setQty(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="kitchenReplacementNote">{t("kitchen.editor.edit_note")}</label>
          <input className="input" id="kitchenReplacementNote" maxLength="200" value={note} disabled={busy} onChange={e => setNote(e.target.value)} />
        </div>
      </div>
      <div className="editor-actions">
        <button type="button" className="btn" data-close-editor disabled={busy} onClick={onClose}><i className="bi bi-x-circle app-icon" aria-hidden="true"></i><span>{t("kitchen.actions.cancel")}</span></button>
        <button type="button" className="btn btn-primary" data-save-editor disabled={busy} onClick={() => onSave({ order, index, item, menuId, qty, note, activeMenus, maxQty })}><i className="bi bi-floppy app-icon" aria-hidden="true"></i><span>{t("kitchen.actions.save_edit")}</span></button>
      </div>
    </section>
  </div>;
}

export function KitchenPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, intlLocale, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("kitchen.meta_title"),
    bodyClass: "order-delivery-workspace kitchen-page",
    styles: [
      "app.css", "icons.css", "kitchen-item-editor.css", "sweet-dialog.css",
      "order-delivery-workspace-theme.css", "page-ready-state.css",
    ],
  });

  const [loading, setLoading] = useState(true);
  const [menuLoadError, setMenuLoadError] = useState("");
  const [orderLoadError, setOrderLoadError] = useState("");
  const loadError = menuLoadError || orderLoadError;
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [editor, setEditor] = useState(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const allowedRole = ["owner", "admin", "kitchen"].includes(profile?.role);
  useLalamoveAutoRefresh(tenant?.id, orders, allowedRole);

  const money = value => `${formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t("kitchen.units.currency")}`;
  const formatTime = value => {
    const date = valueToDate(value);
    if (!date) return "-";
    return new Intl.DateTimeFormat(intlLocale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  };

  useEffect(() => {
    if (!tenant?.id || !allowedRole) return undefined;
    let alive = true;
    setLoading(true);
    setMenuLoadError("");
    setOrderLoadError("");
    let menusSettled = false;
    let ordersSettled = false;
    const finish = () => {
      if (alive && menusSettled && ordersSettled) setLoading(false);
    };
    loadKitchenMenus(tenant.id)
      .then(rows => {
        if (!alive) return;
        setMenus(rows);
        setMenuLoadError("");
        menusSettled = true;
        finish();
      })
      .catch(error => {
        console.error("KITCHEN_MENUS_LOAD_FAILED", error);
        if (!alive) return;
        setMenus([]);
        setMenuLoadError(t("kitchen.loading.failed"));
        menusSettled = true;
        finish();
      });
    const stop = watchOperationalOrders(
      tenant.id,
      rows => {
        if (!alive) return;
        setOrders(rows);
        setOrderLoadError("");
        ordersSettled = true;
        finish();
      },
      error => {
        console.error("KITCHEN_ORDER_WATCH_FAILED", error);
        if (!alive) return;
        setOrders([]);
        setOrderLoadError(t("kitchen.loading.failed"));
        ordersSettled = true;
        finish();
      },
    );
    return () => { alive = false; stop?.(); };
  }, [tenant?.id, allowedRole, t]);

  // Opening Kitchen is read-only: Lalamove status uses the existing
  // bounded read-only fallback. Table settlement occurs only after a
  // signed served-item/status transition, never from page mount.

  const cards = useMemo(() => {
    const active = orders.filter(order =>
      !isWaitingQueuePlaceholder(order) &&
      (ACTIVE_STATUSES.has(order.status) || walkInKitchenPending(order)) &&
      !lalamoveDeliveryCompleted(order) && deliveryKitchenAdmitted(order));
    const tableGroups = new Map();
    active.filter(isTableOrder).forEach(order => {
      const key = tableGroupKey(order);
      if (!tableGroups.has(key)) tableGroups.set(key, []);
      tableGroups.get(key).push(order);
    });
    return [
      ...[...tableGroups.values()].map(group => ({
        type: "table",
        key: tableGroupKey(group[0]),
        group,
        queueDate: group[0]?.queueDate || "",
        sequence: queueSequence(group[0]),
        createdAt: displayTimeValue(group[0]),
      })),
      ...active.filter(order => !isTableOrder(order)).map(order => ({
        type: "order",
        key: order.id,
        order,
        queueDate: order.queueDate || "",
        sequence: queueSequence(order),
        createdAt: displayTimeValue(order),
      })),
    ].sort((a, b) => String(b.queueDate).localeCompare(String(a.queueDate))
      || b.sequence - a.sequence
      || (valueToDate(b.createdAt)?.getTime() || 0) - (valueToDate(a.createdAt)?.getTime() || 0));
  }, [orders]);

  // Exact operation ID persists across ambiguous network results; server
  // checks the original expectedRevision to reject stale client mutations.
  const kitchenOperationIds = useRef(new Map());
  const runKitchenAction = async (order, action, options = {}) => {
    const revision = Number(order?.kitchenRevision || 0);
    const indexKey = options.index ?? "";
    const key = [order.id,action,indexKey,revision].join(":");
    const operationId = kitchenOperationIds.current.get(key) ||
      ("kitchen-" + crypto.randomUUID());
    kitchenOperationIds.current.set(key,operationId);
    const result = await kitchenApplyOrderAction(tenant.id,order.id,action,{
      expectedRevision:revision,expectedStatus:order.status||"",
      expectedPaymentStatus:order.paymentStatus||"",operationId,...options,
    });
    if (!result?.item?.id || Number(result.item.kitchenRevision) < revision+1)
      throw new Error("KITCHEN_SERVER_CONFIRMATION_MISSING");
    kitchenOperationIds.current.delete(key);
    setOrders(current=>current.map(row=>row.id===order.id
      ?{...row,...result.item}:row));
    return result.item;
  };

  const cancelItem = async (order, itemIndex) => {
    if(!order || kitchenWorkLocked(order))return;
    if(order.orderType==="walkin" && order.paymentStatus==="paid"){
      showToast(t("quick_order.deferred.not_available"),"error");return;
    }
    const item=order.items?.[itemIndex];
    if(!item || item.cancelled)return;
    const ok=await sweetConfirm(
      t("kitchen.confirm.cancel_item_message",{item:item.name}),{
        title:t("kitchen.confirm.cancel_item_title"),
        confirmText:t("kitchen.confirm.ok"),cancelText:t("kitchen.confirm.cancel"),
        type:"warning",
      });
    if(!ok)return;
    try{
      let updated;
      if(order.orderType==="walkin"){
        const result=await updateDeferredWalkInKitchen(
          tenant.id,order.id,"cancel_item",{index:itemIndex});
        updated=result?.item;
        if(updated)setOrders(current=>current.map(row=>row.id===order.id?updated:row));
      }else updated=await runKitchenAction(order,"cancel_item",{index:itemIndex});
      if(!updated?.id)throw Error("KITCHEN_CANCEL_ITEM_READBACK_MISSING");
      if(isTableOrder(order) && updated.status==="cancelled"){
        try { await settleTableSession(tenant.id,order.id); }
        catch(error){ console.warn("KITCHEN_CANCELLED_TABLE_SETTLEMENT_PENDING",error?.code||error?.message); }
      }
      showToast(t(updated.status==="cancelled"?
        "kitchen.toast.order_cancelled_no_items":"kitchen.toast.item_cancelled"));
    }catch(error){
      console.error("KITCHEN_CANCEL_ITEM_FAILED",error?.code||error?.message);
      showToast(t("kitchen.toast.status_update_failed"),"error");
    }
  };

  const cancelOrder = async order => {
    if(!order || kitchenWorkLocked(order))return;
    const ok=await sweetConfirm(t("kitchen.confirm.cancel_order_message"),{
      title:t("kitchen.confirm.cancel_order_title"),
      confirmText:t("kitchen.confirm.ok"),cancelText:t("kitchen.confirm.cancel"),
      type:"warning",
    });
    if(!ok)return;
    try{
      let updated;
      if(order.orderType==="walkin" && order.paymentStatus==="paid"){
        const response=await cancelReviewedWalkIn(tenant.id,order.id,"kitchen");
        updated=response?.item;
        showToast(t("cashier.cancel_order.review_recorded"));
      }else if(order.orderType==="walkin" && order.paymentTiming==="after"){
        const response=await cancelUnpaidWalkIn(tenant.id,order.id,"kitchen");
        updated=response?.item;
        showToast(t("kitchen.toast.order_cancelled"));
      }else{
        updated=await runKitchenAction(order,"cancel_order");
        showToast(t("kitchen.toast.order_cancelled"));
      }
      if(!updated?.id)throw Error("KITCHEN_CANCEL_ORDER_READBACK_MISSING");
      if(isTableOrder(order) && updated.status==="cancelled"){
        try { await settleTableSession(tenant.id,order.id); }
        catch(error){ console.warn("KITCHEN_CANCELLED_TABLE_SETTLEMENT_PENDING",error?.code||error?.message); }
      }
      setOrders(current=>current.map(row=>row.id===order.id?{...row,...updated}:row));
    }catch(error){
      console.error("KITCHEN_CANCEL_ORDER_FAILED",error?.code||error?.message);
      showToast(t("kitchen.toast.status_update_failed"),"error");
    }
  };

  const serveItem = async (order,index) => {
    if(!canServeItem(order,order?.items?.[index])||kitchenWorkLocked(order))return;
    try{
      let updated;
      if(order.orderType==="walkin"){
        const response=await updateDeferredWalkInKitchen(
          tenant.id,order.id,"serve_item",{index});
        updated=response?.item;
        if(updated)setOrders(current=>current.map(row=>row.id===order.id?updated:row));
      }else updated=await runKitchenAction(order,"serve_item",{index});
      if(!updated?.id)throw Error("KITCHEN_SERVE_READBACK_MISSING");
      if(isTableOrder(order) && ["paid","served"].includes(updated.status)){
        await settleTableSession(tenant.id,order.id);
      }
      showToast(t(["paid","served"].includes(updated.status)?
        "kitchen.toast.order_served":"kitchen.toast.item_served"));
    }catch(error){
      console.error("KITCHEN_SERVE_ITEM_FAILED",error?.code||error?.message);
      showToast(t("kitchen.toast.item_serve_failed"),"error");
    }
  };

  const changeStatus = async (order,status) => {
    if(!order?.id || kitchenWorkLocked(order))return;
    try{
      let updated;
      if(order.orderType==="walkin"){
        const response=await updateDeferredWalkInKitchen(
          tenant.id,order.id,"status",{status});
        updated=response?.item;
        if(updated)setOrders(current=>current.map(row=>row.id===order.id?updated:row));
      }else updated=await runKitchenAction(order,"status",{status});
      if(!updated?.id)throw Error("KITCHEN_STATUS_READBACK_MISSING");
      if(status==="served" && isTableOrder(order)){
        await settleTableSession(tenant.id,order.id);
      }
      const key=isTakeaway(order)&&status==="served"?"kitchen.toast.takeaway_served":
        isTakeaway(order)&&status==="ready"?"kitchen.toast.takeaway_ready":
        updated.status==="paid"&&isDelivery(order)?"kitchen.toast.delivery_completed":null;
      showToast(key?t(key):t("kitchen.toast.status_changed",{
        status:t(`shared.status.${updated.status}`)}));
    }catch(error){
      console.error("KITCHEN_STATUS_UPDATE_FAILED",error?.code||error?.message);
      showToast(t("kitchen.toast.status_update_failed"),"error");
    }
  };

  const saveEditor = async ({order,index,item,menuId,qty,note,activeMenus,maxQty}) => {
    if(!order || kitchenWorkLocked(order)||editorBusy||isWalkIn(order))return;
    const selectedMenu=activeMenus.find(menu=>menu.id===menuId);
    const nextQty=Number(qty);
    const nextNote=String(note||"").trim();
    if(!selectedMenu||!Number.isSafeInteger(nextQty)||nextQty<1||nextQty>maxQty){
      showToast(t("kitchen.editor.invalid_menu_quantity"),"error");return;
    }
    if((nextQty!==Number(item.qty)||selectedMenu.id!==item.menuId)&&!nextNote){
      showToast(t("kitchen.editor.note_required"),"error");return;
    }
    setEditorBusy(true);
    try{
      await runKitchenAction(order,"edit_item",{
        index,menuId,qty:nextQty,note:nextNote,
      });
      setEditor(null);
      showToast(t("kitchen.toast.item_updated"));
    }catch(error){
      console.error("KITCHEN_ITEM_UPDATE_FAILED",error?.code||error?.message);
      showToast(t("kitchen.toast.item_update_failed"),"error");
    }finally{setEditorBusy(false);}
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (allowedRole && loading)) {
    return <PageReadyOverlay context={t("kitchen.brand")} title={t("kitchen.loading.title")} message={t("kitchen.loading.preparing")} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fkitchen" replace />;
  if (!allowedRole) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  const cardProps = {
    t,
    formatTime,
    money,
    onEditItem: (order, index) => { if (!kitchenWorkLocked(order) && !isWalkIn(order)
      && order?.items?.[index]?.cancelled !== true) setEditor({ order, index }); },
    onCancelItem: cancelItem,
    onServeItem: serveItem,
    onCancelOrder: cancelOrder,
    onStatus: changeStatus,
  };

  return (
    <>
      <header className="app-header">
        <div className="brand"><span className="brand-mark">PG</span>{t("kitchen.brand")}</div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <CashierOrderNotifier orders={orders} onToast={showToast} surface="kitchen" />
          <UserMenu profile={profile} />
        </div>
      </header>

      <div id="demoBanner"></div>

      <main className="container">
        <section className="hero">
          <h1>{t("kitchen.hero.title")}</h1>
          <p>{t("kitchen.hero.description")}</p>
        </section>

        {loadError ? <div className="card upload-error" role="alert">{loadError}</div> : null}
        <TelegramOrderFocus orders={cards.flatMap(card=>card.order?[card.order]:card.group||[])} role="kitchen" />
        <div id="orderGrid" className="grid grid-2">
          {cards.length ? cards.map(card => card.type === "table"
            ? <TableKitchenGroup {...cardProps} group={card.group} key={card.key} />
            : <KitchenOrderCard {...cardProps} order={card.order} key={card.key} />)
            : <div className="card empty">{t("kitchen.order.empty")}</div>}
        </div>
      </main>

      {editor ? <KitchenItemEditor
        editor={editor}
        menus={menus}
        busy={editorBusy}
        t={t}
        money={money}
        onClose={() => { if (!editorBusy) setEditor(null); }}
        onSave={saveEditor}
      /> : null}

      <ParityFooter />
    </>
  );
}
