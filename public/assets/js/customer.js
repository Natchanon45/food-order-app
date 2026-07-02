import "./sweet-dialog.js?v=20260629-048";
import "./cart-item-layout.js?v=20260702-002";
import { dataService, usingDemoMode } from "./data-service.js";
import { ensureTenantContext } from "./tenant-context.js";
import { money, toast, getTableCode, formatTime } from "./ui.js?v=20260701-001";

if (!document.querySelector('link[href*="sweet-dialog.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/sweet-dialog.css?v=20260629-048";
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
let activeCategory = "ทั้งหมด";
let highlightedCategory = "ทั้งหมด";
let tableSessionValid = false;
let unsubscribeOrders = null;
let currentPage = 1;
let categoryObserver = null;

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: ยังไม่ได้ใส่ Firebase Config ข้อมูลจะเก็บในเบราว์เซอร์นี้</div>';
}

function activeTableCode() {
  return activeTable?.code || activeTable?.id || tableCode;
}

function activeTableName() {
  return activeTable?.name || (activeTableCode() ? `โต๊ะ ${activeTableCode()}` : "");
}

function updateTableHeader() {
  const label = activeTableName();
  document.querySelector("#tableBadge").textContent = label || "ไม่พบรหัสโต๊ะ";
  document.querySelector("#tableTitle").textContent = label ? `เมนูสำหรับ${label}` : "กรุณาสแกน QR ของโต๊ะ";
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
  return ["ทั้งหมด", ...new Set(menus.filter(item => item.active !== false).map(item => item.category || "อื่น ๆ"))];
}

function currentTabCategory() {
  return activeCategory === "ทั้งหมด" && isMobileMenu() ? highlightedCategory : activeCategory;
}

function renderCategoryTabs() {
  const selected = currentTabCategory();
  categoryTabs.innerHTML = categories().map(category => `
    <button type="button" class="category-tab${category === selected ? " active" : ""}"
      data-category="${category}" role="tab" aria-selected="${category === selected}">
      ${category}
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
    (activeCategory === "ทั้งหมด" || (item.category || "อื่น ๆ") === activeCategory)
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
    <button type="button" class="menu-page-button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า">‹</button>
    ${visiblePageNumbers(totalPages).map(page => `<button type="button" class="menu-page-button${page === currentPage ? " active" : ""}" data-page="${page}" aria-label="หน้า ${page}" aria-current="${page === currentPage ? "page" : "false"}">${page}</button>`).join("")}
    <button type="button" class="menu-page-button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="หน้าถัดไป">›</button>
    <div class="menu-page-summary">หน้า ${currentPage} จาก ${totalPages} • ${totalItems} เมนู</div>
  `;
}

function menuCard(item) {
  return `
    <article class="card menu-card">
      <div class="menu-image"><img src="${item.image}" alt="${item.name}"></div>
      <div class="menu-name">${item.name}</div>
      <div class="menu-category">${item.category || "อื่น ๆ"}</div>
      <div class="menu-footer">
        <span class="price">${money(item.price)} บาท</span>
        <button class="btn btn-primary btn-sm" data-add="${item.id}">เพิ่ม</button>
      </div>
    </article>`;
}

function disconnectCategoryObserver() {
  categoryObserver?.disconnect();
  categoryObserver = null;
}

function observeCategorySections() {
  disconnectCategoryObserver();
  if (!isMobileMenu() || activeCategory !== "ทั้งหมด") return;

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
    menuGrid.innerHTML = '<div class="card empty">ไม่พบเมนูในหมวดหมู่นี้</div>';
    disconnectCategoryObserver();
    return;
  }

  if (activeCategory !== "ทั้งหมด") {
    menuGrid.innerHTML = filtered.map(menuCard).join("");
    disconnectCategoryObserver();
    return;
  }

  const grouped = new Map();
  filtered.forEach(item => {
    const category = item.category || "อื่น ๆ";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(item);
  });

  menuGrid.innerHTML = [...grouped.entries()].map(([category, items]) => `
    <section data-menu-category-section="${category}" style="grid-column:1/-1;scroll-margin-top:155px">
      <div class="section-title" style="margin:8px 0 10px"><h2>${category}</h2><span class="badge">${items.length} เมนู</span></div>
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
  highlightedCategory = "ทั้งหมด";
  const size = pageSize();
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * size;
  const pageItems = filtered.slice(start, start + size);

  menuGrid.innerHTML = pageItems.length ? pageItems.map(menuCard).join("") : '<div class="card empty">ไม่พบเมนูในหมวดหมู่นี้</div>';
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
      name: latestTableOrder.tableName || `โต๊ะ ${latestTableOrder.tableCode}`
    };
    updateTableHeader();
  }
  const highestRound = sorted.reduce((max, order) => Math.max(max, Number(order.roundNumber || 0)), 0);
  currentRoundLabel.textContent = `รอบที่ ${highestRound + 1}`;
  previousRoundCount.textContent = `${sorted.length} รอบ`;
  previousOrdersSection.querySelector("h2").textContent = activeTableName() ? `รายการที่${activeTableName()}สั่งแล้ว` : "รายการที่โต๊ะนี้สั่งแล้ว";
  previousOrdersSection.hidden = sorted.length === 0;

  previousOrdersList.innerHTML = sorted.map(order => `
    <article class="previous-round">
      <div class="previous-round-head">
        <div class="previous-round-title">รอบที่ ${order.roundNumber || 1}</div>
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
        <small>ยืนยันแล้ว</small>
        <strong>${money(order.totalAmount)} บาท</strong>
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
        <div class="menu-category">${money(item.price)} บาท</div>
        <input class="input" data-note="${item.id}" value="${item.note || ""}" placeholder="หมายเหตุ เช่น ไม่เผ็ด" style="margin-top:7px">
      </div>
      <div class="qty">
        <button data-dec="${item.id}">−</button>
        <strong>${item.qty}</strong>
        <button data-inc="${item.id}">+</button>
      </div>
    </div>
  `).join("") : '<div class="empty">ยังไม่มีรายการในรอบปัจจุบัน</div>';

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  document.querySelector("#cartCount").textContent = `${totalQty} รายการ`;
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
  highlightedCategory = activeCategory === "ทั้งหมด" ? "ทั้งหมด" : activeCategory;
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
  const id = event.target.dataset.add;
  if (!id || !tableSessionValid) return;
  const menu = menus.find(item => item.id === id);
  const current = cart.get(id);
  cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" });
  updateCart();
  toast(`เพิ่ม ${menu.name} แล้ว`);
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
    const ok = await askConfirm(`ลบ ${item.name} ออกจากรายการสั่งซื้อใช่หรือไม่?`, { title: "ลบรายการอาหาร", confirmText: "ตกลง", cancelText: "ยกเลิก", type: "warning" });
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
  highlightedCategory = "ทั้งหมด";
  resetMenuPage();
});

window.addEventListener("resize", () => {
  currentPage = 1;
  highlightedCategory = "ทั้งหมด";
  renderCategoryTabs();
  renderMenus();
});

document.querySelector("#submitOrder").addEventListener("click", async () => {
  const button = document.querySelector("#submitOrder");
  const stillValid = await validateTableSession();
  if (!stillValid) {
    tableSessionValid = false;
    updateCart();
    toast("QR นี้หมดอายุแล้ว กรุณาติดต่อแคชเชียร์", "error");
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
  button.textContent = "กำลังส่ง...";

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
    toast("ส่งรายการเข้าครัวแล้ว");
  } catch (error) {
    console.error(error);
    toast(error.message === "INVALID_TABLE_SESSION" ? "QR นี้หมดอายุแล้ว กรุณาติดต่อแคชเชียร์" : "ส่งออเดอร์ไม่สำเร็จ", "error");
  } finally {
    button.textContent = "ยืนยันการสั่ง";
    updateCart();
  }
});

try {
  await ensureTenantContext();
  tableSessionValid = await validateTableSession();
  if (!tableSessionValid) {
    document.querySelector("#tableBadge").textContent = "QR หมดอายุ";
    document.querySelector("#tableTitle").textContent = "QR นี้ไม่สามารถใช้งานได้";
    categoryTabs.innerHTML = "";
    menuGrid.innerHTML = '<div class="card empty">กรุณาติดต่อแคชเชียร์เพื่อรับ QR สำหรับโต๊ะของคุณ</div>';
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
  document.querySelector("#tableBadge").textContent = "ไม่พบร้าน";
  document.querySelector("#tableTitle").textContent = "ไม่สามารถโหลดข้อมูลร้านได้";
  categoryTabs.innerHTML = "";
  menuGrid.innerHTML = '<div class="card empty">ไม่พบข้อมูลร้านหรือร้านถูกปิดใช้งาน</div>';
  menuPagination.hidden = true;
}
