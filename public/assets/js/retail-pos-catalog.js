import { getProductImageUrl } from "./retail-product-image-store.js?v=20260627-2";
import { RetailCollections, getRecord, watchRecords } from "./retail-db.js?v=20260629-032";

const PRODUCT_KEY = "retail_pos_products_v1";
const SALES_KEY = "retail_pos_sales_v1";
const ORDER_KEY = "retail_pos_catalog_order_v1";
const SETTINGS_ID = "catalog-order";
const INITIAL_LIMIT = 96;
const LOAD_STEP = 96;
const productGrid = document.querySelector("#productGrid");
const productPanel = document.querySelector(".product-panel");
const searchInput = document.querySelector("#searchInput");

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = "/assets/css/retail-pos-catalog.css?v=20260701-018";
(document.head || document.documentElement).appendChild(style);

const tabs = document.createElement("div");
tabs.className = "catalog-tabs";
tabs.id = "catalogTabs";
productPanel?.insertBefore(tabs, productGrid);

let activeCategory = "quick";
let products = [];
let productsStamp = "";
let salesStamp = "";
let ranking = new Map();
let searchTimer = null;
let renderLimit = INITIAL_LIMIT;
let rendering = false;
let observer = null;
let categoryOrder = readJson(ORDER_KEY, []);

function readRaw(key) { return localStorage.getItem(key) || "[]"; }
function readJson(key, fallback) { try { return JSON.parse(readRaw(key)) ?? fallback; } catch { return fallback; } }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function initials(name) { return String(name || "สินค้า").trim().slice(0, 2).toUpperCase(); }
function money(value) { return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function productSearchText(product) { return `${product.name || ""} ${product.id || ""} ${product.barcode || ""} ${product.category || ""}`.toLowerCase(); }
function activeProducts() { return products.filter(item => item.showOnPos !== false); }
function rawCategories() { return [...new Set(activeProducts().map(item => item.category || "ทั่วไป"))]; }
function orderedTabIds() {
  const available = ["quick", ...rawCategories().map(name => `category:${name}`), "all"];
  return [...categoryOrder.filter(id => available.includes(id)), ...available.filter(id => !categoryOrder.includes(id))];
}
function categoryRank(name) { const index = orderedTabIds().indexOf(`category:${name || "ทั่วไป"}`); return index < 0 ? 9999 : index; }

function refreshProductCache() {
  const raw = readRaw(PRODUCT_KEY);
  if (raw !== productsStamp) {
    productsStamp = raw;
    products = readJson(PRODUCT_KEY, []).map(item => ({ ...item, id: String(item.id || item.code || ""), barcode: String(item.barcode || ""), searchText: productSearchText(item) })).filter(item => item.id);
  }
  const rawSales = readRaw(SALES_KEY);
  if (rawSales !== salesStamp) {
    salesStamp = rawSales;
    ranking = new Map();
    readJson(SALES_KEY, []).forEach(sale => (sale.items || []).forEach(item => {
      const productId = String(item.id || item.productId || "").trim();
      if (!productId) return;
      const current = ranking.get(productId) || { qty: 0, revenue: 0 };
      const qty = Number(item.qty || 0);
      current.qty += qty;
      current.revenue += qty * Number(item.price || 0);
      ranking.set(productId, current);
    }));
  }
}

function renderTabs() {
  const items = orderedTabIds().map(id => ({ id, label: id === "quick" ? "ขายดี" : id === "all" ? "ทั้งหมด" : id.slice(9) }));
  tabs.innerHTML = items.map(item => `<button type="button" class="catalog-tab ${activeCategory === item.id ? "active" : ""}" data-category="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("");
}

function shouldShow(product) {
  const keyword = searchInput?.value.trim().toLowerCase() || "";
  if (product.showOnPos === false) return false;
  if (keyword) return product.searchText.includes(keyword);
  if (activeCategory === "quick") return Number(ranking.get(product.id)?.qty || 0) > 0;
  if (activeCategory === "all") return true;
  if (activeCategory.startsWith("category:")) return (product.category || "ทั่วไป") === activeCategory.slice(9);
  return true;
}

function sortProducts(rows) {
  const searching = Boolean(searchInput?.value.trim());
  return [...rows].sort((a, b) => {
    if (activeCategory === "quick" && !searching) {
      const salesA = ranking.get(a.id) || { qty: 0, revenue: 0 };
      const salesB = ranking.get(b.id) || { qty: 0, revenue: 0 };
      return salesB.qty - salesA.qty || salesB.revenue - salesA.revenue || String(a.name || "").localeCompare(String(b.name || ""), "th");
    }
    const categoryCompare = categoryRank(a.category) - categoryRank(b.category);
    if ((activeCategory === "all" || searching) && categoryCompare) return categoryCompare;
    return Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999) || String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

function productCard(product) {
  const disabled = Number(product.stock || 0) <= 0;
  return `<button class="product-card visual-card" type="button" data-product-id="${escapeHtml(product.id)}" ${disabled ? "disabled" : ""} title="${escapeHtml(product.name || "สินค้า")}"><div class="product-image" data-image-key="${escapeHtml(product.imageKey || "")}" data-image-url="${escapeHtml(product.imageUrl || "")}" data-product-name="${escapeHtml(product.name || "สินค้า")}">${escapeHtml(initials(product.name))}</div><div class="product-card-body"><span class="name">${escapeHtml(product.name)}</span><span class="code">${escapeHtml(product.id)} • ${escapeHtml(product.barcode)}</span><span class="stock">คงเหลือ ${Number(product.stock || 0).toLocaleString("th-TH")} ${escapeHtml(product.unit || "")}</span><span class="price">${money(product.price)} บาท</span></div><div class="product-info-overlay"><strong>${escapeHtml(product.name || "สินค้า")}</strong><span>${money(product.price)} บาท • เหลือ ${Number(product.stock || 0).toLocaleString("th-TH")} ${escapeHtml(product.unit || "")}</span></div></button>`;
}

async function hydrateVisibleImages() {
  const images = [...productGrid.querySelectorAll(".product-image:not([data-image-state])")].slice(0, 80);
  for (const container of images) {
    container.dataset.imageState = "loading";
    let url = "";
    if (container.dataset.imageKey) url = await getProductImageUrl(container.dataset.imageKey);
    if (!url) url = container.dataset.imageUrl || "";
    if (!url) { container.dataset.imageState = "ready"; continue; }
    const image = document.createElement("img");
    image.src = url;
    image.alt = container.dataset.productName || "สินค้า";
    image.loading = "lazy";
    image.decoding = "async";
    image.onload = () => { container.dataset.imageState = "ready"; };
    image.onerror = () => { container.dataset.imageState = "ready"; };
    container.textContent = "";
    container.appendChild(image);
  }
}

function renderCatalog() {
  if (!productGrid || rendering) return;
  rendering = true;
  observer?.disconnect();
  refreshProductCache();
  renderTabs();
  const matched = sortProducts(products.filter(shouldShow));
  const visible = matched.slice(0, renderLimit);
  const keyword = searchInput?.value.trim() || "";
  let html = visible.length ? visible.map(productCard).join("") : `<div class="catalog-empty">${keyword ? "ไม่พบสินค้า" : activeCategory === "quick" ? "ยังไม่มีประวัติการขายสำหรับคำนวณสินค้าขายดี" : "ไม่มีสินค้าในหมวดนี้"}</div>`;
  if (matched.length > visible.length) html += `<button type="button" class="catalog-load-more" id="catalogLoadMore">แสดงเพิ่ม ${Math.min(LOAD_STEP, matched.length - visible.length).toLocaleString("th-TH")} รายการ <small>จากทั้งหมด ${matched.length.toLocaleString("th-TH")}</small></button>`;
  else if (matched.length) html += `<div class="catalog-result-count">แสดง ${matched.length.toLocaleString("th-TH")} รายการ</div>`;
  productGrid.innerHTML = html;
  hydrateVisibleImages();
  rendering = false;
  observer?.observe(productGrid, { childList: true });
}

function scheduleRender({ resetLimit = false } = {}) {
  if (resetLimit) renderLimit = INITIAL_LIMIT;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderCatalog, 80);
}

tabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  scheduleRender({ resetLimit: true });
});

productGrid?.addEventListener("click", event => {
  const loadMore = event.target.closest("#catalogLoadMore");
  if (!loadMore) return;
  event.preventDefault();
  event.stopPropagation();
  renderLimit += LOAD_STEP;
  renderCatalog();
});

searchInput?.addEventListener("input", event => {
  event.stopImmediatePropagation();
  scheduleRender({ resetLimit: true });
}, true);

window.addEventListener("storage", () => { categoryOrder = readJson(ORDER_KEY, []); scheduleRender({ resetLimit: true }); });
window.addEventListener("retail-pos-products-changed", () => scheduleRender({ resetLimit: true }));
observer = new MutationObserver(() => { if (!rendering) scheduleRender(); });
if (productGrid) observer.observe(productGrid, { childList: true });

getRecord(RetailCollections.settings, SETTINGS_ID).then(settings => {
  if (!Array.isArray(settings?.categoryOrder)) return;
  categoryOrder = settings.categoryOrder;
  localStorage.setItem(ORDER_KEY, JSON.stringify(categoryOrder));
  scheduleRender({ resetLimit: true });
}).catch(error => console.warn("[retail-pos-catalog] load category order failed", error));
const stopCatalogOrderWatch = watchRecords(RetailCollections.settings, rows => {
  const settings = rows.find(row => String(row.id) === SETTINGS_ID);
  if (!Array.isArray(settings?.categoryOrder)) return;
  categoryOrder = settings.categoryOrder;
  localStorage.setItem(ORDER_KEY, JSON.stringify(categoryOrder));
  scheduleRender({ resetLimit: true });
});
window.addEventListener("beforeunload", stopCatalogOrderWatch, { once: true });
renderCatalog();
