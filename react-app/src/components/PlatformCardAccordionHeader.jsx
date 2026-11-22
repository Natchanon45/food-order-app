import "@/ui/platform-card-accordion.css";

/**
 * Shared accessible header for collapsible Superadmin setting cards.
 * Keep each panel mounted while hidden so partially edited forms, uploads,
 * network requests and existing page-level state are never discarded.
 */
export function PlatformCardAccordionHeader({
  titleId, panelId, icon, title, description, badge = "",
  badgeId, badgeClass = "", expanded, onToggle,
}) {
  return (
    <div className="section-title platform-google-api-title platform-card-accordion-head">
      <h2 id={titleId} className="platform-card-accordion-heading">
        <button
          className="platform-card-accordion-trigger"
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          data-platform-card-toggle
        >
          <span className="platform-card-accordion-copy">
            <span className="platform-card-accordion-title">
              {icon && <i className={icon} aria-hidden="true" />}
              <span>{title}</span>
            </span>
            {description && <span className="platform-card-accordion-description">{description}</span>}
          </span>
          <span className="platform-card-accordion-trailing">
            {badge && <span className={`badge${badgeClass ? ` ${badgeClass}` : ""}`} id={badgeId}>{badge}</span>}
            <span className="platform-card-accordion-action" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </span>
        </button>
      </h2>
    </div>
  );
}
