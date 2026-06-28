import { RetailCollections, saveRecords, listRecords } from './retail-db.js?v=20260627-3';
import { buildRetailMasterCatalogThailand } from './rmct.js?v=20260628-1';

const categoryIcons = ['💧','🥤','🍵','☕','⚡','🥛','🍜','🍪','🍬','🧴','🧽','🧂'];
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
      <div class="category-icon">${categoryIcons[index % categoryIcons.length]}</div>
      <div>
        <h3>${item.name}</h3>
        <p>${item.count.toLocaleString('th-TH')} รายการ • ${item.brands.size.toLocaleString('th-TH')} แบรนด์</p>
      </div>
    </article>
  `).join('');
}

async function loadPreview() {
  const catalog = buildRetailMasterCatalogThailand();
  const existing = await listRecords(RetailCollections.products);
  const pending = catalog.products.filter(item => item.barcodeStatus === 'pending_verification').length;
  els.totalProducts.textContent = catalog.productCount.toLocaleString('th-TH');
  els.currentProducts.textContent = existing.length.toLocaleString('th-TH');
  els.barcodePending.textContent = pending.toLocaleString('th-TH');
  renderCategories(catalog.products);
  els.previewRows.innerHTML = catalog.products.slice(0, 12).map(item => `
    <tr>
      <td>${item.id}</td>
      <td><strong>${item.name}</strong></td>
      <td>${item.category}</td>
      <td>${item.brandTh || item.brand}</td>
      <td class="number">${money(item.price)}</td>
      <td><span class="pill">รอตรวจสอบ</span></td>
    </tr>
  `).join('');
}

async function importCatalog() {
  const catalog = buildRetailMasterCatalogThailand();
  const existing = await listRecords(RetailCollections.products);
  const existingIds = new Set(existing.map(item => String(item.id)));
  const rows = els.skipExisting.checked ? catalog.products.filter(item => !existingIds.has(String(item.id))) : catalog.products;
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
