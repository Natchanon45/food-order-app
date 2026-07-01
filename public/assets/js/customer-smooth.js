import "./sweet-dialog.js?v=20260629-048";
import { dataService, usingDemoMode } from "./data-service.js?v=20260701-008";
import { money, toast, getTableCode, formatTime } from "./ui.js?v=20260701-003";

const tableCode = getTableCode();
const tableToken = new URLSearchParams(location.search).get("token") || "";
const menuGrid = document.querySelector("#menuGrid");
const cartList = document.querySelector("#cartList");
const categoryTabs = document.querySelector("#categoryTabs");
const previousOrdersSection = document.querySelector("#previousOrdersSection");
const previousOrdersList = document.querySelector("#previousOrdersList");
const previousRoundCount = document.querySelector("#previousRoundCount");
const currentRoundLabel = document.querySelector("#currentRoundLabel");
const submitButton = document.querySelector("#submitOrder");
const searchInput = document.querySelector("#searchInput");
const orderNote = document.querySelector("#orderNote");

const cart = new Map();
let menus = [];
let orders = [];
let activeCategory = "ทั้งหมด";
let validSession = false;

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: ข้อมูลอยู่ในเบราว์เซอร์นี้</div>';
document.querySelector("#tableBadge").textContent = tableCode ? `โต๊ะ ${tableCode}` : "ไม่พบรหัสโต๊ะ";
document.querySelector("#tableTitle").textContent = tableCode ? `เมนูสำหรับโต๊ะ ${tableCode}` : "กรุณาสแกน QR ของโต๊ะ";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function categories() {
  return ["ทั้งหมด", ...new Set(menus.filter(item => item.active !== false).map(item => item.category || "อื่น ๆ"))];
}

function renderTabs() {
  categoryTabs.innerHTML = categories().map(category => `<button type="button" class="category-tab${category === activeCategory ? " active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
}

function filteredMenus() {
  const keyword = searchInput.value.trim().toLowerCase();
  return menus.filter(item => item.active !== false && (!keyword || String(item.name || "").toLowerCase().includes(keyword)) && (activeCategory === "ทั้งหมด" || (item.category || "อื่น ๆ") === activeCategory));
}

function renderMenus() {
  if (!validSession) return;
  const rows = filteredMenus();
  menuGrid.innerHTML = rows.length ? rows.map(item => `<article class="card menu-card"><div class="menu-image"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"></div><div class="menu-name">${escapeHtml(item.name)}</div><div class="menu-category">${escapeHtml(item.category || "อื่น ๆ")}</div><div class="menu-footer"><span class="price">${money(item.price)} บาท</span><button class="btn btn-primary btn-sm" data-add="${escapeHtml(item.id)}">เพิ่ม</button></div></article>`).join("") : '<div class="card empty">ไม่พบเมนู</div>';
}

function renderPreviousOrders() {
  const tableOrders = orders.filter(order => order.orderType !== "delivery" && order.orderType !== "takeaway" && order.tableCode === tableCode && order.tableToken === tableToken && !["paid", "cancelled"].includes(order.status));
  const sorted = [...tableOrders].sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0));
  const highestRound = sorted.reduce((max, order) => Math.max(max, Number(order.roundNumber || 0)), 0);
  currentRoundLabel.textContent = `รอบที่ ${highestRound + 1}`;
  previousRoundCount.textContent = `${sorted.length} รอบ`;
  previousOrdersSection.hidden = sorted.length === 0;
  previousOrdersList.innerHTML = sorted.map(order => `<article class="previous-round"><div class="previous-round-head"><div class="previous-round-title">รอบที่ ${order.roundNumber || 1}</div><small>${formatTime(order.createdAt || order.createdAtText || order.updatedAt)}</small></div><div class="previous-round-items">${(order.items || []).map(item => `<div class="previous-round-item"><span>${Number(item.qty || 0).toLocaleString("th-TH")} × ${escapeHtml(item.name)}${item.note ? `<br><small>${escapeHtml(item.note)}</small>` : ""}</span><strong>${money(Number(item.qty || 0) * Number(item.price || 0))}</strong></div>`).join("")}</div><div class="previous-round-head" style="margin-top:8px;margin-bottom:0"><small>ยืนยันแล้ว</small><strong>${money(order.totalAmount)} บาท</strong></div></article>`).join("");
}

function renderCart() {
  const items = [...cart.values()];
  cartList.innerHTML = items.length ? items.map(item => `<div class="cart-row"><div><strong>${escapeHtml(item.name)}</strong><div class="menu-category">${money(item.price)} บาท</div><input class="input" data-note="${escapeHtml(item.id)}" value="${escapeHtml(item.note || "")}" placeholder="หมายเหตุ เช่น ไม่เผ็ด" style="margin-top:7px"></div><div class="qty"><button data-dec="${escapeHtml(item.id)}">−</button><strong>${item.qty}</strong><button data-inc="${escapeHtml(item.id)}">+</button></div></div>`).join("") : '<div class="empty">ยังไม่มีรายการในรอบปัจจุบัน</div>';
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.qty * Number(item.price), 0);
  document.querySelector("#cartCount").textContent = `${totalQty} รายการ`;
  document.querySelector("#cartTotal").textContent = money(total);
  submitButton.disabled = !validSession || !items.length;
}

async function validateSession() {
  if (!tableCode || !tableToken) return false;
  const table = await dataService.getTable(tableCode);
  return Boolean(table && table.active !== false && table.status === "occupied" && table.orderToken === tableToken);
}

categoryTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderTabs();
  renderMenus();
});

searchInput.addEventListener("input", renderMenus);

menuGrid.addEventListener("click", event => {
  const id = event.target.closest("[data-add]")?.dataset.add;
  if (!id || !validSession) return;
  const menu = menus.find(item => String(item.id) === String(id));
  if (!menu) return;
  const current = cart.get(id);
  cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" });
  renderCart();
  toast(`เพิ่ม ${menu.name} แล้ว`);
});

cartList.addEventListener("click", event => {
  const inc = event.target.closest("[data-inc]")?.dataset.inc;
  const dec = event.target.closest("[data-dec]")?.dataset.dec;
  const id = inc || dec;
  if (!id || !cart.has(id)) return;
  const item = cart.get(id);
  item.qty += inc ? 1 : -1;
  if (item.qty <= 0) cart.delete(id); else cart.set(id, item);
  renderCart();
});

cartList.addEventListener("input", event => {
  const id = event.target.dataset.note;
  if (!id || !cart.has(id)) return;
  const item = cart.get(id);
  item.note = event.target.value;
  cart.set(id, item);
});

submitButton.addEventListener("click", async () => {
  if (!await validateSession()) {
    validSession = false;
    renderCart();
    toast("QR นี้หมดอายุแล้ว กรุณาติดต่อแคชเชียร์", "error");
    return;
  }
  const items = [...cart.values()].map(({ id, name, price, qty, note }) => ({ menuId: id, name, price: Number(price), qty, note: note || "" }));
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  submitButton.disabled = true;
  submitButton.textContent = "กำลังส่ง...";
  try {
    await dataService.createTableOrder({ tableCode, tableToken, status: "pending", totalAmount, note: orderNote.value.trim(), items });
    cart.clear();
    orderNote.value = "";
    renderCart();
    toast("ส่งรายการเข้าครัวแล้ว");
  } catch (error) {
    console.error(error);
    toast(error.message === "INVALID_TABLE_SESSION" ? "QR นี้หมดอายุแล้ว กรุณาติดต่อแคชเชียร์" : "ส่งออเดอร์ไม่สำเร็จ", "error");
  } finally {
    submitButton.textContent = "ยืนยันการสั่ง";
    renderCart();
  }
});

try {
  validSession = await validateSession();
  if (!validSession) {
    document.querySelector("#tableBadge").textContent = "QR หมดอายุ";
    document.querySelector("#tableTitle").textContent = "QR นี้ไม่สามารถใช้งานได้";
    categoryTabs.innerHTML = "";
    menuGrid.innerHTML = '<div class="card empty">กรุณาติดต่อแคชเชียร์เพื่อรับ QR สำหรับโต๊ะของคุณ</div>';
    document.querySelector("#searchInput").disabled = true;
  } else {
    menus = await dataService.listMenus();
    renderTabs();
    renderMenus();
    dataService.subscribeOrders(nextOrders => { orders = nextOrders; renderPreviousOrders(); });
  }
} catch (error) {
  console.error(error);
  menuGrid.innerHTML = '<div class="card empty">ตรวจสอบ QR ไม่สำเร็จ กรุณาติดต่อพนักงาน</div>';
}
renderCart();
