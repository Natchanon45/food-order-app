import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { REACT_RELEASE } from "@/config/release";

function runtimeEnvironment() {
  const host = String(location.hostname || "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return "local";
  return REACT_RELEASE.environment || "production";
}

function retailCacheKeyCount() {
  try {
    return Object.keys(localStorage).filter(key => key.startsWith("retail_")).length;
  } catch {
    return 0;
  }
}

export function AppDeveloperPanel() {
  const { profile, user } = useAuth();
  const { tenant } = useTenant();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = event => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.shiftKey && String(event.key || "").toLowerCase() === "d") {
        event.preventDefault();
        setOpen(value => !value);
        return;
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const rows = useMemo(() => [
    ["Version", REACT_RELEASE.version],
    ["Build", REACT_RELEASE.build],
    ["Branch", REACT_RELEASE.branch],
    ["Commit", REACT_RELEASE.commit],
    ["ระบบข้อมูล", REACT_RELEASE.dataService],
    ["Environment", runtimeEnvironment()],
    ["Milestone", REACT_RELEASE.milestone],
    ["Tenant", tenant?.id || profile?.tenantId || "-"],
    ["User", user?.email || profile?.email || profile?.username || profile?.name || "-"],
    ["Role", profile?.roleId || profile?.role || "-"],
    ["URL", location.pathname + location.search],
    ["Screen", `${innerWidth}×${innerHeight}`],
    ["DPR", devicePixelRatio || 1],
    ["Retail Cache Keys", retailCacheKeyCount()],
  ], [profile, tenant, user, open]);

  return (
    <>
      <button
        type="button"
        className="app-version-badge"
        data-app-version-badge
        title={`${REACT_RELEASE.product} v${REACT_RELEASE.version} • Build ${REACT_RELEASE.build}\nBranch: ${REACT_RELEASE.branch}\nCommit: ${REACT_RELEASE.commit}`}
        aria-label="เปิด Developer Panel"
        onClick={() => setOpen(true)}
      ></button>

      <div className="app-dev-panel" data-app-dev-panel hidden={!open}>
        <div className="app-dev-backdrop" data-close-dev-panel onClick={() => setOpen(false)}></div>
        <section className="app-dev-card" role="dialog" aria-modal="true" aria-label="Developer Panel">
          <header className="app-dev-head">
            <div><small>Developer Panel</small><h2>{REACT_RELEASE.product}</h2></div>
            <button type="button" className="app-dev-close" aria-label="ปิด" onClick={() => setOpen(false)}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </header>
          <div className="app-dev-grid">
            {rows.map(([label, value]) => <div className="app-dev-row" key={label}><span>{label}</span><strong>{String(value ?? "-")}</strong></div>)}
          </div>
          <div className="app-dev-section">
            <h3>What&apos;s New</h3>
            <ul>{REACT_RELEASE.whatsNew.map(item => <li key={item}>{item}</li>)}</ul>
          </div>
          <details className="app-dev-section"><summary>Browser</summary><p>{navigator.userAgent}</p></details>
        </section>
      </div>
    </>
  );
}
