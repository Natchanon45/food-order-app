import { RetailCollections, saveRecord } from "./retail-db.js?v=20260627-3";

const PRODUCT_KEY = "retail_pos_products_v1";
const root = document.querySelector("#sortManagerRoot");
const productTableBody = document.querySelector("#productTableBody");
const toast = document.querySelector("#toast");
let products = readProducts();
let selectedCategory = "";
let saving = false;
let toastTimer;
let sortingTable = false;

function readProducts() {
  try { return JSON.parse(localStorage.getItem(PRODUCT_KEY)) || []; }
  catch { return []; }
}

function writeProducts(rows) {
  localStorage.setItem(PRODUCT_KEY, JSON.stringify(rows || []));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function showToast(message) {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function categoryName(product) {
  return String(product?.category || "ทั่วไป").trim() || "ทั่วไป";
}

function isBestSellerCategory(name) {
  const normalized = String(name || "").trim().toLowerCase().replace(/\s+/g, "");
  return ["ขายดี", "สินค้าขายดี", "bestseller", "bestsellers", "best-seller", "popular"].includes(normalized);
}

function categoryOrder(name) {
  const rows = products.filter(item => categoryName(item) === name);
  const values = rows.map(item => Number(item.categoryOrder)).filter(Number.isFinite);
  return values.length ? Math.min(...values) : 999;
}

function sortProductsForDisplay(rows) {
  return [...rows].sort((a, b) => {
    const categoryCompare = Number(categoryOrder(categoryName(a)) || 999) - Number(categoryOrder(categoryName(b)) || 999);
    if (categoryCompare) return categoryCompare;
    const categoryText = categoryName(a).localeCompare(categoryName(b), "th");
    if (categoryText) return categoryText;
    const orderCompare = Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999);
    if (orderCompare) return orderCompare;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

function getCategories() {
  const names = [...new Set(products.map(categoryName))];
  return names.sort((a, b) => {
    const orderCompare = Number(categoryOrder(a) || 999) - Number(categoryOrder(b) || 999);
    if (orderCompare) return orderCompare;
    return a.localeCompare(b, "th");
  });
}

function normalizeCategoryOrders(categories) {
  products = products.map(product => {
    const index = categories.indexOf(categoryName(product));
    return index >= 0 ? { ...product, categoryOrder: (index + 1) * 10 } : product;
  });
}

function normalizeProductOrders(category) {
  if (isBestSellerCategory(category)) return;
  const categoryProducts = products
    .filter(item => categoryName(item) === category)
    .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || String(a.name || "").localeCompare(String(b.name || ""), "th"));
  products = products.map(product => {
    const index = categoryProducts.findIndex(item => item.id === product.id);
    return index >= 0 ? { ...product, sortOrder: (index + 1) * 10 } : product;
  });
}

function moveCategory(name, delta) {
  const categories = getCategories();
  const index = categories.indexOf(name);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= categories.length) return;
  [categories[index], categories[nextIndex]] = [categories[nextIndex], categories[index]];
  normalizeCategoryOrders(categories);
  selectedCategory = name;
  persistLocalAndRender();
}

function moveProduct(id, delta) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  const category = categoryName(product);
  if (isBestSellerCategory(category)) {
    showToast("หมวดขายดีล็อกลำดับสินค้าไว้");
    return;
  }
  const categoryProducts = products
    .filter(item => categoryName(item) === category)
    .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || String(a.name || "").localeCompare(String(b.name || ""), "th"));
  const index = categoryProducts.findIndex(item => item.id === id);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= categoryProducts.length) return;
  [categoryProducts[index], categoryProducts[nextIndex]] = [categoryProducts[nextIndex], categoryProducts[index]];
  products = products.map(product => {
    const nextOrder = categoryProducts.findIndex(item => item.id === product.id);
    return nextOrder >= 0 ? { ...product, sortOrder: (nextOrder + 1) * 10 } : product;
  });
  persistLocalAndRender();
}

function persistLocalAndRender() {
  writeProducts(products);
  render();
  sortProductTableRows();
  window.dispatchEvent(new StorageEvent("storage", { key: PRODUCT_KEY }));
}

async function saveAll() {
  if (saving) return;
  saving = true;
  render();
  const rows = products.map(product => ({ ...product }));
  try {
    for (const product of rows) await saveRecord(RetailCollections.products, product);
    writeProducts(rows);
    showToast("บันทึกลำดับสินค้าแล้ว");
  } catch (error) {
    console.warn("[retail-products-sort-manager] save failed", error);
    showToast("บันทึกลำดับไม่สำเร็จ กรุณาลองใหม่");
  } finally {
    saving = false;
    render();
  }
}

function renderCategoryList(categories) {
  return categories.map((name, index) => {
    const count = products.filter(item => categoryName(item) === name).length;
    const active = name === selectedCategory ? " active" : "";
    const best = isBestSellerCategory(name) ? " best-seller" : "";
    return `<div class="sort-row${active}${best}" data-category="${escapeHtml(name)}">
      <div class="sort-row-main"><div class="sort-row-title">${escapeHtml(name)}</div><div class="sort-row-meta">${count.toLocaleString("th-TH")} รายการ • ลำดับ ${Number(categoryOrder(name) || 999).toLocaleString("th-TH")}${best ? " • หมวดขายดี" : ""}</div></div>
      <div class="sort-actions"><button type="button" data-category-up="${escapeHtml(name)}" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-category-down="${escapeHtml(name)}" ${index === categories.length - 1 ? "disabled" : ""}>↓</button><button class="sort-select-btn" type="button" data-select-category="${escapeHtml(name)}">เลือก</button></div>
    </div>`;
  }).join("");
}

function renderProductList() {
  if (!selectedCategory) return `<div class="sort-empty">เลือกหมวดสินค้าเพื่อจัดลำดับสินค้า</div>`;
  const bestSeller = isBestSellerCategory(selectedCategory);
  const rows = products
    .filter(item => categoryName(item) === selectedCategory)
    .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || String(a.name || "").localeCompare(String(b.name || ""), "th"));
  if (!rows.length) return `<div class="sort-empty">ไม่มีสินค้าในหมวดนี้</div>`;
  return rows.map((product, index) => `<div class="sort-row${bestSeller ? " best-seller" : ""}" data-product="${escapeHtml(product.id)}">
    <div class="sort-row-main"><div class="sort-row-title">${escapeHtml(product.name || product.id)}</div><div class="sort-row-meta">${escapeHtml(product.id)} • ${escapeHtml(product.barcode || "ไม่มีบาร์โค้ด")} • ลำดับ ${Number(product.sortOrder ?? 999).toLocaleString("th-TH")}${bestSeller ? " • ล็อกลำดับสินค้าในหมวดขายดี" : ""}</div></div>
    <div class="sort-actions"><button type="button" data-product-up="${escapeHtml(product.id)}" ${index === 0 || bestSeller ? "disabled" : ""}>↑</button><button type="button" data-product-down="${escapeHtml(product.id)}" ${index === rows.length - 1 || bestSeller ? "disabled" : ""}>↓</button></div>
  </div>`).join("");
}

function render() {
  if (!root) return;
  products = readProducts();
  const categories = getCategories();
  if (!selectedCategory || !categories.includes(selectedCategory)) selectedCategory = categories[0] || "";
  root.innerHTML = `<div class="sort-column"><div class="sort-column-head"><div><h3>หมวดสินค้า</h3><span>ลากงานด้วยปุ่มขึ้น/ลง</span></div></div><div class="sort-list">${categories.length ? renderCategoryList(categories) : `<div class="sort-empty">ยังไม่มีหมวดสินค้า</div>`}</div></div>
  <div class="sort-column"><div class="sort-column-head"><div><h3>สินค้าในหมวด ${escapeHtml(selectedCategory || "-")}</h3><span>${isBestSellerCategory(selectedCategory) ? "หมวดขายดีล็อกลำดับสินค้า" : "จัดลำดับสินค้าในหมวดนี้"}</span></div></div><div class="sort-list">${renderProductList()}</div><div class="sort-footer"><p class="sort-note">ระบบจะบันทึก `categoryOrder` และ `sortOrder` เฉพาะข้อมูลสินค้าเดิม โดยไม่แก้ลำดับสินค้าในหมวดขายดี</p><button class="sort-save" type="button" data-save-order ${saving ? "disabled" : ""}>${saving ? "กำลังบันทึก..." : "บันทึกลำดับ"}</button></div></div>`;
}

function sortProductTableRows() {
  if (!productTableBody || sortingTable) return;
  const rows = [...productTableBody.querySelectorAll("tr")];
  if (!rows.length) return;
  const productMap = new Map(readProducts().map(product => [String(product.id), product]));
  const orderedRows = rows.sort((a, b) => {
    const pa = productMap.get(a.cells[0]?.textContent.trim());
    const pb = productMap.get(b.cells[0]?.textContent.trim());
    if (!pa || !pb) return 0;
    const categoryCompare = Number(pa.categoryOrder ?? categoryOrder(categoryName(pa)) ?? 999) - Number(pb.categoryOrder ?? categoryOrder(categoryName(pb)) ?? 999);
    if (categoryCompare) return categoryCompare;
    const categoryText = categoryName(pa).localeCompare(categoryName(pb), "th");
    if (categoryText) return categoryText;
    const orderCompare = Number(pa.sortOrder ?? 999) - Number(pb.sortOrder ?? 999);
    if (orderCompare) return orderCompare;
    return String(pa.name || "").localeCompare(String(pb.name || ""), "th");
  });
  sortingTable = true;
  orderedRows.forEach(row => productTableBody.appendChild(row));
  sortingTable = false;
}

root?.addEventListener("click", event => {
  const categoryUp = event.target.closest("[data-category-up]")?.dataset.categoryUp;
  const categoryDown = event.target.closest("[data-category-down]")?.dataset.categoryDown;
  const selected = event.target.closest("[data-select-category]")?.dataset.selectCategory;
  const productUp = event.target.closest("[data-product-up]")?.dataset.productUp;
  const productDown = event.target.closest("[data-product-down]")?.dataset.productDown;
  if (categoryUp) return moveCategory(categoryUp, -1);
  if (categoryDown) return moveCategory(categoryDown, 1);
  if (selected) { selectedCategory = selected; return render(); }
  if (productUp) return moveProduct(productUp, -1);
  if (productDown) return moveProduct(productDown, 1);
  if (event.target.closest("[data-save-order]")) return saveAll();
});

const observer = new MutationObserver(() => sortProductTableRows());
if (productTableBody) observer.observe(productTableBody, { childList: true });
window.addEventListener("storage", event => { if (!event.key || event.key === PRODUCT_KEY) render(); });
setInterval(render, 3000);
render();
sortProductTableRows();
