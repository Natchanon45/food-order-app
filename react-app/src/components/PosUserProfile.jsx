export function PosUserProfile({ profile = {}, roleLabel = "" }) {
  const name = String(profile?.name || profile?.displayName || profile?.email || "-").trim() || "-";
  const email = String(profile?.email || "").trim();
  const role = String(roleLabel || profile?.roleLabel || profile?.roleId || profile?.role || "-").trim() || "-";

  return (
    <div className="pos-menu-user">
      <i className="bi bi-person-circle pos-menu-user-icon" aria-hidden="true"></i>
      <strong>{name}</strong>
      <span>{role}{email ? ` • ${email}` : ""}</span>
    </div>
  );
}
