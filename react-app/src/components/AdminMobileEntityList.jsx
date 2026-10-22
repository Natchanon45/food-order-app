import { memo } from "react";

// Mobile-only companion to the existing Admin desktop tables. Both modules
// share identical row geometry and keep their existing pagination/actions.
const DEFAULT_FOOD_IMAGE = "/assets/images/default-food.svg";

export const AdminMobileEntityList = memo(function AdminMobileEntityList({
  kind, items, t, intlLocale, onEdit, onDelete,
}) {
  const isMenu = kind === "menu";
  const activeLabel = t(isMenu ? "admin.menu.active" : "admin.table.active");
  const inactiveLabel = t(isMenu ? "admin.menu.closed" : "admin.table.closed");

  return (
    <div className="admin-mobile-entity-list" data-mobile-entity-list={kind} role="list">
      {items.length ? items.map(item => {
        const active = item.active !== false;
        const capacity = Math.max(1, Number.parseInt(item.capacity ?? item.seats ?? item.seatCount ?? 4, 10) || 4);
        return (
          <article
            role="listitem"
            className={"admin-mobile-entity-row" + (active ? "" : " is-inactive")}
            data-entity-id={item.id}
            data-active={active}
            key={item.id}
          >
            {isMenu ? (
              <img
                className="admin-mobile-entity-thumbnail"
                src={item.image || DEFAULT_FOOD_IMAGE}
                alt=""
                loading="lazy"
                style={{ objectPosition: "50% " + Number(item.imagePositionY ?? 50) + "%" }}
                onError={event => {
                  if (!event.currentTarget.src.endsWith(DEFAULT_FOOD_IMAGE)) {
                    event.currentTarget.src = DEFAULT_FOOD_IMAGE;
                  }
                }}
              />
            ) : (
              <span className="admin-mobile-entity-thumbnail admin-mobile-table-tile" aria-hidden="true">
                <i className="fi fi-rr-table-picnic" aria-hidden="true"></i>
              </span>
            )}
            <div className="admin-mobile-entity-details">
              <strong className="admin-mobile-entity-name">{item.name || (isMenu ? "-" : item.code || "-")}</strong>
              <span className="admin-mobile-entity-subtitle">
                {isMenu ? item.category || "-" : (
                  <><span>{t("admin.table.header_code")}: {item.code || "-"}</span>
                    <span className="admin-mobile-entity-capacity">{t("admin.table.header_capacity")}: {capacity}</span></>
                )}
              </span>
              {isMenu ? (
                <strong className="admin-mobile-entity-price">
                  <span aria-hidden="true">฿</span>
                  {new Intl.NumberFormat(intlLocale || "th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(item.price || 0))}
                </strong>
              ) : null}
              <span className={"admin-mobile-entity-status" + (active ? " is-active" : " is-inactive")}>
                <span className="admin-mobile-entity-dot" aria-hidden="true"></span>
                {active ? activeLabel : inactiveLabel}
              </span>
            </div>
            <div className="admin-mobile-entity-actions">
              <button
                className="admin-mobile-entity-action is-edit"
                type="button"
                data-edit-mobile-entity={kind}
                aria-label={t("admin.common.edit") + ": " + (item.name || item.code || "")}
                title={t("admin.common.edit")}
                onClick={() => onEdit(item)}
              >
                <i className="fi fi-rr-edit" aria-hidden="true"></i>
              </button>
              <button
                className="admin-mobile-entity-action is-delete"
                type="button"
                data-delete-mobile-entity={kind}
                aria-label={t("admin.common.delete") + ": " + (item.name || item.code || "")}
                title={t("admin.common.delete")}
                onClick={() => onDelete(item)}
              >
                <i className="fi fi-rr-trash" aria-hidden="true"></i>
              </button>
            </div>
          </article>
        );
      }) : <div className="admin-mobile-entity-empty" role="status">{t("admin.pagination.no_results")}</div>}
    </div>
  );
});
