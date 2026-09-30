import { useState } from "react";

export function AdminCollapsibleCard({
  children,
  className = "",
  id,
  style,
  heading,
  sectionTitleStyle,
  cardKey,
  icon = "",
  accent = "green",
  t,
}) {
  const [collapsed, setCollapsed] = useState(true);

  const toggle = () => setCollapsed(value => {
    const next = !value;
    if (!next) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      });
    }
    return next;
  });
  const onHeaderClick = event => {
    if (event.target.closest("button, a, input, select, textarea, label")) return;
    toggle();
  };

  return (
    <section
      id={id}
      className={`card admin-collapsible-card admin-vr-card${collapsed ? " admin-card-collapsed" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      data-admin-collapsible="true"
      data-admin-card-key={cardKey}
      data-admin-vr-accent={accent}
      data-admin-icon={icon || undefined}
    >
      <div
        className="section-title admin-card-touch-target"
        style={sectionTitleStyle}
        onClick={onHeaderClick}
      >
        {icon ? <span className="admin-heading-icon" aria-hidden="true"><i className={`bi bi-${icon}`}></i></span> : null}
        <div className="admin-card-heading">{heading}</div>
        <button
          type="button"
          className="btn admin-card-toggle"
          aria-expanded={!collapsed}
          aria-label={t("admin.workspace.toggle_card")}
          title={t("admin.workspace.toggle_title")}
          onClick={event => {
            event.stopPropagation();
            toggle();
          }}
        >
          <i className="bi bi-chevron-down app-icon" aria-hidden="true"></i>
        </button>
      </div>
      <div className="admin-card-body">{children}</div>
    </section>
  );
}
