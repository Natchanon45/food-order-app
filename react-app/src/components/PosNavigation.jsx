import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "firebase/auth";
import { clearRetailPosSession, getRetailPosSession } from "@/auth/retailPosSession";
import { PosUserProfile } from "@/components/PosUserProfile";
import { auth } from "@/firebase/client";
import { useI18n } from "@/i18n/I18nProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { loadPosRoleSettings } from "@/data/retailPosSystemData";

export const POS_MENU_GROUPS = [
  { id: "sales", label: "ขายหน้าร้าน", icon: "cart3", tone: "emerald", items: [
    { key: "pos.sale", label: "หน้าขาย", href: "/pos", icon: "cart3", tone: "emerald" },
    { key: "pos.sales", label: "ประวัติการขาย", href: "/pos/sales", icon: "receipt", tone: "blue" },
    { key: "pos.tax_invoices", label: "ใบกำกับภาษี", href: "/pos/tax-invoices", icon: "file-earmark-text", tone: "amber" },
    { key: "pos.returns", label: "คืนสินค้า", href: "/pos/returns", icon: "arrow-counterclockwise", tone: "rose" },
    { key: "pos.shifts", label: "กะพนักงาน", href: "/pos/shifts", icon: "clock-history", tone: "violet" },
  ]},
  { id: "stock", label: "สินค้าและสต็อก", icon: "boxes", tone: "teal", items: [
    { key: "pos.products", label: "สินค้าและสต็อก", href: "/pos/products", icon: "box-seam", tone: "teal" },
    { key: "pos.stock_movements", label: "เคลื่อนไหวสต็อก", href: "/pos/stock-movements", icon: "arrow-left-right", tone: "sky" },
    { key: "pos.stock_counts", label: "ตรวจนับสต็อก", href: "/pos/stock-counts", icon: "clipboard-check", tone: "lime" },
  ]},
  { id: "purchase", label: "จัดซื้อ", icon: "truck", tone: "orange", items: [
    { key: "pos.purchases", label: "รับสินค้าเข้า", href: "/pos/purchases", icon: "truck", tone: "orange" },
    { key: "pos.payables", label: "เจ้าหนี้", href: "/pos/payables", icon: "cash-stack", tone: "amber" },
    { key: "pos.suppliers", label: "ผู้จำหน่าย", href: "/pos/suppliers", icon: "building", tone: "indigo" },
  ]},
  { id: "customer", label: "ลูกค้าและสมาชิก", icon: "person-vcard", tone: "pink", items: [
    { key: "pos.customers", label: "ทะเบียนลูกค้า", href: "/pos/customers", icon: "person-vcard", tone: "pink" },
  ]},
  { id: "system", label: "ระบบ", icon: "gear", tone: "slate", items: [
    { key: "pos.settings", label: "ตั้งค่าร้าน", href: "/pos/settings", icon: "gear", tone: "slate" },
    { key: "pos.backup", label: "สำรองและกู้คืน", href: "/pos/backup", icon: "database-down", tone: "cyan" },
    { key: "pos.users", label: "ผู้ใช้และสิทธิ์", href: "/pos/users", icon: "shield-lock", tone: "purple" },
  ]},
];

const permissionTranslationKey = key => `pos_users.permission_items.${String(key || "").replaceAll(".", "_")}`;
const translatedOrFallback = (t, key, fallback) => {
  const translated = t(key);
  return translated && translated !== key ? translated : fallback || key;
};

export function getPosPermissions(profile, roleRows = null) {
  if (profile?.role === "owner" || profile?.roleId === "owner") {
    return new Set(POS_MENU_GROUPS.flatMap(group => group.items.map(item => item.key)));
  }
  try {
    const roles = Array.isArray(roleRows) ? roleRows : JSON.parse(localStorage.getItem("retail_pos_roles_v1") || "[]");
    const roleId = String(profile?.roleId || profile?.role || "");
    const role = Array.isArray(roles) ? roles.find(item => String(item?.id || "") === roleId) : null;
    if (role?.permissions?.length) return new Set(role.permissions);
  } catch {}
  if (profile?.role === "cashier") {
    return new Set(["pos.sale", "pos.sales", "pos.tax_invoices", "pos.returns", "pos.shifts", "pos.customers"]);
  }
  if (profile?.role === "manager" || profile?.role === "admin") {
    return new Set(POS_MENU_GROUPS.flatMap(group => group.items.map(item => item.key))
      .filter(key => !["pos.backup", "pos.users"].includes(key)));
  }
  if (profile?.role === "stock") {
    return new Set(["pos.products", "pos.stock_movements", "pos.stock_counts", "pos.purchases", "pos.suppliers"]);
  }
  return new Set(["pos.sale"]);
}

export function firstAllowedPosPage(profile, roleRows = null) {
  const permissions = getPosPermissions(profile, roleRows);
  return POS_MENU_GROUPS
    .flatMap(group => group.items)
    .find(item => permissions.has(item.key))?.href || "/pos/forbidden";
}

export function PosNavigation({ profile, currentKey = "" }) {
  const { t } = useI18n();
  const { tenant } = useTenant();
  const sessionProfile = useMemo(() => getRetailPosSession(), [
    profile?.uid,
    profile?.id,
    profile?.tenantId,
    profile?.email,
    profile?.displayName,
    profile?.name,
    profile?.role,
    profile?.roleId,
  ]);
  const posProfile = useMemo(() => ({
    ...(profile || {}),
    ...(sessionProfile || {}),
    displayName: sessionProfile?.name || profile?.displayName || profile?.name || profile?.email || "",
    name: sessionProfile?.name || profile?.name || profile?.displayName || profile?.email || "",
    email: sessionProfile?.email || profile?.email || "",
    role: sessionProfile?.role || profile?.role || profile?.roleId || "",
    roleId: sessionProfile?.roleId || sessionProfile?.role || profile?.roleId || profile?.role || "",
  }), [profile, sessionProfile]);
  const currentGroup = POS_MENU_GROUPS.find(group => group.items.some(item => item.key === currentKey))?.id || "sales";
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => new Set([currentGroup]));
  const [roleRows, setRoleRows] = useState(null);

  useEffect(() => {
    if (!tenant?.id) return undefined;
    let alive = true;
    loadPosRoleSettings(tenant.id).then(rows => {
      if (!alive) return;
      setRoleRows(rows);
      try { localStorage.setItem("retail_pos_roles_v1", JSON.stringify(rows)); } catch {}
    }).catch(error => console.warn("POS_ROLE_SETTINGS_LOAD_FAILED", error));
    return () => { alive = false; };
  }, [tenant?.id]);

  const permissions = useMemo(() => getPosPermissions(posProfile, roleRows), [posProfile, roleRows]);
  const groups = useMemo(() => POS_MENU_GROUPS
    .map(group => ({ ...group, items: group.items.filter(item => permissions.has(item.key)) }))
    .filter(group => group.items.length), [permissions]);

  const roleLabel = useMemo(() => {
    const roleId = String(posProfile?.roleId || posProfile?.role || "").trim();
    let customName = "";
    try {
      const roles = Array.isArray(roleRows) ? roleRows : JSON.parse(localStorage.getItem("retail_pos_roles_v1") || "[]");
      customName = Array.isArray(roles)
        ? String(roles.find(item => String(item?.id || "") === roleId)?.name || "")
        : "";
    } catch {}
    const key = `pos_users.role_names.${roleId}`;
    const translated = roleId ? t(key) : "";
    return translated && translated !== key ? translated : customName || roleId || "-";
  }, [posProfile?.role, posProfile?.roleId, roleRows, t]);

  useEffect(() => {
    document.body.classList.toggle("pos-menu-open", open);
    return () => document.body.classList.remove("pos-menu-open");
  }, [open]);

  const toggleGroup = groupId => setOpenGroups(current => {
    const next = new Set(current);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    return next;
  });

  const logout = async () => {
    await signOut(auth).catch(() => {});
    clearRetailPosSession();
    localStorage.removeItem("food_order_active_tenant");
    localStorage.removeItem("food_order_active_shop");
    location.replace("/pos/login/");
  };

  return (
    <>
      <button id="posMenuTrigger" type="button" className="btn btn-secondary pos-menu-trigger"
        aria-label={t("pos_navigation.menu")} title={t("pos_navigation.menu")} onClick={() => setOpen(true)}>
        <i className="bi bi-list" aria-hidden="true"></i>
        <span className="pos-menu-trigger-label">{t("pos_navigation.menu")}</span>
      </button>
      {typeof document !== "undefined" ? createPortal(
      <div id="posMenuPopover" className={`pos-menu-popover${open ? " open" : ""}`}>
        <div className="pos-menu-backdrop" data-close-menu onClick={() => setOpen(false)}></div>
        <aside className="pos-menu-panel" aria-hidden={!open}>
          <div className="pos-menu-head">
            <h2 className="pos-menu-title">{t("pos_navigation.title")}</h2>
            <button className="icon-btn" type="button" aria-label={t("pos_navigation.close")}
              title={t("pos_navigation.close")} onClick={() => setOpen(false)}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <PosUserProfile profile={posProfile} roleLabel={roleLabel} />
          <a className="btn btn-secondary pos-central-home" href="/" data-pos-icon="house">
            <i className="bi bi-house pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>
            <span>{t("pos_navigation.central_home")}</span>
          </a>
          <nav>
            {groups.length ? groups.map(group => {
              const groupOpen = openGroups.has(group.id);
              return (
                <section className={`pos-menu-group${groupOpen ? " is-open" : ""}`} key={group.id}>
                  <button type="button" data-menu-group={group.id} aria-expanded={groupOpen} onClick={() => toggleGroup(group.id)}>
                    <span className="pos-menu-group-title">
                      <i className={`bi bi-${group.icon} pos-menu-group-icon`} data-icon-tone={group.tone || "green"} aria-hidden="true"></i>
                      <span className="pos-menu-group-label">{translatedOrFallback(t, `pos_users.groups.${group.id}`, group.label)}</span>
                    </span>
                    <i className={`bi ${groupOpen ? "bi-chevron-up" : "bi-chevron-down"} pos-menu-chevron`} aria-hidden="true"></i>
                  </button>
                  <ul className="pos-menu-links">
                    {group.items.map(item => (
                      <li key={item.key}>
                        <a className={`pos-menu-link${item.key === currentKey ? " is-current" : ""}`} href={item.href} onClick={() => setOpen(false)}>
                          <i className={`bi bi-${item.icon} pos-menu-item-icon`} data-icon-tone={item.tone || "green"} aria-hidden="true"></i>
                          <span>{translatedOrFallback(t, permissionTranslationKey(item.key), item.label)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            }) : <div className="pos-menu-empty">{t("pos_navigation.empty")}</div>}
          </nav>
          <div className="pos-menu-footer">
            <button id="posLogoutBtn" className="btn btn-danger" type="button" onClick={logout}>
              <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
              <span>{t("pos_navigation.logout")}</span>
            </button>
          </div>
        </aside>
      </div>,
      document.body) : null}
    </>
  );
}
