const menuGrid = document.querySelector("#menuGrid");
const pagination = document.querySelector("#menuPagination");
const menuListStart = document.querySelector("#menuListStart");
let currentPage = 1;
let rendering = false;

function pageSize() {
  return window.matchMedia("(max-width: 480px)").matches ? 6 : 9;
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
  const size = pageSize();
  const totalPages = Math.max(1, Math.ceil(cards.length / size));
  currentPage = Math.min(currentPage, totalPages);
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
    <button type="button" class="menu-page-button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${visiblePageNumbers(totalPages).map(page => `<button type="button" class="menu-page-button${page === currentPage ? " active" : ""}" data-page="${page}" aria-label="หน้า ${page}" aria-current="${page === currentPage ? "page" : "false"}">${page}</button>`).join("")}
    <button type="button" class="menu-page-button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
    <div class="menu-page-summary">หน้า ${currentPage} จาก ${totalPages} • ${cards.length} เมนู</div>
  `;

  rendering = false;
}

function resetPagination() {
  currentPage = 1;
  queueMicrotask(renderPagination);
}

pagination?.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  renderPagination();
  if (menuListStart) {
    const top = menuListStart.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
});

if (menuGrid) {
  const observer = new MutationObserver(resetPagination);
  observer.observe(menuGrid, { childList: true });
}

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resetPagination, 120);
});

document.querySelector("#searchInput")?.addEventListener("input", resetPagination);
document.querySelector("#categoryTabs")?.addEventListener("click", resetPagination);

renderPagination();
