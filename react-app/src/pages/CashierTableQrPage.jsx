import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { sweetAlert, sweetConfirm } from "@/components/sweetDialog";
import {
  assignWalkInTable,
  getOperationalTable,
  loadOperationalSnapshot,
  updateOperationalTable,
  watchOperationalOrders,
  watchOperationalTables,
} from "@/data/operationalData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";
import { qrDataUrl } from "@/utils/localQr";

const ALLOWED = new Set(["owner", "admin", "manager", "cashier"]);

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

function createOrderToken() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isWalkInTable(table) {
  return String(table?.occupancyType || "").toLowerCase() === "walkin"
    || String(table?.walkInOrderId || "").trim() !== "";
}

function walkInOrderForTable(table, orders) {
  const orderId = String(table?.walkInOrderId || "").trim();
  const tableCode = String(table?.code || table?.id || "").trim().toUpperCase();
  return orders.find(order => orderId && String(order?.id || "") === orderId)
    || orders.find(order =>
      order?.orderType === "walkin"
      && order?.serviceType === "dine_in"
      && String(order?.tableCode || "").trim().toUpperCase() === tableCode
      && !["paid", "cancelled", "voided", "deleted", "completed"].includes(String(order?.status || "").toLowerCase())
    )
    || null;
}

function hasUnpaidTableOrders(table, orders) {
  const tableCode = String(table?.code || table?.id || "");
  const tableToken = String(table?.orderToken || "");
  return orders.some(order => {
    if (order?.orderType === "delivery") return false;
    if (["paid", "cancelled"].includes(order?.status)) return false;
    if (order?.paymentStatus === "paid") return false;
    const sameToken = tableToken && String(order?.tableToken || "") === tableToken;
    const sameTable = tableCode && String(order?.tableCode || "") === tableCode;
    return sameToken || sameTable;
  });
}

export function CashierTableQrPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t } = useI18n();
  const stylesReady = useParityPage({
    title: t("cashier_documents.table_qr.meta_title"),
    bodyClass: "order-delivery-workspace od-qr-page",
    styles: [
      "app.css", "menu-qr.css", "cashier-qr-print.css", "icons.css",
      "sweet-dialog.css", "order-delivery-workspace-theme.css",
    ],
    attributes: { "data-roles": "owner,admin,manager,cashier" },
  });
  const allowed = ALLOWED.has(profile?.role);

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [ticket, setTicket] = useState(null);
  const [moveTargets, setMoveTargets] = useState({});
  const [paperSize, setPaperSizeState] = useState(() => {
    try { return localStorage.getItem("qr_paper_size") || "80"; } catch { return "80"; }
  });
  const printRequestRef = useRef(0);

  useEffect(() => {
    document.body.classList.remove("qr-size-58", "qr-size-80", "qr-size-a4");
    document.body.classList.add(paperSize === "58" ? "qr-size-58" : paperSize === "a4" ? "qr-size-a4" : "qr-size-80");
    try { localStorage.setItem("qr_paper_size", paperSize); } catch {}
    return () => document.body.classList.remove("qr-size-58", "qr-size-80", "qr-size-a4", "qr-printing");
  }, [paperSize]);

  useEffect(() => {
    if (!tenant?.id || !allowed) return undefined;
    let alive = true;
    let stopOrders = () => {};
    let stopTables = () => {};
    loadOperationalSnapshot(tenant.id)
      .then(data => {
        if (!alive) return;
        setOrders(data.orders || []);
        setTables(data.tables || []);
        setLoading(false);
        stopOrders = watchOperationalOrders(tenant.id, rows => { if (alive) setOrders(rows || []); });
        stopTables = watchOperationalTables(tenant.id, rows => { if (alive) setTables(rows || []); });
      })
      .catch(error => {
        console.error("TABLE_QR_LOAD_FAILED", error);
        if (alive) {
          setLoading(false);
          showToast(t("cashier_documents.table_qr.qr_failed", { code: error?.code || "LOAD_FAILED" }), "error");
        }
      });
    return () => {
      alive = false;
      stopOrders();
      stopTables();
    };
  }, [tenant?.id, allowed, t]);

  useEffect(() => {
    const afterPrint = () => document.body.classList.remove("qr-printing");
    window.addEventListener("afterprint", afterPrint);
    return () => window.removeEventListener("afterprint", afterPrint);
  }, []);

  const available = useMemo(() => tables.filter(table =>
    table.active !== false
    && !isWalkInTable(table)
    && (!table.status || table.status === "available")
    && !String(table.orderToken || "").trim()
  ), [tables]);
  const occupied = useMemo(() => tables.filter(table =>
    table.active !== false
    && !isWalkInTable(table)
    && table.status === "occupied"
    && String(table.orderToken || "").trim() !== ""
  ), [tables]);
  const walkIns = useMemo(() => tables.filter(table => table.active !== false && isWalkInTable(table)), [tables]);

  const availableMoveTargets = currentTable => tables.filter(table =>
    table?.active !== false
    && !isWalkInTable(table)
    && (!table?.status || table.status === "available")
    && !String(table?.orderToken || "").trim()
    && String(table?.id || "") !== String(currentTable?.id || "")
  );

  const qrErrorMessage = error => {
    const code = String(error?.code || error?.message || "UNKNOWN_ERROR");
    if (code.includes("TABLE_HAS_UNPAID_ORDERS")) return t("cashier_documents.table_qr.unpaid_orders");
    if (code.includes("permission-denied")) return t("cashier_documents.table_qr.permission_denied");
    if (code.includes("TENANT_CONTEXT_REQUIRED") || code.includes("TENANT_NOT_RESOLVED")) return t("cashier_documents.table_qr.tenant_missing");
    if (code.includes("not-found") || code.includes("TABLE_NOT_FOUND")) return t("cashier_documents.table_qr.table_not_found");
    return t("cashier_documents.table_qr.qr_failed", { code });
  };

  const tableOrderUrl = (table, token) => {
    const url = new URL(`/s/${encodeURIComponent(tenant?.slug || "")}/order/`, location.origin);
    url.searchParams.set("table", table.code || "");
    url.searchParams.set("token", token || "");
    return url.toString();
  };

  const requestPrint = nextTicket => {
    setTicket(nextTicket);
    printRequestRef.current += 1;
    const requestId = printRequestRef.current;
    window.setTimeout(async () => {
      if (requestId !== printRequestRef.current) return;
      document.body.classList.add("qr-printing");
      const image = document.querySelector("#issuedQr img");
      if (image && !image.complete) {
        await Promise.race([
          new Promise(resolve => image.addEventListener("load", resolve, { once: true })),
          new Promise(resolve => image.addEventListener("error", resolve, { once: true })),
          new Promise(resolve => setTimeout(resolve, 1500)),
        ]);
      }
      requestAnimationFrame(() => window.print());
    }, 30);
  };

  const issueTable = async table => {
    if (!tenant?.id || busyKey) return;
    setBusyKey(`issue:${table.id}`);
    try {
      const latest = await getOperationalTable(tenant.id, table.id);
      if (!latest || (latest.status && latest.status !== "available") || String(latest.orderToken || "").trim()) {
        showToast(t("cashier_documents.table_qr.table_unavailable"), "error");
        return;
      }
      const token = createOrderToken();
      const updated = await updateOperationalTable(tenant.id, table.id, {
        status: "occupied",
        orderToken: token,
        currentRound: 0,
        orderIds: [],
        sessionStartedAt: new Date().toISOString(),
      });
      requestPrint({ table: updated, token });
    } catch (error) {
      console.error("TABLE_QR_ISSUE_FAILED", error);
      showToast(qrErrorMessage(error), "error");
    } finally {
      setBusyKey("");
    }
  };

  const reprintTable = async table => {
    if (!tenant?.id || busyKey) return;
    setBusyKey(`reprint:${table.id}`);
    try {
      const latest = await getOperationalTable(tenant.id, table.id);
      if (!latest || latest.status !== "occupied" || !latest.orderToken) {
        showToast(t("cashier_documents.table_qr.expired"), "error");
        return;
      }
      requestPrint({ table: latest, token: latest.orderToken });
    } catch (error) {
      console.error("TABLE_QR_REPRINT_FAILED", error);
      showToast(qrErrorMessage(error), "error");
    } finally {
      setBusyKey("");
    }
  };

  const closeTable = async table => {
    if (!tenant?.id || busyKey) return;
    try {
      const latest = await getOperationalTable(tenant.id, table.id);
      const target = latest || table;
      if (hasUnpaidTableOrders(target, orders)) {
        showToast(t("cashier_documents.table_qr.unpaid_orders"), "error");
        return;
      }
      const label = table.name || t("cashier_documents.table_qr.table_fallback", { table: table.code || table.id });
      const ok = await sweetConfirm(
        `${t("cashier_documents.table_qr.close_confirm_message", { table: label })}\n\n${t("cashier_documents.table_qr.close_confirm_warning")}`,
        {
          title: t("cashier_documents.table_qr.close_confirm_title"),
          confirmText: t("cashier.common.confirm"),
          cancelText: t("cashier.common.cancel"),
          type: "warning",
        },
      );
      if (!ok) return;
      setBusyKey(`close:${table.id}`);
      await updateOperationalTable(tenant.id, table.id, {
        status: "available",
        orderToken: "",
        sessionStartedAt: null,
        currentRound: 0,
        orderIds: [],
      });
      showToast(t("cashier_documents.table_qr.close_success", { table: label }));
    } catch (error) {
      console.error("TABLE_CLOSE_FAILED", error);
      showToast(qrErrorMessage(error), "error");
    } finally {
      setBusyKey("");
    }
  };

  const viewWalkIn = async table => {
    const order = walkInOrderForTable(table, orders);
    const queue = String(order?.queueNo || table?.walkInQueueNo || "-");
    const customer = String(order?.customerName || "").trim() || t("cashier_documents.table_qr.walkin_customer_fallback");
    await sweetAlert(t("cashier_documents.table_qr.walkin_detail_message", {
      queue,
      customer,
      table: table.name || table.code || table.id,
    }), {
      title: t("cashier_documents.table_qr.walkin_detail_title"),
      type: "warning",
      confirmText: t("cashier.common.confirm"),
    });
  };

  const moveWalkIn = async table => {
    if (!tenant?.id || busyKey) return;
    const order = walkInOrderForTable(table, orders);
    const targetCode = String(moveTargets[table.id] || "").trim();
    if (!order) return showToast(t("cashier_documents.table_qr.walkin_order_missing"), "error");
    if (!targetCode) return showToast(t("cashier_documents.table_qr.move_target_required"), "error");
    const target = tables.find(item => String(item.code || item.id) === targetCode);
    const ok = await sweetConfirm(t("cashier_documents.table_qr.move_confirm_message", {
      from: table.name || table.code || table.id,
      to: target?.name || targetCode,
    }), {
      title: t("cashier_documents.table_qr.move_confirm_title"),
      confirmText: t("cashier_documents.table_qr.move_walkin"),
      cancelText: t("cashier.common.cancel"),
      type: "warning",
    });
    if (!ok) return;
    setBusyKey(`move:${table.id}`);
    try {
      await assignWalkInTable(tenant.id, order.id, targetCode);
      showToast(t("cashier_documents.table_qr.move_success", {
        from: table.name || table.code || table.id,
        to: target?.name || targetCode,
      }));
    } catch (error) {
      console.error("WALK_IN_TABLE_MOVE_FAILED", error);
      showToast(t(error?.code === "TABLE_NOT_AVAILABLE"
        ? "cashier_documents.table_qr.table_unavailable"
        : "cashier_documents.table_qr.move_failed"), "error");
    } finally {
      setBusyKey("");
    }
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (allowed && loading)) {
    return <PageReadyOverlay context={t("cashier_documents.table_qr.header_title")} title={t("cashier.loading.title")} message={t("cashier.loading.preparing")} progress={76} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fcashier%2Ftable-qr" replace />;
  if (!allowed) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  const ticketUrl = ticket ? tableOrderUrl(ticket.table, ticket.token) : "";
  const ticketQr = ticketUrl ? qrDataUrl(ticketUrl, { size: 320, margin: 4 }) : "";

  return (
    <>
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div className="brand"><span className="brand-mark">FO</span>{t("cashier_documents.table_qr.header_title")}</div>
          <Link className="btn btn-sm" to="/cashier"><i className="bi bi-arrow-left app-icon" aria-hidden="true"></i><span>{t("cashier_documents.table_qr.back")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <div id="demoBanner"></div>
      <main className="container">
        <section className="hero">
          <h1>{t("cashier_documents.table_qr.hero_title")}</h1>
          <p>{t("cashier_documents.table_qr.hero_description")}</p>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="field">
            <label htmlFor="qrPaperSize">{t("cashier_documents.table_qr.paper_size")}</label>
            <select className="input" id="qrPaperSize" value={paperSize} onChange={event => setPaperSizeState(event.target.value)}>
              <option value="80">{t("cashier_documents.table_qr.paper_80")}</option>
              <option value="58">{t("cashier_documents.table_qr.paper_58")}</option>
              <option value="a4">A4</option>
            </select>
          </div>
        </section>

        <section>
          <div className="section-title">
            <h2>{t("cashier_documents.table_qr.available_title")}</h2>
            <span className="badge" id="availableCount">{t("cashier_documents.table_qr.table_count", { count: available.length })}</span>
          </div>
          <div id="availableTables" className="grid grid-3">
            {available.length ? available.map(table => (
              <article className="card" key={table.id}>
                <h2 style={{ marginTop: 0 }}>{table.name || table.code || table.id}</h2>
                <div className="badge">{t("cashier_documents.table_qr.status_available")}</div>
                <button className="btn btn-primary" type="button" style={{ width: "100%", marginTop: 14 }} disabled={Boolean(busyKey)} onClick={() => issueTable(table)}>
                  {busyKey === `issue:${table.id}` ? t("cashier_documents.table_qr.issuing") : t("cashier_documents.table_qr.issue_print")}
                </button>
              </article>
            )) : <div className="card empty">{t("cashier_documents.table_qr.no_available_tables")}</div>}
          </div>
        </section>

        <section style={{ marginTop: 22 }}>
          <div className="section-title">
            <h2>{t("cashier_documents.table_qr.issued_title")}</h2>
            <span className="badge warning" id="occupiedCount">{t("cashier_documents.table_qr.table_count", { count: occupied.length })}</span>
          </div>
          <div id="occupiedTables" className="grid grid-3">
            {occupied.length ? occupied.map(table => (
              <article className="card order-card" key={table.id}>
                <h2 style={{ marginTop: 0 }}>{table.name || table.code || table.id}</h2>
                <div className="badge warning">{t("cashier_documents.table_qr.status_issued")}</div>
                <p className="menu-category" style={{ marginBottom: 0 }}>{t("cashier_documents.table_qr.occupied_help")}</p>
                <div className="order-actions" style={{ marginTop: 14 }}>
                  <button className="btn btn-dark" type="button" disabled={Boolean(busyKey)} onClick={() => reprintTable(table)}>
                    <i className="bi bi-printer app-icon" aria-hidden="true"></i>
                    <span>{busyKey === `reprint:${table.id}` ? t("cashier_documents.table_qr.reprint_preparing") : t("cashier_documents.table_qr.reprint")}</span>
                  </button>
                  <button className="btn btn-danger" type="button" disabled={Boolean(busyKey)} onClick={() => closeTable(table)}>
                    <i className="bi bi-door-closed app-icon" aria-hidden="true"></i>
                    <span>{busyKey === `close:${table.id}` ? t("cashier_documents.table_qr.closing") : t("cashier_documents.table_qr.close_table")}</span>
                  </button>
                </div>
              </article>
            )) : <div className="card empty">{t("cashier_documents.table_qr.no_issued_tables")}</div>}
          </div>
        </section>

        <section style={{ marginTop: 22 }}>
          <div className="section-title">
            <h2>{t("cashier_documents.table_qr.walkin_title")}</h2>
            <span className="badge warning" id="walkInCount">{t("cashier_documents.table_qr.table_count", { count: walkIns.length })}</span>
          </div>
          <div id="walkInTables" className="grid grid-3">
            {walkIns.length ? walkIns.map(table => {
              const order = walkInOrderForTable(table, orders);
              const queue = String(order?.queueNo || table?.walkInQueueNo || "-");
              const customer = String(order?.customerName || "").trim() || t("cashier_documents.table_qr.walkin_customer_fallback");
              const targets = availableMoveTargets(table);
              return (
                <article className="card order-card" key={table.id} data-walkin-table-card={table.id}>
                  <h2 style={{ marginTop: 0 }}>{table.name || table.code || table.id}</h2>
                  <div className="badge warning">{t("cashier_documents.table_qr.status_walkin")}</div>
                  <p className="menu-category" style={{ marginBottom: 8 }}>{t("cashier_documents.table_qr.walkin_summary", { queue, customer })}</p>
                  <div className="order-actions" style={{ marginTop: 10 }}>
                    <button className="btn btn-dark" type="button" onClick={() => viewWalkIn(table)}>{t("cashier_documents.table_qr.walkin_view")}</button>
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>{t("cashier_documents.table_qr.move_to")}</label>
                    <select className="input" value={moveTargets[table.id] || ""} disabled={!targets.length || !order} onChange={event => setMoveTargets(current => ({ ...current, [table.id]: event.target.value }))}>
                      <option value="">{targets.length ? t("cashier_documents.table_qr.move_placeholder") : t("cashier_documents.table_qr.no_move_target")}</option>
                      {targets.map(target => <option value={target.code || target.id} key={target.id}>{target.name || target.code || target.id}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" type="button" style={{ width: "100%", marginTop: 10 }} disabled={!targets.length || !order || Boolean(busyKey)} onClick={() => moveWalkIn(table)}>
                    {t("cashier_documents.table_qr.move_walkin")}
                  </button>
                </article>
              );
            }) : <div className="card empty">{t("cashier_documents.table_qr.no_walkin_tables")}</div>}
          </div>
        </section>

        {ticket ? (
          <section id="issuedQrWrap" style={{ marginTop: 18 }}>
            <div id="issuedQr">
              <article className="card qr-card print-target">
                <div className="qr-ticket">
                  <div className="qr-ticket-header">
                    <div className="qr-ticket-brand">FOOD ORDER QR</div>
                    <div className="qr-ticket-title">{t("cashier_documents.table_qr.ticket_title")}</div>
                    <div className="qr-ticket-table">{ticket.table.name}</div>
                  </div>
                  <div className="qr-ticket-rule"></div>
                  <div className="qr-ticket-code"><img src={ticketQr} width="260" height="260" alt={t("cashier_documents.table_qr.qr_alt", { table: ticket.table.name })} /></div>
                  <div className="qr-ticket-rule"></div>
                  <div className="qr-ticket-steps">
                    <div>{t("cashier_documents.table_qr.ticket_step_camera")}</div>
                    <div>{t("cashier_documents.table_qr.ticket_step_scan")}</div>
                    <div>{t("cashier_documents.table_qr.ticket_step_order")}</div>
                  </div>
                  <div className="qr-ticket-footer">{t("cashier_documents.table_qr.ticket_footer", { table: ticket.table.name })}<br />{t("cashier_documents.table_qr.ticket_footer_check")}</div>
                </div>
                <button className="btn btn-dark" id="printIssuedQr" type="button" style={{ marginTop: 12 }} onClick={() => requestPrint(ticket)}>{t("cashier_documents.table_qr.print_again")}</button>
              </article>
            </div>
          </section>
        ) : null}
      </main>
      <ParityFooter />
    </>
  );
}
