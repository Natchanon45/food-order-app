const PRODUCT_KEY = "retail_pos_products_v1";
const productGrid = document.querySelector("#productGrid");
const productPanel = document.querySelector(".product-panel");
const searchInput = document.querySelector("#searchInput");

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = "/assets/css/retail-pos-catalog.css?v=20260624-2";
document.head.appendChild(style);

const tabs = document.createElement("div");
tabs.className = "catalog-tabs";
tabs.id = "catalogTabs";
productPanel?.insertBefore(tabs, productGrid);

let activeCategory = "quick";
let decorating = false;
let observer;

function readProducts() {
  try { return JSON.parse(localStorage.getItem(PRODUCT_KEY)) || []; }
  catch { return []; }
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

function shouldShow(product) {
  const searching = Boolean(searchInput?.value.trim());
  if (searching) return true;
  if (product.showOnPos === false) return false;
  if (activeCategory === "quick") return product.quickSale === true;
  if (activeCategory === "all") return true;
  if (activeCategory.startsWith("category:")) return (product.category || "ทั่วไป") === activeCategory.slice(9);
  return true;
}

function decorateCards() {
  if (decorating || !productGrid) return;
  decorating = true;
  observer?.disconnect();

  try {
    const products = readProducts();
    const byId = new Map(products.map(item => [item.id, item]));
    let visibleCount = 0;

    [...productGrid.querySelectorAll(".product-card[data-product-id]")].forEach(card => {
      const product = byId.get(card.dataset.productId);
      if (!product) return;

      card.classList.add("visual-card");
      const show = shouldShow(product);
      card.classList.toggle("catalog-hidden", !show);
      if (show) visibleCount += 1;

      if (!card.querySelector(".product-image")) {
        const name = product.name || "สินค้า";
        const imageMarkup = product.imageUrl
          ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.parentElement.textContent='${escapeHtml(initials(name))}'">`
          : escapeHtml(initials(name));
        const original = card.innerHTML;
        card.innerHTML = `${product.quickSale ? '<span class="quick-badge">ขายดี</span>' : ''}<div class="product-image">${imageMarkup}</div><div class="product-card-body">${original}</div>`;
      }
    });

    let empty = productGrid.querySelector(".catalog-empty");
    if (!visibleCount && !searchInput?.value.trim()) {
      const message = activeCategory === "quick" ? "ยังไม่ได้กำหนดสินค้าขายดี" : "ไม่มีสินค้าในหมวดนี้";
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
