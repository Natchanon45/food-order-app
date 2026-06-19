function createPaginator({ rowsSelector, searchSelector, statusSelector, paginationSelector, emptyColumns }) {
  const rowsContainer = document.querySelector(rowsSelector);
  const searchInput = document.querySelector(searchSelector);
  const statusFilter = document.querySelector(statusSelector);
  const pagination = document.querySelector(paginationSelector);
  let currentPage = 1;
  let rendering = false;

  function pageSize() {
    return window.matchMedia("(max-width: 480px)").matches ? 5 : 10;
  }

  function visiblePages(totalPages) {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    return Array.from({ length: 5 }, (_, index) => start + index);
  }

  function allDataRows() {
    return [...rowsContainer.querySelectorAll(":scope > tr")].filter(row => !row.dataset.paginationEmpty);
  }

  function filteredRows() {
    const keyword = (searchInput?.value || "").trim().toLowerCase();
    const status = statusFilter?.value || "all";

    return allDataRows().filter(row => {
      const textMatch = !keyword || row.textContent.toLowerCase().includes(keyword);
      const rowStatus = row.dataset.active === "true" ? "active" : "inactive";
      const statusMatch = status === "all" || status === rowStatus;
      return textMatch && statusMatch;
    });
  }

  function render() {
    if (rendering) return;
    rendering = true;

    const oldEmpty = rowsContainer.querySelector("[data-pagination-empty]");
    if (oldEmpty) oldEmpty.remove();

    const rows = allDataRows();
    const matched = filteredRows();
    const size = pageSize();
    const totalPages = Math.max(1, Math.ceil(matched.length / size));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * size;
    const visibleSet = new Set(matched.slice(start, start + size));

    rows.forEach(row => {
      row.hidden = !visibleSet.has(row);
    });

    if (!matched.length) {
      const emptyRow = document.createElement("tr");
      emptyRow.dataset.paginationEmpty = "true";
      emptyRow.innerHTML = `<td colspan="${emptyColumns}" class="empty">ไม่พบข้อมูลที่ค้นหา</td>`;
      rowsContainer.appendChild(emptyRow);
    }

    pagination.hidden = totalPages <= 1;
    pagination.innerHTML = totalPages <= 1 ? "" : `
      <button type="button" class="menu-page-button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>‹</button>
      ${visiblePages(totalPages).map(page => `<button type="button" class="menu-page-button${page === currentPage ? " active" : ""}" data-page="${page}">${page}</button>`).join("")}
      <button type="button" class="menu-page-button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>›</button>
      <div class="menu-page-summary">หน้า ${currentPage} จาก ${totalPages} • ${matched.length} รายการ</div>
    `;

    rendering = false;
  }

  function reset() {
    currentPage = 1;
    render();
  }

  searchInput?.addEventListener("input", reset);
  statusFilter?.addEventListener("change", reset);
  pagination?.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    currentPage = Number(button.dataset.page);
    render();
    rowsContainer.closest("section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const observer = new MutationObserver(() => {
    currentPage = 1;
    queueMicrotask(render);
  });
  observer.observe(rowsContainer, { childList: true });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(reset, 120);
  });

  render();
}

createPaginator({
  rowsSelector: "#menuRows",
  searchSelector: "#menuListSearch",
  statusSelector: "#menuListStatus",
  paginationSelector: "#menuListPagination",
  emptyColumns: 6
});

createPaginator({
  rowsSelector: "#tableRows",
  searchSelector: "#tableListSearch",
  statusSelector: "#tableListStatus",
  paginationSelector: "#tableListPagination",
  emptyColumns: 4
});
