import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import {
  inspectLegacyData,
  SAAS_SOURCE_SHOP_ID,
  SAAS_TARGET_TENANT,
} from "@/data/saasMigrationService";
import { useI18n } from "@/i18n/I18nProvider";
import saasTranslations from "@/i18n/saas-setup-master-translations.json";
import { useParityPage } from "@/hooks/useParityPage";

function nested(source, key) {
  return String(key || "").split(".").filter(Boolean)
    .reduce((value, part) => value && Object.prototype.hasOwnProperty.call(value, part) ? value[part] : undefined, source);
}
function interpolate(value, replacements = {}) {
  return String(value).replace(/:([A-Za-z0-9_]+)/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(replacements, key) ? String(replacements[key]) : match);
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

export function SaasSetupPage() {
  const authState = useAuth();
  const { profile } = authState;
  const { locale, t: globalT } = useI18n();
  const t = (key, replacements = {}) => interpolate(
    nested(saasTranslations?.[locale], key)
      ?? nested(saasTranslations?.th, key)
      ?? key,
    replacements,
  );
  const stylesReady = useParityPage({
    title: t("meta.title"),
    styles: ["sweet-dialog.css", "super-admin-header.css"],
    attributes: { "data-roles": "super_admin" },
  });
  const [summary, setSummary] = useState(null);
  const [stateKey, setStateKey] = useState("runtime.state.checking");
  const [busy, setBusy] = useState(true);
  const [initialReady, setInitialReady] = useState(false);
  const refreshSummary = async () => {
    setStateKey("runtime.state.checking");
    setSummary(null);
    setBusy(true);
    try {
      const data = await inspectLegacyData();
      setSummary(data);
      setStateKey(data.tenantExists ? "runtime.state.inspection_only" : "runtime.state.target_not_found");
    } catch (error) {
      console.error("SAAS_SETUP_INSPECT_FAILED", error);
      setStateKey("runtime.state.check_failed");
      showToast(t("runtime.toast.check_failed"), "error");
    } finally {
      setBusy(false);
      setInitialReady(true);
    }
  };

  useEffect(() => {
    if (profile?.role !== "super_admin") return undefined;
    setInitialReady(false);
    refreshSummary();
    return undefined;
  }, [profile?.role]);

  if (authState.status === "loading" || !stylesReady || (profile?.role === "super_admin" && !initialReady)) {
    return <PageReadyOverlay context="PENGUIN" title={globalT("shared.state.loading")} message={globalT("shared.state.please_wait")} />;
  }
  if (authState.status !== "ready") return <main role="alert" data-saas-auth-error>{t("runtime.state.check_failed")}</main>;
  if (!profile) return <Navigate to="/login?next=%2Fsuper-admin%2Fsaas-setup" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="super-admin-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><span>{t("header.brand")}</span></div>
          <Link className="btn btn-sm super-admin-header-back" to="/platform">
            <i className="bi bi-arrow-left" aria-hidden="true"></i><span>{t("header.back")}</span>
          </Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <h1>{t("hero.title")}</h1>
          <p>{t("hero.description", { source: `shops/${SAAS_SOURCE_SHOP_ID}`, tenant: SAAS_TARGET_TENANT.name })}</p>
        </section>

        <section className="card">
          <div className="section-title">
            <h2>{t("summary.title")}</h2>
            <span className="badge" id="migrationState">{t(stateKey)}</span>
          </div>
          <div className="grid grid-2" id="migrationSummary">
            <div className="card" style={{ boxShadow: "none" }}><strong>{t("summary.menus")}</strong><div className="price" id="menuCount">{Number.isInteger(summary?.menus) ? t("runtime.count.items", { count: summary.menus }) : "-"}</div></div>
            <div className="card" style={{ boxShadow: "none" }}><strong>{t("summary.tables")}</strong><div className="price" id="tableCount">{Number.isInteger(summary?.tables) ? t("runtime.count.tables", { count: summary.tables }) : "-"}</div></div>
            <div className="card" style={{ boxShadow: "none" }}><strong>{t("summary.orders")}</strong><div className="price" id="orderCount">{Number.isInteger(summary?.orders) ? t("runtime.count.orders", { count: summary.orders }) : "-"}</div></div>
            <div className="card" style={{ boxShadow: "none" }}><strong>{t("summary.settings")}</strong><div className="price" id="settingCount">{typeof summary?.settings === "boolean" ? t(summary.settings ? "runtime.settings.found" : "runtime.settings.missing") : "-"}</div></div>
          </div>

          <div className="card" style={{ marginTop: 16, boxShadow: "none", background: "#f8fbf9" }}>
            <strong>{t("target.title")}</strong>
            <div className="menu-category">{t("target.name")}: {summary?.target?.name || SAAS_TARGET_TENANT.name}</div>
            <div className="menu-category">{t("target.slug")}: {summary?.target?.slug || SAAS_TARGET_TENANT.slug}</div>
            <div className="menu-category">{t("target.id")}: {SAAS_TARGET_TENANT.id}</div>
          </div>

          <p id="saasInspectionNotice" role="note" className="menu-category" style={{ marginTop: 16 }}>
            <i className="bi bi-shield-lock" aria-hidden="true" />{" "}
            {t("runtime.state.source_unavailable")}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn" id="refreshMigration" type="button" disabled={busy} onClick={refreshSummary}>
              {t("actions.refresh")}
            </button>
            <button className="btn btn-primary" id="startMigration" type="button"
              disabled aria-disabled="true" aria-describedby="saasInspectionNotice">
              {t("actions.start")}
            </button>
          </div>
          <div id="migrationLog" role="status" className="menu-category" style={{ marginTop: 12 }}>
            {t("runtime.state.inspection_only")}
          </div>
        </section>
      </main>

      <ParityFooter />
    </>
  );
}
