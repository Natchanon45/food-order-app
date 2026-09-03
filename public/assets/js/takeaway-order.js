import "./public-page-static-i18n.js?v=20260903-231";

import "./sweet-dialog.js?v=20260726-034";
import "./cart-item-layout.js?v=20260702-002";
import { publicStorefrontService as dataService } from './public-storefront-service.js?v=20260903-231';
import { money, toast } from "./ui.js?v=20260805-081";
import { t } from "./i18n.js?v=20260903-202";

const menuGrid = document.querySelector("#menuGrid");
const menuPagination = document.querySelector("#menuPagination");
const cartList = document.querySelector("#cartList");
const categoryTabs = document.querySelector("#categoryTabs");
const submitButton = document.querySelector("#submitOrder");
const cart = new Map();
const ALL_CATEGORY = "ทั้งหมด";
const OTHER_CATEGORY = "อื่น ๆ";
let menus = [];
let activeCategory = ALL_CATEGORY;
let currentPage = 1;
let submitting = false;
let confirming = false;

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function setDialogActionContent(button, icon, label) {
  if (!button) return;
  button.innerHTML = `<i class="bi bi-${icon}" aria-hidden="true"></i><span>${label}</span>`;
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.gap = "8px";
}

function decorateDialogActions(cancelIcon, cancelLabel, confirmIcon, confirmLabel) {
  queueMicrotask(() => {
    setDialogActionContent(document.querySelector("#sweetDialogCancel"), cancelIcon, cancelLabel);
    setDialogActionContent(document.querySelector("#sweetDialogConfirm"), confirmIcon, confirmLabel);
  });
}

async function confirmOrderSubmission() {
  const cancelLabel = t("takeaway.confirm.cancel");
  const confirmLabel = t("takeaway.confirm.confirm");
  const confirmation = askConfirm(t("takeaway.confirm.message"), {
    title: t("takeaway.confirm.title"),
    confirmText: confirmLabel,
    cancelText: cancelLabel,
    type: "warning"
  });
  decorateDialogActions("x-circle", cancelLabel, "check-circle", confirmLabel);
  return await confirmation;
}

function showOrderSuccess(queueNo) {
  if (typeof window.sweetConfirm !== "function") return;
  const closeLabel = t("takeaway.success.close");
  const confirmLabel = t("takeaway.success.confirm");
  void window.sweetConfirm(t("takeaway.success.queue", { queue: queueNo || t("takeaway.success.fallback_queue") }), {
    title: t("takeaway.success.title"),
    type: "success",
    cancelText: closeLabel,
    confirmText: confirmLabel,
  });
  decorateDialogActions("x-circle", closeLabel, "check-circle", confirmLabel);
}

function isMobile() { return window.matchMedia("(max-width: 899px)").matches; }
function pageSize() { return isMobile() ? Number.MAX_SAFE_INTEGER : 10; }
function categories() { return [ALL_CATEGORY, ...new Set(menus.filter(item => item.active !== false).map(item => item.category || OTHER_CATEGORY))]; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function categoryLabel(category) {
  if (category === ALL_CATEGORY) return t("takeaway.menu.all");
  if (category === OTHER_CATEGORY) return t("takeaway.menu.other");
  return category;
}
function priceLabel(value) { return t("takeaway.cart.amount", { amount: money(value) }); }
function renderTabs() { categoryTabs.innerHTML = categories().map(category => `<button type="button" class="category-tab${category === activeCategory ? " active" : ""}" data-category="${escapeHtml(category)}" role="tab" aria-selected="${category === activeCategory}">${escapeHtml(categoryLabel(category))}</button>`).join(""); }
function filteredMenus() { const keyword = document.querySelector("#searchInput").value.trim().toLowerCase(); return menus.filter(item => item.active !== false && (!keyword || String(item.name || "").toLowerCase().includes(keyword)) && (activeCategory === ALL_CATEGORY || (item.category || OTHER_CATEGORY) === activeCategory)); }
function menuCard(item) { return `<article class="card menu-card"><div class="menu-image"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"></div><div class="menu-name">${escapeHtml(item.name)}</div><div class="menu-category">${escapeHtml(categoryLabel(item.category || OTHER_CATEGORY))}</div><div class="menu-footer"><span class="price">${priceLabel(item.price)}</span><button type="button" class="btn btn-primary btn-sm menu-add-button" data-add="${escapeHtml(item.id)}" aria-label="${t("takeaway.menu.add")}" title="${t("takeaway.menu.add")}"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></div></article>`; }
function visiblePageNumbers(totalPages) { if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1); const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4)); return Array.from({ length: 5 }, (_, index) => start + index); }
function renderPagination(totalItems) {
  if (isMobile()) { menuPagination.hidden = true; menuPagination.innerHTML = ""; return; }
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize()));
  currentPage = Math.min(currentPage, totalPages);
  menuPagination.hidden = totalPages <= 1;
  menuPagination.innerHTML = totalPages <= 1 ? "" : `<button type="button" class="menu-page-button menu-page-nav" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="${t("takeaway.menu.previous_page")}" title="${t("takeaway.menu.previous_page")}"><i class="bi bi-chevron-left app-icon" aria-hidden="true"></i></button>${visiblePageNumbers(totalPages).map(page => `<button type="button" class="menu-page-button${page === currentPage ? " active" : ""}" data-page="${page}" aria-label="${t("takeaway.menu.page_aria", { page })}">${page}</button>`).join("")}<button type="button" class="menu-page-button menu-page-nav" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="${t("takeaway.menu.next_page")}" title="${t("takeaway.menu.next_page")}"><i class="bi bi-chevron-right app-icon" aria-hidden="true"></i></button><div class="menu-page-summary">${t("takeaway.menu.page_summary", { current: currentPage, total: totalPages, count: totalItems })}</div>`;
}
function renderMenus() { const filtered = filteredMenus(); const size = pageSize(); const totalPages = Math.max(1, Math.ceil(filtered.length / size)); currentPage = Math.min(currentPage, totalPages); const pageItems = isMobile() ? filtered : filtered.slice((currentPage - 1) * size, currentPage * size); menuGrid.innerHTML = pageItems.length ? pageItems.map(menuCard).join("") : `<div class="card empty">${t("takeaway.menu.empty")}</div>`; renderPagination(filtered.length); }
function updateCart() {
  const items = [...cart.values()];
  cartList.innerHTML = items.length ? items.map(item => `<div class="cart-row"><div><strong>${escapeHtml(item.name)}</strong><div class="menu-category">${priceLabel(item.price)}</div><input class="input" data-note="${escapeHtml(item.id)}" value="${escapeHtml(item.note || "")}" placeholder="${t("takeaway.cart.item_note_placeholder")}" style="margin-top:7px"></div><div class="qty"><button data-dec="${escapeHtml(item.id)}">−</button><strong>${item.qty}</strong><button data-inc="${escapeHtml(item.id)}">+</button></div></div>`).join("") : `<div class="empty">${t("takeaway.cart.empty")}</div>`;
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.qty * Number(item.price), 0);
  document.querySelector("#cartCount").textContent = t("takeaway.cart.count", { count: totalQty });
  document.querySelector("#cartTotal").textContent = money(total);
  submitButton.disabled = confirming || submitting || !items.length;
}

categoryTabs.addEventListener("click", event => { const button = event.target.closest("[data-category]"); if (!button) return; activeCategory = button.dataset.category; currentPage = 1; renderTabs(); renderMenus(); });
menuPagination.addEventListener("click", event => { const button = event.target.closest("[data-page]"); if (!button || button.disabled) return; currentPage = Number(button.dataset.page); renderMenus(); document.querySelector("#menuListStart")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
menuGrid.addEventListener("click", event => { const id = event.target.closest("[data-add]")?.dataset.add; if (!id) return; const menu = menus.find(item => item.id === id); if (!menu) return; const current = cart.get(id); cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" }); updateCart(); toast(t("takeaway.toast.added", { name: menu.name })); });
cartList.addEventListener("click", async event => {
  const incButton = event.target.closest("[data-inc]");
  const decButton = event.target.closest("[data-dec]");
  const id = incButton?.dataset.inc || decButton?.dataset.dec;
  if (!id) return;
  const item = cart.get(id);
  if (!item) return;
  if (incButton) { item.qty += 1; cart.set(id, item); updateCart(); return; }
  if (item.qty <= 1) {
    const ok = await askConfirm(t("takeaway.remove.message", { name: item.name }), {
      title: t("takeaway.remove.title"),
      confirmText: t("takeaway.confirm.confirm"),
      cancelText: t("takeaway.confirm.cancel"),
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
cartList.addEventListener("input", event => { const id = event.target.dataset.note; if (!id) return; const item = cart.get(id); if (!item) return; item.note = event.target.value; cart.set(id, item); });
document.querySelector("#searchInput").addEventListener("input", () => { currentPage = 1; renderMenus(); });
let resizeTimer = 0;
let mobileLayout = isMobile();
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const nextMobileLayout = isMobile();
    if (nextMobileLayout === mobileLayout) return;
    mobileLayout = nextMobileLayout;
    currentPage = 1;
    renderMenus();
  }, 150);
});

submitButton.addEventListener("click", async () => {
  if (confirming || submitting) return;
  const customerName = document.querySelector("#customerName").value.trim();
  const customerPhone = document.querySelector("#customerPhone").value.trim();
  if (!customerName && !customerPhone) { toast(t("takeaway.customer.required"), "error"); document.querySelector("#customerName").focus(); return; }
  const items = [...cart.values()].map(({ id, name, price, qty, note }) => ({ menuId: id, name, price: Number(price), qty, note: note || "" }));
  if (!items.length) return;
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  confirming = true;
  updateCart();
  const confirmed = await confirmOrderSubmission().finally(() => { confirming = false; updateCart(); });
  if (!confirmed) { toast(t("takeaway.toast.cancelled")); return; }
  submitting = true; submitButton.textContent = t("takeaway.actions.submitting"); updateCart();
  try {
    const result = await dataService.createTakeawayOrder({ customerName, customerPhone, status: "pending", totalAmount, subtotalAmount: totalAmount, note: document.querySelector("#orderNote").value.trim(), items });
    cart.clear();
    document.querySelector("#orderNote").value = "";
    updateCart();
    toast(t("takeaway.toast.submitted"));
    showOrderSuccess(result?.queueNo);
  }
  catch (error) { console.error(error); toast(error.message === "TAKEAWAY_CUSTOMER_REQUIRED" ? t("takeaway.customer.required") : t("takeaway.toast.submit_failed"), "error"); }
  finally { submitting = false; submitButton.textContent = t("takeaway.actions.submit"); updateCart(); }
});

try { menus = await dataService.listMenus(); renderTabs(); renderMenus(); } catch (error) { console.error(error); menuGrid.innerHTML = `<div class="card empty">${t("takeaway.menu.load_failed")}</div>`; }
updateCart();
