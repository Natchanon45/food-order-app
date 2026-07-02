const PRODUCT_KEY = "retail_pos_products_v1";
const grid = document.querySelector("#productGrid");
let sorting = false;

function readProducts() {
  try { return JSON.parse(localStorage.getItem(PRODUCT_KEY)) || []; }
  catch { return []; }
}

function categoryName(product) {
  return String(product?.category || "ทั่วไป").trim() || "ทั่วไป";
}

function isBestSellerCategory(name) {
  const normalized = String(name || "").trim().toLowerCase().replace(/\s+/g, "");
  return ["ขายดี", "สินค้าขายดี", "bestseller", "bestsellers", "best-seller", "popular"].includes(normalized);
}

function productCompare(products) {
  const map = new Map(products.map(product => [String(product.id), product]));
  return (cardA, cardB) => {
    const a = map.get(String(cardA.dataset.productId || ""));
    const b = map.get(String(cardB.dataset.productId || ""));
    if (!a || !b) return 0;
    const categoryCompare = Number(a.categoryOrder ?? 999) - Number(b.categoryOrder ?? 999);
    if (categoryCompare) return categoryCompare;
    const categoryText = categoryName(a).localeCompare(categoryName(b), "th");
    if (categoryText) return categoryText;
    const orderCompare = Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999);
    if (orderCompare) return orderCompare;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  };
}

function applyDisplayOrder() {
  if (!grid || sorting) return;
  const cards = [...grid.querySelectorAll(".product-card[data-product-id]")];
  if (cards.length < 2) return;

  const products = readProducts();
  const byId = new Map(products.map(product => [String(product.id), product]));
  const nonBestCards = cards
    .filter(card => !isBestSellerCategory(categoryName(byId.get(String(card.dataset.productId || "")))))
    .sort(productCompare(products));

  let nextNonBestIndex = 0;
  sorting = true;
  cards.forEach(card => {
    const product = byId.get(String(card.dataset.productId || ""));
    const nextCard = isBestSellerCategory(categoryName(product)) ? card : nonBestCards[nextNonBestIndex++];
    if (nextCard) grid.appendChild(nextCard);
  });
  sorting = false;
}

const observer = new MutationObserver(() => applyDisplayOrder());
if (grid) observer.observe(grid, { childList: true });
window.addEventListener("storage", event => { if (!event.key || event.key === PRODUCT_KEY) applyDisplayOrder(); });
setTimeout(applyDisplayOrder, 100);
