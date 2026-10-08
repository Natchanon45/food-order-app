import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/auth/AuthProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { STAFF_ROLES } from "@/auth/authFlow";
import { db, functions } from "@/firebase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

const roleAliases = new Set(["owner", "admin", "cashier", "kitchen", "manager"]);

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function safeHttpUrl(value = "") {
  try {
    const url = new URL(String(value).trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function safePhone(value = "") {
  return String(value).replace(/[^\\d+*#,;]/g, "");
}

function safeEmail(value = "") {
  const normalized = String(value).trim().toLowerCase();
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalized) ? normalized : "";
}

function supportsModule(profile = {}, moduleName = "", tenant = null) {
  if (tenant && profile.role !== "super_admin") {
    const master = tenant.businessType;
    if (master === "restaurant_cafe" && moduleName === "retail-pos") return false;
    if (master === "retail" && moduleName === "order-delivery") return false;
  }
  if (!moduleName || profile.role === "super_admin") return true;
  const values = [
    profile.module, profile.tenantType, profile.businessType,
    profile.businessScope, profile.business_scope,
    profile.businessUnit, profile.business_unit,
    ...(Array.isArray(profile.modules) ? profile.modules : []),
    ...(Array.isArray(profile.businessUnits) ? profile.businessUnits : []),
    ...(Array.isArray(profile.allowedModules) ? profile.allowedModules : []),
  ].filter(Boolean).map(lower);

  if (moduleName === "retail-pos") {
    if (profile.role === "owner") {
      return !values.length || values.includes("retail_pos") || values.includes("retail") || values.includes("all") || values.includes("both");
    }
    return values.includes("retail_pos") || values.includes("retail") || values.includes("all") || values.includes("both");
  }
  return !values.length || values.includes(moduleName) || values.includes("all");
}

function DashboardCard({ profile, tenant, roles, module, href, cardKey, icon, label, description, visible = true, feature = false }) {
  const ownerCanView = profile?.role === "owner" && roles.some(role => roleAliases.has(role));
  const roleAllowed = ownerCanView || roles.includes(profile?.role);
  const moduleAllowed = supportsModule(profile, module, tenant);
  if (!visible || !roleAllowed || !moduleAllowed) return null;

  return (
    <a className={`card nav-card${feature ? " nav-card-feature" : ""}`} href={href} data-dashboard-card={cardKey || undefined} data-description={description}>
      <span className="nav-card-icon"><i className={icon} aria-hidden="true"></i></span>
      <span className="nav-card-label">{label}</span>
    </a>
  );
}

export function HomePage() {
  const { t } = useI18n();
  const authState = useAuth();
  const tenantState = useTenant();
  const { tenant } = tenantState;
  const profile = authState.profile;
  const masterRestaurantEnabled = tenant?.businessType !== "retail";
  const masterRetailEnabled = tenant?.businessType !== "restaurant_cafe";
  const staff = profile?.active !== false && STAFF_ROLES.includes(profile?.role);
  const [revenueShareEnabled, setRevenueShareEnabled] = useState(false);
  const [resolvedShopName, setResolvedShopName] = useState("");
  const [publicContact, setPublicContact] = useState(null);

  const stylesReady = useParityPage({
    bodyClass: staff ? "staff-home" : "",
    title: t("home.meta.title"),
    styles: ["home-dashboard.css", "public-contact.css", "public-utility-actions.css", "home-page.css"],
    attributes: staff ? { "data-roles": profile?.role || "" } : {},
  });

  useEffect(() => {
    let alive = true;
    if (!["owner", "admin"].includes(profile?.role)) {
      setRevenueShareEnabled(false);
      return () => { alive = false; };
    }
    httpsCallable(functions, "getTenantRevenueShareAccess")({})
      .then(result => { if (alive) setRevenueShareEnabled(result.data?.enabled === true); })
      .catch(() => { if (alive) setRevenueShareEnabled(false); });
    return () => { alive = false; };
  }, [profile?.role]);

  useEffect(() => {
    let alive = true;
    setResolvedShopName("");
    if (profile?.role === "owner" && tenant?.id) {
      getDoc(doc(db, "tenants", tenant.id, "settings", "store"))
        .then(snapshot => {
          const name = snapshot.exists() ? String(snapshot.data()?.shopName || "").trim() : "";
          if (alive) setResolvedShopName(name);
        })
        .catch(error => console.warn("STAFF_HOME_STORE_NAME_FALLBACK", error));
    }
    return () => { alive = false; };
  }, [profile?.role, tenant?.id]);

  useEffect(() => {
    const settingsRef = doc(db, "platformSettings", "publicContact");
    return onSnapshot(settingsRef, snapshot => {
      const data = snapshot.exists() ? snapshot.data() : null;
      if (!data || data.enabled !== true) {
        setPublicContact(null);
        return;
      }
      const actions = [];
      const phone = safePhone(data.phoneNumber);
      if (data.phoneEnabled === true && phone) actions.push({ channel: "phone", icon: "telephone-fill", label: String(data.phoneLabel || t("home.public.contact.phone")).trim() || t("home.public.contact.phone"), href: `tel:${phone}` });
      const lineUrl = safeHttpUrl(data.lineUrl);
      if (data.lineEnabled === true && lineUrl) actions.push({ channel: "line", icon: "line", label: String(data.lineLabel || "LINE").trim() || "LINE", href: lineUrl, external: true });
      const messengerUrl = safeHttpUrl(data.messengerUrl);
      if (data.messengerEnabled === true && messengerUrl) actions.push({ channel: "messenger", icon: "messenger", label: String(data.messengerLabel || "Messenger").trim() || "Messenger", href: messengerUrl, external: true });
      const email = safeEmail(data.email);
      if (data.emailEnabled === true && email) actions.push({ channel: "email", icon: "envelope-fill", label: String(data.emailLabel || t("home.public.contact.email")).trim() || t("home.public.contact.email"), href: `mailto:${email}` });
      setPublicContact(actions.length ? {
        heading: String(data.heading || t("home.public.contact.title")).trim() || t("home.public.contact.title"),
        description: String(data.description || t("home.public.contact.runtime_description")).trim() || t("home.public.contact.runtime_description"),
        actions,
      } : null);
    }, error => {
      console.warn("[public-contact] unable to load contact settings", error);
      setPublicContact(null);
    });
  }, [t]);

  useEffect(() => {
    if (profile?.role === "super_admin") location.replace("/platform");
  }, [profile?.role]);

  const shopName = useMemo(
    () => resolvedShopName || tenant?.shopName || tenant?.name || profile?.tenantName || t("home.staff.owner.store_fallback"),
    [resolvedShopName, tenant, profile, t],
  );

  if (
    authState.status === "loading"
    || !stylesReady
    || profile?.role === "super_admin"
    || (staff && tenantState.status === "loading")
  ) {
    return (
      <PageReadyOverlay
        context="PENGUIN"
        title={t("shared.state.loading")}
        message={t("shared.state.please_wait")}
      />
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">PG</span>
          <span className="brand-label">{staff ? "PENGUIN" : "PENGUIN"}</span>
        </div>
        <div className="app-header-actions" data-header-actions style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginLeft: "auto", minWidth: 0, flex: "0 0 auto" }}>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0, order: -100 }} />
          {staff && profile ? <UserMenu profile={profile} /> : null}
        </div>
      </header>

      {!staff ? (
        <main className="container" id="publicLanding">
          <section className="hero public-landing-hero">
            <h1><i className="bi bi-shop-window app-icon public-heading-icon" aria-hidden="true"></i><span>PENGUIN</span></h1>
            <p>{t("home.public.hero.description")}</p>
          </section>

          <section className="grid grid-3" aria-label={t("home.public.features.aria_label")}>
            {[
              ["bi bi-phone", "online"],
              ["bi bi-scooter", "delivery"],
              ["bi bi-building-gear", "management"],
            ].map(([icon, key]) => (
              <article className="card public-feature-card" key={key}>
                <h2><i className={`${icon} app-icon public-heading-icon`} aria-hidden="true"></i><span>{t(`home.public.features.${key}.title`)}</span></h2>
                <p>{t(`home.public.features.${key}.description`)}</p>
              </article>
            ))}
          </section>

          <section className="card public-pricing-card" aria-label={t("home.public.pricing.aria_label")}>
            <div className="public-pricing-head">
              <div>
                <h2><i className="bi bi-stars app-icon public-heading-icon" aria-hidden="true"></i><span>{t("home.public.pricing.title")}</span></h2>
                <p>{t("home.public.pricing.description")}</p>
              </div>
            </div>

            <div className="public-plan-grid">
              <article className="public-plan">
                <span className="public-plan-badge"><i className="bi bi-gift" aria-hidden="true"></i>{t("home.public.pricing.badges.start")}</span>
                <h3>{t("home.public.pricing.plans.free.name")}</h3>
                <p className="public-plan-price">0฿<small>{t("home.public.pricing.month_suffix")}</small></p>
                <p>{t("home.public.pricing.plans.free.description")}</p>
                <ul>
                  <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("home.public.pricing.plans.free.features.basic_orders")}</span></li>
                  <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("home.public.pricing.plans.free.features.staff_login")}</span></li>
                </ul>
              </article>

              <article className="public-plan public-plan-featured">
                <span className="public-plan-badge"><i className="bi bi-lightning-charge" aria-hidden="true"></i>{t("home.public.pricing.badges.recommended")}</span>
                <h3>{t("home.public.pricing.plans.pro.name")}</h3>
                <p className="public-plan-price">390฿<small>{t("home.public.pricing.month_suffix")}</small></p>
                <p>{t("home.public.pricing.plans.pro.description")}</p>
                <ul>
                  <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>Order / Delivery / Kitchen</span></li>
                  <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("home.public.pricing.plans.pro.features.cashier_reports")}</span></li>
                </ul>
              </article>

              <article className="public-plan">
                <span className="public-plan-badge"><i className="bi bi-gem" aria-hidden="true"></i>{t("home.public.pricing.badges.full_system")}</span>
                <h3>{t("home.public.pricing.plans.premium.name")}</h3>
                <p className="public-plan-price">590฿<small>{t("home.public.pricing.month_suffix")}</small></p>
                <p>{t("home.public.pricing.plans.premium.description")}</p>
                <ul>
                  <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("home.public.pricing.plans.premium.features.retail_pos_staff")}</span></li>
                  <li><i className="bi bi-check-circle" aria-hidden="true"></i><span>{t("home.public.pricing.plans.premium.features.sync")}</span></li>
                </ul>
              </article>
            </div>

            <div className="public-cta-row">
              <Link className="btn btn-primary" to="/register"><i className="bi bi-person-plus app-icon" aria-hidden="true"></i><span>{t("home.public.pricing.register")}</span></Link>
              <Link className="btn btn-outline-public" to="/login"><i className="bi bi-box-arrow-in-right app-icon" aria-hidden="true"></i><span>{t("home.public.pricing.login")}</span></Link>
            </div>
            <p className="public-register-note">{t("home.public.pricing.register_note")}</p>
          </section>

          <section className="card public-contact-card" id="publicContactCard" aria-labelledby="publicContactTitle" hidden={!publicContact}>
            <div className="public-contact-copy">
              <span className="public-contact-kicker"><i className="bi bi-chat-heart" aria-hidden="true"></i><span>{t("home.public.contact.kicker")}</span></span>
              <h2 id="publicContactTitle">{publicContact?.heading || t("home.public.contact.title")}</h2>
              <p id="publicContactDescription">{publicContact?.description || t("home.public.contact.runtime_description")}</p>
            </div>
            <nav className="public-contact-links" id="publicContactLinks" aria-label={t("home.public.contact.channels_aria")}>
              {publicContact?.actions?.map(action => (
                <a
                  className="public-contact-action"
                  data-channel={action.channel}
                  href={action.href}
                  aria-label={action.label}
                  target={action.external ? "_blank" : undefined}
                  rel={action.external ? "noopener noreferrer" : undefined}
                  key={action.channel}
                >
                  <span className="public-contact-action-icon" aria-hidden="true"><i className={`bi bi-${action.icon}`}></i></span>
                  <span>{action.label}</span>
                </a>
              ))}
            </nav>
          </section>

          <section className="card quick-menu-card" aria-label={t("home.public.quick.aria_label")}>
            <div className="quick-menu-head">
              <h2><i className="bi bi-lightning-charge app-icon public-heading-icon" aria-hidden="true"></i><span>{t("home.public.quick.title")}</span></h2>
              <p>{t("home.public.quick.description")}</p>
            </div>
            <div className="quick-link-grid quick-link-grid-single">
              <Link className="quick-link" to="/login" style={{ alignItems: "center" }}>
                <span className="quick-link-icon" style={{ width: 42, height: 42, minWidth: 42, minHeight: 42, display: "inline-flex", alignItems: "center", justifyContent: "center", alignSelf: "center", flex: "0 0 42px", padding: 0, lineHeight: 1 }}><i className="bi bi-box-arrow-in-right app-icon" aria-hidden="true" style={{ width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", margin: 0, padding: 0, fontSize: 20, lineHeight: 1, flex: "0 0 20px" }}></i></span>
                <span className="quick-link-content">
                  <strong>{t("home.public.quick.staff_login_title")}</strong>
                  <span>{t("home.public.quick.staff_login_description")}</span>
                </span>
              </Link>
            </div>
          </section>

          <section className="card public-about-card" style={{ marginTop: 18 }}>
            <h2 style={{ marginTop: 0 }}><i className="bi bi-info-circle app-icon public-heading-icon" aria-hidden="true"></i><span>{t("home.public.about.title")}</span></h2>
            <p>{t("home.public.about.description")}</p>
            <div className="public-support">
              <nav className="public-support-links" aria-label={t("home.public.about.links_aria")}>
                <a className="public-support-link" href="mailto:sripleng.natchanon@gmail.com"><i className="bi bi-envelope app-icon public-inline-icon" aria-hidden="true"></i><span>{t("home.public.about.support")}</span></a>
                <a className="public-support-link" href="/privacy"><i className="bi bi-shield-check app-icon public-inline-icon" aria-hidden="true"></i><span>{t("home.public.about.privacy")}</span></a>
                <a className="public-support-link" href="/terms"><i className="bi bi-file-text app-icon public-inline-icon" aria-hidden="true"></i><span>{t("home.public.about.terms")}</span></a>
              </nav>
            </div>
          </section>
        </main>
      ) : (
        <main className="container" id="staffDashboard">
          <section className="hero staff-hero">
            <h1>{profile.role === "owner" ? t("home.staff.owner.title") : "PENGUIN / Order / Delivery / POS"}</h1>
            <p>{profile.role === "owner" ? shopName : t("home.staff.hero_description")}</p>
          </section>

          {masterRestaurantEnabled ? <section className="dashboard-section dashboard-section-order-delivery" aria-labelledby="frontServiceTitle">
            <div className="dashboard-section-head">
              <h2 id="frontServiceTitle">Order / Delivery</h2>
              <p>{t("home.staff.order_delivery.description")}</p>
            </div>
            <div className="nav-cards" aria-label={t("home.staff.order_delivery.aria_label")}>
              <DashboardCard profile={profile} tenant={tenant} roles={["owner","admin","kitchen","super_admin"]} href="/kitchen" cardKey="kitchen" icon="fi fi-rr-restaurant app-icon" label={t("home.staff.cards.kitchen")} description={t("home.staff.card_descriptions.kitchen")} />
              <DashboardCard profile={profile} tenant={tenant} roles={["owner","admin","cashier","super_admin"]} href="/cashier" cardKey="cashier" icon="fi fi-rr-receipt app-icon" label={t("home.staff.cards.cashier")} description={t("home.staff.card_descriptions.cashier")} />
              <DashboardCard profile={profile} tenant={tenant} roles={["owner","admin","super_admin"]} href="/admin" cardKey="admin" icon="fi fi-rr-settings-sliders app-icon" label={t("home.staff.cards.system_admin")} description={t("home.staff.card_descriptions.system_admin")} />
              <DashboardCard profile={profile} tenant={tenant} roles={["owner","super_admin"]} href="/admin/users" cardKey="admin_users" icon="fi fi-rr-users app-icon" label={t("home.staff.cards.staff_admin")} description={t("home.staff.card_descriptions.staff_admin")} />
            </div>
          </section> : null}

          {revenueShareEnabled ? (
            <section className="dashboard-section" aria-labelledby="centralReportsTitle" data-revenue-share-section>
              <div className="dashboard-section-head">
                <h2 id="centralReportsTitle">{t("revenue_share_report.menu.section_title")}</h2>
                <p>{t("revenue_share_report.menu.section_description")}</p>
              </div>
              <div className="nav-cards" aria-label={t("revenue_share_report.menu.section_title")}>
                <DashboardCard profile={profile} tenant={tenant} roles={["owner","admin"]} href="/reports/revenue-share" cardKey="revenue_share" icon="bi bi-graph-up-arrow app-icon" label={t("revenue_share_report.menu.title")} description={t("revenue_share_report.menu.description")} />
              </div>
            </section>
          ) : null}

          {masterRetailEnabled ? <section className="dashboard-section dashboard-section-pos" aria-labelledby="retailPosTitle">
            <div className="dashboard-section-head">
              <h2 id="retailPosTitle">Retail POS</h2>
              <p>{t("home.staff.retail_pos.description")}</p>
            </div>
            <div className="nav-cards nav-cards-pos" aria-label={t("home.staff.retail_pos.aria_label")}>
              <DashboardCard profile={profile} tenant={tenant} roles={["owner","admin","manager","cashier","super_admin"]} module="retail-pos" href="/pos" cardKey="pos" icon="fi fi-rr-shop app-icon" label={t("home.staff.retail_pos.store")} description="" feature />
              <DashboardCard profile={profile} tenant={tenant} roles={["owner","super_admin"]} module="retail-pos" href="/pos/catalog" cardKey="pos_catalog" icon="fi fi-rr-box-open app-icon" label="POS Catalog" description="" />
            </div>
          </section> : null}
        </main>
      )}

      <ParityFooter />
    </>
  );
}
