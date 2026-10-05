import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { CashierOrderNotifier } from "@/components/CashierOrderNotifier";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { sweetConfirm } from "@/components/sweetDialog";
import {
  cancelOperationalOrder,
  loadOperationalSnapshot,
  refreshLalamoveDispatch,
  updateOperationalOrder,
  watchOperationalOrders,
} from "@/data/operationalData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const ACTIVE_STATUSES = new Set(["pending", "accepted", "cooking", "ready", "served"]);

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
function lalamoveStatus(order) { return String(order?.lalamoveOrderStatus || "").toUpperCase(); }
function isLalamoveDelivery(order) {
  return isDelivery(order) && String(order?.deliveryProvider || "").toLowerCase() === "lalamove";
}
function lalamoveDeliveryCompleted(order) {
  return isLalamoveDelivery(order) && lalamoveStatus(order) === "COMPLETED";
}
function lalamoveCompletionStale(order) {
  return lalamoveDeliveryCompleted(order)
    && !["paid", "completed"].includes(String(order?.status || "").toLowerCase());
}
function lalamoveDispatchActive(order) {
  return isLalamoveDelivery(order)
    && Boolean(order?.lalamoveOrderId)
    && !["PICKED_UP", "COMPLETED", "CANCELED", "CANCELLED", "REJECTED", "EXPIRED"].includes(lalamoveStatus(order));
}
function isKitchenLocked(order) {
  return ["served", "paid", "completed", "cancelled"].includes(order?.status) || lalamoveDispatchActive(order);
}
function recalculateOrder(order, items) {
  const subtotalAmount = items.filter(item => !item.cancelled)
    .reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  const deliveryFee = isDelivery(order) && subtotalAmount > 0 ? Number(order.deliveryFee || 0) : 0;
  return { subtotalAmount, deliveryFee, totalAmount: subtotalAmount + deliveryFee };
}

function nextActions(order, t) {
  const status = order?.status;
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
function KitchenInfo({ order, t }) {
  if (isDelivery(order)) {
    const paymentText = order.paymentStatus === "paid"
      ? t("kitchen.order.payment_paid")
      : String(order.paymentMethod || "").toLowerCase() === "cod"
        ? t("kitchen.order.payment_cod") : t("kitchen.order.payment_unpaid");
    return <p><span className={"badge" + (order.paymentStatus === "paid" ? "" : " warning")}>{paymentText}</span><br /><strong>{t("kitchen.order.phone")}</strong> {order.recipientPhone || "-"}<br /><strong>{t("kitchen.order.address")}</strong> {order.deliveryAddress || "-"}</p>;
  }
  if (isTakeaway(order)) return <p><span className="badge warning">{t("kitchen.order.takeaway_badge")}</span><br /><strong>{t("kitchen.order.customer")}</strong> {order.customerName || "-"}<br /><strong>{t("kitchen.order.phone")}</strong> {order.customerPhone || "-"}<br /><strong>{t("kitchen.order.queue")}</strong> {order.queueNo || "-"}</p>;
  if (isWalkIn(order)) {
    const tableText = order.serviceType === "dine_in"
      ? (order.tableCode ? t("quick_order.kitchen.table", { table: order.tableCode }) : t("quick_order.kitchen.table_unassigned"))
      : t("quick_order.service.takeaway");
    return <p><span className="badge">{t("quick_order.cashier.paid")}</span><br /><strong>{tableText}</strong>{order.customerName ? <><br />{order.customerName}</> : null}</p>;
  }
  return null;
}
function DeliverySummary({ order, t, money }) {
  if (!isDelivery(order)) return null;
  return <div className="card" style={{ marginTop: 10, padding: "10px 12px", boxShadow: "none", background: "#f8fbf9" }}>
    <div className="receipt-row"><span>{t("kitchen.order.delivery_zone")}</span><strong>{order.deliveryZoneLabel || "-"}</strong></div>
    <div className="receipt-row"><span>{t("kitchen.order.food_subtotal")}</span><strong>{money(order.subtotalAmount ?? (Number(order.totalAmount || 0) - Number(order.deliveryFee || 0)))}</strong></div>
    <div className="receipt-row"><span>{t("kitchen.order.delivery_fee")}</span><strong>{money(order.deliveryFee || 0)}</strong></div>
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
  order, nested = false, t, formatTime, money, onEditItem, onCancelItem, onCancelOrder, onStatus,
}) {
  const locked = isKitchenLocked(order);
  const overdue = ["pending", "accepted", "cooking"].includes(order?.status) && ageMinutes(order) >= 15;
  const statusText = isTakeaway(order) && order.status === "ready"
    ? t("kitchen.states.ready_to_serve")
    : t(`shared.status.${order.status || "pending"}`);
  const heading = nested ? (
    <div><h3 style={{ margin: 0 }}>{t("kitchen.order.round_title", { round: order.roundNumber || 1 })}</h3><small>{formatTime(displayTimeValue(order))}</small></div>
  ) : (
    <div className="order-heading-with-queue">
      <span className="order-queue-badge"><small>{t("kitchen.order.queue")}</small><strong>{order.queueNo || "-"}</strong></span>
      <div><h2 style={{ margin: 0 }}>{orderTitle(order, t)}</h2><small>{formatTime(displayTimeValue(order))}</small></div>
    </div>
  );
  const Tag = nested ? "section" : "article";
  return <Tag className={[
    "card", "order-card", nested ? "table-round-card" : "",
    isTakeaway(order) ? "takeaway-kitchen-card" : "",
    isWalkIn(order) ? "walkin-kitchen-card" : "",
    overdue ? "kitchen-order-overdue" : "",
  ].filter(Boolean).join(" ")}>
    <div className="order-head">{heading}<span className={"badge" + (isTakeaway(order) ? " warning" : "")}>{statusText}</span></div>
    {overdue ? <span className="badge warning kitchen-overdue-badge">{t("kitchen.order.overdue", { count: ageMinutes(order) })}</span> : null}
    <KitchenInfo order={order} t={t} />
    <ul className="order-items">
      {(order.items || []).map((item, index) => (
        <li key={`${order.id}-${index}`} style={item.cancelled ? { opacity: .48, textDecoration: "line-through" } : undefined}>
          <strong>{Number(item.qty || 0)} × {String(item.name || "")}{item.isGift === true ? ` ${t("kitchen.order.gift_suffix")}` : ""}</strong>
          {item.note ? <><br /><small>{t("kitchen.order.item_note")} {item.note}</small></> : null}
          {item.cancelled ? <><br /><small>{t("kitchen.states.cancelled")}</small></>
            : locked ? <div className="kitchen-item-actions"><span className="badge">{lockedItemLabel(order, t)}</span></div>
              : <div className="kitchen-item-actions">
                  <button className="btn btn-sm" type="button" data-edit-item={order.id} data-item-index={index} onClick={() => onEditItem(order, index)}><i className="bi bi-pencil" aria-hidden="true"></i><span>{t("kitchen.actions.edit")}</span></button>
                  <button className="btn btn-danger btn-sm" type="button" data-cancel-item={order.id} data-item-index={index} onClick={() => onCancelItem(order, index)}><i className="bi bi-x-circle app-icon" aria-hidden="true"></i><span>{t("kitchen.actions.cancel")}</span></button>
                </div>}
        </li>
      ))}
    </ul>
    <DeliverySummary order={order} t={t} money={money} />
    <LalamoveNotice order={order} t={t} />
    {order.note ? <p><strong>{t("kitchen.order.order_note")}</strong> {order.note}</p> : null}
    <div className="order-head" style={{ marginTop: 10 }}><strong>{t("kitchen.order.net_total")}</strong><strong className="price">{money(order.totalAmount)}</strong></div>
    <div className="order-actions kitchen-order-actions" style={{ marginTop: 12 }}>
      {nextActions(order, t).map(([status, label, cls, icon, actionClass]) => (
        <button className={`btn ${cls} kitchen-status-action ${actionClass || ""}`} type="button" data-id={order.id} data-status={status} aria-label={label} key={status} onClick={() => onStatus(order, status)}>
          <i className={`bi bi-${icon}`} aria-hidden="true"></i><span>{label}</span>
        </button>
      ))}
      {!locked ? <button className="btn btn-danger" type="button" data-cancel-order={order.id} onClick={() => onCancelOrder(order)}><i className="bi bi-x-circle app-icon" aria-hidden="true"></i><span>{t("kitchen.actions.cancel_order")}</span></button> : null}
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
      <h2 id="kitchenItemEditorTitle">{t("kitchen.editor.title")}</h2>
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
        <button type="button" className="btn" data-close-editor disabled={busy} onClick={onClose}>{t("kitchen.actions.cancel")}</button>
        <button type="button" className="btn btn-primary" data-save-editor disabled={busy} onClick={() => onSave({ order, index, item, menuId, qty, note, activeMenus, maxQty })}>{t("kitchen.actions.save_edit")}</button>
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
  const [loadError, setLoadError] = useState("");
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [editor, setEditor] = useState(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const completionRepairRef = useRef(new Set());
  const allowedRole = ["owner", "admin", "kitchen"].includes(profile?.role);

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
    setLoadError("");
    loadOperationalSnapshot(tenant.id)
      .then(snapshot => {
        if (!alive) return;
        setMenus(snapshot.menus || []);
        setOrders(snapshot.orders || []);
        setLoading(false);
      })
      .catch(error => {
        console.error("KITCHEN_INITIAL_LOAD_FAILED", error);
        if (!alive) return;
        setLoadError(t("kitchen.loading.failed"));
        setLoading(false);
      });
    const stop = watchOperationalOrders(
      tenant.id,
      rows => { if (alive) { setOrders(rows); setLoading(false); } },
      error => {
        console.error("KITCHEN_ORDER_WATCH_FAILED", error);
        if (alive) setLoadError(t("kitchen.loading.failed"));
      },
    );
    return () => { alive = false; stop?.(); };
  }, [tenant?.id, allowedRole, t]);

  useEffect(() => {
    if (!tenant?.id || !allowedRole) return;
    orders.filter(lalamoveCompletionStale).forEach(order => {
      const orderId = String(order.id || "");
      if (!orderId || completionRepairRef.current.has(orderId)) return;
      completionRepairRef.current.add(orderId);
      refreshLalamoveDispatch(tenant.id, orderId).catch(error => {
        console.warn("KITCHEN_LALAMOVE_COMPLETION_REPAIR_FAILED", orderId, error);
        window.setTimeout(() => completionRepairRef.current.delete(orderId), 10000);
      });
    });
  }, [tenant?.id, allowedRole, orders]);

  const cards = useMemo(() => {
    const active = orders.filter(order => ACTIVE_STATUSES.has(order.status) && !lalamoveDeliveryCompleted(order));
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

  const updateOrder = async (orderId, patch) => {
    if (!tenant?.id) throw new Error("TENANT_REQUIRED");
    const updated = await updateOperationalOrder(tenant.id, orderId, patch);
    setOrders(current => current.map(row => row.id === orderId ? updated : row));
    return updated;
  };

  const cancelItem = async (order, itemIndex) => {
    if (!order || isKitchenLocked(order)) return;
    const selectedItem = order.items?.[itemIndex];
    if (!selectedItem || selectedItem.cancelled) return;
    const ok = await sweetConfirm(
      t("kitchen.confirm.cancel_item_message", { item: selectedItem.name }),
      {
        title: t("kitchen.confirm.cancel_item_title"),
        confirmText: t("kitchen.confirm.ok"),
        cancelText: t("kitchen.confirm.cancel"),
        type: "warning",
      },
    );
    if (!ok) return;
    try {
      const items = order.items.map((item, index) => index === itemIndex
        ? { ...item, cancelled: true, cancelledAt: new Date().toISOString() }
        : item);
      const totals = recalculateOrder(order, items);
      const patch = { items, ...totals };
      if (totals.subtotalAmount <= 0) patch.status = "cancelled";
      await updateOrder(order.id, patch);
      showToast(t(totals.subtotalAmount <= 0
        ? "kitchen.toast.order_cancelled_no_items"
        : "kitchen.toast.item_cancelled"));
    } catch (error) {
      console.error("KITCHEN_CANCEL_ITEM_FAILED", error);
      showToast(t("kitchen.toast.status_update_failed"), "error");
    }
  };

  const cancelOrder = async order => {
    if (!order || isKitchenLocked(order)) return;
    const ok = await sweetConfirm(
      t("kitchen.confirm.cancel_order_message"),
      {
        title: t("kitchen.confirm.cancel_order_title"),
        confirmText: t("kitchen.confirm.ok"),
        cancelText: t("kitchen.confirm.cancel"),
        type: "warning",
      },
    );
    if (!ok) return;
    const optimistic = {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    };
    setOrders(current => current.map(row => row.id === order.id ? { ...row, ...optimistic } : row));
    try {
      const cancelled = await cancelOperationalOrder(tenant.id, order.id);
      setOrders(current => current.map(row => row.id === order.id ? { ...row, ...cancelled } : row));
      showToast(t("kitchen.toast.order_cancelled"));
    } catch (error) {
      setOrders(current => current.map(row => row.id === order.id ? order : row));
      console.error("KITCHEN_CANCEL_ORDER_FAILED", error);
      showToast(t("kitchen.toast.status_update_failed"), "error");
    }
  };

  const changeStatus = async (order, status) => {
    if (!order?.id || isKitchenLocked(order)) return;
    const patch = { status };
    if (status === "served") patch.servedAt = new Date().toISOString();
    if (isTakeaway(order) && status === "ready") patch.pickupStatus = "ready";
    if (isTakeaway(order) && status === "served") patch.pickupStatus = "served";
    if (isDelivery(order) && status === "served" && order.paymentStatus === "paid") {
      patch.status = "paid";
      patch.completedAt = new Date().toISOString();
    }
    if (isWalkIn(order) && status === "served" && order.paymentStatus === "paid") {
      patch.status = "paid";
      patch.completedAt = new Date().toISOString();
    }
    try {
      await updateOrder(order.id, patch);
      const key = isTakeaway(order) && patch.status === "served"
        ? "kitchen.toast.takeaway_served"
        : isTakeaway(order) && patch.status === "ready"
          ? "kitchen.toast.takeaway_ready"
          : patch.status === "paid" && isDelivery(order)
            ? "kitchen.toast.delivery_completed"
            : null;
      showToast(key
        ? t(key)
        : t("kitchen.toast.status_changed", { status: t(`shared.status.${patch.status}`) }));
    } catch (error) {
      console.error("KITCHEN_STATUS_UPDATE_FAILED", error);
      showToast(t("kitchen.toast.status_update_failed"), "error");
    }
  };

  const saveEditor = async ({ order, index, item, menuId, qty, note, activeMenus, maxQty }) => {
    if (!order || isKitchenLocked(order) || editorBusy) return;
    const selectedMenu = activeMenus.find(menu => menu.id === menuId);
    const nextQty = Number(qty);
    const nextNote = String(note || "").trim();
    if (!selectedMenu || !Number.isInteger(nextQty) || nextQty < 1 || nextQty > maxQty) {
      showToast(t("kitchen.editor.invalid_menu_quantity"), "error");
      return;
    }
    if ((nextQty !== Number(item.qty) || selectedMenu.id !== item.menuId) && !nextNote) {
      showToast(t("kitchen.editor.note_required"), "error");
      return;
    }
    const items = order.items.map((row, itemIndex) => itemIndex !== index ? row : {
      ...row,
      originalQty: row.originalQty || row.qty,
      originalName: row.originalName || row.name,
      menuId: selectedMenu.id,
      name: selectedMenu.name,
      price: Number(selectedMenu.price),
      qty: nextQty,
      note: nextNote,
      replacedFromName: selectedMenu.id !== row.menuId
        ? (row.replacedFromName || row.name)
        : row.replacedFromName || "",
      updatedByKitchenAt: new Date().toISOString(),
    });
    const totals = recalculateOrder(order, items);
    setEditorBusy(true);
    try {
      await updateOrder(order.id, {
        items,
        ...totals,
        kitchenAdjustedAt: new Date().toISOString(),
      });
      setEditor(null);
      showToast(t("kitchen.toast.item_updated"));
    } catch (error) {
      console.error("KITCHEN_ITEM_UPDATE_FAILED", error);
      showToast(t("kitchen.toast.item_update_failed"), "error");
    } finally {
      setEditorBusy(false);
    }
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (allowedRole && loading)) {
    return <PageReadyOverlay context={t("kitchen.brand")} title={t("kitchen.loading.title")} message={t("kitchen.loading.preparing")} progress={76} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fkitchen" replace />;
  if (!allowedRole) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  const cardProps = {
    t,
    formatTime,
    money,
    onEditItem: (order, index) => { if (!isKitchenLocked(order)) setEditor({ order, index }); },
    onCancelItem: cancelItem,
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
