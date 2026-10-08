import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { createTenantOwner, listTenants, updateTenantOwner } from "@/data/platformTenantService";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

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

export function PlatformOwnersPage() {
  const authState = useAuth();
  const { profile } = authState;
  const { t, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("platform_owners.meta.title"),
    styles: ["tenant-admin.css", "platform-owners-modern.css", "super-admin-header.css"],
    attributes: { "data-roles": "super_admin" },
  });
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [initialReady, setInitialReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("create");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [confirmSecret, setConfirmSecret] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const displayNameRef = useRef(null);
  const confirmSecretRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setTenants(await listTenants());
    } catch (error) {
      console.error("PLATFORM_OWNERS_LOAD_FAILED", error);
      setLoadError(t("platform_owners.list.load_failed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role !== "super_admin") return undefined;
    let alive = true;
    setInitialReady(false);
    load().finally(() => { if (alive) setInitialReady(true); });
    return () => { alive = false; };
  }, [profile?.role]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return tenants.filter(tenant => {
      const text = [tenant.name, tenant.slug, tenant.ownerDisplayName, tenant.ownerEmail].join(" ").toLowerCase();
      if (keyword && !text.includes(keyword)) return false;
      if (filter === "has-owner" && !tenant.ownerUid) return false;
      if (filter === "no-owner" && tenant.ownerUid) return false;
      if (filter === "inactive" && tenant.active !== false) return false;
      return true;
    });
  }, [tenants, search, filter]);

  const ownerCount = tenants.filter(item => item.ownerUid).length;
  const pendingOwnerCount = Math.max(0, tenants.length - ownerCount);
  const inactiveCount = tenants.filter(item => item.active === false).length;

  const openModal = (tenant, nextMode) => {
    setSelected(tenant);
    setMode(nextMode);
    setDisplayName(nextMode === "edit" ? tenant.ownerDisplayName || "" : "");
    setEmail(nextMode === "edit" ? tenant.ownerEmail || "" : "");
    setSecret("");
    setConfirmSecret("");
    setFormError("");
    confirmSecretRef.current?.setCustomValidity?.("");
    document.body.classList.add("owner-modal-open");
    requestAnimationFrame(() => displayNameRef.current?.focus?.());
  };

  const closeModal = () => {
    if (saving) return;
    setSelected(null);
    setFormError("");
    document.body.classList.remove("owner-modal-open");
  };

  const submit = async event => {
    event.preventDefault();
    if (!selected) return;
    setFormError("");
    if (mode === "create" && secret !== confirmSecret) {
      setFormError(t("platform_owners.modal.password_mismatch"));
      return;
    }
    setSaving(true);
    try {
      if (mode === "edit") {
        await updateTenantOwner({ tenantId: selected.id, displayName: displayName.trim() });
        showToast(t("platform_owners.toast.updated"));
      } else {
        await createTenantOwner({
          tenantId: selected.id,
          displayName: displayName.trim(),
          email: email.trim().toLowerCase(),
          password: secret,
        });
        showToast(t("platform_owners.toast.created"));
      }
      setSelected(null);
      setFormError("");
      document.body.classList.remove("owner-modal-open");
      await load();
    } catch (error) {
      console.error("PLATFORM_OWNER_SAVE_FAILED", error);
      let message = mode === "edit" ? t("platform_owners.errors.update_failed") : t("platform_owners.errors.create_failed");
      if (error?.code === "functions/already-exists") message = t("platform_owners.errors.already_exists");
      if (error?.code === "functions/invalid-argument") message = t("platform_owners.errors.invalid");
      if (error?.code === "functions/permission-denied") message = t("platform_owners.errors.permission_denied");
      setFormError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === "Escape" && selected) closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("owner-modal-open");
    };
  }, [selected, saving]);

  useEffect(() => {
    const field = confirmSecretRef.current;
    if (!field || mode === "edit") return;
    field.setCustomValidity(!confirmSecret || confirmSecret === secret ? "" : t("platform_owners.modal.password_mismatch"));
  }, [confirmSecret, secret, mode, t]);

  if (authState.status === "loading" || !stylesReady || (profile?.role === "super_admin" && !initialReady)) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fplatform%2Fowners" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="super-admin-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><span>{t("platform_owners.header.title")}</span></div>
          <Link className="btn btn-sm super-admin-header-back" to="/platform"><i className="bi bi-arrow-left" aria-hidden="true"></i><span>{t("platform_owners.header.back")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main className="container platform-owners-page">
        <section className="platform-owners-hero">
          <div className="platform-owners-hero-copy">
            <span className="platform-owners-eyebrow"><i className="bi bi-stars" aria-hidden="true"></i>{t("platform_owners.hero.eyebrow")}</span>
            <h1>{t("platform_owners.hero.title")}</h1>
            <p>{t("platform_owners.hero.description")}</p>
          </div>
          <div className="platform-owners-metrics" aria-label={t("platform_owners.hero.metrics_aria")}>
            <article>
              <span className="platform-owner-metric-icon stores"><i className="bi bi-shop-window" aria-hidden="true"></i></span>
              <div><small>{t("platform_owners.hero.stats.stores")}</small><strong>{formatNumber(tenants.length)}</strong></div>
            </article>
            <article>
              <span className="platform-owner-metric-icon owners"><i className="bi bi-person-check" aria-hidden="true"></i></span>
              <div><small>{t("platform_owners.hero.stats.owners")}</small><strong>{formatNumber(ownerCount)}</strong></div>
            </article>
            <article>
              <span className="platform-owner-metric-icon pending"><i className="bi bi-person-plus" aria-hidden="true"></i></span>
              <div><small>{t("platform_owners.hero.stats.pending")}</small><strong>{formatNumber(pendingOwnerCount)}</strong></div>
            </article>
            <article>
              <span className="platform-owner-metric-icon inactive"><i className="bi bi-pause-circle" aria-hidden="true"></i></span>
              <div><small>{t("platform_owners.hero.stats.inactive")}</small><strong>{formatNumber(inactiveCount)}</strong></div>
            </article>
          </div>
        </section>

        <section className="card platform-owners-workspace">
          <div className="platform-owners-workspace-head">
            <div className="platform-owners-workspace-title">
              <span className="platform-owners-workspace-icon"><i className="bi bi-person-vcard" aria-hidden="true"></i></span>
              <div>
                <h2>{t("platform_owners.list.title")}</h2>
                <p>{t("platform_owners.list.description")}</p>
              </div>
            </div>
            <span className="platform-owner-result-pill" id="ownerCount">{t("platform_owners.list.result_count", { count: formatNumber(filtered.length), total: formatNumber(tenants.length) })}</span>
          </div>

          <div className="platform-owner-toolbar">
            <label className="platform-owner-control" htmlFor="ownerSearch">
              <span>{t("platform_owners.list.search_label")}</span>
              <span className="platform-owner-control-shell">
                <i className="bi bi-search" aria-hidden="true"></i>
                <input className="input" id="ownerSearch" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("platform_owners.list.search")} />
              </span>
            </label>
            <label className="platform-owner-control" htmlFor="ownerStatusFilter">
              <span>{t("platform_owners.list.filter_label")}</span>
              <span className="platform-owner-control-shell">
                <i className="bi bi-funnel" aria-hidden="true"></i>
                <select className="input" id="ownerStatusFilter" value={filter} onChange={e => setFilter(e.target.value)}>
                  <option value="all">{t("platform_owners.list.status_all")}</option>
                  <option value="has-owner">{t("platform_owners.list.status_has_owner")}</option>
                  <option value="no-owner">{t("platform_owners.list.status_no_owner")}</option>
                  <option value="inactive">{t("platform_owners.list.status_inactive")}</option>
                </select>
              </span>
            </label>
          </div>

          <div id="ownerList" className="platform-owner-grid">
            {loading ? <div className="platform-owner-empty-state"><i className="bi bi-arrow-repeat" aria-hidden="true"></i><strong>{t("platform_owners.list.loading")}</strong></div>
              : loadError ? <div className="upload-error">{loadError}</div>
              : filtered.length ? filtered.map(tenant => (
                <article className={`platform-owner-card${tenant.ownerUid ? " has-owner" : " needs-owner"}${tenant.active === false ? " is-inactive" : ""}`} key={tenant.id}>
                  <header className="platform-owner-card-head">
                    <div className="platform-owner-store-identity">
                      <span className="platform-owner-store-mark">{String(tenant.name || t("platform_owners.tenant.unknown_name")).trim().slice(0, 1).toUpperCase()}</span>
                      <div>
                        <span className="platform-owner-slug"><i className="bi bi-link-45deg" aria-hidden="true"></i>/{tenant.slug || "-"}</span>
                        <h3>{tenant.name || t("platform_owners.tenant.unknown_name")}</h3>
                      </div>
                    </div>
                    <span className={`platform-owner-store-status${tenant.active === false ? " inactive" : " active"}`}>
                      <i className="bi bi-circle-fill" aria-hidden="true"></i>
                      {tenant.active === false ? t("platform_owners.tenant.inactive") : t("platform_owners.tenant.active")}
                    </span>
                  </header>

                  <div className="platform-owner-profile">
                    <span className={`platform-owner-profile-icon${tenant.ownerUid ? " ready" : " pending"}`}>
                      <i className={`bi ${tenant.ownerUid ? "bi-person-badge" : "bi-person-plus"}`} aria-hidden="true"></i>
                    </span>
                    <div className="platform-owner-profile-copy">
                      <span>{t("platform_owners.tenant.owner_label")}</span>
                      <strong>{tenant.ownerUid ? (tenant.ownerDisplayName || t("platform_owners.tenant.owner_unknown")) : t("platform_owners.tenant.no_owner")}</strong>
                      <small>{tenant.ownerUid ? (tenant.ownerEmail || "-") : t("platform_owners.tenant.pending")}</small>
                    </div>
                    <span className={`platform-owner-account-state${tenant.ownerUid ? " ready" : " pending"}`}>
                      <i className={`bi ${tenant.ownerUid ? "bi-check-circle-fill" : "bi-clock-fill"}`} aria-hidden="true"></i>
                      {tenant.ownerUid ? t("platform_owners.tenant.owner_exists") : t("platform_owners.tenant.pending")}
                    </span>
                  </div>

                  <footer className="platform-owner-card-actions">
                    <span className="platform-owner-card-hint">
                      <i className={`bi ${tenant.ownerUid ? "bi-shield-check" : "bi-exclamation-circle"}`} aria-hidden="true"></i>
                      {tenant.ownerUid ? t("platform_owners.tenant.ready_help") : t("platform_owners.tenant.pending_help")}
                    </span>
                    {tenant.ownerUid
                      ? <button className="btn platform-owner-action" type="button" data-owner-action="edit" data-tenant-id={tenant.id} onClick={() => openModal(tenant, "edit")}><i className="bi bi-pencil-square app-icon" aria-hidden="true"></i><span>{t("platform_owners.tenant.edit_owner")}</span></button>
                      : <button className="btn btn-primary platform-owner-action" type="button" data-owner-action="create" data-tenant-id={tenant.id} onClick={() => openModal(tenant, "create")}><i className="bi bi-person-plus app-icon" aria-hidden="true"></i><span>{t("platform_owners.tenant.create_owner")}</span></button>}
                  </footer>
                </article>
              )) : <div className="platform-owner-empty-state"><i className="bi bi-search" aria-hidden="true"></i><strong>{t("platform_owners.list.empty")}</strong><span>{t("platform_owners.list.empty_help")}</span></div>}
          </div>
        </section>
      </main>

      <div className="owner-modal" hidden={!selected}>
        <div className="owner-modal-backdrop" data-owner-close onClick={closeModal}></div>
        <section className="owner-modal-card" role="dialog" aria-modal="true" aria-labelledby="ownerModalTitle">
          <div className="owner-modal-head">
            <div>
              <div className="owner-modal-icon"><i className="bi bi-person app-icon"></i></div>
              <div><h2 id="ownerModalTitle">{t(mode === "edit" ? "platform_owners.modal.edit_title" : "platform_owners.modal.create_title")}</h2><p id="ownerModalShop">{selected?.name || selected?.slug || selected?.id || "-"}</p></div>
            </div>
            <button type="button" className="owner-modal-close" data-owner-close aria-label={t("platform_owners.modal.close")} onClick={closeModal}><i className="bi bi-x-lg app-icon"></i></button>
          </div>
          <form id="ownerForm" className="owner-modal-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="ownerDisplayName">{t("platform_owners.modal.display_name")}</label>
              <input ref={displayNameRef} className="input" id="ownerDisplayName" maxLength="120" autoComplete="name" required value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ownerEmail">{t("platform_owners.modal.email")}</label>
              <input className="input" id="ownerEmail" type="email" maxLength="160" autoComplete="username" required disabled={mode === "edit"} value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            {mode !== "edit" ? <div id="ownerPasswordFields" className="grid grid-2 owner-password-grid">
              <div className="field">
                <label htmlFor="ownerPassword">{t("platform_owners.modal.password")}</label>
                <input className="input" id="ownerPassword" type="password" minLength="8" autoComplete="new-password" required value={secret} onChange={e => setSecret(e.target.value)} />
                <small>{t("platform_owners.modal.password_help")}</small>
              </div>
              <div className="field">
                <label htmlFor="ownerPasswordConfirm">{t("platform_owners.modal.password_confirm")}</label>
                <input ref={confirmSecretRef} className="input" id="ownerPasswordConfirm" type="password" minLength="8" autoComplete="new-password" required value={confirmSecret} onChange={e => setConfirmSecret(e.target.value)} />
                <small>{t("platform_owners.modal.password_confirm_help")}</small>
              </div>
            </div> : null}
            {formError ? <div className="upload-error owner-form-error" id="ownerFormError">{formError}</div> : <div className="upload-error owner-form-error" id="ownerFormError" hidden></div>}
            <div className="owner-modal-actions">
              <button type="button" className="btn" data-owner-close onClick={closeModal}><i className="bi bi-x-lg app-icon"></i><span>{t("platform_owners.modal.cancel")}</span></button>
              <button type="submit" className="btn btn-primary" id="ownerSubmitButton" disabled={saving}>{saving ? <span>{t("platform_owners.modal.saving")}</span> : <><i className="bi bi-floppy app-icon"></i><span>{t(mode === "edit" ? "platform_owners.modal.save_name" : "platform_owners.modal.create_account")}</span></>}</button>
            </div>
          </form>
        </section>
      </div>

      <ParityFooter />
    </>
  );
}
