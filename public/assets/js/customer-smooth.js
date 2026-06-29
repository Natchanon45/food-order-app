import "./sweet-dialog.js?v=20260629-048";
import { dataService, usingDemoMode } from "./data-service.js";
import { money, toast, getTableCode, formatTime } from "./ui.js";

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
const cartList = document.querySelector("#cartList");
const categoryTabs = document.querySelector("#categoryTabs");
const previousOrdersSection = document.querySelector("#previousOrdersSection");
const previousOrdersList = document.querySelector("#previousOrdersList");
const previousRoundCount = document.querySelector("#previousRoundCount");
const currentRoundLabel = document.querySelector("#currentRoundLabel");
const submitButton = document.querySelector("#submitOrder");
const cart = new Map();

let menus = [];
let sessionOrders = [];
let activeCategory = "ทั้งหมด";
let tableSessionValid = false;
let unsubscribeOrders = null;
let currentPage = 1;

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: ข้อมูลอยู่ในเบราว์เซอร์นี้</div>';
}

document.querySelector("#tableBadge").textContent = tableCode ? `โต๊ะ ${tableCode}` : "ไม่พบรหัสโต๊ะ";
document.querySelector("#tableTitle").textContent = tableCode ? `เมนูสำหรับโต๊ะ ${tableCode}` : "กรุณาสแกน QR ของโต๊ะ";
submitButton.disabled = true;

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function isMobile() {
  return window.matchMedia("(max-width: 899px)").matches;
}

function pageSize() {
  return isMobile() ? Number.MAX_SAFE_INTEGER : 10;
}

function categories() {
  return ["ทั้งหมด", ...new Set(menus.filter(item => item.active !== false).map(item => item.category || "อื่น ๆ"))];
}

function renderTabs() {
  categoryTabs.innerHTML = categories().map(category => `
    <button type="button" class="category-tab${category === activeCategory ? " active" : ""}" data-category="${category}" role="tab" aria-selected="${category === activeCategory}">${category}</button>
  `).join("");

  const active = categoryTabs.querySelector(".category-tab.active");
  if (active) {
    const left = active.offsetLeft - (categoryTabs.clientWidth / 2) + (active.clientWidth / 2);
    categoryTabs.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }
}

function filteredMenus() {
  const keyword = document.querySelector("#searchInput").value.trim().toLowerCase();
  return menus.filter(item =>
    item.active !== false &&
    (!keyword || String(item.name || "").toLowerCase().includes(keyword)) &&
    (activeCategory === "ทั้งหมด" || (item.category || "อื่น ๆ") === activeCategory)
  );
}

function menuCard(item) {
  return `<article class="card menu-card">
    <div class="menu-image"><img src="${item.image}" alt="${item.name}"></div>
    <div class="menu-name">${item.name}</div>
    <div class="menu-category">${item.category || "อื่น ๆ"}</div>
    <div class="menu-footer"><span class="price">${money(item.price)} บาท</span><button class="btn btn-primary btn-sm" data-add="${item.id}">เพิ่ม</button></div>
  </article>`;
}

function visiblePageNumbers(totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function renderPagination(totalItems) {
  if (isMobile()) {
    menuPagination.hidden = true;
    menuPagination.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize()));
  currentPage = Math.min(currentPage, totalPages);
  menuPagination.hidden = totalPages <= 1;
  if (totalPages <= 1) {
    menuPagination.innerHTML = "";
    return;
  }

  menuPagination.innerHTML = `
    <button type="button" class="menu-page-button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>‹</button>
    ${visiblePageNumbers(totalPages).map(page => `<button type="button" class="menu-page-button${page === currentPage ? " active" : ""}" data-page="${page}">${page}</button>`).join("")}
    <button type="button" class="menu-page-button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>›</button>
    <div class="menu-page-summary">หน้า ${currentPage} จาก ${totalPages} • ${totalItems} เมนู</div>`;
}

function renderMenus() {
  if (!tableSessionValid) return;
  const filtered = filteredMenus();
  const size = pageSize();
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * size;
  const pageItems = isMobile() ? filtered : filtered.slice(start, start + size);
  menuGrid.innerHTML = pageItems.length ? pageItems.map(menuCard).join("") : '<div class="card empty">ไม่พบเมนู</div>';
  renderPagination(filtered.length);
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderPreviousOrders() {
  const sorted = [...sessionOrders].sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0) || timestampValue(a.createdAt) - timestampValue(b.createdAt));
  const highestRound = sorted.reduce((max, order) => Math.max(max, Number(order.roundNumber || 0)), 0);
  currentRoundLabel.textContent = `รอบที่ ${highestRound + 1}`;
  previousRoundCount.textContent = `${sorted.length} รอบ`;
  previousOrdersSection.hidden = sorted.length === 0;
  previousOrdersList.innerHTML = sorted.map(order => `
    <article class="previous-round">
      <div class="previous-round-head"><div class="previous-round-title">รอบที่ ${order.roundNumber || 1}</div><small>${formatTime(order.createdAt)}</small></div>
      <div class="previous-round-items">${(order.items || []).map(item => `<div class="previous-round-item"><span>${item.qty} × ${item.name}${item.note ? `<br><small>${item.note}</small>` : ""}</span><strong>${money(Number(item.qty) * Number(item.price))}</strong></div>`).join("")}</div>
      <div class="previous-round-head" style="margin-top:8px;margin-bottom:0"><small>ยืนยันแล้ว</small><strong>${money(order.totalAmount)} บาท</strong></div>
    </article>`).join("");
}

function updateCart() {
  const items = [...cart.values()];
  cartList.innerHTML = items.length ? items.map(item => `
    <div class="cart-row">
      <div><strong>${item.name}</strong><div class="menu-category">${money(item.price)} บาท</div><input class="input" data-note="${item.id}" value="${item.note || ""}" placeholder="หมายเหตุ เช่น ไม่เผ็ด" style="margin-top:7px"></div>
      <div class="qty"><button data-dec="${item.id}">−</button><strong>${item.qty}</strong><button data-inc="${item.id}">+</button></div>
    </div>`).join("") : '<div class="empty">ยังไม่มีรายการในรอบปัจจุบัน</div>';

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.qty * Number(item.price), 0);
  document.querySelector("#cartCount").textContent = `${totalQty} รายการ`;
  document.querySelector("#cartTotal").textContent = money(total);
  submitButton.disabled = !tableSessionValid || !items.length;
}

async function validateTableSession() {
  if (!tableCode || !tableToken) return false;
  const table = await dataService.getTable(tableCode);
  return Boolean(table && table.active !== false && table.status === "occupied" && table.orderToken === tableToken);
}

function startSharedOrderFeed() {
  if (unsubscribeOrders) unsubscribeOrders();
  unsubscribeOrders = dataService.subscribeOrders(orders => {
    sessionOrders = orders.filter(order => order.orderType !== "delivery" && order.tableCode === tableCode && order.tableToken === tableToken);
    renderPreviousOrders();
  });
}

categoryTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  currentPage = 1;
  renderTabs();
  renderMenus();
});

menuPagination.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  renderMenus();
  document.querySelector("#menuListStart")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

menuGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  const id = button?.dataset.add;
  if (!id || !tableSessionValid) return;
  const menu = menus.find(item => item.id === id);
  if (!menu) return;
  const current = cart.get(id);
  cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" });
  updateCart();
  toast(`เพิ่ม ${menu.name} แล้ว`);
});

cartList.addEventListener("click", async event => {
  const incButton = event.target.closest("[data-inc]");
  const decButton = event.target.closest("[data-dec]");
  const id = incButton?.dataset.inc || decButton?.dataset.dec;
  if (!id) return;
  const item = cart.get(id);
  if (!item) return;

  if (incButton) {
    item.qty += 1;
    cart.set(id, item);
    updateCart();
    return;
  }

  if (item.qty <= 1) {
    const ok = await askConfirm(`ลบ ${item.name} ออกจากรายการสั่งซื้อใช่หรือไม่?`, {
      title: "ลบรายการอาหาร",
      confirmText: "ตกลง",
      cancelText: "ยกเลิก",
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
  if (!item) return;
  item.note = event.target.value;
  cart.set(id, item);
});

document.querySelector("#searchInput").addEventListener("input", () => {
  currentPage = 1;
  renderMenus();
});

window.addEventListener("resize", () => {
  currentPage = 1;
  renderMenus();
});

submitButton.addEventListener("click", async () => {
  const stillValid = await validateTableSession();
  if (!stillValid) {
    tableSessionValid = false;
    updateCart();
    toast("QR นี้หมดอายุแล้ว กรุณาติดต่อแคชเชียร์", "error");
    return;
  }

  const items = [...cart.values()].map(({ id, name, price, qty, note }) => ({ menuId: id, name, price: Number(price), qty, note: note || "" }));
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  submitButton.disabled = true;
  submitButton.textContent = "กำลังส่ง...";

  try {
    await dataService.createTableOrder({ tableCode, tableToken, status: "pending", totalAmount, note: document.querySelector("#orderNote").value.trim(), items });
    cart.clear();
    document.querySelector("#orderNote").value = "";
    updateCart();
    toast("ส่งรายการเข้าครัวแล้ว");
  } catch (error) {
    console.error(error);
    toast(error.message === "INVALID_TABLE_SESSION" ? "QR นี้หมดอายุแล้ว กรุณาติดต่อแคชเชียร์" : "ส่งออเดอร์ไม่สำเร็จ", "error");
  } finally {
    submitButton.textContent = "ยืนยันการสั่ง";
    updateCart();
  }
});

try {
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
    renderTabs();
    renderMenus();
    startSharedOrderFeed();
  }
} catch (error) {
  console.error(error);
  menuGrid.innerHTML = '<div class="card empty">ตรวจสอบ QR ไม่สำเร็จ กรุณาติดต่อพนักงาน</div>';
}

updateCart();