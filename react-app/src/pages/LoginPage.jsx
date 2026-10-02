import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authenticateStaff, ROLE_HOME } from "@/auth/authFlow";
import { clearRetailPosSession, prepareRetailPosSession } from "@/auth/retailPosSession";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ParityFooter } from "@/components/ParityFooter";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

function showErrorToast(message) {
  const el = document.createElement("div");
  el.className = "app-toast error";
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = '<span class="app-toast-icon" aria-hidden="true"><i class="bi bi-x-circle app-icon"></i></span><span class="app-toast-message"></span>';
  el.querySelector(".app-toast-message").textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  window.setTimeout(() => {
    el.classList.remove("show");
    window.setTimeout(() => el.remove(), 250);
  }, 3200);
}

function errorMessage(t, error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("too-many-requests")) return t("auth.login.errors.too_many");
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return t("auth.login.errors.invalid_credentials");
  }
  if (code.includes("invalid-email")) return t("auth.login.errors.invalid_email");
  if (code.includes("network-request-failed")) return t("auth.login.errors.network");
  if (code.includes("ACCOUNT_NOT_ALLOWED") || code.includes("RETAIL_POS_NOT_ALLOWED")) return t("auth.login.errors.account_not_allowed");
  if (code.includes("TENANT_SUBSCRIPTION_EXPIRED")) return t("auth.login.errors.subscription_expired");
  if (code.includes("TENANT_SUSPENDED")) return t("auth.login.errors.tenant_suspended");
  if (code.includes("TENANT_INACTIVE") || code.includes("TENANT_NOT_FOUND") || code.includes("TENANT_REQUIRED")) {
    return t("auth.login.errors.tenant_inactive");
  }
  return t("auth.login.errors.failed");
}

const REACT_ROUTE_MAP = Object.freeze({
  "/": "/",
  "/admin": "/admin",
  "/admin/users": "/admin/users",
  "/admin/sales-report": "/admin/sales-report",
  "/admin/qr": "/admin/qr",
  "/reports/revenue-share": "/reports/revenue-share",
  "/cashier": "/cashier",
  "/cashier/quick-order": "/cashier/quick-order",
  "/cashier/receipt": "/cashier/receipt",
  "/cashier/table-qr": "/cashier/table-qr",
  "/cashier/waiting-queue": "/cashier/waiting-queue",
  "/waiting-queue": "/waiting-queue",
  "/kitchen": "/kitchen",
  "/pos": "/pos",
  "/platform": "/platform",
  "/admin/tenants": "/admin/tenants",
  "/platform/owners": "/platform/owners",
  "/platform/contact": "/platform/contact",
  "/platform/pricing": "/platform/pricing",
  "/super-admin/saas-setup": "/super-admin/saas-setup",
});

function safeNextPath(value, fallback = "") {
  const path = String(value || "").trim();
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  const projectPublicPath = path.match(/^\/[^/]+\/public(\/.*|$)/);
  if (projectPublicPath) return projectPublicPath[1] || "/";
  if (path === "/public") return "/";
  if (path.startsWith("/public/")) return path.slice(7) || "/";
  return path;
}

function businessUnits(profile = {}) {
  if (Array.isArray(profile.businessUnits) && profile.businessUnits.length) {
    return new Set(profile.businessUnits.map(value => String(value).trim().toLowerCase()));
  }
  const scope = String(profile.businessScope || "both").trim().toLowerCase();
  if (scope === "order_delivery") return new Set(["order_delivery"]);
  if (scope === "retail_pos") return new Set(["retail_pos"]);
  return new Set(["order_delivery", "retail_pos"]);
}

function scopedRoleHome(profile = {}) {
  if (profile.role === "super_admin") return "/platform";
  const units = businessUnits(profile);
  if (units.has("retail_pos") && !units.has("order_delivery")) return "/pos";
  if (units.has("order_delivery") && !units.has("retail_pos")) {
    if (profile.role === "kitchen") return "/kitchen";
    if (profile.role === "cashier") return "/cashier";
    if (["owner", "admin", "manager"].includes(profile.role)) return "/admin";
    return "/";
  }
  return ROLE_HOME[profile.role] || "/react";
}

function canOpenNext(profile = {}, value = "") {
  const path = safeNextPath(value, "");
  if (!path) return false;
  const pathname = new URL(path, location.origin).pathname.replace(/\/+$/, "") || "/";
  if (
    /^\/(?:react\/)?platform(?:\/|$)/.test(pathname)
    || pathname === "/admin/tenants"
    || pathname === "/react/admin/tenants"
    || pathname === "/super-admin/saas-setup"
    || pathname === "/react/super-admin/saas-setup"
  ) {
    return profile.role === "super_admin";
  }
  const units = businessUnits(profile);
  if (/^\/(?:react\/)?pos(?:\/|$)/.test(pathname)) return units.has("retail_pos");
  if (/^\/(?:react\/)?(?:admin|cashier|kitchen|waiting-queue|reports\/revenue-share)(?:\/|$)/.test(pathname)) {
    return units.has("order_delivery");
  }
  return true;
}

function reactMigrationTarget(value) {
  const path = safeNextPath(value, "");
  if (!path) return "";
  const url = new URL(path, location.origin);
  const canonical = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
  const withoutReact = canonical === "/react"
    ? "/"
    : canonical.startsWith("/react/")
      ? canonical.slice("/react".length)
      : canonical;
  const mapped = REACT_ROUTE_MAP[withoutReact];
  return mapped
    ? `${mapped}${url.search}${url.hash}`
    : `${withoutReact}${url.search}${url.hash}`;
}

export function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stylesReady = useParityPage({
    bodyClass: "login-page",
    title: t("auth.login.title"),
    styles: ["login-page.css"],
  });

  useEffect(() => {
    clearRetailPosSession();
    const reason = new URLSearchParams(location.search).get("reason") || "";
    const key = reason === "subscription_expired"
      ? "auth.login.errors.subscription_expired"
      : reason === "tenant_suspended"
        ? "auth.login.errors.tenant_suspended"
        : reason === "tenant_inactive"
          ? "auth.login.errors.tenant_inactive"
          : "";
    if (!key) return;
    const message = t(key);
    setError(message);
    showErrorToast(message);
  }, [t]);

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const profile = await authenticateStaff(email.trim().toLowerCase(), password);
      const requestedNext = new URLSearchParams(location.search).get("next") || "";
      const fallback = scopedRoleHome(profile);
      const safeRequestedNext = safeNextPath(requestedNext, "");
      const target = safeRequestedNext && canOpenNext(profile, safeRequestedNext)
        ? reactMigrationTarget(safeRequestedNext)
        : fallback;

      const posSession = await prepareRetailPosSession(profile).catch(error => {
        console.warn("POS_SESSION_PREPARE_SKIPPED", error);
        return { ok: false };
      });
      const targetPathname = new URL(target, location.origin).pathname;
      if (/^\/pos(?:\/|$)/.test(targetPathname) && !posSession.ok) {
        throw new Error("RETAIL_POS_NOT_ALLOWED");
      }

      location.replace(target || "/react");
    } catch (reason) {
      console.error(reason);
      const message = errorMessage(t, reason);
      setError(message);
      showErrorToast(message);
    } finally {
      setBusy(false);
    }
  };

  if (!stylesReady) {
    return <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }

  return (
    <>
      <main className="login-shell">
        <div className="login-language"><LocaleSwitcher /></div>
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo">KJ</div>
            <h1>
              <i className="bi bi-person-circle app-icon" aria-hidden="true"></i>
              <span>{t("auth.login.staff_title")}</span>
            </h1>
            <p>Order • Delivery • Retail POS</p>
          </div>

          <form
            id="loginForm"
            className="login-form"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            onSubmit={submit}
          >
            <label>
              <span className="login-field-title">{t("auth.login.email")}</span>
              <span className={`login-input-wrap${email ? " is-filled" : ""}`} data-validation-feedback-host>
                <i className="bi bi-envelope app-icon login-field-icon" aria-hidden="true"></i>
                <input
                  id="email"
                  name="fod-login-email"
                  type="email"
                  autoComplete="off"
                  maxLength="100"
                  required
                  autoFocus
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                />
              </span>
            </label>

            <label>
              <span className="login-field-title">{t("auth.login.password")}</span>
              <span className={`login-input-wrap login-password-wrap${password ? " is-filled" : ""}`} data-validation-feedback-host>
                <i className="fi fi-rr-key app-icon login-field-icon login-key-reference-icon" aria-hidden="true"></i>
                <input
                  id="password"
                  name="fod-login-secret"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  maxLength="100"
                  required
                  minLength="6"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                />
                <button id="togglePasswordBtn" type="button" onClick={() => setShowPassword(value => !value)}>
                  {t(showPassword ? "auth.login.hide_password" : "auth.login.show_password")}
                </button>
              </span>
            </label>

            <p id="loginError" className="login-error" hidden={!error}>{error}</p>
            <button id="loginButton" className="btn btn-pay login-submit" type="submit" disabled={busy}>
              {busy
                ? <span className="login-loading">{t("auth.login.loading")}</span>
                : <>
                    <i className="bi bi-box-arrow-in-right app-icon" aria-hidden="true"></i>
                    <span>{t("auth.login.submit")}</span>
                  </>
              }
            </button>
          </form>
        </section>

        <Link className="login-home-link" to="/">
          <i className="bi bi-house-door app-icon" aria-hidden="true"></i>
          <span>{t("auth.login.home")}</span>
        </Link>
      </main>
      <ParityFooter />
    </>
  );
}
