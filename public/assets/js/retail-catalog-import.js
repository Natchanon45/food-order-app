import { RetailCollections, saveRecordsStrict, listRecords } from './retail-db.js?v=20260628-7';
import { buildRetailMasterCatalogThailand, validateRetailMasterCatalogThailand } from './rmct.js?v=20260628-7';
import { requireRole } from './auth-service.js?v=20260630-067';

await requireRole(['owner']);

const categoryIcons = ["droplet", "cup-straw", "cup-hot", "cup", "lightning-charge", "box-seam", "grid-3x3-gap", "basket", "bag", "archive", "box2", "bookshelf"];

const els = {
  totalProducts: document.querySelector('#totalProducts'),
  readyProducts: document.querySelector('#readyProducts'),
  currentProducts: document.querySelector('#currentProducts'),
  reviewPending: document.querySelector('#reviewPending'),
  importButton: document.querySelector('#importButton'),
  previewRows: document.querySelector('#previewRows'),
  previewSummary: document.querySelector('#previewSummary'),
  importResult: document.querySelector('#importResult'),
  skipExisting: document.querySelector('#skipExisting'),
  categoryGrid: document.querySelector('#categoryGrid'),
  importDialog: document.querySelector('#importDialog'),
  importDialogCount: document.querySelector('#importDialogCount'),
  cancelImport: document.querySelector('#cancelImport'),
  confirmImport: document.querySelector('#confirmImport')
};

const catalog = buildRetailMasterCatalogThailand();
const validation = validateRetailMasterCatalogThailand(catalog);
const selectedCategoryIds = new Set(catalog.products.map(item => item.categoryId));
let existingProducts = [];
let importing = false;
let pendingImportRows = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

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
    const key = item.categoryId;
    const current = map.get(key) || { id: key, name: item.category || 'อื่น ๆ', count: 0, published: 0, brands: new Set() };
    current.count += 1;
    if (item.catalogStatus === 'published') current.published += 1;
    if (item.brandTh || item.brand) current.brands.add(item.brandTh || item.brand);
    map.set(key, current);
  }
  return [...map.values()];
}

function renderCategories() {
  els.categoryGrid.innerHTML = categorySummary(catalog.products).map((item, index) => `
    <label class="category-card ${item.published ? 'has-ready' : ''}">
      <input type="checkbox" data-category-id="${escapeHtml(item.id)}" ${selectedCategoryIds.has(item.id) ? 'checked' : ''}>
      <span class="category-icon" aria-hidden="true"><i class="bi bi-${categoryIcons[index % categoryIcons.length]}"></i></span>
      <span>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.count.toLocaleString('th-TH')} รายการ • พร้อมนำเข้า ${item.published.toLocaleString('th-TH')}</small>
      </span>
    </label>
  `).join('');
}

function existingKeys() {
  return {
    masterIds: new Set(existingProducts.map(item => String(item.masterProductId || '')).filter(Boolean)),
    barcodes: new Set(existingProducts.map(item => String(item.barcode || '')).filter(Boolean))
  };
}

function isExisting(item, keys = existingKeys()) {
  return keys.masterIds.has(String(item.masterProductId)) || (item.barcode && keys.barcodes.has(String(item.barcode)));
}

function selectedProducts({ publishedOnly = false } = {}) {
  return catalog.products
    .filter(item => selectedCategoryIds.has(item.categoryId) && (!publishedOnly || item.catalogStatus === 'published'))
    .sort((left, right) => {
      const statusOrder = Number(right.catalogStatus === 'published') - Number(left.catalogStatus === 'published');
      return statusOrder || String(left.categoryId).localeCompare(String(right.categoryId)) || String(left.name).localeCompare(String(right.name), 'th');
    });
}

function importRows() {
  const rows = selectedProducts({ publishedOnly: true });
  if (!els.skipExisting.checked) return rows;
  const keys = existingKeys();
  return rows.filter(item => !isExisting(item, keys));
}

function barcodeCell(item) {
  return item.barcode ? `<span class="pill">${escapeHtml(item.barcode)}</span>` : '<span class="pill muted">รอตรวจสอบ</span>';
}

function statusCell(item) {
  return item.catalogStatus === 'published'
    ? '<span class="pill">พร้อมนำเข้า</span>'
    : '<span class="pill muted">ฉบับร่าง</span>';
}

function sourceCell(item) {
  const sources = item.verificationSources || [];
  if (!sources.length) return '<span class="source-empty">—</span>';
  const first = sources[0];
  const suffix = sources.length > 1 ? ` +${sources.length - 1}` : '';
  return `<a class="source-link" href="${escapeHtml(first.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(first.name)}${suffix}</a>`;
}

function renderPreview() {
  const rows = selectedProducts();
  const published = rows.filter(item => item.catalogStatus === 'published').length;
  els.previewSummary.textContent = `เลือก ${rows.length.toLocaleString('th-TH')} รายการ • พร้อมนำเข้า ${published.toLocaleString('th-TH')} รายการ`;
  els.previewRows.innerHTML = rows.slice(0, 20).map(item => `
    <tr>
      <td>${escapeHtml(item.masterProductId)}</td>
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.brandTh || item.brand)}</td>
      <td class="number">${money(item.price)}</td>
      <td>${barcodeCell(item)}</td>
      <td>${statusCell(item)}</td>
      <td>${sourceCell(item)}</td>
    </tr>
  `).join('');
}

function renderStats() {
  els.totalProducts.textContent = catalog.productCount.toLocaleString('th-TH');
  els.readyProducts.textContent = catalog.publishedCount.toLocaleString('th-TH');
  els.currentProducts.textContent = existingProducts.length.toLocaleString('th-TH');
  els.reviewPending.textContent = catalog.draftCount.toLocaleString('th-TH');
}

function updateImportButton() {
  const count = importRows().length;
  els.importButton.disabled = importing || !validation.valid || count === 0;
  els.importButton.textContent = importing ? 'กำลังนำเข้า...' : count
    ? `นำเข้า ${count.toLocaleString('th-TH')} รายการที่ผ่านตรวจ`
    : 'ไม่มีสินค้าที่พร้อมนำเข้า';
}

function prepareImportProduct(item) {
  return {
    ...item,
    id: item.masterProductId,
    sku: item.masterProductId,
    stock: 0,
    showOnPos: false,
    activationStatus: 'setup_required',
    importedFromCatalog: true,
    importedCatalogVersion: catalog.version
  };
}

async function loadCatalogState() {
  existingProducts = await listRecords(RetailCollections.products);
  renderStats();
  renderCategories();
  renderPreview();
  updateImportButton();
  if (!validation.valid) setResult(`Catalog ไม่ผ่าน validation: ${validation.errors[0]}`, 'error');
}

function requestImport() {
  pendingImportRows = importRows();
  if (!pendingImportRows.length || importing || !validation.valid) return;
  els.importDialogCount.textContent = pendingImportRows.length.toLocaleString('th-TH');
  els.importDialog.showModal();
}

async function importCatalog() {
  const rows = [...pendingImportRows];
  if (!rows.length || importing || !validation.valid) return;
  els.importDialog.close();
  pendingImportRows = [];
  importing = true;
  updateImportButton();
  setResult('กำลังบันทึกสินค้า กรุณารอสักครู่...');
  try {
    await saveRecordsStrict(RetailCollections.products, rows.map(prepareImportProduct), {
      onProgress: ({ completed, total }) => setResult(`กำลังนำเข้า ${completed.toLocaleString('th-TH')} / ${total.toLocaleString('th-TH')} รายการ`)
    });
    setResult(`นำเข้าสำเร็จ ${rows.length.toLocaleString('th-TH')} รายการ กรุณาตั้งสต็อกและเปิดแสดงบน POS จากหน้าสินค้า`, '');
    existingProducts = await listRecords(RetailCollections.products);
    renderStats();
    renderPreview();
  } catch (error) {
    console.error('[catalog-import]', error);
    const denied = String(error?.code || error?.message || '').includes('permission-denied');
    setResult(denied ? 'นำเข้าไม่สำเร็จ: บัญชีนี้ไม่มีสิทธิ์เพิ่มสินค้าในร้าน' : `นำเข้าไม่สำเร็จ: ${error?.message || 'กรุณาลองใหม่'}`, 'error');
  } finally {
    importing = false;
    updateImportButton();
  }
}

els.categoryGrid.addEventListener('change', event => {
  const input = event.target.closest('input[data-category-id]');
  if (!input) return;
  if (input.checked) selectedCategoryIds.add(input.dataset.categoryId);
  else selectedCategoryIds.delete(input.dataset.categoryId);
  renderPreview();
  updateImportButton();
});
els.skipExisting.addEventListener('change', updateImportButton);
els.importButton.addEventListener('click', requestImport);
els.cancelImport.addEventListener('click', () => {
  pendingImportRows = [];
  els.importDialog.close();
});
els.confirmImport.addEventListener('click', importCatalog);
await loadCatalogState();
