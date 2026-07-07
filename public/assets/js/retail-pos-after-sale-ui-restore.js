const PRODUCT_KEY = 'retail_pos_products_v1';
const grid = document.querySelector('#productGrid');
let clearingBill = false;

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

function productLabel(product = {}) {
  const stock = Number(product.stock || 0).toLocaleString('th-TH');
  const unit = product.unit || 'ชิ้น';
  return `${product.name || 'ไม่ระบุชื่อ'} คงเหลือ ${stock} ${unit} ${money(product.price)} บาท`;
}

function hoverInfoHtml(product = {}) {
  const stock = Number(product.stock || 0).toLocaleString('th-TH');
  const unit = product.unit || 'ชิ้น';
  return `<span class="pos-card-hover-info" aria-hidden="true"><strong>${escapeHtml(product.name || 'ไม่ระบุชื่อ')}</strong><span class="pos-hover-stock">คงเหลือ ${stock} ${escapeHtml(unit)}</span><span class="pos-hover-price">${money(product.price)} บาท</span></span>`;
}

function soldOutHtml(product = {}) {
  return Number(product.stock || 0) <= 0 ? '<span class="pos-card-sold-out">สินค้าหมด</span>' : '';
}

function restoreProductCards() {
  if (!grid) return;
  const map = productsById();
  grid.querySelectorAll('[data-product-id]').forEach(card => {
    const product = map.get(String(card.dataset.productId || ''));
    if (!product) return;
    const src = String(imageUrl(product) || '').trim();
    const soldOut = Number(product.stock || 0) <= 0;
    card.removeAttribute('title');
    card.setAttribute('aria-label', productLabel(product));
    card.classList.toggle('is-sold-out', soldOut);
    if (soldOut) card.setAttribute('aria-disabled', 'true'); else card.removeAttribute('aria-disabled');
    if (!src) return;
    const stamp = `${product.id}|${product.updatedAt || ''}|${product.stock || 0}|${product.price || 0}|${src}|stock-overlay`;
    if (card.dataset.posImageRestored === stamp) return;
    card.dataset.posImageRestored = stamp;
    card.classList.add('pos-product-card-image');
    const id = product.id || '';
    const barcode = product.barcode || '';
    const code = [id, barcode].filter(Boolean).join(' • ');
    card.innerHTML = `${soldOutHtml(product)}<span class="pos-card-image-wrap"><img src="${escapeHtml(src)}" alt="${escapeHtml(product.name || '')}" loading="lazy" decoding="async"></span><span class="pos-card-title">${escapeHtml(product.name || 'ไม่ระบุชื่อ')}</span><span class="pos-card-code">${escapeHtml(code)}</span><span class="pos-card-stock">คงเหลือ ${Number(product.stock || 0).toLocaleString('th-TH')} ${escapeHtml(product.unit || 'ชิ้น')}</span><span class="pos-card-price">${money(product.price)} บาท</span>${hoverInfoHtml(product)}`;
  });
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) textOrHtml(node, value);
}

function textOrHtml(node, value) {
  if (node.id === 'cartList') node.innerHTML = value;
  else node.textContent = value;
}

function setValue(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.value = value;
}

function clearCurrentBillUi() {
  document.querySelector('#paymentDialog')?.removeAttribute('data-customer-id');
  setValue('#discountInput', '0');
  setValue('#receivedInput', '');
  setText('#cartList', '');
  const cartEmpty = document.querySelector('#cartEmpty');
  if (cartEmpty) cartEmpty.hidden = false;
  setText('#itemCount', '0 รายการ');
  ['#subtotal', '#beforeVatAmount', '#vatAmount', '#grandTotal'].forEach(selector => setText(selector, '0.00'));
  setText('#paymentTotal', '0.00 บาท');
  setText('#changeAmount', '0.00 บาท');
  setText('#paymentError', '');
  const payBtn = document.querySelector('#payBtn');
  if (payBtn) payBtn.disabled = true;
  document.querySelectorAll('[data-selected-customer], .selected-customer, .loyalty-selected, .customer-selected').forEach(node => { node.textContent = ''; node.hidden = true; });
  setTimeout(() => document.querySelector('#barcodeInput')?.focus(), 80);
}

function forceClearBill() {
  if (clearingBill) return;
  clearingBill = true;
  try {
    const clearButton = document.querySelector('#clearSaleBtn');
    if (clearButton && !clearButton.disabled) clearButton.click();
    clearCurrentBillUi();
    window.dispatchEvent(new CustomEvent('retail-pos-bill-cleared'));
  } finally {
    setTimeout(() => { clearingBill = false; }, 120);
  }
}

if (grid) new MutationObserver(() => requestAnimationFrame(restoreProductCards)).observe(grid, { childList: true, subtree: false });
window.addEventListener('pageshow', () => setTimeout(restoreProductCards, 0));
window.addEventListener('storage', event => { if (!event.key || event.key === PRODUCT_KEY) setTimeout(restoreProductCards, 0); });
window.addEventListener('retail-pos-sale-saved', () => setTimeout(forceClearBill, 0));
window.addEventListener('retail-pos-ready-for-next-sale', () => setTimeout(forceClearBill, 0));
window.addEventListener('retail-pos-receipt-closed', () => setTimeout(forceClearBill, 0));
window.retailPosForceClearBill = forceClearBill;
restoreProductCards();
