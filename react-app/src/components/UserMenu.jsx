import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from "firebase/auth";
import { auth } from "@/firebase/client";
import { clearRetailPosSession } from "@/auth/retailPosSession";
import { useI18n } from "@/i18n/I18nProvider";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";

const roleLabel = role => ({
  super_admin: "เจ้าของระบบ",
  owner: "เจ้าของร้าน",
  admin: "ผู้ดูแลระบบ",
  manager: "ผู้จัดการ",
  cashier: "แคชเชียร์",
  kitchen: "ครัว",
})[role] || role;

function greetingName(profile = {}) {
  if (profile.role === "cashier") return "แคชเชียร์";
  if (profile.role === "kitchen") return "Kitchen";
  if (profile.role === "manager") return "Manager";
  if (profile.role === "admin") return "Admin";
  if (profile.role === "owner") return profile.displayName || "Owner";
  if (profile.role === "super_admin") return profile.displayName || "Super Admin";
  return profile.displayName || roleLabel(profile.role);
}

const iconClass = {
  home: "fi fi-rr-house-chimney",
  people: "fi fi-rr-user-time",
  easel2: "fi fi-rr-room-service",
  settings: "fi fi-rr-settings-sliders",
  users: "fi fi-rr-users",
};

function menuLinks(profile = {}) {
  const reactPath = path => path;
  const links = [{ key: "home", href: "/", icon: "home", label: "หน้าหลัก" }];
  if (profile.role === "super_admin") {
    return [
      { key: "platform", href: reactPath("/platform"), icon: "home", label: "ระบบกลาง" },
      { key: "tenants", href: reactPath("/admin/tenants"), icon: "settings", label: "จัดการร้านค้า" },
    ];
  }
  if (["owner", "admin", "manager", "cashier"].includes(profile.role)) {
    links.push({ key: "waiting_queue", href: reactPath("/cashier/waiting-queue"), icon: "people", label: "คิวรอโต๊ะ" });
  }
  if (["owner", "cashier"].includes(profile.role)) {
    links.push({ key: "table_qr", href: reactPath("/cashier/table-qr"), icon: "easel2", label: "เปิดโต๊ะ" });
  }
  if (["owner", "admin"].includes(profile.role)) {
    links.push({ key: "admin", href: reactPath("/admin"), icon: "settings", label: "จัดการระบบร้าน" });
  }
  if (profile.role === "owner") {
    links.push({ key: "admin_users", href: reactPath("/admin/users"), icon: "users", label: "จัดการพนักงาน" });
  }
  return links;
}

function PasswordField({ label, name, value, visible, onChange, onToggle, hint, t }) {
  return (
    <label className="owner-password-field">
      <span className="owner-password-label"><i className="bi bi-lock app-icon" aria-hidden="true"></i><span>{label}</span></span>
      <span className="owner-password-input-wrap">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={event => onChange(event.target.value)}
          autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
          minLength={name === "currentPassword" ? undefined : 8}
          aria-required="true"
        />
        <button
          className="owner-password-toggle"
          type="button"
          onClick={onToggle}
          aria-label={t(visible ? "shared.password_dialog.hide_field" : "shared.password_dialog.show_field", { field: label })}
          aria-pressed={visible}
        >
          <i className={`bi bi-${visible ? "eye-slash" : "eye"} app-icon`} aria-hidden="true"></i>
        </button>
      </span>
      {hint ? <small className="owner-password-hint"><i className="bi bi-info-circle app-icon" aria-hidden="true"></i><span>{hint}</span></small> : null}
    </label>
  );
}

function OwnerPasswordDialog({ open, onClose }) {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const currentRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setVisible({});
    setMessage("");
    setSuccess(false);
    setBusy(false);
    const timer = window.setTimeout(() => currentRef.current?.querySelector?.("input")?.focus?.(), 30);
    const onKey = event => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const fail = key => {
    setSuccess(false);
    setMessage(t(key));
  };

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    if (!currentPassword || !newPassword || !confirmPassword) return fail("shared.password_dialog.required");
    if (newPassword !== confirmPassword) return fail("shared.password_dialog.mismatch");
    if (newPassword.length < 8) return fail("shared.password_dialog.too_short");

    const user = auth.currentUser;
    if (!user?.email) return fail("shared.password_dialog.failed");

    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setSuccess(true);
      setMessage(t("shared.password_dialog.success"));
      window.setTimeout(onClose, 900);
    } catch (error) {
      console.error("OWNER_PASSWORD_CHANGE_FAILED", error);
      const code = String(error?.code || "");
      if (["auth/invalid-credential", "auth/wrong-password", "auth/user-mismatch"].includes(code)) {
        fail("shared.password_dialog.current_invalid");
      } else if (code === "auth/weak-password") {
        fail("shared.password_dialog.too_short");
      } else {
        fail("shared.password_dialog.failed");
      }
      setBusy(false);
    }
  };

  const toggle = name => setVisible(current => ({ ...current, [name]: !current[name] }));

  return createPortal(
    <div className="owner-password-backdrop" data-ui-layer="modal" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form className="owner-password-dialog" data-owner-password-form onSubmit={submit}>
        <div className="owner-password-header">
          <span className="owner-password-heading-icon"><i className="fi fi-rr-key owner-password-key-icon" aria-hidden="true"></i></span>
          <div className="owner-password-title">
            <h2>{t("shared.password_dialog.title")}</h2>
            <p>{t("shared.password_dialog.description")}</p>
          </div>
          <button className="owner-password-close" type="button" disabled={busy} onClick={onClose} aria-label={t("shared.password_dialog.close")}>
            <i className="bi bi-x-lg app-icon" aria-hidden="true"></i>
          </button>
        </div>
        <div className="owner-password-body">
          <div ref={currentRef}>
            <PasswordField label={t("shared.password_dialog.current_password")} name="currentPassword" value={currentPassword} visible={visible.currentPassword} onChange={setCurrentPassword} onToggle={() => toggle("currentPassword")} t={t} />
          </div>
          <PasswordField label={t("shared.password_dialog.new_password")} name="newPassword" value={newPassword} visible={visible.newPassword} onChange={setNewPassword} onToggle={() => toggle("newPassword")} hint={t("shared.password_dialog.hint")} t={t} />
          <PasswordField label={t("shared.password_dialog.confirm_password")} name="confirmPassword" value={confirmPassword} visible={visible.confirmPassword} onChange={setConfirmPassword} onToggle={() => toggle("confirmPassword")} t={t} />
        </div>
        <div className={`owner-password-error${message ? " has-message" : ""}${success ? " is-success" : ""}`} data-password-error>
          <i className={`bi bi-${success ? "check-circle" : "x-circle"} app-icon`} aria-hidden="true"></i>
          <span data-password-message>{message}</span>
        </div>
        <div className="owner-password-actions">
          <button className="owner-password-cancel" type="button" disabled={busy} onClick={onClose}>
            <i className="bi bi-x-lg app-icon" aria-hidden="true"></i><span>{t("shared.password_dialog.cancel")}</span>
          </button>
          <button className="owner-password-submit" type="submit" disabled={busy}>
            <i className={busy ? "bi bi-arrow-repeat app-icon" : "fi fi-rr-key owner-password-key-icon"} aria-hidden="true"></i>
            <span>{t(busy ? "shared.password_dialog.submitting" : "shared.password_dialog.submit")}</span>
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export function UserMenu({ profile }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onClick = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = event => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const logout = async () => {
    if (loggingOut) return;
    setOpen(false);
    setLoggingOut(true);
    await signOut(auth).catch(error => console.warn("AUTH_SIGN_OUT_FAILED", error));
    clearRetailPosSession();
    localStorage.removeItem("food_order_active_tenant");
    localStorage.removeItem("food_order_active_shop");
    const loginPath = "/login";
    location.replace(loginPath);
  };

  const links = menuLinks(profile);
  return (
    <>
      <div className={`user-menu${open ? " open" : ""}`} data-user-menu="true" ref={rootRef} style={{ marginLeft: 0, order: 100 }}>
        <button type="button" className="user-menu-trigger" data-user-menu-trigger aria-expanded={open}
          aria-haspopup="menu" onClick={event => { event.stopPropagation(); setOpen(value => !value); }}>
          <span className="user-menu-avatar"><i className="bi bi-person app-icon" aria-hidden="true"></i></span>
          <span className="user-menu-trigger-label">{profile.displayName || roleLabel(profile.role)}</span>
          <i className="bi bi-chevron-down app-icon user-menu-chevron" aria-hidden="true"></i>
        </button>
        <div className="user-menu-panel" data-user-menu-panel role="menu" hidden={!open}>
          <div className="user-menu-greeting">
            สวัสดี {greetingName(profile)}
            <span className="user-menu-role">{roleLabel(profile.role)}</span>
          </div>
          {links.map(item => (
            <a className="user-menu-link" href={item.href} data-user-menu-key={item.key} role="menuitem" key={item.href}>
              <i className={`${iconClass[item.icon] || "fi fi-rr-circle"} app-icon`} aria-hidden="true"></i>
              <span>{item.label}</span>
            </a>
          ))}
          {profile.role === "owner" ? (
            <button
              type="button"
              className="user-menu-link"
              data-menu-action="change-password"
              role="menuitem"
              onClick={() => { setOpen(false); setPasswordOpen(true); }}
            >
              <i className="fi fi-rr-key app-icon fontawesome-profile-icon profile-key-reference-icon" aria-hidden="true"></i>
              <span>{t("shared.user_menu.change_password")}</span>
            </button>
          ) : null}
          <button type="button" className="user-menu-action danger" data-logout role="menuitem" onClick={logout}>
            <i className="fi fi-rr-exit app-icon" aria-hidden="true"></i>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>
      <OwnerPasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      {loggingOut ? <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} /> : null}
    </>
  );
}
