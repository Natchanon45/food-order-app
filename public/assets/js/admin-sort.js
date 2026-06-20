import { dataService } from "./data-service.js";
import { toast } from "./ui.js";

const categoryList = document.querySelector("#categorySortList");
const itemList = document.querySelector("#itemSortList");
const selectedCategoryLabel = document.querySelector("#selectedSortCategory");
const saveCategoryOrderButton = document.querySelector("#saveCategoryOrder");
const saveItemOrderButton = document.querySelector("#saveItemOrder");
const menuRows = document.querySelector("#menuRows");

let menus = [];
let categoryOrder = [];
let selectedCategory = "";
let categorySortable = null;
let itemSortable = null;
let savingCategoryOrder = false;
let savingItemOrder = false;
let refreshTimer = null;
let sortManagerReady = false;

function categoryNames() {
  return [...new Set(menus.map(item => item.category || "อื่น ๆ"))];
}

function orderedCategories() {
  const names = categoryNames();
  const known = categoryOrder.filter(name => names.includes(name));
  const unknown = names.filter(name => !known.includes(name)).sort((a, b) => a.localeCompare(b, "th"));
  return [...known, ...unknown];
}

function refreshOrderBadges(container) {
  [...container.querySelectorAll(".sort-item")].forEach((item, index) => {
    const badge = item.querySelector(".sort-order-badge");
    if (badge) badge.textContent = String(index + 1);
  });
}

function setButtonBusy(button, busy, busyText, normalText) {
  button.disabled = busy;
  button.classList.toggle("is-loading", busy);
  button.textContent = busy ? busyText : normalText;
}

async function persistCategoryOrder({ silent = false } = {}) {
  if (savingCategoryOrder) return;
  const nextOrder = [...categoryList.querySelectorAll("[data-category]")].map(item => item.dataset.category);
  if (!nextOrder.length) return;
  savingCategoryOrder = true;
  categoryOrder = [...nextOrder];
  refreshOrderBadges(categoryList);
  setButtonBusy(saveCategoryOrderButton, true, "กำลังบันทึก...", "บันทึกลำดับหมวด");
  try {
    await dataService.saveStoreSettings({ categoryOrder: nextOrder });
    if (!silent) toast("บันทึกลำดับหมวดหมู่แล้ว");
  } catch (error) {
    console.error(error);
    toast("บันทึกลำดับหมวดหมู่ไม่สำเร็จ", "error");
  } finally {
    savingCategoryOrder = false;
    setButtonBusy(saveCategoryOrderButton, false, "กำลังบันทึก...", "บันทึกลำดับหมวด");
  }
}

async function persistItemOrder({ silent = false } = {}) {
  if (savingItemOrder) return;
  const ids = [...itemList.querySelectorAll("[data-menu-id]")].map(item => item.dataset.menuId);
  if (!ids.length) return;
  savingItemOrder = true;
  refreshOrderBadges(itemList);
  menus = menus.map(item => {
    const index = ids.indexOf(item.id);
    return index >= 0 ? { ...item, sortOrder: index + 1 } : item;
  });
  setButtonBusy(saveItemOrderButton, true, "กำลังบันทึก...", "บันทึกลำดับเมนู");
  try {
    await Promise.all(ids.map((id, index) => dataService.saveMenu({ id, sortOrder: index + 1 })));
    if (!silent) toast(`บันทึกลำดับเมนูในหมวด ${selectedCategory} แล้ว`);
  } catch (error) {
    console.error(error);
    toast("บันทึกลำดับเมนูไม่สำเร็จ", "error");
  } finally {
    savingItemOrder = false;
    setButtonBusy(saveItemOrderButton, false, "กำลังบันทึก...", "บันทึกลำดับเมนู");
  }
}

function renderCategories() {
  const categories = orderedCategories();
  categoryOrder = [...categories];
  if (!selectedCategory || !categories.includes(selectedCategory)) selectedCategory = categories[0] || "";
  categoryList.innerHTML = categories.length ? categories.map((category, index) => `
    <div class="sort-item${category === selectedCategory ? " active-category" : ""}" data-category="${category}">
      <span class="sort-handle" aria-hidden="true">⋮⋮</span>
      <button type="button" class="btn" data-select-category="${category}" style="padding:0;background:transparent;text-align:left;font-weight:800">${category}</button>
      <span class="sort-order-badge">${index + 1}</span>
    </div>
  `).join("") : '<div class="sort-empty">ยังไม่มีหมวดหมู่</div>';

  categorySortable?.destroy();
  if (window.Sortable && categories.length) {
    categorySortable = new window.Sortable(categoryList, {
      animation: 180,
      handle: ".sort-handle",
      ghostClass: "sort-ghost",
      chosenClass: "sort-chosen",
      dragClass: "sort-drag",
      delay: 120,
      delayOnTouchOnly: true,
      touchStartThreshold: 4,
      onEnd: async () => {
        categoryOrder = [...categoryList.querySelectorAll("[data-category]")].map(item => item.dataset.category);
        refreshOrderBadges(categoryList);
        await persistCategoryOrder({ silent: true });
      }
    });
  }
  renderItems();
}

function renderItems() {
  selectedCategoryLabel.textContent = selectedCategory || "-";
  const items = menus
    .filter(item => (item.category || "อื่น ๆ") === selectedCategory)
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999) || String(a.name || "").localeCompare(String(b.name || ""), "th"));

  itemList.innerHTML = items.length ? items.map((item, index) => `
    <div class="sort-item" data-menu-id="${item.id}">
      <span class="sort-handle" aria-hidden="true">⋮⋮</span>
      <div><strong>${item.name}</strong><div class="menu-category">${item.active !== false ? "เปิดขาย" : "ปิดขาย"} • ${Number(item.price || 0).toLocaleString("th-TH")} บาท</div></div>
      <span class="sort-order-badge">${index + 1}</span>
    </div>
  `).join("") : '<div class="sort-empty">ยังไม่มีเมนูในหมวดนี้</div>';

  itemSortable?.destroy();
  if (window.Sortable && items.length) {
    itemSortable = new window.Sortable(itemList, {
      animation: 180,
      handle: ".sort-handle",
      ghostClass: "sort-ghost",
      chosenClass: "sort-chosen",
      dragClass: "sort-drag",
      delay: 120,
      delayOnTouchOnly: true,
      touchStartThreshold: 4,
      onEnd: async () => {
        refreshOrderBadges(itemList);
        await persistItemOrder({ silent: true });
      }
    });
  }
}

categoryList.addEventListener("click", event => {
  const button = event.target.closest("[data-select-category]");
  if (!button) return;
  selectedCategory = button.dataset.selectCategory;
  renderCategories();
});

saveCategoryOrderButton.addEventListener("click", () => persistCategoryOrder());
saveItemOrderButton.addEventListener("click", () => persistItemOrder());

async function loadSortManager() {
  const previousMenuIds = new Set(menus.map(item => item.id));
  const [menuData, settings] = await Promise.all([dataService.listMenus(), dataService.getStoreSettings()]);
  const newMenu = menuData.find(item => !previousMenuIds.has(item.id));
  menus = menuData;
  categoryOrder = Array.isArray(settings.categoryOrder) ? settings.categoryOrder : [];
  if (newMenu) selectedCategory = newMenu.category || "อื่น ๆ";
  renderCategories();
  sortManagerReady = true;
}

function scheduleSortRefresh() {
  if (!sortManagerReady) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => loadSortManager().catch(error => {
    console.error(error);
    toast("อัปเดตรายการจัดลำดับไม่สำเร็จ", "error");
  }), 80);
}

if (menuRows) {
  new MutationObserver(scheduleSortRefresh).observe(menuRows, { childList: true });
}

window.addEventListener("menu-data-changed", scheduleSortRefresh);
await loadSortManager();