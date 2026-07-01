import "./sweet-dialog.js?v=20260629-048";
import { dataService, usingDemoMode } from "./data-service.js?v=20260701-009";
import { money, toast } from "./ui.js?v=20260701-003";

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: ข้อมูลอยู่ในเบราว์เซอร์นี้</div>';

const menuGrid = document.querySelector("#menuGrid");
const menuPagination = document.querySelector("#menuPagination");
const cartList = document.querySelector("#cartList");
const categoryTabs = document.querySelector("#categoryTabs");
const submitButton = document.querySelector("#submitOrder");
const cart = new Map();
let menus = [];
let activeCategory = "ทั้งหมด";
let currentPage = 1;
let submitting = false;

function isMobile() { return window.matchMedia("(max-width: 899px)").matches; }
function pageSize() { return isMobile() ? Number.MAX_SAFE_INTEGER : 10; }
function categories() { return ["ทั้งหมด", ...new Set(menus.filter(item => item.active !== false).map(item => item.category || "อื่น ๆ"))]; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }

function renderTabs() { categoryTabs.innerHTML = categories().map(category => `<button type="button" class="category-tab${category === activeCategory ? " active" : ""}" data-category="${escapeHtml(category)}" role="tab" aria-selected="${category === activeCategory}">${escapeHtml(category)}</button>`).join(""); }
function filteredMenus() { const keyword = document.querySelector("#searchInput").value.trim().toLowerCase(); return menus.filter(item => item.active !== false && (!keyword || String(item.name || "").toLowerCase().includes(keyword)) && (activeCategory === "ทั้งหมด" || (item.category || "อื่น ๆ") === activeCategory)); }
function menuCard(item) { return `<article class="card menu-card"><div class="menu-image"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"></div><div class="menu-name">${escapeHtml(item.name)}</div><div class="menu-category">${escapeHtml(item.category || "อื่น ๆ")}</div><div class="menu-footer"><span class="price">${money(item.price)} บาท</span><button class="btn btn-primary btn-sm" data-add="${escapeHtml(item.id)}">เพิ่ม</button></div></article>`; }
function visiblePageNumbers(totalPages) { if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1); const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4)); return Array.from({ length: 5 }, (_, index) => start + index); }
function renderPagination(totalItems) { if (isMobile()) { menuPagination.hidden = true; menuPagination.innerHTML = ""; return; } const totalPages = Math.max(1, Math.ceil(totalItems / pageSize())); currentPage = Math.min(currentPage, totalPages); menuPagination.hidden = totalPages <= 1; menuPagination.innerHTML = totalPages <= 1 ? "" : `<button type="button" class="menu-page-button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>‹</button>${visiblePageNumbers(totalPages).map(page => `<button type="button" class="menu-page-button${page === currentPage ? " active" : ""}" data-page="${page}">${page}</button>`).join("")}<button type="button" class="menu-page-button" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>›</button><div class="menu-page-summary">หน้า ${currentPage} จาก ${totalPages} • ${totalItems} เมนู</div>`; }
function renderMenus() { const filtered = filteredMenus(); const size = pageSize(); const totalPages = Math.max(1, Math.ceil(filtered.length / size)); currentPage = Math.min(currentPage, totalPages); const pageItems = isMobile() ? filtered : filtered.slice((currentPage - 1) * size, currentPage * size); menuGrid.innerHTML = pageItems.length ? pageItems.map(menuCard).join("") : '<div class="card empty">ไม่พบเมนู</div>'; renderPagination(filtered.length); }
function updateCart() { const items = [...cart.values()]; cartList.innerHTML = items.length ? items.map(item => `<div class="cart-row"><div><strong>${escapeHtml(item.name)}</strong><div class="menu-category">${money(item.price)} บาท</div><input class="input" data-note="${escapeHtml(item.id)}" value="${escapeHtml(item.note || "")}" placeholder="หมายเหตุ เช่น ไม่เผ็ด" style="margin-top:7px"></div><div class="qty"><button data-dec="${escapeHtml(item.id)}">−</button><strong>${item.qty}</strong><button data-inc="${escapeHtml(item.id)}">+</button></div></div>`).join("") : '<div class="empty">ยังไม่มีรายการ</div>'; const totalQty = items.reduce((sum, item) => sum + item.qty, 0); const total = items.reduce((sum, item) => sum + item.qty * Number(item.price), 0); document.querySelector("#cartCount").textContent = `${totalQty} รายการ`; document.querySelector("#cartTotal").textContent = money(total); submitButton.disabled = submitting || !items.length; }

categoryTabs.addEventListener("click", event => { const button = event.target.closest("[data-category]"); if (!button) return; activeCategory = button.dataset.category; currentPage = 1; renderTabs(); renderMenus(); });
menuPagination.addEventListener("click", event => { const button = event.target.closest("[data-page]"); if (!button || button.disabled) return; currentPage = Number(button.dataset.page); renderMenus(); document.querySelector("#menuListStart")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
menuGrid.addEventListener("click", event => { const id = event.target.closest("[data-add]")?.dataset.add; if (!id) return; const menu = menus.find(item => item.id === id); if (!menu) return; const current = cart.get(id); cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" }); updateCart(); toast(`เพิ่ม ${menu.name} แล้ว`); });
cartList.addEventListener("click", event => { const incButton = event.target.closest("[data-inc]"); const decButton = event.target.closest("[data-dec]"); const id = incButton?.dataset.inc || decButton?.dataset.dec; if (!id) return; const item = cart.get(id); if (!item) return; if (incButton) item.qty += 1; if (decButton) item.qty -= 1; if (item.qty <= 0) cart.delete(id); else cart.set(id, item); updateCart(); });
cartList.addEventListener("input", event => { const id = event.target.dataset.note; if (!id) return; const item = cart.get(id); if (!item) return; item.note = event.target.value; cart.set(id, item); });
document.querySelector("#searchInput").addEventListener("input", () => { currentPage = 1; renderMenus(); });
window.addEventListener("resize", () => { currentPage = 1; renderMenus(); });

submitButton.addEventListener("click", async () => {
  const customerName = document.querySelector("#customerName").value.trim();
  const customerPhone = document.querySelector("#customerPhone").value.trim();
  if (!customerName && !customerPhone) { toast("กรุณากรอกชื่อหรือเบอร์โทร", "error"); document.querySelector("#customerName").focus(); return; }
  const items = [...cart.values()].map(({ id, name, price, qty, note }) => ({ menuId: id, name, price: Number(price), qty, note: note || "" }));
  if (!items.length) return;
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  submitting = true; submitButton.textContent = "กำลังส่ง..."; updateCart();
  try { const result = await dataService.createTakeawayOrder({ customerName, customerPhone, status: "pending", totalAmount, subtotalAmount: totalAmount, note: document.querySelector("#orderNote").value.trim(), items }); cart.clear(); document.querySelector("#orderNote").value = ""; updateCart(); toast(`ส่งรายการเข้าครัวแล้ว เลขคิว ${result?.queueNo || "Take Away"}`); if (typeof window.sweetAlert === "function") window.sweetAlert(`เลขคิวของคุณคือ ${result?.queueNo || "Take Away"}`, { title: "สั่งกลับบ้านสำเร็จ", type: "success" }); }
  catch (error) { console.error(error); toast(error.message === "TAKEAWAY_CUSTOMER_REQUIRED" ? "กรุณากรอกชื่อหรือเบอร์โทร" : "ส่งออเดอร์ไม่สำเร็จ", "error"); }
  finally { submitting = false; submitButton.textContent = "ส่งรายการเข้าครัว"; updateCart(); }
});

try { menus = await dataService.listMenus(); renderTabs(); renderMenus(); } catch (error) { console.error(error); menuGrid.innerHTML = '<div class="card empty">โหลดเมนูไม่สำเร็จ กรุณาติดต่อพนักงาน</div>'; }
updateCart();
