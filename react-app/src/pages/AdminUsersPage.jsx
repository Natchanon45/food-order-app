import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import { createStaffUser, listStaffUsers, updateStaffUser } from "@/data/adminStaff";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

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

// Presentation-only labels; stay local to this page instead of modifying
// the pinned SOURCE translation bundle or account/role authorization.
const STAFF_UI_COPY = {
  th: { total: "ทีมงานทั้งหมด", enabled: "ใช้งานอยู่", suspended: "ระงับใช้งาน",
    search: "ค้นหาชื่อหรืออีเมลพนักงาน", all: "ทั้งหมด", clear: "ล้างการค้นหา",
    emptySearch: "ไม่พบพนักงานที่ตรงกับการค้นหา", member: "ข้อมูลพนักงาน", person: "สมาชิกทีม",
  },
  en: { total: "Team members", enabled: "Active", suspended: "Suspended",
    search: "Search by name or email", all: "All", clear: "Clear search",
    emptySearch: "No matching team members", member: "Team member", person: "Team member",
  },
  my: { total: "ဝန်ထမ်းအားလုံး", enabled: "အသုံးပြုနေသည်", suspended: "ဆိုင်းငံ့ထားသည်",
    search: "အမည် သို့မဟုတ် အီးမေးလ်ဖြင့် ရှာပါ", all: "အားလုံး", clear: "ရှာဖွေမှုရှင်းရန်",
    emptySearch: "ကိုက်ညီသောဝန်ထမ်းမရှိပါ", member: "ဝန်ထမ်း", person: "ဝန်ထမ်း",
  },
  lo: { total: "ພະນັກງານທັງໝົດ", enabled: "ກຳລັງໃຊ້ງານ", suspended: "ລະງັບໃຊ້ງານ",
    search: "ຄົ້ນຫາຊື່ ຫຼື ອີເມວ", all: "ທັງໝົດ", clear: "ລ້າງການຄົ້ນຫາ",
    emptySearch: "ບໍ່ພົບພະນັກງານ", member: "ພະນັກງານ", person: "ພະນັກງານ",
  },
  km: { total: "បុគ្គលិកសរុប", enabled: "កំពុងប្រើប្រាស់", suspended: "បានផ្អាក",
    search: "ស្វែងរកតាមឈ្មោះ ឬអ៊ីមែល", all: "ទាំងអស់", clear: "សម្អាតការស្វែងរក",
    emptySearch: "មិនមានបុគ្គលិកដែលត្រូវគ្នា", member: "បុគ្គលិក", person: "បុគ្គលិក",
  },
};

const EMPTY_FORM = {
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "admin",
  businessScope: "order_delivery",
  active: true,
};

export function AdminUsersPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const ownerId = String(authUser?.uid || authUser?.id || "");
  const { t, locale } = useI18n();
  const ui = STAFF_UI_COPY[locale] || STAFF_UI_COPY.th;
  const stylesReady = useParityPage({
    title: t("admin_users.meta.title"),
    bodyClass: "order-delivery-workspace admin-users-page",
    styles: ["app.css", "icons.css", "order-delivery-workspace-theme.css", "admin-users.css", "staff-modern-port.css"],
  });

  const dialogRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  // A validated staff list belongs to one tenant and one read request.
  // Ignore replies from an earlier tenant, even if they arrive out of order.
  const [readyTenantId, setReadyTenantId] = useState("");
  const loadRequestRef = useRef(0);
  const activeTenantIdRef = useRef("");
  activeTenantIdRef.current = tenantState.tenant?.id || "";
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingUid, setSavingUid] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Counts use persisted staff status, not unsaved UI drafts.
  const enabledCount = users.filter(row => row.active === true).length;
  const suspendedCount = users.length - enabledCount;
  const searchTerm = search.trim().toLocaleLowerCase();
  const visibleUsers = users.filter(row =>
    (statusFilter === "all" || (statusFilter === "active" ? row.active : !row.active)) &&
    (!searchTerm || [row.displayName, row.email, row.role, row.businessScope]
      .some(value => String(value || "").toLocaleLowerCase().includes(searchTerm)))
  );

  const load = useCallback(async () => {
    const expectedTenantId = tenantState.tenant?.id;
    if (!expectedTenantId) return;
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const rows = await listStaffUsers(expectedTenantId);
      if (requestId !== loadRequestRef.current || activeTenantIdRef.current !== expectedTenantId) return;
      setUsers(rows);
      setDrafts(Object.fromEntries(rows.map(user => [user.uid, {
        displayName: user.displayName || "",
        role: user.role || "admin",
        businessScope: user.businessScope || "order_delivery",
        active: user.active !== false,
      }])));
    } catch (error) {
      if (requestId !== loadRequestRef.current || activeTenantIdRef.current !== expectedTenantId) return;
      console.error("ADMIN_USERS_LOAD_FAILED", error);
      // A failed read must not leave old staff visible or editable.
      setUsers([]);
      setDrafts({});
      const message = t("admin_users.list.load_failed");
      setLoadError(message);
      showToast(message, "error");
    } finally {
      if (requestId === loadRequestRef.current && activeTenantIdRef.current === expectedTenantId) {
        setLoading(false);
        setReadyTenantId(expectedTenantId);
      }
    }
  }, [t, tenantState.tenant?.id]);

  useEffect(() => {
    if (profile?.role === "owner" && tenantState.status === "ready" && tenantState.tenant?.id) load();
    return () => { loadRequestRef.current += 1; };
  }, [profile?.role, tenantState.status, load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    dialogRef.current?.showModal?.();
    requestAnimationFrame(() => document.getElementById("displayName")?.focus());
  };

  const closeCreate = () => {
    if (creating) return;
    dialogRef.current?.close?.();
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const submitCreate = async event => {
    event.preventDefault();
    if (profile?.role !== "owner" || tenantState.status !== "ready" || loadError ||
        loading || readyTenantId !== tenantState.tenant?.id || creating) return;
    setFormError("");
    if (form.password.length < 8) {
      setFormError(t("admin_users.validation.password_min"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFormError(t("admin_users.validation.password_mismatch"));
      return;
    }

    setCreating(true);
    try {
      await createStaffUser(tenantState.tenant.id, {
        displayName: form.displayName,
        email: form.email,
        password: form.password,
        role: form.role,
        businessScope: form.businessScope,
        active: form.active,
      });
      dialogRef.current?.close?.();
      setForm(EMPTY_FORM);
      showToast(t("admin_users.messages.created"));
      await load();
    } catch (error) {
      console.error("ADMIN_USERS_CREATE_FAILED", error);
      const code = String(error?.code || error?.message || "");
      let message = t("admin_users.messages.create_failed");
      if (error?.response?.status === 409 || code.includes("already-exists")) message = t("admin_users.messages.email_exists");
      else if (error?.response?.status === 400 || error?.response?.status === 422 ||
        code.includes("invalid-argument") || code === "STAFF_PASSWORD_LENGTH_INVALID")
        message = t("admin_users.messages.invalid_data");
      else if (error?.response?.status === 403 || code.includes("permission-denied")) message = t("admin_users.messages.forbidden");
      setFormError(message);
      showToast(message, "error");
    } finally {
      setCreating(false);
    }
  };

  const patchDraft = (uid, patch) => {
    setDrafts(current => ({
      ...current,
      [uid]: { ...(current[uid] || {}), ...patch },
    }));
  };

  const saveUser = async user => {
    if (!user?.uid || String(user.uid) === ownerId || savingUid || loadError || loading ||
        readyTenantId !== tenantState.tenant?.id || profile?.role !== "owner") return;
    const draft = drafts[user.uid] || {};
    setSavingUid(user.uid);
    try {
      await updateStaffUser(tenantState.tenant.id, user.uid, {
        email: user.email,
        displayName: draft.displayName,
        role: draft.role,
        businessScope: draft.businessScope,
        active: draft.active,
      });
      showToast(t("admin_users.messages.saved"));
      await load();
    } catch (error) {
      console.error("ADMIN_USERS_SAVE_FAILED", error);
      showToast(t("admin_users.messages.save_failed"), "error");
    } finally {
      setSavingUid("");
    }
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (profile?.role === "owner" && tenantState.status === "ready" && tenantState.tenant?.id &&
      readyTenantId !== tenantState.tenant.id)) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (authState.status !== "ready") return <main role="alert" data-admin-users-auth-error>ไม่สามารถตรวจสอบสิทธิ์กับ PENGUIN ได้</main>;
  if (!profile) return <Navigate to="/login?next=%2Fadmin%2Fusers" replace />;
  if (profile.role !== "owner") return <Navigate to="/" replace />;
  if (tenantState.status !== "ready" || !tenantState.tenant) return <main role="alert" data-admin-users-tenant-error>PENGUIN ไม่อนุญาตให้ใช้ข้อมูลร้านนี้</main>;

  return (
    <>
      <header className="app-header">
        <div className="admin-users-header-leading">
          <span className="brand-mark">PG</span>
          <span className="admin-users-header-title">{t("admin_users.header.title")}</span>
          <Link className="btn btn-sm admin-users-header-back" to="/admin" aria-label={t("admin_users.header.back")}><i className="bi bi-arrow-left app-icon" aria-hidden="true"></i><span className="staff-back-symbol" aria-hidden="true">←</span><span className="staff-back-text">{t("admin_users.header.back")}</span></Link>
        </div>
        <div className="app-header-actions admin-users-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main className="container">
        <section className="hero staff-hero">
          <div>
            <span className="staff-hero-kicker"><i className="bi bi-people" aria-hidden="true"></i> {t("admin_users.hero.kicker")}</span>
            <h1>{t("admin_users.hero.title")}</h1>
            <p>{t("admin_users.hero.description")}</p>
          </div>
          <button className="btn staff-create-trigger" id="openCreateUserModal" type="button" disabled={Boolean(loadError) || loading} onClick={openCreate}>
            <i className="bi bi-person-plus" aria-hidden="true"></i><span>{t("admin_users.hero.add")}</span>
          </button>
        </section>

        <section className="staff-overview" aria-label={ui.total}>
          <div className="staff-metric staff-metric-total">
            <span className="staff-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-2a5.5 5.5 0 0 1 11 0v2M17 11a3 3 0 1 0-1.1-5.8M17 14a4.5 4.5 0 0 1 3.5 4.4V19" /></svg></span>
            <div><span className="staff-metric-label">{ui.total}</span><strong className="staff-metric-value">{users.length}</strong></div>
            <span className="staff-metric-corner" aria-hidden="true"><i className="bi bi-arrow-up-right"></i></span>
          </div>
          <div className="staff-metric staff-metric-active">
            <span className="staff-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3" /><path d="M3 19v-2a6 6 0 0 1 10.2-4.3M15.2 17l2.1 2.1 4.2-5" /></svg></span>
            <div><span className="staff-metric-label">{ui.enabled}</span><strong className="staff-metric-value">{enabledCount}</strong></div>
            <span className="staff-metric-status-dot" aria-hidden="true"></span>
          </div>
          <div className="staff-metric staff-metric-suspended">
            <span className="staff-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3" /><path d="M3 19v-2a6 6 0 0 1 10.2-4.3M16 17h5" /></svg></span>
            <div><span className="staff-metric-label">{ui.suspended}</span><strong className="staff-metric-value">{suspendedCount}</strong></div>
            <span className="staff-metric-status-dot" aria-hidden="true"></span>
          </div>
        </section>

        <section className="card staff-list-card">
          <div className="section-title staff-list-heading">
            <div><h2>{t("admin_users.list.title")}</h2><p>{t("admin_users.list.description")}</p></div>
            <span className="badge" id="userCount">{t("admin_users.list.count", { count: users.length })}</span>
          </div>
          <div className="staff-toolbar">
            <label className="staff-search">
              <i className="bi bi-search" aria-hidden="true"></i>
              <span className="sr-only">{ui.search}</span>
              <input type="search" value={search} onChange={event => setSearch(event.target.value)}
                placeholder={ui.search} aria-label={ui.search} data-staff-search />
              {search ? <button type="button" onClick={() => setSearch("")} aria-label={ui.clear} className="staff-search-clear"><i className="bi bi-x-lg" aria-hidden="true"></i></button> : null}
            </label>
            <div className="staff-status-filters" role="group" aria-label={t("admin_users.list.columns.active")}>
              {[["all",ui.all,users.length],["active",ui.enabled,enabledCount],["suspended",ui.suspended,suspendedCount]].map(([value,label,count]) =>
                <button type="button" key={value} className={"staff-filter" + (statusFilter === value ? " is-current" : "")}
                  aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)} data-staff-filter={value}>
                  {label}<span>{count}</span>
                </button>
              )}
            </div>
          </div>
          {loadError ? <div className="upload-error" role="alert">{loadError}</div> : null}

          <div className="user-mobile-list" id="userMobileRows">
            {loading ? <div className="empty">{t("shared.state.loading")}</div>
              : visibleUsers.length ? visibleUsers.map(user => {
                const draft = drafts[user.uid] || {};
                const isSelf = String(user.uid) === ownerId;
                const isActive = draft.active !== false;
                return (
                  <article className={"staff-user-card" + (user.active ? "" : " is-suspended")} key={"mobile-" + user.uid}>
                    <div className="staff-user-card-head">
                      <span className="staff-user-avatar" aria-hidden="true"><i className="bi bi-person"></i></span>
                      <div className="staff-user-identity">
                        <label className="staff-user-field staff-user-name-field">
                          <span>{t("admin_users.list.columns.name")}</span>
                          <input className="input" data-mobile-name-uid={user.uid} maxLength="100" value={draft.displayName ?? ""} onChange={e => patchDraft(user.uid, { displayName: e.target.value })} />
                        </label>
                        <div className="staff-user-email"><i className="bi bi-envelope" aria-hidden="true"></i><span>{user.email || "-"}</span></div>
                      </div>
                    </div>

                    <div className="staff-user-card-status">
                      <span className={"staff-state-tag" + (user.active ? " is-active" : " is-suspended")}>
                        <span aria-hidden="true"></span>{user.active ? ui.enabled : ui.suspended}
                      </span>
                    </div>
                    <div className="staff-user-card-fields">
                      <label className="staff-user-field">
                        <span>{t("admin_users.list.columns.role")}</span>
                        <select className="input" data-mobile-role-uid={user.uid} value={draft.role || "admin"} onChange={e => patchDraft(user.uid, { role: e.target.value })}><option value="admin">{t("admin_users.roles.admin")}</option><option value="cashier">{t("admin_users.roles.cashier")}</option><option value="kitchen">{t("admin_users.roles.kitchen")}</option><option value="manager">Manager</option><option value="stock">Stock</option></select>
                      </label>
                      <label className="staff-user-field">
                        <span>{t("admin_users.list.columns.scope")}</span>
                        <select className="input" data-mobile-scope-uid={user.uid} value={draft.businessScope || "order_delivery"} onChange={e => patchDraft(user.uid, { businessScope: e.target.value })}><option value="order_delivery">{t("admin_users.scopes.order_delivery")}</option><option value="retail_pos">{t("admin_users.scopes.retail_pos")}</option><option value="both">{t("admin_users.scopes.both")}</option></select>
                      </label>
                    </div>

                    <div className="staff-user-card-footer">
                      <div className="staff-user-active">
                        <span>{t("admin_users.list.columns.active")}</span>
                        <button
                          className={"staff-user-switch" + (isActive ? " is-on" : " is-off")}
                          type="button"
                          role="switch"
                          aria-checked={isActive}
                          aria-label={t("admin_users.list.columns.active")}
                          data-mobile-active-uid={user.uid}
                          onClick={() => patchDraft(user.uid, { active: !isActive })}
                        >
                          <span className="staff-user-switch-knob" aria-hidden="true"></span>
                        </button>
                      </div>
                      <button className="btn btn-primary btn-sm staff-user-save" type="button" data-mobile-save-user={user.uid} disabled={isSelf || savingUid === user.uid || Boolean(loadError) || loading} onClick={() => saveUser(user)}>
                        <i className={"bi " + (savingUid === user.uid ? "bi-hourglass-split" : "bi-floppy")} aria-hidden="true"></i>
                        <span>{t(savingUid === user.uid ? "admin_users.actions.saving" : "admin_users.actions.save")}</span>
                      </button>
                    </div>
                  </article>
                );
              }) : <div className="empty staff-empty"><i className="bi bi-search" aria-hidden="true"></i><span>{search || statusFilter !== "all" ? ui.emptySearch : t("admin_users.list.empty")}</span></div>}
          </div>

          <div className="user-table-scroll user-desktop-table">
            <table className="table-list user-table">
              <thead><tr><th>{t("admin_users.list.columns.name")}</th><th>{t("admin_users.list.columns.email")}</th><th>{t("admin_users.list.columns.role")}</th><th>{t("admin_users.list.columns.scope")}</th><th>{t("admin_users.list.columns.active")}</th><th></th></tr></thead>
              <tbody id="userRows">
                {loading ? <tr><td colSpan="6"><div className="empty">{t("shared.state.loading")}</div></td></tr>
                  : visibleUsers.length ? visibleUsers.map(user => {
                    const draft = drafts[user.uid] || {};
                    return (
                      <tr key={user.uid} className={user.active ? "" : "is-suspended"}>
                        <td><div className="staff-desktop-person">
                          <span className="staff-desktop-avatar" aria-hidden="true"><i className="bi bi-person" /></span>
                          <input className="input" data-name-uid={user.uid} aria-label={t("admin_users.list.columns.name")} maxLength="100"
                            value={draft.displayName ?? ""} onChange={e => patchDraft(user.uid, { displayName: e.target.value })} />
                        </div></td>
                        <td><span className="staff-desktop-email" title={user.email || "-"}>{user.email || "-"}</span></td>
                        <td><select className="input" data-role-uid={user.uid} value={draft.role || "admin"} onChange={e => patchDraft(user.uid, { role: e.target.value })}><option value="admin">{t("admin_users.roles.admin")}</option><option value="cashier">{t("admin_users.roles.cashier")}</option><option value="kitchen">{t("admin_users.roles.kitchen")}</option><option value="manager">Manager</option><option value="stock">Stock</option></select></td>
                        <td><select className="input" data-scope-uid={user.uid} value={draft.businessScope || "order_delivery"} onChange={e => patchDraft(user.uid, { businessScope: e.target.value })}><option value="order_delivery">{t("admin_users.scopes.order_delivery")}</option><option value="retail_pos">{t("admin_users.scopes.retail_pos")}</option><option value="both">{t("admin_users.scopes.both")}</option></select></td>
                        <td><label className="staff-desktop-active">
                          <input type="checkbox" data-active-uid={user.uid} checked={draft.active !== false}
                            onChange={e => patchDraft(user.uid, { active: e.target.checked })} />
                          <span>{draft.active !== false ? ui.enabled : ui.suspended}</span>
                        </label></td>
                        <td><button className="btn btn-primary btn-sm user-save-button" type="button" data-save-user={user.uid} disabled={String(user.uid) === ownerId || savingUid === user.uid || Boolean(loadError) || loading} onClick={() => saveUser(user)}><i className={"bi " + (savingUid === user.uid ? "bi-hourglass-split" : "bi-floppy")} aria-hidden="true"></i><span>{t(savingUid === user.uid ? "admin_users.actions.saving" : "admin_users.actions.save")}</span></button></td>
                      </tr>
                    );
                  }) : <tr><td colSpan="6"><div className="empty staff-empty"><i className="bi bi-search" aria-hidden="true"></i><span>{search || statusFilter !== "all" ? ui.emptySearch : t("admin_users.list.empty")}</span></div></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <dialog className="staff-dialog" id="userDialog" aria-labelledby="userDialogTitle" ref={dialogRef} onCancel={e => { e.preventDefault(); closeCreate(); }}>
        <form id="userForm" className="staff-dialog-form" onSubmit={submitCreate}>
          <header className="staff-dialog-header">
            <span className="staff-dialog-icon"><i className="bi bi-person-plus" aria-hidden="true"></i></span>
            <div><h2 id="userDialogTitle">{t("admin_users.dialog.title")}</h2><p>{t("admin_users.dialog.description")}</p></div>
            <button className="staff-dialog-close" id="closeCreateUserModal" type="button" aria-label={t("admin_users.dialog.close")} disabled={creating} onClick={closeCreate}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
          </header>
          <div className="staff-dialog-body">
            <div className="grid grid-2">
              <div className="field"><label htmlFor="displayName">{t("admin_users.dialog.display_name")}</label><input className="input" id="displayName" required maxLength="100" value={form.displayName} onChange={e => setForm(current => ({ ...current, displayName: e.target.value }))} placeholder={t("admin_users.dialog.display_name_placeholder")} /></div>
              <div className="field"><label htmlFor="email">{t("admin_users.dialog.email")}</label><input className="input" id="email" type="email" autoComplete="off" required value={form.email} onChange={e => setForm(current => ({ ...current, email: e.target.value }))} placeholder="name@example.com" /></div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label htmlFor="password">{t("admin_users.dialog.password")}</label><input className="input" id="password" type="password" autoComplete="new-password" minLength="8" required value={form.password} onChange={e => setForm(current => ({ ...current, password: e.target.value }))} placeholder={t("admin_users.dialog.password_placeholder")} /></div>
              <div className="field"><label htmlFor="confirmPassword">{t("admin_users.dialog.confirm_password")}</label><input className="input" id="confirmPassword" type="password" autoComplete="new-password" minLength="8" required value={form.confirmPassword} onChange={e => setForm(current => ({ ...current, confirmPassword: e.target.value }))} placeholder={t("admin_users.dialog.confirm_password_placeholder")} /></div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label htmlFor="role">{t("admin_users.dialog.role")}</label><select className="input" id="role" required value={form.role} onChange={e => setForm(current => ({ ...current, role: e.target.value }))}><option value="admin">{t("admin_users.role_options.admin")}</option><option value="cashier">{t("admin_users.role_options.cashier")}</option><option value="kitchen">{t("admin_users.role_options.kitchen")}</option><option value="manager">Manager</option><option value="stock">Stock</option></select></div>
              <div className="field"><label htmlFor="businessScope">{t("admin_users.dialog.scope")}</label><select className="input" id="businessScope" required value={form.businessScope} onChange={e => setForm(current => ({ ...current, businessScope: e.target.value }))}><option value="order_delivery">{t("admin_users.scope_options.order_delivery")}</option><option value="retail_pos">{t("admin_users.scope_options.retail_pos")}</option><option value="both">{t("admin_users.scope_options.both")}</option></select></div>
            </div>
            <label className="staff-active-option"><span><strong>{t("admin_users.dialog.active_title")}</strong><small>{t("admin_users.dialog.active_help")}</small></span><input type="checkbox" id="active" checked={form.active} onChange={e => setForm(current => ({ ...current, active: e.target.checked }))} /></label>
            {formError ? <div className="upload-error" id="userError">{formError}</div> : <div className="upload-error" id="userError" hidden></div>}
          </div>
          <footer className="staff-dialog-footer">
            <button className="btn staff-cancel-button" id="cancelCreateUserModal" type="button" disabled={creating} onClick={closeCreate}><i className="bi bi-x-circle" aria-hidden="true"></i><span>{t("admin_users.dialog.cancel")}</span></button>
            <button className="btn btn-primary user-form-action" id="createUserButton" type="submit" disabled={creating}><i className={"bi " + (creating ? "bi-hourglass-split" : "bi-person-plus")} aria-hidden="true"></i><span>{t(creating ? "admin_users.dialog.creating" : "admin_users.dialog.create")}</span></button>
          </footer>
        </form>
      </dialog>

      <ParityFooter />
    </>
  );
}
