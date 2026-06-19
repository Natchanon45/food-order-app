import { dataService } from "./data-service.js";
import { toast } from "./ui.js";

const categoryList = document.querySelector("#categorySortList");
const itemList = document.querySelector("#itemSortList");
const selectedCategoryLabel = document.querySelector("#selectedSortCategory");
const saveCategoryOrderButton = document.querySelector("#saveCategoryOrder");
const saveItemOrderButton = document.querySelector("#saveItemOrder");

let menus = [];
let categoryOrder = [];
let selectedCategory = "";
let categorySortable = null;
let itemSortable = null;

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

function renderCategories() {
  const categories = orderedCategories();
  categoryOrder = [...categories];

  if (!selectedCategory || !categories.includes(selectedCategory)) {
    selectedCategory = categories[0] || "";
  }

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
      onEnd: () => refreshOrderBadges(categoryList)
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
      <div>
        <strong>${item.name}</strong>
        <div class="menu-category">${item.active !== false ? "เปิดขาย" : "ปิดขาย"} • ${Number(item.price || 0).toLocaleString("th-TH")} บาท</div>
      </div>
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
      onEnd: () => refreshOrderBadges(itemList)
    });
  }
}

categoryList.addEventListener("click", event => {
  const button = event.target.closest("[data-select-category]");
  if (!button) return;
  selectedCategory = button.dataset.selectCategory;
  renderCategories();
});

saveCategoryOrderButton.addEventListener("click", async () => {
  const nextOrder = [...categoryList.querySelectorAll("[data-category]")].map(item => item.dataset.category);
  if (!nextOrder.length) return;

  saveCategoryOrderButton.disabled = true;
  saveCategoryOrderButton.textContent = "กำลังบันทึก...";
  try {
    await dataService.saveStoreSettings({ categoryOrder: nextOrder });
    categoryOrder = nextOrder;
    toast("บันทึกลำดับหมวดหมู่แล้ว");
  } catch (error) {
    console.error(error);
    toast("บันทึกลำดับหมวดหมู่ไม่สำเร็จ", "error");
  } finally {
    saveCategoryOrderButton.disabled = false;
    saveCategoryOrderButton.textContent = "บันทึกลำดับหมวด";
  }
});

saveItemOrderButton.addEventListener("click", async () => {
  const ids = [...itemList.querySelectorAll("[data-menu-id]")].map(item => item.dataset.menuId);
  if (!ids.length) return;

  saveItemOrderButton.disabled = true;
  saveItemOrderButton.textContent = "กำลังบันทึก...";
  try {
    await Promise.all(ids.map((id, index) => dataService.saveMenu({ id, sortOrder: index + 1 })));
    menus = menus.map(item => {
      const index = ids.indexOf(item.id);
      return index >= 0 ? { ...item, sortOrder: index + 1 } : item;
    });
    toast(`บันทึกลำดับเมนูในหมวด ${selectedCategory} แล้ว`);
  } catch (error) {
    console.error(error);
    toast("บันทึกลำดับเมนูไม่สำเร็จ", "error");
  } finally {
    saveItemOrderButton.disabled = false;
    saveItemOrderButton.textContent = "บันทึกลำดับเมนู";
  }
});

async function loadSortManager() {
  const [menuData, settings] = await Promise.all([
    dataService.listMenus(),
    dataService.getStoreSettings()
  ]);
  menus = menuData;
  categoryOrder = Array.isArray(settings.categoryOrder) ? settings.categoryOrder : [];
  renderCategories();
}

await loadSortManager();
