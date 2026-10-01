import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import {
  inspectLegacyData,
  migrateLegacyStore,
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

async function askConfirm(message, options) {
  if (typeof window.sweetConfirm !== "function") {
    await import(/* @vite-ignore */ "/assets/js/sweet-dialog.js?v=20260731-095");
  }
  return typeof window.sweetConfirm === "function"
    ? window.sweetConfirm(message, options)
    : false;
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
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(true);
  const [logLines, setLogLines] = useState([]);

  const appendLog = message => setLogLines(lines => [...lines, String(message || "")]);

  const refreshSummary = async () => {
    setStateKey("runtime.state.checking");
    setBusy(true);
    try {
      const data = await inspectLegacyData();
      setSummary(data);
      setStateKey(data.tenantExists ? "runtime.state.tenant_exists" : "runtime.state.ready");
    } catch (error) {
      console.error("SAAS_SETUP_INSPECT_FAILED", error);
      setStateKey("runtime.state.check_failed");
      showToast(t("runtime.toast.check_failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (profile?.role === "super_admin") refreshSummary();
  }, [profile?.role]);

  const startMigration = async () => {
    const confirmed = await askConfirm(
      overwrite
        ? t("runtime.confirm.overwrite")
        : t("runtime.confirm.copy", { source: SAAS_SOURCE_SHOP_ID }),
      {
        title: t("runtime.confirm.title"),
        confirmText: t("runtime.confirm.confirm"),
        cancelText: t("runtime.confirm.cancel"),
        type: "warning",
      },
    );
    if (!confirmed) return;

    setBusy(true);
    setLogLines([t("runtime.log.start")]);
    try {
      const results = await migrateLegacyStore({
        overwrite,
        onProgress: progress => {
          if (progress.step === "tenant") appendLog(t("runtime.progress.tenant"));
          else if (progress.step === "collection") appendLog(t("runtime.progress.collection", { name: progress.name }));
          else if (progress.step === "settings") appendLog(t("runtime.progress.settings"));
          else if (progress.step === "done") appendLog(t("runtime.progress.done"));
        },
      });
      results.forEach(result => appendLog(t("runtime.log.result", {
        source: result.sourceName,
        copied: result.copied,
        skipped: result.skipped,
        total: result.total,
      })));
      setStateKey("runtime.state.migration_success");
      showToast(t("runtime.toast.migration_success"));
      await refreshSummary();
    } catch (error) {
      console.error("SAAS_SETUP_MIGRATION_FAILED", error);
      setStateKey("runtime.state.migration_failed");
      appendLog(t("runtime.log.error", { message: error?.message || error }));
      showToast(t("runtime.toast.migration_failed"), "error");
      setBusy(false);
    }
  };

  if (authState.status === "loading" || !stylesReady) {
    return <PageReadyOverlay context="PENGUIN" title={globalT("shared.state.loading")} message={globalT("shared.state.please_wait")} progress={80} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fsuper-admin%2Fsaas-setup" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="super-admin-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><span>{t("header.brand")}</span></div>
          <Link className="btn btn-sm super-admin-header-back" to="/">
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
            <div className="card" style={{ boxShadow: "none" }}><strong>{t("summary.menus")}</strong><div className="price" id="menuCount">{summary ? t("runtime.count.items", { count: summary.menus }) : "-"}</div></div>
            <div className="card" style={{ boxShadow: "none" }}><strong>{t("summary.tables")}</strong><div className="price" id="tableCount">{summary ? t("runtime.count.tables", { count: summary.tables }) : "-"}</div></div>
            <div className="card" style={{ boxShadow: "none" }}><strong>{t("summary.orders")}</strong><div className="price" id="orderCount">{summary ? t("runtime.count.orders", { count: summary.orders }) : "-"}</div></div>
            <div className="card" style={{ boxShadow: "none" }}><strong>{t("summary.settings")}</strong><div className="price" id="settingCount">{summary ? t(summary.settings ? "runtime.settings.found" : "runtime.settings.missing") : "-"}</div></div>
          </div>

          <div className="card" style={{ marginTop: 16, boxShadow: "none", background: "#f8fbf9" }}>
            <strong>{t("target.title")}</strong>
            <div className="menu-category">{t("target.name")}: {SAAS_TARGET_TENANT.name}</div>
            <div className="menu-category">{t("target.slug")}: {SAAS_TARGET_TENANT.slug}</div>
            <div className="menu-category">{t("target.id")}: {SAAS_TARGET_TENANT.id}</div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
            <input type="checkbox" id="overwriteData" checked={overwrite} disabled={busy} onChange={event => setOverwrite(event.target.checked)} />
            {t("overwrite")}
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <button className="btn" id="refreshMigration" type="button" disabled={busy} onClick={refreshSummary}>
              {t("actions.refresh")}
            </button>
            <button className="btn btn-primary" id="startMigration" type="button" disabled={busy} onClick={startMigration}>
              {t("actions.start")}
            </button>
          </div>

          {logLines.length ? (
            <div id="migrationLog" className="card" style={{ marginTop: 16, boxShadow: "none", whiteSpace: "pre-line" }}>
              {logLines.join("\n")}
            </div>
          ) : null}
        </section>
      </main>

      <ParityFooter />
    </>
  );
}
