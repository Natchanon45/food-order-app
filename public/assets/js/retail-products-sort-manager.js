import { RetailCollections, getRecord, saveRecordStrict, saveRecordsStrict } from "./retail-db.js?v=20260629-032";

const PRODUCT_KEY = "retail_pos_products_v1";
const ORDER_KEY = "retail_pos_catalog_order_v1";
const SETTINGS_ID = "catalog-order";
const QUICK_ID = "quick";
const ALL_ID = "all";
const root = document.querySelector("#sortManagerRoot");
const productTableBody = document.querySelector("#productTableBody");
const toast = document.querySelector("#toast");
let products = readJson(PRODUCT_KEY, []);
let configuredOrder = readJson(ORDER_KEY, []);
let selectedCategory = "";
let saving = false;
let categorySortable;
let productSortable;
let toastTimer;

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function categoryName(product) { return String(product?.category || "ทั่วไป").trim() || "ทั่วไป"; }
function categoryId(name) { return `category:${name}`; }
function categoryLabel(id) { return id === QUICK_ID ? "ขายดี" : id === ALL_ID ? "ทั้งหมด" : id.startsWith("category:") ? id.slice(9) : id; }
function actualCategory(id) { return id.startsWith("category:") ? id.slice(9) : ""; }
function showToast(message) { if (!toast) return; clearTimeout(toastTimer); toast.textContent = message; toast.classList.add("show"); toastTimer = setTimeout(() => toast.classList.remove("show"), 1800); }

function allCategoryIds() {
  const actual = [...new Set(products.map(categoryName))].map(categoryId);
  const available = [QUICK_ID, ...actual, ALL_ID];
  return [...configuredOrder.filter(id => available.includes(id)), ...available.filter(id => !configuredOrder.includes(id))];
}

function orderedProducts(category) {
  return products.filter(item => categoryName(item) === category).sort((a, b) => Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999) || String(a.name || "").localeCompare(String(b.name || ""), "th"));
}

function refreshBadges(container) { [...container.querySelectorAll(".sort-order-badge")].forEach((badge, index) => { badge.textContent = String(index + 1); }); }
function sortableOptions(onEnd) { return { animation: 180, handle: ".sort-handle", ghostClass: "sort-ghost", chosenClass: "sort-chosen", dragClass: "sort-drag", forceFallback: true, fallbackOnBody: true, fallbackClass: "sort-fallback", fallbackTolerance: 3, delay: 120, delayOnTouchOnly: true, touchStartThreshold: 4, onEnd }; }

function renderCategories(ids) {
  return ids.map((id, index) => {
    const category = actualCategory(id);
    const count = category ? products.filter(item => categoryName(item) === category).length : id === ALL_ID ? products.length : 0;
    return `<div class="sort-row${id === selectedCategory ? " active" : ""}${id === QUICK_ID ? " best-seller" : ""}" data-category-id="${escapeHtml(id)}">
      <span class="sort-handle" aria-label="ลากเพื่อจัดลำดับ"><i class="bi bi-grip-vertical" aria-hidden="true"></i></span>
      <button class="sort-row-main" type="button" data-select-category="${escapeHtml(id)}"><span class="sort-row-title">${escapeHtml(categoryLabel(id))}</span><span class="sort-row-meta">${id === QUICK_ID ? "เรียงสินค้าตามยอดขายอัตโนมัติ" : `${count.toLocaleString("th-TH")} รายการ`}</span></button>
      <span class="sort-order-badge">${index + 1}</span>
    </div>`;
  }).join("");
}

function renderProducts() {
  if (selectedCategory === QUICK_ID) return `<div class="sort-empty">สินค้าใน “ขายดี” เรียงตามจำนวนชิ้นที่ขายได้ จึงไม่เปิดให้จัดลำดับเอง</div>`;
  if (selectedCategory === ALL_ID) return `<div class="sort-empty">“ทั้งหมด” ใช้ลำดับหมวดหมู่และลำดับสินค้าภายในแต่ละหมวดโดยอัตโนมัติ</div>`;
  const category = actualCategory(selectedCategory);
  const rows = orderedProducts(category);
  if (!rows.length) return `<div class="sort-empty">ไม่มีสินค้าในหมวดนี้</div>`;
  return rows.map((product, index) => `<div class="sort-row" data-product-id="${escapeHtml(product.id)}">
    <span class="sort-handle" aria-label="ลากเพื่อจัดลำดับ"><i class="bi bi-grip-vertical" aria-hidden="true"></i></span>
    <div class="sort-row-main"><span class="sort-row-title">${escapeHtml(product.name || product.id)}</span><span class="sort-row-meta">${escapeHtml(product.id)} • ${escapeHtml(product.barcode || "ไม่มีบาร์โค้ด")}</span></div>
    <span class="sort-order-badge">${index + 1}</span>
  </div>`).join("");
}

function render() {
  if (!root) return;
  products = readJson(PRODUCT_KEY, []);
  const ids = allCategoryIds();
  if (!selectedCategory || !ids.includes(selectedCategory)) selectedCategory = ids.find(id => id.startsWith("category:")) || QUICK_ID;
  root.innerHTML = `<div class="sort-column"><div class="sort-column-head"><div><h3>ลำดับหมวดหมู่หน้า POS</h3><span>ลากการ์ดเพื่อจัดลำดับจากซ้ายไปขวา</span></div></div><div class="sort-list" data-category-list>${renderCategories(ids)}</div></div>
  <div class="sort-column"><div class="sort-column-head"><div><h3>สินค้าในหมวด ${escapeHtml(categoryLabel(selectedCategory))}</h3><span>ลากการ์ดเพื่อจัดลำดับสินค้า</span></div></div><div class="sort-list" data-product-list>${renderProducts()}</div><div class="sort-footer"><p class="sort-note">บันทึกลง Firebase และนำไปใช้ที่หน้า /pos ทันที โดยอันดับสินค้า “ขายดี” ยังคำนวณจากยอดขาย</p><button class="sort-save" type="button" data-save-order ${saving ? "disabled" : ""}>${saving ? "กำลังบันทึก..." : "บันทึกลำดับ"}</button></div></div>`;
  bindSortables();
}

function bindSortables() {
  categorySortable?.destroy(); productSortable?.destroy();
  const categoryList = root.querySelector("[data-category-list]");
  if (window.Sortable && categoryList) categorySortable = new window.Sortable(categoryList, sortableOptions(() => { configuredOrder = [...categoryList.querySelectorAll("[data-category-id]")].map(row => row.dataset.categoryId); localStorage.setItem(ORDER_KEY, JSON.stringify(configuredOrder)); refreshBadges(categoryList); }));
  const productList = root.querySelector("[data-product-list]");
  const category = actualCategory(selectedCategory);
  if (window.Sortable && productList && category) productSortable = new window.Sortable(productList, sortableOptions(() => {
    const ids = [...productList.querySelectorAll("[data-product-id]")].map(row => row.dataset.productId);
    products = products.map(product => categoryName(product) === category ? { ...product, sortOrder: (ids.indexOf(String(product.id)) + 1) * 10 } : product);
    localStorage.setItem(PRODUCT_KEY, JSON.stringify(products)); refreshBadges(productList); sortProductTableRows();
  }));
}

async function saveAll() {
  if (saving) return;
  saving = true; render();
  try {
    configuredOrder = allCategoryIds();
    await saveRecordStrict(RetailCollections.settings, { id: SETTINGS_ID, type: "catalog-order", categoryOrder: configuredOrder });
    await saveRecordsStrict(RetailCollections.products, products);
    localStorage.setItem(ORDER_KEY, JSON.stringify(configuredOrder));
    localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
    window.dispatchEvent(new StorageEvent("storage", { key: ORDER_KEY }));
    showToast("บันทึกลำดับลง Firebase แล้ว");
  } catch (error) { console.error("[retail-products-sort-manager] save failed", error); showToast("บันทึกลำดับไม่สำเร็จ กรุณาตรวจสอบสิทธิ์"); }
  finally { saving = false; render(); }
}

function sortProductTableRows() {
  if (!productTableBody) return;
  const map = new Map(products.map(item => [String(item.id), item]));
  const categoryRank = new Map(allCategoryIds().filter(id => id.startsWith("category:")).map((id, index) => [actualCategory(id), index]));
  const currentRows = [...productTableBody.querySelectorAll("tr")];
  const orderedRows = [...currentRows].sort((a, b) => {
    const pa = map.get(a.cells[0]?.textContent.trim()), pb = map.get(b.cells[0]?.textContent.trim());
    if (!pa || !pb) return 0;
    return (categoryRank.get(categoryName(pa)) ?? 9999) - (categoryRank.get(categoryName(pb)) ?? 9999) || Number(pa.sortOrder ?? 9999) - Number(pb.sortOrder ?? 9999);
  });
  const changed = orderedRows.some((row, index) => row !== currentRows[index]);
  if (changed) orderedRows.forEach(row => productTableBody.appendChild(row));
}

root?.addEventListener("click", event => { const id = event.target.closest("[data-select-category]")?.dataset.selectCategory; if (id) { selectedCategory = id; render(); } if (event.target.closest("[data-save-order]")) saveAll(); });
if (productTableBody) new MutationObserver(sortProductTableRows).observe(productTableBody, { childList: true });
window.addEventListener("storage", event => { if (!event.key || [PRODUCT_KEY, ORDER_KEY].includes(event.key)) { configuredOrder = readJson(ORDER_KEY, []); render(); } });
window.addEventListener("retail-pos-products-changed", render);

const remote = await getRecord(RetailCollections.settings, SETTINGS_ID).catch(() => null);
if (Array.isArray(remote?.categoryOrder)) { configuredOrder = remote.categoryOrder; localStorage.setItem(ORDER_KEY, JSON.stringify(configuredOrder)); }
render(); sortProductTableRows();
