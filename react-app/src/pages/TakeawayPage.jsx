import { useEffect, useMemo, useState } from "react";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { StoreBrandMark, brandedHeroStyle } from "@/components/StoreHeroBranding";
import { useParams } from "react-router-dom";
import { sweetAlert, sweetConfirm } from "@/components/sweetDialog";
import {
  PublicCartList, PublicMenuCatalog, PublicStorefrontFooter, PublicStorefrontHeader, showStorefrontToast,
} from "@/components/PublicStorefront";
import {
  createPublicTakeawayOrder, loadPublicStorefront, resolvePublicTenant,
} from "@/data/publicStorefrontData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

export function TakeawayPage() {
  const { slug = "" } = useParams();
  const { t, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("takeaway.meta.title"),
    bodyClass: "order-delivery-workspace table-order-page takeaway-order-page",
    styles: [
      "app.css", "menu-qr.css", "menu-pagination.css", "icons.css", "pos-refresh.css",
      "public-menu-image-frame.css", "table-order-sticky-lite.css", "sweet-dialog.css",
      "order-delivery-workspace-theme.css", "shared-responsive.css", "store-hero-branding.css", "ui-layer-stack.css",
    ],
  });
  const [tenant, setTenant] = useState(null);
  const [settings, setSettings] = useState({});
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeCategory, setActiveCategory] = useState("__all__");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!slug) {
      setLoading(false);
      setLoadError(t("delivery.checkout.errors.tenant_not_ready"));
      return undefined;
    }
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const nextTenant = await resolvePublicTenant(slug);
        const catalog = await loadPublicStorefront(nextTenant);
        if (!alive) return;
        setTenant(nextTenant);
        setSettings(catalog.settings || {});
        setMenus(catalog.menus || []);
      } catch (error) {
        console.error("TAKEAWAY_REACT_LOAD_FAILED", error);
        if (alive) setLoadError(t("takeaway.menu.load_failed"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0),
    [cart],
  );
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + Number(item.qty || 0), 0), [cart]);

  const add = item => {
    setCart(current => {
      const found = current.find(row => row.id === item.id);
      return found
        ? current.map(row => row.id === item.id ? { ...row, qty: row.qty + 1 } : row)
        : [...current, { ...item, qty: 1, note: "" }];
    });
    showStorefrontToast(t("takeaway.toast.added", { name: item.name }));
  };
  const increase = id => setCart(current => current.map(row => row.id === id ? { ...row, qty: row.qty + 1 } : row));
  const decrease = async item => {
    if (item.qty > 1) {
      setCart(current => current.map(row => row.id === item.id ? { ...row, qty: row.qty - 1 } : row));
      return;
    }
    const ok = await sweetConfirm(t("takeaway.remove.message", { name: item.name }), {
      title: t("takeaway.remove.title"),
      confirmText: t("takeaway.confirm.confirm"),
      cancelText: t("takeaway.confirm.cancel"),
      confirmIcon: "check-circle",
      cancelIcon: "x-circle",
      type: "warning",
    });
    if (ok) setCart(current => current.filter(row => row.id !== item.id));
  };
  const noteItem = (id, value) => setCart(current => current.map(row => row.id === id ? { ...row, note: value } : row));

  const submit = async () => {
    if (!tenant || submitting || !cart.length) return;
    if (!customerName.trim() && !customerPhone.trim()) {
      showStorefrontToast(t("takeaway.customer.required"), "error");
      return;
    }
    const ok = await sweetConfirm(t("takeaway.confirm.message"), {
      title: t("takeaway.confirm.title"),
      confirmText: t("takeaway.confirm.confirm"),
      cancelText: t("takeaway.confirm.cancel"),
      confirmIcon: "check-circle",
      cancelIcon: "x-circle",
      type: "warning",
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      const items = cart.map(({ id, name, price, qty, note: itemNote }) => ({
        menuId: id, name, price: Number(price || 0), qty: Number(qty || 0), note: itemNote || "",
      }));
      const result = await createPublicTakeawayOrder(tenant, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        status: "pending",
        totalAmount: cartTotal,
        subtotalAmount: cartTotal,
        note: note.trim(),
        items,
      });
      setCart([]);
      setNote("");
      showStorefrontToast(t("takeaway.toast.submitted"));
      await sweetAlert(t("takeaway.success.queue", { queue: result?.queueNo || t("takeaway.success.fallback_queue") }), {
        title: t("takeaway.success.title"),
        confirmText: t("takeaway.success.confirm"),
        type: "success",
      });
    } catch (error) {
      console.error("TAKEAWAY_REACT_SUBMIT_FAILED", error);
      showStorefrontToast(
        error?.message === "TAKEAWAY_CUSTOMER_REQUIRED"
          ? t("takeaway.customer.required")
          : t("takeaway.toast.submit_failed"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!stylesReady || loading) return <PageReadyOverlay />;
  const shopName = String(settings?.shopName || tenant?.name || t("shared.store.fallback_name") || "PENGUIN").trim();

  return (
    <>
      <PublicStorefrontHeader title={t("takeaway.header.title")} badge={t("takeaway.header.badge")} />
      <main className="container">
        <section className="hero store-branded-hero" style={brandedHeroStyle(settings)}>
          <h1 className="hero-title"><StoreBrandMark settings={settings} /><span>{shopName}</span></h1>
          <p>{t("takeaway.hero.description")}</p>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-title">
            <h2>{t("takeaway.customer.title")}</h2>
            <span className="badge warning">{t("takeaway.customer.no_table")}</span>
          </div>
          <div className="grid grid-2">
            <div className="field">
              <label>{t("takeaway.customer.name")}</label>
              <input className="input" maxLength={80} value={customerName}
                placeholder={t("takeaway.customer.name_placeholder")} onChange={event => setCustomerName(event.target.value)} />
            </div>
            <div className="field">
              <label>{t("takeaway.customer.phone")}</label>
              <input className="input" inputMode="tel" maxLength={20} value={customerPhone}
                placeholder={t("takeaway.customer.phone_placeholder")} onChange={event => setCustomerPhone(event.target.value)} />
            </div>
          </div>
          <small>{t("takeaway.customer.hint")}</small>
        </section>

        {loadError ? <section className="card empty">{loadError}</section> : (
          <div className="delivery-pos">
            {loading ? <div className="delivery-menu-column"><div className="card empty">{t("shared.loading")}</div></div> : (
              <PublicMenuCatalog menus={menus} prefix="takeaway.menu" activeCategory={activeCategory}
                setActiveCategory={setActiveCategory} search={search} setSearch={setSearch}
                page={page} setPage={setPage} onAdd={add} disabled={submitting} />
            )}
            <div className="delivery-side-column">
              <section className="card current-round">
                <div className="section-title">
                  <h2>{t("takeaway.cart.title")}</h2>
                  <span className="badge">{t("takeaway.cart.count", { count: cartCount })}</span>
                </div>
                <PublicCartList items={cart} prefix="takeaway.cart" onIncrease={increase} onDecrease={decrease} onNote={noteItem} />
                <div className="field" style={{ marginTop: 14 }}>
                  <label>{t("takeaway.cart.note")}</label>
                  <textarea className="input" value={note} placeholder={t("takeaway.cart.note_placeholder")}
                    onChange={event => setNote(event.target.value)} />
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
      <div className="cart-bar">
        <div>
          <small>{t("takeaway.cart.total")}</small>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{formatNumber(cartTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t("takeaway.cart.currency")}</div>
        </div>
        <button className="btn btn-primary" type="button" disabled={!tenant || !cart.length || submitting} onClick={submit}>
          <i className={"bi bi-" + (submitting ? "hourglass-split" : "check-lg") + " app-icon"} aria-hidden="true"></i>
          <span>{t(submitting ? "takeaway.actions.submitting" : "takeaway.actions.submit")}</span>
        </button>
      </div>
      <PublicStorefrontFooter />
    </>
  );
}
