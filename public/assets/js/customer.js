import "./public-page-static-i18n.js?v=20260903-231";

import "./sweet-dialog.js?v=20260726-034";
import "./cart-item-layout.js?v=20260702-002";
import { dataService as defaultDataService, usingDemoMode as defaultUsingDemoMode } from "./data-service.js?v=20260718-021";
import { ensureTenantContext } from "./tenant-context.js";
import { money, toast, getTableCode, formatTime } from "./ui.js?v=20260805-081";
import { t } from "./i18n.js?v=20260903-202";

const dataService = window.__CUSTOMER_DATA_SERVICE__ || defaultDataService;
const usingDemoMode = window.__CUSTOMER_USING_DEMO_MODE__ ?? defaultUsingDemoMode;
const ALL_CATEGORY = "ทั้งหมด";
const OTHER_CATEGORY = "อื่น ๆ";

if (!document.querySelector('link[href*="sweet-dialog.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/sweet-dialog.css?v=20260726-034";
  document.head.appendChild(link);
}

const tableCode = getTableCode();
const tableToken = new URLSearchParams(location.search).get("token") || "";
const menuGrid = document.querySelector("#menuGrid");
const menuPagination = document.querySelector("#menuPagination");
const menuListStart = document.querySelector("#menuListStart");
const cartList = document.querySelector("#cartList");
const categoryTabs = document.querySelector("#categoryTabs");
const previousOrdersSection = document.querySelector("#previousOrdersSection");
const previousOrdersList = document.querySelector("#previousOrdersList");
const previousRoundCount = document.querySelector("#previousRoundCount");
const currentRoundLabel = document.querySelector("#currentRoundLabel");
const cart = new Map();
let menus = [];
let sessionOrders = [];
let activeTable = null;
let activeCategory = ALL_CATEGORY;
let highlightedCategory = ALL_CATEGORY;
let tableSessionValid = false;
let unsubscribeOrders = null;
let currentPage = 1;
let categoryObserver = null;

function setIconHeading(selector, icon, text) {
  const heading = document.querySelector(selector);
  if (!heading) return;
  let label = heading.querySelector(":scope > span");
  if (!label) {
    heading.innerHTML = `<i class="bi bi-${icon} app-icon" aria-hidden="true"></i><span></span>`;
    label = heading.querySelector(":scope > span");
  }
  label.textContent = text;
}

function setSubmitButton(text, busy = false) {
  const button = document.querySelector("#submitOrder");
  if (!button) return;
  button.innerHTML = busy
    ? `<i class="bi bi-hourglass-split app-icon" aria-hidden="true"></i><span>${text}</span>`
    : `<i class="bi bi-check-lg app-icon" aria-hidden="true"></i><span>${text}</span>`;
}

function categoryLabel(category) {
  if (category === ALL_CATEGORY) return t("order.menu.all");
  if (category === OTHER_CATEGORY) return t("order.menu.other");
  return category;
}

function priceLabel(value) {
  return t("order.cart.amount", { amount: money(value) });
}

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = `<div class="demo-banner">${t("order.demo")}</div>`;
}

function activeTableCode() {
  return activeTable?.code || activeTable?.id || tableCode;
}

function activeTableName() {
  return activeTable?.name || (activeTableCode() ? t("order.table.name", { table: activeTableCode() }) : "");
}

function updateTableHeader() {
  const label = activeTableName();
  document.querySelector("#tableBadge").textContent = label || t("order.header.missing_table");
  setIconHeading("#tableTitle", "journal-text", label ? t("order.hero.for_table", { table: label }) : t("order.hero.scan_qr"));
}

updateTableHeader();
document.querySelector("#submitOrder").disabled = true;

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function isMobileMenu() {
  return window.matchMedia("(max-width: 480px)").matches;
}

function pageSize() {
  return isMobileMenu() ? Number.MAX_SAFE_INTEGER : 10;
}

function categories() {
  return [ALL_CATEGORY, ...new Set(menus.filter(item => item.active !== false).map(item => item.category || OTHER_CATEGORY))];
}

function currentTabCategory() {
  return activeCategory === ALL_CATEGORY && isMobileMenu() ? highlightedCategory : activeCategory;
}

function renderCategoryTabs() {
  const selected = currentTabCategory();
  categoryTabs.innerHTML = categories().map(category => `
    <button type="button" class="category-tab${category === selected ? " active" : ""}"
      data-category="${category}" role="tab" aria-selected="${category === selected}">
      ${categoryLabel(category)}
    </button>
  `).join("");

  const activeTab = categoryTabs.querySelector(".category-tab.active");
  activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

function getFilteredMenus() {
  const keyword = document.querySelector("#searchInput").value.trim().toLowerCase();
  return menus.filter(item =>
    item.active !== false &&
    (!keyword || item.name.toLowerCase().includes(keyword)) &&
    (activeCategory === ALL_CATEGORY || (item.category || OTHER_CATEGORY) === activeCategory)
  );
}

function visiblePageNumbers(totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function renderPagination(totalItems) {
  if (isMobileMenu()) {
    menuPagination.hidden = true;
    menuPagination.innerHTML = "";
    return;
  }

  const size = pageSize();
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  currentPage = Math.min(currentPage, totalPages);
  menuPagination.hidden = totalPages <= 1;

  if (totalPages <= 1) {
    menuPagination.innerHTML = "";
    return;
  }

  menuPagination.innerHTML = `
    <button type="button" class="menu-page-button menu-page-nav" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="${t("order.menu.previous_page")}" title="${t("order.menu.previous_page")}"><i class="bi bi-chevron-left app-icon" aria-hidden="true"></i></button>
    ${visiblePageNumbers(totalPages).map(page => `<button type="button" class="menu-page-button${page === currentPage ? " active" : ""}" data-page="${page}" aria-label="${t("order.menu.page_aria", { page })}" aria-current="${page === currentPage ? "page" : "false"}">${page}</button>`).join("")}
    <button type="button" class="menu-page-button menu-page-nav" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="${t("order.menu.next_page")}" title="${t("order.menu.next_page")}"><i class="bi bi-chevron-right app-icon" aria-hidden="true"></i></button>
    <div class="menu-page-summary">${t("order.menu.page_summary", { current: currentPage, total: totalPages, count: totalItems })}</div>
  `;
}

function menuCard(item) {
  return `
    <article class="card menu-card">
      <div class="menu-image"><img src="${item.image}" alt="${item.name}"></div>
      <div class="menu-name">${item.name}</div>
      <div class="menu-category">${categoryLabel(item.category || OTHER_CATEGORY)}</div>
      <div class="menu-footer">
        <span class="price">${priceLabel(item.price)}</span>
        <button type="button" class="btn btn-primary btn-sm menu-add-button" data-add="${item.id}" aria-label="${t("order.menu.add")}" title="${t("order.menu.add")}"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>
      </div>
    </article>`;
}

function disconnectCategoryObserver() {
  categoryObserver?.disconnect();
  categoryObserver = null;
}

function observeCategorySections() {
  disconnectCategoryObserver();
  if (!isMobileMenu() || activeCategory !== ALL_CATEGORY) return;

  const sections = [...menuGrid.querySelectorAll("[data-menu-category-section]")];
  if (!sections.length) return;

  categoryObserver = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => Math.abs(a.boundingClientRect.top - 165) - Math.abs(b.boundingClientRect.top - 165));
    if (!visible.length) return;

    const nextCategory = visible[0].target.dataset.menuCategorySection;
    if (!nextCategory || nextCategory === highlightedCategory) return;
    highlightedCategory = nextCategory;
    renderCategoryTabs();
  }, {
    root: null,
    rootMargin: "-150px 0px -62% 0px",
    threshold: [0, 0.05, 0.2]
  });

  sections.forEach(section => categoryObserver.observe(section));
}

function renderMobileGroupedMenus(filtered) {
  if (!filtered.length) {
    menuGrid.innerHTML = `<div class="card empty">${t("order.menu.empty")}</div>`;
    disconnectCategoryObserver();
    return;
  }

  if (activeCategory !== ALL_CATEGORY) {
    menuGrid.innerHTML = filtered.map(menuCard).join("");
    disconnectCategoryObserver();
    return;
  }

  const grouped = new Map();
  filtered.forEach(item => {
    const category = item.category || OTHER_CATEGORY;
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(item);
  });

  menuGrid.innerHTML = [...grouped.entries()].map(([category, items]) => `
    <section data-menu-category-section="${category}" style="grid-column:1/-1;scroll-margin-top:155px">
      <div class="section-title" style="margin:8px 0 10px"><h2>${categoryLabel(category)}</h2><span class="badge">${t("order.menu.group_count", { count: items.length })}</span></div>
      <div class="grid grid-3">${items.map(menuCard).join("")}</div>
    </section>
  `).join("");

  requestAnimationFrame(observeCategorySections);
}

function renderMenus() {
  if (!tableSessionValid) return;
  const filtered = getFilteredMenus();

  if (isMobileMenu()) {
    currentPage = 1;
    renderMobileGroupedMenus(filtered);
    renderPagination(filtered.length);
    return;
  }

  disconnectCategoryObserver();
  highlightedCategory = ALL_CATEGORY;
  const size = pageSize();
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * size;
  const pageItems = filtered.slice(start, start + size);

  menuGrid.innerHTML = pageItems.length ? pageItems.map(menuCard).join("") : `<div class="card empty">${t("order.menu.empty")}</div>`;
  renderPagination(filtered.length);
}

function resetMenuPage() {
  currentPage = 1;
  renderMenus();
}

function scrollToMenuList() {
  const top = menuListStart.getBoundingClientRect().top + window.scrollY - 145;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isVisibleSessionOrder(order) {
  return order?.orderType !== "delivery" &&
    order?.orderType !== "takeaway" &&
    order?.tableToken === tableToken &&
    !["paid", "cancelled"].includes(order?.status) &&
    order?.paymentStatus !== "paid";
}

function renderPreviousOrders() {
  const sorted = [...sessionOrders].sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0) || timestampValue(a.createdAt) - timestampValue(b.createdAt));
  const latestTableOrder = [...sorted].reverse().find(order => order.tableCode || order.tableName);
  if (latestTableOrder?.tableCode && latestTableOrder.tableCode !== activeTableCode()) {
    activeTable = {
      ...(activeTable || {}),
      code: latestTableOrder.tableCode,
      id: latestTableOrder.tableCode,
      name: latestTableOrder.tableName || t("order.table.name", { table: latestTableOrder.tableCode })
    };
    updateTableHeader();
  }
  const highestRound = sorted.reduce((max, order) => Math.max(max, Number(order.roundNumber || 0)), 0);
  currentRoundLabel.textContent = t("order.cart.round", { round: highestRound + 1 });
  previousRoundCount.textContent = t("order.previous.round_count", { count: sorted.length });
  setIconHeading("#previousOrdersSection h2", "clock-history", activeTableName() ? t("order.previous.title_for_table", { table: activeTableName() }) : t("order.previous.title"));
  previousOrdersSection.hidden = sorted.length === 0;

  previousOrdersList.innerHTML = sorted.map(order => `
    <article class="previous-round">
      <div class="previous-round-head">
        <div class="previous-round-title">${t("order.previous.round", { round: order.roundNumber || 1 })}</div>
        <small>${formatTime(order.createdAt)}</small>
      </div>
      <div class="previous-round-items">
        ${(order.items || []).map(item => `
          <div class="previous-round-item">
            <span>${item.qty} × ${item.name}${item.note ? `<br><small>${item.note}</small>` : ""}</span>
            <strong>${money(Number(item.qty) * Number(item.price))}</strong>
          </div>
        `).join("")}
      </div>
      <div class="previous-round-head" style="margin-top:8px;margin-bottom:0">
        <small>${t("order.previous.confirmed")}</small>
        <strong>${priceLabel(order.totalAmount)}</strong>
      </div>
    </article>
  `).join("");
}

function updateCart() {
  const items = [...cart.values()];
  cartList.innerHTML = items.length ? items.map(item => `
    <div class="cart-row">
      <div>
        <strong>${item.name}</strong>
        <div class="menu-category">${priceLabel(item.price)}</div>
        <input class="input" data-note="${item.id}" value="${item.note || ""}" placeholder="${t("order.cart.item_note_placeholder")}" style="margin-top:7px">
      </div>
      <div class="qty">
        <button data-dec="${item.id}">−</button>
        <strong>${item.qty}</strong>
        <button data-inc="${item.id}">+</button>
      </div>
    </div>
  `).join("") : `<div class="empty">${t("order.cart.empty")}</div>`;

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  document.querySelector("#cartCount").textContent = t("order.cart.count", { count: totalQty });
  document.querySelector("#cartTotal").textContent = money(total);
  document.querySelector("#submitOrder").disabled = !tableSessionValid || !items.length;
}

async function validateTableSession() {
  if (!tableCode || !tableToken) return false;
  const table = await dataService.getTable(tableCode);
  const valid = Boolean(table && table.active !== false && table.status === "occupied" && table.orderToken === tableToken);
  activeTable = valid ? table : null;
  updateTableHeader();
  return valid;
}

function startSharedOrderFeed() {
  if (unsubscribeOrders) unsubscribeOrders();
  unsubscribeOrders = dataService.subscribeOrders(orders => {
    sessionOrders = orders.filter(isVisibleSessionOrder);
    renderPreviousOrders();
  });
}

categoryTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  highlightedCategory = activeCategory === ALL_CATEGORY ? ALL_CATEGORY : activeCategory;
  renderCategoryTabs();
  resetMenuPage();
  scrollToMenuList();
});

menuPagination.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  renderMenus();
  scrollToMenuList();
});

menuGrid.addEventListener("click", event => {
  const id = event.target.closest?.("[data-add]")?.dataset.add;
  if (!id || !tableSessionValid) return;
  const menu = menus.find(item => item.id === id);
  const current = cart.get(id);
  cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" });
  updateCart();
  toast(t("order.toast.added", { name: menu.name }));
});

cartList.addEventListener("click", async event => {
  const inc = event.target.dataset.inc;
  const dec = event.target.dataset.dec;
  const id = inc || dec;
  if (!id) return;

  const item = cart.get(id);
  if (!item) return;

  if (inc) {
    item.qty += 1;
    cart.set(id, item);
    updateCart();
    return;
  }

  if (item.qty <= 1) {
    const ok = await askConfirm(t("order.remove.message", { name: item.name }), {
      title: t("order.remove.title"),
      confirmText: t("shared.actions.ok"),
      cancelText: t("shared.actions.cancel"),
      type: "warning"
    });
    if (!ok) return;
    cart.delete(id);
  } else {
    item.qty -= 1;
    cart.set(id, item);
  }

  updateCart();
});

cartList.addEventListener("input", event => {
  const id = event.target.dataset.note;
  if (!id) return;
  const item = cart.get(id);
  item.note = event.target.value;
  cart.set(id, item);
});

document.querySelector("#searchInput").addEventListener("input", () => {
  highlightedCategory = ALL_CATEGORY;
  resetMenuPage();
});

window.addEventListener("resize", () => {
  currentPage = 1;
  highlightedCategory = ALL_CATEGORY;
  renderCategoryTabs();
  renderMenus();
});

document.querySelector("#submitOrder").addEventListener("click", async () => {
  const button = document.querySelector("#submitOrder");
  const stillValid = await validateTableSession();
  if (!stillValid) {
    tableSessionValid = false;
    updateCart();
    toast(t("order.errors.expired"), "error");
    return;
  }

  const items = [...cart.values()].map(({ id, name, price, qty, note }) => ({
    menuId: id,
    name,
    price: Number(price),
    qty,
    note: note || ""
  }));
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  button.disabled = true;
  setSubmitButton(t("order.actions.submitting"), true);

  try {
    await dataService.createTableOrder({
      tableCode: activeTableCode(),
      tableName: activeTableName(),
      tableToken,
      status: "pending",
      totalAmount,
      note: document.querySelector("#orderNote").value.trim(),
      items
    });
    cart.clear();
    document.querySelector("#orderNote").value = "";
    updateCart();
    toast(t("order.toast.submitted"));
  } catch (error) {
    console.error(error);
    toast(error.message === "INVALID_TABLE_SESSION" ? t("order.errors.expired") : t("order.toast.submit_failed"), "error");
  } finally {
    setSubmitButton(t("order.actions.submit"));
    updateCart();
  }
});

try {
  await ensureTenantContext();
  tableSessionValid = await validateTableSession();
  if (!tableSessionValid) {
    document.querySelector("#tableBadge").textContent = t("order.header.expired");
    setIconHeading("#tableTitle", "journal-x", t("order.errors.invalid_title"));
    categoryTabs.innerHTML = "";
    menuGrid.innerHTML = `<div class="card empty">${t("order.errors.invalid_description")}</div>`;
    menuPagination.hidden = true;
    document.querySelector("#searchInput").disabled = true;
  } else {
    menus = await dataService.listMenus();
    renderCategoryTabs();
    renderMenus();
    startSharedOrderFeed();
  }
} catch (error) {
  console.error(error);
  document.querySelector("#tableBadge").textContent = t("order.header.store_missing");
  setIconHeading("#tableTitle", "journal-x", t("order.errors.store_title"));
  categoryTabs.innerHTML = "";
  menuGrid.innerHTML = `<div class="card empty">${t("order.errors.store_description")}</div>`;
  menuPagination.hidden = true;
}
