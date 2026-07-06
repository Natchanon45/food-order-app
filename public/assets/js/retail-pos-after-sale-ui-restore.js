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

function productTitle(product = {}) {
  const name = product.name || 'ไม่ระบุชื่อ';
  const stock = Number(product.stock || 0).toLocaleString('th-TH');
  const unit = product.unit || 'ชิ้น';
  const price = money(product.price);
  const code = [product.id || '', product.barcode || ''].filter(Boolean).join(' • ');
  return `${name}\nสต๊อกคงเหลือ ${stock} ${unit}\nราคา ${price} บาท${code ? `\nรหัส ${code}` : ''}`;
}

function hoverInfoHtml(product = {}) {
  const stock = Number(product.stock || 0).toLocaleString('th-TH');
  const unit = product.unit || 'ชิ้น';
  return `<span class="pos-card-hover-info" aria-hidden="true"><strong>${escapeHtml(product.name || 'ไม่ระบุชื่อ')}</strong><span>สต๊อก ${stock} ${escapeHtml(unit)}</span><span>${money(product.price)} บาท</span></span>`;
}

function restoreProductCards() {
  if (!grid) return;
  const map = productsById();
  grid.querySelectorAll('[data-product-id]').forEach(card => {
    const product = map.get(String(card.dataset.productId || ''));
    if (!product) return;
    const src = String(imageUrl(product) || '').trim();
    const title = productTitle(product);
    card.setAttribute('title', title);
    card.setAttribute('aria-label', title.replace(/\n/g, ' '));
    if (!src) return;
    const stamp = `${product.id}|${product.updatedAt || ''}|${product.stock || 0}|${product.price || 0}|${src}`;
    if (card.dataset.posImageRestored === stamp) return;
    card.dataset.posImageRestored = stamp;
    card.classList.add('pos-product-card-image');
    const id = product.id || '';
    const barcode = product.barcode || '';
    const code = [id, barcode].filter(Boolean).join(' • ');
    card.innerHTML = `<span class="pos-card-image-wrap"><img src="${escapeHtml(src)}" alt="${escapeHtml(product.name || '')}" loading="lazy" decoding="async"></span><span class="pos-card-title">${escapeHtml(product.name || 'ไม่ระบุชื่อ')}</span><span class="pos-card-code">${escapeHtml(code)}</span><span class="pos-card-stock">คงเหลือ ${Number(product.stock || 0).toLocaleString('th-TH')} ${escapeHtml(product.unit || 'ชิ้น')}</span><span class="pos-card-price">${money(product.price)} บาท</span>${hoverInfoHtml(product)}`;
  });
}

if (grid) new MutationObserver(() => requestAnimationFrame(restoreProductCards)).observe(grid, { childList: true, subtree: false });
window.addEventListener('pageshow', () => setTimeout(restoreProductCards, 0));
window.addEventListener('storage', event => { if (!event.key || event.key === PRODUCT_KEY) setTimeout(restoreProductCards, 0); });
restoreProductCards();
