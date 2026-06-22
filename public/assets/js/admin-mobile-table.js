const ICONS = "/assets/images/app-icons.svg?v=20260622-7";

function icon(name) {
  return `<svg class="app-icon" aria-hidden="true"><use href="${ICONS}#icon-${name}"></use></svg>`;
}

function decorateStatusCell(row) {
  const cells = row.children;
  if (!cells.length) return;
  const statusCell = cells[cells.length - 2];
  if (!statusCell) return;

  if (row.dataset.active !== "true" && row.dataset.active !== "false") {
    const text = statusCell.textContent.trim();
    row.dataset.active = /เปิดขาย|ใช้งาน/.test(text) ? "true" : "false";
  }

  if (statusCell.querySelector(".admin-status-icon")) return;

  const active = row.dataset.active === "true";
  statusCell.innerHTML = `<span class="admin-status-icon${active ? "" : " is-inactive"}" role="img" aria-label="${active ? "เปิดใช้งาน" : "ปิดใช้งาน"}" title="${active ? "เปิดใช้งาน" : "ปิดใช้งาน"}">${icon(active ? "check" : "times-circle")}</span>`;
}

function decorateActionCell(row) {
  const actionCell = row.lastElementChild;
  if (!actionCell || actionCell.querySelector(".admin-row-actions")) return;

  const editButton = actionCell.querySelector("[data-edit-menu], [data-edit-table]");
  const deleteButton = actionCell.querySelector("[data-delete-menu], [data-delete-table]");
  if (!editButton && !deleteButton) return;

  const wrap = document.createElement("span");
  wrap.className = "admin-row-actions";

  if (editButton) {
    editButton.innerHTML = icon("pencil");
    editButton.classList.add("admin-icon-button", "btn-icon-only");
    editButton.setAttribute("aria-label", "แก้ไข");
    editButton.title = "แก้ไข";
    wrap.appendChild(editButton);
  }

  if (deleteButton) {
    deleteButton.innerHTML = icon("trash");
    deleteButton.classList.add("admin-icon-button", "btn-icon-only");
    deleteButton.setAttribute("aria-label", "ลบ");
    deleteButton.title = "ลบ";
    wrap.appendChild(deleteButton);
  }

  actionCell.replaceChildren(wrap);
}

function decorateRows(root) {
  root.querySelectorAll?.("#menuRows > tr, #tableRows > tr").forEach(row => {
    if (row.dataset.paginationEmpty) return;
    decorateStatusCell(row);
    decorateActionCell(row);
  });
}

function initialize() {
  decorateRows(document);
  const targets = [document.querySelector("#menuRows"), document.querySelector("#tableRows")].filter(Boolean);
  targets.forEach(target => {
    new MutationObserver(() => decorateRows(document)).observe(target, { childList: true });
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
else initialize();
