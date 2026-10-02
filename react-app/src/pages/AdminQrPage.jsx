import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { subscribeActiveTables } from "@/data/adminQrData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";
import { qrDataUrl } from "@/utils/localQr";

function clearPrintTarget() {
  document.body.classList.remove("qr-printing");
  document.querySelectorAll(".qr-card.print-target").forEach(card => card.classList.remove("print-target"));
}

export function AdminQrPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t } = useI18n();
  const stylesReady = useParityPage({
    title: t("admin_qr.meta.title"),
    bodyClass: "order-delivery-workspace od-qr-page",
    styles: ["app.css", "menu-qr.css", "icons.css", "admin-icon-polish.css", "order-delivery-workspace-theme.css"],
  });
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const baseUrl = useMemo(() => {
    if (!tenant?.slug) return "";
    return `${location.origin}/s/${encodeURIComponent(tenant.slug)}/`;
  }, [tenant?.slug]);

  useEffect(() => {
    if (!tenant?.id || !["owner", "admin"].includes(profile?.role)) return undefined;
    setLoading(true);
    setLoadError("");
    return subscribeActiveTables(
      tenant.id,
      rows => {
        setTables(rows);
        setLoading(false);
      },
      error => {
        setLoadError(error?.message || "ADMIN_QR_LOAD_FAILED");
        setLoading(false);
      },
    );
  }, [tenant?.id, profile?.role]);

  useEffect(() => {
    window.addEventListener("afterprint", clearPrintTarget);
    return () => {
      window.removeEventListener("afterprint", clearPrintTarget);
      clearPrintTarget();
    };
  }, []);

  const printCard = event => {
    clearPrintTarget();
    const card = event.currentTarget.closest(".qr-card");
    card?.classList.add("print-target");
    document.body.classList.add("qr-printing");
    requestAnimationFrame(() => window.print());
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) {
    return <PageReadyOverlay context="KINJAI" title={t("shared.state.loading")} message={t("shared.state.please_wait")} progress={88} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fadmin%2Fqr" replace />;
  if (!["owner", "admin"].includes(profile.role)) return <Navigate to="/" replace />;
  if (tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header">
        <div className="admin-qr-header-leading">
          <div className="brand"><span className="brand-mark">KJ</span>{t("admin_qr.header.title")}</div>
          <Link className="btn btn-sm admin-qr-header-back" to="/admin">
            <i className="bi bi-arrow-left app-icon" aria-hidden="true"></i>
            <span>{t("admin_qr.header.back")}</span>
          </Link>
        </div>
        <div className="app-header-actions admin-qr-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <div id="demoBanner"></div>

      <main className="container">
        <section className="hero">
          <h1>{t("admin_qr.hero.title")}</h1>
          <p>{t("admin_qr.hero.description")}</p>
        </section>
        <div className="field card" style={{ marginBottom: 16 }}>
          <label htmlFor="baseUrl">{t("admin_qr.base_url")}</label>
          <input className="input" id="baseUrl" readOnly value={baseUrl} />
        </div>

        <div id="qrGrid" className="qr-grid">
          {loading ? <div className="card empty">{t("admin_qr.states.loading")}</div>
            : loadError ? <div className="card empty">{t("admin_qr.states.error")}</div>
            : !tables.length ? <div className="card empty">{t("admin_qr.states.no_tables")}</div>
            : tables.map(table => {
              const orderUrl = `${baseUrl}order/?table=${encodeURIComponent(table.code)}`;
              const qrUrl = qrDataUrl(orderUrl, { size: 320, margin: 4 });
              return (
                <article className="card qr-card" key={table.id || table.code}>
                  <div className="qr-ticket">
                    <div className="qr-ticket-header">
                      <div className="qr-ticket-brand">KINJAI QR</div>
                      <div className="qr-ticket-title">{t("admin_qr.ticket.scan_to_order")}</div>
                      <div className="qr-ticket-table">{table.name}</div>
                    </div>
                    <div className="qr-ticket-rule"></div>
                    <div className="qr-ticket-code">
                      <img src={qrUrl} width="260" height="260" alt={`QR ${table.name}`} />
                    </div>
                    <div className="qr-ticket-rule"></div>
                    <div className="qr-ticket-steps">
                      <div>{t("admin_qr.ticket.step_camera")}</div>
                      <div>{t("admin_qr.ticket.step_scan")}</div>
                      <div>{t("admin_qr.ticket.step_order")}</div>
                    </div>
                    <div className="qr-ticket-footer">
                      {t("admin_qr.ticket.check_table")}<br />
                      {t("admin_qr.ticket.thanks")}
                    </div>
                  </div>
                  <small className="qr-ticket-url">{orderUrl}</small>
                  <button className="btn btn-dark btn-sm" type="button" data-print-card onClick={printCard}>{t("admin_qr.ticket.print")}</button>
                </article>
              );
            })}
        </div>
      </main>

      <ParityFooter />
    </>
  );
}
