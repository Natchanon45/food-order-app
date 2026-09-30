import { t } from "./i18n.js?v=20260930-001";

// DELIVERY_MENU_PAGINATION_ICONS_20260829_001
const menuGrid = document.querySelector("#menuGrid");
const pagination = document.querySelector("#menuPagination");
const copy = {
  previous: t("common.pagination.previous"),
  next: t("common.pagination.next"),
  page: page => t("common.pagination.page", { page }),
  summary: (current, total, count) => t("common.pagination.summary", { current, total, count }),
};
let currentPage = 1;
let rendering = false;

function isMobileLayout() {
  return window.matchMedia("(max-width: 899px)").matches;
}

function pageSize() {
  return isMobileLayout() ? Infinity : 10;
}

function visiblePageNumbers(totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function renderPagination() {
  if (!menuGrid || !pagination || rendering) return;
  rendering = true;

  const cards = [...menuGrid.querySelectorAll(":scope > .menu-card")];

  if (isMobileLayout()) {
    cards.forEach(card => { card.hidden = false; });
    pagination.hidden = true;
    pagination.innerHTML = "";
    rendering = false;
    return;
  }

  const size = pageSize();
  const totalPages = Math.max(1, Math.ceil(cards.length / size));
  currentPage = Math.max(1, Math.min(currentPage, totalPages));
  const start = (currentPage - 1) * size;
  const end = start + size;

  cards.forEach((card, index) => {
    card.hidden = index < start || index >= end;
  });

  pagination.hidden = totalPages <= 1;
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    rendering = false;
    return;
  }

  pagination.innerHTML = `
    <button type="button" class="menu-page-button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="${copy.previous}"><i class="bi bi-chevron-left app-icon" aria-hidden="true"></i></button>
    ${visiblePageNumbers(totalPages).map(page => `<button type="button" class="menu-page-button${page === currentPage ? " active" : ""}" data-page="${page}" aria-label="${copy.page(page)}" aria-current="${page === currentPage ? "page" : "false"}">${page}</button>`).join("")}
    <button type="button" class="menu-page-button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="${copy.next}"><i class="bi bi-chevron-right app-icon" aria-hidden="true"></i></button>
    <div class="menu-page-summary">${copy.summary(currentPage, totalPages, cards.length)}</div>
  `;

  rendering = false;
}

function resetPagination() {
  currentPage = 1;
  queueMicrotask(renderPagination);
}

pagination?.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled || isMobileLayout()) return;
  currentPage = Number(button.dataset.page);
  renderPagination();
});

if (menuGrid) {
  const observer = new MutationObserver(resetPagination);
  observer.observe(menuGrid, { childList: true });
}

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    currentPage = 1;
    renderPagination();
  }, 120);
});

document.querySelector("#searchInput")?.addEventListener("input", resetPagination);
document.querySelector("#categoryTabs")?.addEventListener("click", resetPagination);

renderPagination();
