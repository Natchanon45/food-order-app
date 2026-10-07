import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { sweetConfirm } from "@/components/sweetDialog";
import {
  PublicCartList, PublicMenuCatalog, PublicStorefrontFooter, PublicStorefrontHeader, showStorefrontToast,
} from "@/components/PublicStorefront";
import {
  createPublicTableOrder, findPublicTableSession, getPublicTable, listPublicMenus, resolvePublicTenant, watchPublicTableOrders,
} from "@/data/publicStorefrontData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Number.isFinite(value?.seconds)) return Number(value.seconds) * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PublicOrderPage() {
  const { slug = "" } = useParams();
  const { t, intlLocale, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("order.meta.title"),
    bodyClass: "order-delivery-workspace table-order-page",
    styles: [
      "app.css", "menu-qr.css", "customer-rounds.css", "menu-pagination.css", "icons.css",
      "pos-refresh.css", "table-order-sticky-lite.css", "sweet-dialog.css",
      "order-delivery-workspace-theme.css", "public-menu-image-frame.css", "i18n.css",
      "shared-responsive.css", "toast-system.css", "ui-layer-stack.css",
    ],
  });
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const requestedTable = String(params.get("table") || params.get("code") || "").trim();
  const tableToken = String(params.get("token") || "").trim();
  const [tenant, setTenant] = useState(null);
  const [activeTable, setActiveTable] = useState(null);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("__all__");
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState({});
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeCode = String(activeTable?.code || activeTable?.id || requestedTable || "");
  const activeName = String(activeTable?.name || (activeCode ? t("order.table.name", { table: activeCode }) : ""));
  const validSession = Boolean(activeTable && tableToken && activeTable.status === "occupied" && activeTable.orderToken === tableToken);
  const visibleOrders = useMemo(() => orders
    .filter(order => order?.tableToken === tableToken && !["paid", "cancelled"].includes(order?.status) && order?.paymentStatus !== "paid")
    .sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0) || timestampValue(a.createdAt) - timestampValue(b.createdAt)),
    [orders, tableToken]);
  const nextRound = visibleOrders.reduce((max, order) => Math.max(max, Number(order.roundNumber || 0)), 0) + 1;
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const totalQty = cartItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const total = cartItems.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatTime = value => {
    const millis = timestampValue(value);
    if (!millis) return "-";
    return new Intl.DateTimeFormat(intlLocale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(millis));
  };

  useEffect(() => {
    let alive = true;
    let poll = 0;
    const bootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        if (!requestedTable) throw new Error("INVALID_TABLE_SESSION");
        const resolvedTenant = await resolvePublicTenant(slug);
        if (!alive) return;
        setTenant(resolvedTenant);

        let table = await getPublicTable(resolvedTenant, requestedTable);
        const directToken = String(table?.orderToken || "").trim();
        const directActive = Boolean(table && table.active !== false && table.status === "occupied" && directToken);
        if (!directActive) {
          table = tableToken ? await findPublicTableSession(resolvedTenant, requestedTable, tableToken) : null;
        }

        if (table) {
          const resolvedCode = String(table.code || table.id || requestedTable).trim();
          const resolvedToken = String(table.orderToken || "").trim();
          if (resolvedCode && resolvedToken && (resolvedCode !== requestedTable || resolvedToken !== tableToken)) {
            const nextParams = new URLSearchParams(location.search);
            nextParams.set("table", resolvedCode);
            nextParams.delete("code");
            nextParams.set("token", resolvedToken);
            location.replace(`${location.pathname}?${nextParams.toString()}`);
            return;
          }
        }

        const rows = await listPublicMenus(resolvedTenant);
        if (!alive) return;
        setMenus(rows);
        setActiveTable(table);
        if (!table) setError("INVALID_TABLE_SESSION");
        poll = window.setInterval(async () => {
          try {
            const latest = await findPublicTableSession(resolvedTenant, requestedTable, tableToken);
            if (alive) setActiveTable(latest);
          } catch (pollError) { console.warn("PUBLIC_ORDER_SESSION_RECHECK_FAILED", pollError); }
        }, 5000);
      } catch (loadError) {
        console.error("PUBLIC_ORDER_LOAD_FAILED", loadError);
        if (alive) setError(String(loadError?.message || "TENANT_NOT_RESOLVED"));
      } finally { if (alive) setLoading(false); }
    };
    bootstrap();
    return () => { alive = false; window.clearInterval(poll); };
  }, [slug, requestedTable, tableToken]);

  useEffect(() => {
    if (!tenant?.id || !activeTable?.id || !tableToken) { setOrders([]); return undefined; }
    return watchPublicTableOrders(tenant, activeTable.id, tableToken, payload => {
      if (payload.table && payload.table.orderToken === tableToken) setActiveTable(payload.table);
      setOrders(payload.orders || []);
    }, watchError => console.error("PUBLIC_ORDER_WATCH_FAILED", watchError));
  }, [tenant?.id, activeTable?.id, tableToken]);

  const addItem = item => {
    if (!validSession) return;
    setCart(current => {
      const previous = current[item.id];
      return { ...current, [item.id]: previous ? { ...previous, qty: previous.qty + 1 } : { ...item, qty: 1, note: "" } };
    });
    showStorefrontToast(t("order.toast.added", { name: item.name }));
  };
  const increase = id => setCart(current => ({ ...current, [id]: { ...current[id], qty: Number(current[id]?.qty || 0) + 1 } }));
  const decrease = async item => {
    if (Number(item.qty || 0) <= 1) {
      const ok = await sweetConfirm(t("order.remove.message", { name: item.name }), {
        title: t("order.remove.title"), confirmText: t("shared.actions.ok"), cancelText: t("shared.actions.cancel"), type: "warning",
      });
      if (!ok) return;
      setCart(current => { const next = { ...current }; delete next[item.id]; return next; });
      return;
    }
    setCart(current => ({ ...current, [item.id]: { ...current[item.id], qty: Number(current[item.id].qty || 0) - 1 } }));
  };
  const noteItem = (id, note) => setCart(current => ({ ...current, [id]: { ...current[id], note } }));

  const submit = async () => {
    if (!tenant || submitting || !cartItems.length) return;
    setSubmitting(true);
    try {
      const table = await findPublicTableSession(tenant, activeCode || requestedTable, tableToken);
      if (!table) throw new Error("INVALID_TABLE_SESSION");
      setActiveTable(table);
      const items = cartItems.map(({ id, name, price, qty, note }) => ({ menuId: id, name, price: Number(price), qty: Number(qty), note: note || "" }));
      await createPublicTableOrder(tenant, {
        tableCode: table.code || table.id, tableName: table.name || t("order.table.name", { table: table.code || table.id }),
        tableToken, orderType: "table", paymentStatus: "unpaid", status: "pending", totalAmount: total, note: orderNote.trim(), items,
      });
      setCart({});
      setOrderNote("");
      showStorefrontToast(t("order.toast.submitted"));
    } catch (submitError) {
      console.error("PUBLIC_ORDER_SUBMIT_FAILED", submitError);
      showStorefrontToast(submitError?.message === "INVALID_TABLE_SESSION" ? t("order.errors.expired") : t("order.toast.submit_failed"), "error");
    } finally { setSubmitting(false); }
  };

  const storeFailure = error && error !== "INVALID_TABLE_SESSION";
  const badge = validSession ? activeName : storeFailure ? t("order.header.store_missing") : t("order.header.expired");
  const heroTitle = validSession ? t("order.hero.for_table", { table: activeName }) : storeFailure ? t("order.errors.store_title") : t("order.errors.invalid_title");
  const heroDescription = validSession ? t("order.hero.description") : storeFailure ? t("order.errors.store_description") : t("order.errors.invalid_description");

  if (!stylesReady) return null;
  return (
    <>
      <PublicStorefrontHeader title={t("order.header.title")} badge={loading ? t("order.header.checking") : badge} />
      <main className="container">
        <section className="hero">
          <h1 className="hero-title"><i className={"bi bi-" + (validSession ? "journal-text" : "journal-x") + " app-icon"} aria-hidden="true"></i><span>{heroTitle}</span></h1>
          <p>{heroDescription}</p>
        </section>
        <div className="delivery-pos">
          {validSession ? (
            <PublicMenuCatalog menus={menus} prefix="order.menu" activeCategory={activeCategory} setActiveCategory={setActiveCategory}
              search={search} setSearch={setSearch} page={page} setPage={setPage} onAdd={addItem} />
          ) : (
            <div className="delivery-menu-column"><div className="card empty">{heroDescription}</div></div>
          )}
          <div className="delivery-side-column">
            <section className="card current-round">
              <div className="section-title">
                <h2><i className="bi bi-cart3 app-icon" aria-hidden="true"></i><span>{t("order.cart.title")}</span> <span className="round-label">{t("order.cart.round", { round: nextRound })}</span></h2>
                <span className="badge">{t("order.cart.count", { count: totalQty })}</span>
              </div>
              <PublicCartList items={cartItems} prefix="order.cart" onIncrease={increase} onDecrease={decrease} onNote={noteItem} />
              <div className="field" style={{ marginTop: 14 }}>
                <label>{t("order.cart.note")}</label>
                <textarea className="input" value={orderNote} placeholder={t("order.cart.note_placeholder")} onChange={event => setOrderNote(event.target.value)} />
              </div>
            </section>
            {visibleOrders.length ? (
              <section className="card previous-orders" style={{ marginTop: 18 }}>
                <div className="section-title">
                  <h2><i className="bi bi-clock-history app-icon" aria-hidden="true"></i><span>{activeName ? t("order.previous.title_for_table", { table: activeName }) : t("order.previous.title")}</span></h2>
                  <span className="badge">{t("order.previous.round_count", { count: visibleOrders.length })}</span>
                </div>
                <div className="previous-orders-list">
                  {visibleOrders.map(order => (
                    <article className="previous-round" key={order.id}>
                      <div className="previous-round-head"><div className="previous-round-title">{t("order.previous.round", { round: order.roundNumber || 1 })}</div><small>{formatTime(order.createdAt || order.createdAtText)}</small></div>
                      <div className="previous-round-items">{(order.items || []).map((item, index) => (
                        <div className="previous-round-item" key={(item.menuId || item.name || "item") + index}>
                          <span>{item.qty} × {item.name}{item.note ? <><br /><small>{item.note}</small></> : null}</span>
                          <strong>{money(Number(item.qty || 0) * Number(item.price || 0))}</strong>
                        </div>
                      ))}</div>
                      <div className="previous-round-head" style={{ marginTop: 8, marginBottom: 0 }}><small>{t("order.previous.confirmed")}</small><strong>{t("order.cart.amount", { amount: money(order.totalAmount) })}</strong></div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
      <div className="cart-bar">
        <div><small>{t("order.cart.total")}</small><div style={{ fontSize: 20, fontWeight: 800 }}><span>{money(total)}</span> {t("order.cart.currency")}</div></div>
        <button className="btn btn-primary" type="button" disabled={!validSession || !cartItems.length || submitting} onClick={submit}>
          <i className={"bi bi-" + (submitting ? "hourglass-split" : "check-lg") + " app-icon"} aria-hidden="true"></i>
          <span>{t(submitting ? "order.actions.submitting" : "order.actions.submit")}</span>
        </button>
      </div>
      <PublicStorefrontFooter />
    </>
  );
}
