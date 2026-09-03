import { dataService } from "./data-service.js?v=20260903-203";
import { ensureAdminSessionContext } from "./admin-session-bootstrap.js?v=20260903-203";
import { toast } from "./ui.js?v=20260831-001";
import { t } from "./i18n.js?v=20260903-202";

const categoryList = document.querySelector("#categorySortList");
const itemList = document.querySelector("#itemSortList");
const selectedCategoryLabel = document.querySelector("#selectedSortCategory");
const saveCategoryOrderButton = document.querySelector("#saveCategoryOrder");
const saveItemOrderButton = document.querySelector("#saveItemOrder");
const menuRows = document.querySelector("#menuRows");
const touchDevice = matchMedia?.("(pointer: coarse)")?.matches || "ontouchstart" in window;
const locale = document.documentElement.lang === "en" ? "en-US" : "th-TH";

let menus = [];
let categoryOrder = [];
let selectedCategory = "";
let categorySortable = null;
let itemSortable = null;
let savingCategoryOrder = false;
let savingItemOrder = false;
let refreshTimer = null;
let sortManagerReady = false;

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function categoryNames() { return [...new Set(menus.map(item => item.category || t("admin.menu.other_category")))]; }
function categoryOrderKey(value = "") { return String(value).normalize("NFKC").replace(/\s+/g, "").replace(/^อาหาร/, "").replace(/^ประเภท/, ""); }
function orderedCategories() {
  const names = categoryNames();
  const namesByKey = new Map(names.map(name => [categoryOrderKey(name), name]));
  const known = categoryOrder.map(name => names.includes(name) ? name : namesByKey.get(categoryOrderKey(name))).filter((name, index, rows) => name && rows.indexOf(name) === index);
  const unknown = names.filter(name => !known.includes(name)).sort((a, b) => a.localeCompare(b, locale));
  return [...known, ...unknown];
}
function refreshOrderBadges(container) { [...container.querySelectorAll(".sort-item")].forEach((item, index) => { const badge = item.querySelector(".sort-order-badge"); if (badge) badge.textContent = String(index + 1); }); }
function setButtonBusy(button, busy, busyText, normalText) { button.disabled = busy; button.classList.toggle("is-loading", busy); button.textContent = busy ? busyText : normalText; }
function sortableOptions(onEnd) {
  return {
    animation: 180,
    handle: ".sort-handle",
    ghostClass: "sort-ghost",
    chosenClass: "sort-chosen",
    dragClass: "sort-drag",
    delay: touchDevice ? 180 : 0,
    delayOnTouchOnly: true,
    touchStartThreshold: touchDevice ? 8 : 4,
    forceFallback: Boolean(touchDevice),
    fallbackOnBody: Boolean(touchDevice),
    fallbackTolerance: 5,
    onEnd
  };
}

async function persistCategoryOrder({ silent = false } = {}) {
  if (savingCategoryOrder) return;
  const nextOrder = [...categoryList.querySelectorAll("[data-category]")].map(item => item.dataset.category).filter(Boolean);
  if (!nextOrder.length) return;
  savingCategoryOrder = true;
  categoryOrder = [...nextOrder];
  refreshOrderBadges(categoryList);
  setButtonBusy(saveCategoryOrderButton, true, t("admin.common.saving"), t("admin.menu.save_category_order"));
  try { await dataService.saveStoreSettings({ categoryOrder: nextOrder }); if (!silent) toast(t("admin.menu.category_order_saved")); }
  catch (error) { console.error("SAVE_CATEGORY_ORDER_FAILED", error); toast(t("admin.menu.category_order_failed"), "error"); }
  finally { savingCategoryOrder = false; setButtonBusy(saveCategoryOrderButton, false, t("admin.common.saving"), t("admin.menu.save_category_order")); }
}

async function persistItemOrder({ silent = false } = {}) {
  if (savingItemOrder) return;
  const ids = [...itemList.querySelectorAll("[data-menu-id]")].map(item => item.dataset.menuId);
  if (!ids.length) return;
  savingItemOrder = true;
  refreshOrderBadges(itemList);
  menus = menus.map(item => { const index = ids.indexOf(item.id); return index >= 0 ? { ...item, sortOrder: index + 1 } : item; });
  setButtonBusy(saveItemOrderButton, true, t("admin.common.saving"), t("admin.menu.save_item_order"));
  try {
    await Promise.all(ids.map((id, index) => {
      const menu = menus.find(item => item.id === id);
      if (!menu) throw new Error(`MENU_NOT_FOUND:${id}`);
      return dataService.saveMenu({ ...menu, id, sortOrder: index + 1 });
    }));
    if (!silent) toast(t("admin.menu.item_order_saved", { category: selectedCategory }));
  }
  catch (error) { console.error("SAVE_ITEM_ORDER_FAILED", error); toast(t("admin.menu.item_order_failed"), "error"); }
  finally { savingItemOrder = false; setButtonBusy(saveItemOrderButton, false, t("admin.common.saving"), t("admin.menu.save_item_order")); }
}

function renderCategories() {
  const categories = orderedCategories();
  categoryOrder = [...categories];
  if (!selectedCategory || !categories.includes(selectedCategory)) selectedCategory = categories[0] || "";
  categoryList.innerHTML = categories.length ? categories.map((category, index) => `<div class="sort-item${category === selectedCategory ? " active-category" : ""}" data-category="${escapeHtml(category)}"><span class="sort-handle" aria-hidden="true">⋮⋮</span><button type="button" class="btn" data-select-category="${escapeHtml(category)}" style="padding:0;background:transparent;text-align:left;font-weight:600">${escapeHtml(category)}</button><span class="sort-order-badge">${index + 1}</span></div>`).join("") : `<div class="sort-empty">${t("admin.menu.no_categories")}</div>`;
  categorySortable?.destroy();
  if (window.Sortable && categories.length) {
    categorySortable = new window.Sortable(categoryList, sortableOptions(async () => {
      categoryOrder = [...categoryList.querySelectorAll("[data-category]")].map(item => item.dataset.category);
      refreshOrderBadges(categoryList);
      await persistCategoryOrder({ silent: true });
    }));
  }
  renderItems();
}

function renderItems() {
  selectedCategoryLabel.textContent = selectedCategory || "-";
  const items = menus.filter(item => (item.category || t("admin.menu.other_category")) === selectedCategory).sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999) || String(a.name || "").localeCompare(String(b.name || ""), locale));
  itemList.innerHTML = items.length ? items.map((item, index) => `<div class="sort-item" data-menu-id="${escapeHtml(item.id)}"><span class="sort-handle" aria-hidden="true">⋮⋮</span><div><strong>${escapeHtml(item.name)}</strong><div class="menu-category">${item.active !== false ? t("admin.menu.active") : t("admin.menu.inactive")} • ${Number(item.price || 0).toLocaleString(locale)} ${t("admin.common.baht")}</div></div><span class="sort-order-badge">${index + 1}</span></div>`).join("") : `<div class="sort-empty">${t("admin.menu.no_items_in_category")}</div>`;
  itemSortable?.destroy();
  if (window.Sortable && items.length) {
    itemSortable = new window.Sortable(itemList, sortableOptions(async () => {
      refreshOrderBadges(itemList);
      await persistItemOrder({ silent: true });
    }));
  }
}

categoryList.addEventListener("click", event => { const button = event.target.closest("[data-select-category]"); if (!button) return; selectedCategory = button.dataset.selectCategory; renderCategories(); });
saveCategoryOrderButton.addEventListener("click", () => persistCategoryOrder());
saveItemOrderButton.addEventListener("click", () => persistItemOrder());

async function loadSortManager() {
  const previousMenuIds = new Set(menus.map(item => item.id));
  const previousSelected = selectedCategory;
  const [menuData, settings] = await Promise.all([dataService.listMenus(), dataService.getStoreSettings()]);
  const newMenu = menuData.find(item => !previousMenuIds.has(item.id));
  menus = menuData;
  categoryOrder = Array.isArray(settings.categoryOrder) ? settings.categoryOrder : [];
  if (newMenu) selectedCategory = newMenu.category || t("admin.menu.other_category");
  else if (previousSelected && categoryNames().includes(previousSelected)) selectedCategory = previousSelected;
  renderCategories();
  sortManagerReady = true;
}

async function loadSortManagerWithRetry(attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await ensureAdminSessionContext();
      return await loadSortManager();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  categoryList.innerHTML = `<div class="sort-empty">${t("admin.menu.category_load_failed")}</div>`;
  itemList.innerHTML = `<div class="sort-empty">${t("admin.menu.item_load_failed")}</div>`;
  throw lastError || new Error("ADMIN_SORT_LOAD_FAILED");
}

function scheduleSortRefresh() { if (!sortManagerReady) return; clearTimeout(refreshTimer); refreshTimer = setTimeout(() => loadSortManagerWithRetry().catch(error => { console.error(error); toast(t("admin.menu.sort_refresh_failed"), "error"); }), 120); }
if (menuRows) new MutationObserver(scheduleSortRefresh).observe(menuRows, { childList: true });
window.addEventListener("menu-data-changed", scheduleSortRefresh);

try {
  await loadSortManagerWithRetry();
} catch (error) {
  console.error("ADMIN_SORT_INITIAL_LOAD_FAILED", error);
  toast(t("admin.menu.sort_load_failed"), "error");
}
