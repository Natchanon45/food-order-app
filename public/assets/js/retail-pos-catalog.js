import { getProductImageUrl } from "./retail-product-image-store.js?v=20260624-1";

const PRODUCT_KEY = "retail_pos_products_v1";
const SALES_KEY = "retail_pos_sales_v1";
const productGrid = document.querySelector("#productGrid");
const productPanel = document.querySelector(".product-panel");
const searchInput = document.querySelector("#searchInput");

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = "/assets/css/retail-pos-catalog.css?v=20260624-4";
document.head.appendChild(style);

const tabs = document.createElement("div");
tabs.className = "catalog-tabs";
tabs.id = "catalogTabs";
productPanel?.insertBefore(tabs, productGrid);

let activeCategory = "quick";
let decorating = false;
let observer;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function readProducts() {
  return readJson(PRODUCT_KEY, []);
}

function readSales() {
  return readJson(SALES_KEY, []);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function initials(name) {
  return String(name || "สินค้า").trim().slice(0, 2).toUpperCase();
}

function categories(products) {
  return [...new Set(products.filter(item => item.showOnPos !== false).map(item => item.category || "ทั่วไป"))]
    .sort((a, b) => a.localeCompare(b, "th"));
}

function buildSalesRanking() {
  const ranking = new Map();
  readSales().forEach(sale => {
    (sale.items || []).forEach(item => {
      const productId = String(item.id || "").trim();
      if (!productId) return;
      const current = ranking.get(productId) || { qty: 0, revenue: 0 };
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      current.qty += qty;
      current.revenue += qty * price;
      ranking.set(productId, current);
    });
  });
  return ranking;
}

function renderTabs() {
  const products = readProducts();
  const tabItems = [
    { id: "quick", label: "ขายดี" },
    ...categories(products).map(name => ({ id: `category:${name}`, label: name })),
    { id: "all", label: "ทั้งหมด" }
  ];
  const html = tabItems.map(item => `
    <button type="button" class="catalog-tab ${activeCategory === item.id ? "active" : ""}" data-category="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>
  `).join("");
  if (tabs.innerHTML !== html) tabs.innerHTML = html;
}

function shouldShow(product, ranking) {
  const searching = Boolean(searchInput?.value.trim());
  if (searching) return true;
  if (product.showOnPos === false) return false;
  if (activeCategory === "quick") return Number(ranking.get(product.id)?.qty || 0) > 0;
  if (activeCategory === "all") return true;
  if (activeCategory.startsWith("category:")) return (product.category || "ทั่วไป") === activeCategory.slice(9);
  return true;
}

function sortCards(cards, byId, ranking) {
  const searching = Boolean(searchInput?.value.trim());
  const sorted = [...cards].sort((a, b) => {
    const productA = byId.get(a.dataset.productId);
    const productB = byId.get(b.dataset.productId);
    if (activeCategory === "quick" && !searching) {
      const salesA = ranking.get(productA?.id) || { qty: 0, revenue: 0 };
      const salesB = ranking.get(productB?.id) || { qty: 0, revenue: 0 };
      return salesB.qty - salesA.qty || salesB.revenue - salesA.revenue || String(productA?.name || "").localeCompare(String(productB?.name || ""), "th");
    }
    return Number(productA?.sortOrder ?? 999) - Number(productB?.sortOrder ?? 999)
      || String(productA?.name || "").localeCompare(String(productB?.name || ""), "th");
  });
  sorted.forEach(card => productGrid.appendChild(card));
}

async function hydrateCardImage(container, product) {
  if (!container || container.dataset.imageState === "loading" || container.dataset.imageState === "ready") return;
  container.dataset.imageState = "loading";
  let url = "";
  if (product.imageKey) url = await getProductImageUrl(product.imageKey);
  if (!url) url = product.imageUrl || "";
  if (!url) {
    container.dataset.imageState = "ready";
    return;
  }
  const image = document.createElement("img");
  image.src = url;
  image.alt = product.name || "สินค้า";
  image.loading = "lazy";
  image.onload = () => { container.dataset.imageState = "ready"; };
  image.onerror = () => {
    container.textContent = initials(product.name);
    container.dataset.imageState = "ready";
  };
  container.textContent = "";
  container.appendChild(image);
}

function decorateCards() {
  if (decorating || !productGrid) return;
  decorating = true;
  observer?.disconnect();

  try {
    const products = readProducts();
    const ranking = buildSalesRanking();
    const byId = new Map(products.map(item => [item.id, item]));
    const cards = [...productGrid.querySelectorAll(".product-card[data-product-id]")];
    let visibleCount = 0;

    cards.forEach(card => {
      const product = byId.get(card.dataset.productId);
      if (!product) return;
      card.classList.add("visual-card");
      const show = shouldShow(product, ranking);
      card.classList.toggle("catalog-hidden", !show);
      if (show) visibleCount += 1;

      if (!card.querySelector(".product-image")) {
        const original = card.innerHTML;
        card.innerHTML = `<div class="product-image">${escapeHtml(initials(product.name))}</div><div class="product-card-body">${original}</div>`;
      }
      hydrateCardImage(card.querySelector(".product-image"), product);
    });

    sortCards(cards, byId, ranking);

    let empty = productGrid.querySelector(".catalog-empty");
    if (!visibleCount && !searchInput?.value.trim()) {
      const message = activeCategory === "quick" ? "ยังไม่มีประวัติการขายสำหรับคำนวณสินค้าขายดี" : "ไม่มีสินค้าในหมวดนี้";
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "catalog-empty";
        empty.textContent = message;
        productGrid.appendChild(empty);
      } else if (empty.textContent !== message) {
        empty.textContent = message;
      }
    } else if (empty) {
      empty.remove();
    }
  } finally {
    decorating = false;
    observer?.observe(productGrid, { childList: true, subtree: true });
  }
}

function refreshCatalog() {
  renderTabs();
  decorateCards();
}

tabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  refreshCatalog();
});

searchInput?.addEventListener("input", () => requestAnimationFrame(decorateCards));
window.addEventListener("storage", refreshCatalog);

observer = new MutationObserver(() => {
  if (!decorating) requestAnimationFrame(decorateCards);
});
observer.observe(productGrid, { childList: true, subtree: true });

refreshCatalog();
