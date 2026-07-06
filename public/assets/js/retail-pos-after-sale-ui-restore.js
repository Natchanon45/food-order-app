const PRODUCT_KEY = 'retail_pos_products_v1';
const grid = document.querySelector('#productGrid');

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function productsById() {
  const rows = readJson(PRODUCT_KEY, []);
  const map = new Map();
  rows.forEach(product => {
    if (product?.id) map.set(String(product.id), product);
    if (product?.barcode) map.set(String(product.barcode), product);
  });
  return map;
}

function imageUrl(product = {}) {
  const nested = product.image && typeof product.image === 'object' ? product.image.url || product.image.src || product.image.downloadURL : '';
  return product.imageUrl || product.imageURL || product.photoUrl || product.photoURL || product.thumbnailUrl || product.thumbnailURL || product.productImageUrl || product.pictureUrl || product.imageDataUrl || product.imageData || product.image || nested || '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]);
}

function restoreProductCards() {
  if (!grid) return;
  const map = productsById();
  grid.querySelectorAll('[data-product-id]').forEach(card => {
    const product = map.get(String(card.dataset.productId || ''));
    if (!product) return;
    const src = String(imageUrl(product) || '').trim();
    if (!src) return;
    const stamp = `${product.id}|${product.updatedAt || ''}|${src}`;
    if (card.dataset.posImageRestored === stamp) return;
    card.dataset.posImageRestored = stamp;
    card.classList.add('pos-product-card-image');
    const id = product.id || '';
    const barcode = product.barcode || '';
    const code = [id, barcode].filter(Boolean).join(' • ');
    card.innerHTML = `<span class="pos-card-image-wrap"><img src="${escapeHtml(src)}" alt="${escapeHtml(product.name || '')}" loading="lazy" decoding="async"></span><span class="pos-card-title">${escapeHtml(product.name || 'ไม่ระบุชื่อ')}</span><span class="pos-card-code">${escapeHtml(code)}</span><span class="pos-card-stock">คงเหลือ ${Number(product.stock || 0).toLocaleString('th-TH')} ${escapeHtml(product.unit || 'ชิ้น')}</span><span class="pos-card-price">${money(product.price)} บาท</span>`;
  });
}

if (grid) new MutationObserver(() => requestAnimationFrame(restoreProductCards)).observe(grid, { childList: true, subtree: false });
window.addEventListener('pageshow', () => setTimeout(restoreProductCards, 0));
restoreProductCards();
