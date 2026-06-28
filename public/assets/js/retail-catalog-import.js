import { RetailCollections, saveRecords, listRecords } from './retail-db.js?v=20260627-3';
import { buildRetailMasterCatalogThailand } from './rmct.js?v=20260628-1';

const categorySvg = [
  '<svg viewBox="0 0 24 24"><path d="M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M8 4h8l-1 16H9L8 4z"/><path d="M7 8h10"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M6 9h10v5a5 5 0 0 1-10 0V9z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M7 8h10v7a5 5 0 0 1-10 0V8z"/><path d="M6 19h12"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M13 2 5 13h6l-1 9 9-13h-6l0-7z"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M8 3h8l1 4v13H7V7l1-4z"/><path d="M8 8h8"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M5 7h14v10H5z"/><path d="M8 7v10M16 7v10"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M5 8h14l-2 11H7L5 8z"/><path d="M8 5h8"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M7 8h10v8H7z"/><path d="M3 12h4M17 12h4"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M8 5h8v4H8z"/><path d="M7 9h10v11H7z"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M6 10h12v9H6z"/><path d="M9 6h6v4H9z"/></svg>',
  '<svg viewBox="0 0 24 24"><path d="M8 4h8v16H8z"/><path d="M10 8h4M10 12h4"/></svg>'
];
const els = {
  totalProducts: document.querySelector('#totalProducts'),
  currentProducts: document.querySelector('#currentProducts'),
  barcodePending: document.querySelector('#barcodePending'),
  importButton: document.querySelector('#importButton'),
  previewRows: document.querySelector('#previewRows'),
  importResult: document.querySelector('#importResult'),
  skipExisting: document.querySelector('#skipExisting'),
  categoryGrid: document.querySelector('#categoryGrid')
};

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ean13FromSku(item) {
  const digits = String(item.sku || item.id || '').replace(/\D/g, '').slice(-9).padStart(9, '0');
  const base = `8859${digits}`.slice(0, 12);
  const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return `${base}${check}`;
}

function withSystemBarcode(item) {
  const barcode = String(item.barcode || '').trim() || ean13FromSku(item);
  return {
    ...item,
    barcode,
    barcodeStatus: item.barcode ? (item.barcodeStatus || 'verified') : 'thai_ean13_generated',
    barcodeType: item.barcode ? (item.barcodeType || 'ean13') : 'ean13_generated_885',
    sourceNote: `${item.sourceNote || ''} ใช้ EAN-13 ขึ้นต้น 885 สำหรับสแกนภายในร้าน รูปสินค้ายังไม่ถูกนำเข้าอัตโนมัติ`.trim()
  };
}

function setResult(message, tone = '') {
  els.importResult.textContent = message;
  els.importResult.dataset.tone = tone;
}

function categorySummary(products) {
  const map = new Map();
  for (const item of products) {
    const key = item.category || 'อื่น ๆ';
    const current = map.get(key) || { name: key, count: 0, brands: new Set() };
    current.count += 1;
    if (item.brandTh || item.brand) current.brands.add(item.brandTh || item.brand);
    map.set(key, current);
  }
  return [...map.values()];
}

function renderCategories(products) {
  els.categoryGrid.innerHTML = categorySummary(products).map((item, index) => `
    <article class="category-card">
      <div class="category-icon" aria-hidden="true">${categorySvg[index % categorySvg.length]}</div>
      <div>
        <h3>${item.name}</h3>
        <p>${item.count.toLocaleString('th-TH')} รายการ • ${item.brands.size.toLocaleString('th-TH')} แบรนด์</p>
      </div>
    </article>
  `).join('');
}

async function loadPreview() {
  const catalog = buildRetailMasterCatalogThailand();
  const products = catalog.products.map(withSystemBarcode);
  const existing = await listRecords(RetailCollections.products);
  els.totalProducts.textContent = catalog.productCount.toLocaleString('th-TH');
  els.currentProducts.textContent = existing.length.toLocaleString('th-TH');
  els.barcodePending.textContent = products.length.toLocaleString('th-TH');
  renderCategories(products);
  els.previewRows.innerHTML = products.slice(0, 12).map(item => `
    <tr>
      <td>${item.id}</td>
      <td><strong>${item.name}</strong></td>
      <td>${item.category}</td>
      <td>${item.brandTh || item.brand}</td>
      <td class="number">${money(item.price)}</td>
      <td><span class="pill">${item.barcode}</span></td>
    </tr>
  `).join('');
}

async function importCatalog() {
  const catalog = buildRetailMasterCatalogThailand();
  const products = catalog.products.map(withSystemBarcode);
  const existing = await listRecords(RetailCollections.products);
  const existingIds = new Set(existing.map(item => String(item.id)));
  const rows = els.skipExisting.checked ? products.filter(item => !existingIds.has(String(item.id))) : products;
  if (!rows.length) return setResult('ไม่มีสินค้าที่ต้องนำเข้า ร้านนี้มี SKU ชุดนี้ครบแล้ว', '');
  if (!confirm(`นำเข้าสินค้า ${rows.length.toLocaleString('th-TH')} รายการเข้าร้านนี้?`)) return;
  els.importButton.disabled = true;
  els.importButton.textContent = 'กำลังนำเข้า...';
  setResult('กำลังบันทึกสินค้า กรุณารอสักครู่...');
  try {
    await saveRecords(RetailCollections.products, rows);
    setResult(`นำเข้าสำเร็จ ${rows.length.toLocaleString('th-TH')} รายการ`, '');
    await loadPreview();
  } catch (error) {
    console.error('[catalog-import]', error);
    setResult('นำเข้าไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Firestore หรือ Console', 'error');
  } finally {
    els.importButton.disabled = false;
    els.importButton.textContent = 'นำเข้าสินค้าที่ยังไม่มี';
  }
}

els.importButton.addEventListener('click', importCatalog);
await loadPreview();
