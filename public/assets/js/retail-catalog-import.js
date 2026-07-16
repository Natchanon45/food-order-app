import { RetailCollections, saveRecordsStrict, listRecords } from './retail-db.js?v=20260628-7';
import { buildRetailMasterCatalogThailand, validateRetailMasterCatalogThailand } from './rmct.js?v=20260628-7';
import { requireRole } from './auth-service.js?v=20260716-009';

await requireRole(['owner']);

const categoryIcons = ["droplet", "cup-straw", "cup-hot", "cup", "lightning-charge", "box-seam", "grid-3x3-gap", "basket", "bag", "archive", "box2", "bookshelf"];

const els = {
  totalProducts: document.querySelector('#totalProducts'),
  readyProducts: document.querySelector('#readyProducts'),
  currentProducts: document.querySelector('#currentProducts'),
  reviewPending: document.querySelector('#reviewPending'),
  catalogSearch: document.querySelector('#catalogSearch'),
  catalogStatusFilter: document.querySelector('#catalogStatusFilter'),
  clearCatalogFilters: document.querySelector('#clearCatalogFilters'),
  selectAllCategories: document.querySelector('#selectAllCategories'),
  selectReadyCategories: document.querySelector('#selectReadyCategories'),
  clearCategories: document.querySelector('#clearCategories'),
  importButton: document.querySelector('#importButton'),
  previewRows: document.querySelector('#previewRows'),
  previewSummary: document.querySelector('#previewSummary'),
  catalogImportSummary: document.querySelector('#catalogImportSummary'),
  importResult: document.querySelector('#importResult'),
  skipExisting: document.querySelector('#skipExisting'),
  categoryGrid: document.querySelector('#categoryGrid'),
  importDialog: document.querySelector('#importDialog'),
  importDialogCount: document.querySelector('#importDialogCount'),
  importDialogSummary: document.querySelector('#importDialogSummary'),
  cancelImport: document.querySelector('#cancelImport'),
  confirmImport: document.querySelector('#confirmImport')
};

const catalog = buildRetailMasterCatalogThailand();
const validation = validateRetailMasterCatalogThailand(catalog);
const selectedCategoryIds = new Set(catalog.products.map(item => item.categoryId));
const categorySummaries = categorySummary(catalog.products);
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

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  }
}

function renderImportSuccess(rows) {
  const previewRows = rows.slice(0, 8);
  const moreCount = Math.max(0, rows.length - previewRows.length);
  els.importResult.dataset.tone = 'success';
  els.importResult.innerHTML = `
    <div class="import-success">
      <div class="import-success-head">
        <span class="import-success-icon" aria-hidden="true"><i class="bi bi-check2-circle"></i></span>
        <div>
          <strong>นำเข้าสำเร็จ ${rows.length.toLocaleString('th-TH')} รายการ</strong>
          <span>ตั้งสต็อกเป็น 0 และยังไม่แสดงบน POS จนกว่าจะตรวจสินค้า</span>
        </div>
      </div>
      <div class="import-success-actions">
        <a class="btn primary" href="/pos/products/">ไปตรวจสินค้าที่นำเข้า</a>
        <button id="copyImportedSku" class="btn secondary" type="button">คัดลอก SKU</button>
      </div>
      <div class="import-success-checklist" aria-label="สิ่งที่ต้องตรวจหลังนำเข้า">
        <span><i class="bi bi-currency-dollar" aria-hidden="true"></i><strong>ตรวจราคา</strong><small>ยืนยันราคาขายจริงก่อนเปิดใช้งาน</small></span>
        <span><i class="bi bi-box-seam" aria-hidden="true"></i><strong>ตั้งสต็อก</strong><small>เพิ่มจำนวนคงเหลือจากหน้าสินค้า</small></span>
        <span><i class="bi bi-eye" aria-hidden="true"></i><strong>เปิดขายบน POS</strong><small>เปิดแสดงเฉพาะรายการที่พร้อมขาย</small></span>
      </div>
      <div class="import-success-list">
        ${previewRows.map(item => `
          <span>
            <strong>${escapeHtml(item.masterProductId)}</strong>
            <small>${escapeHtml(item.name)}</small>
          </span>
        `).join('')}
        ${moreCount ? `<span class="more"><strong>+${moreCount.toLocaleString('th-TH')}</strong><small>รายการอื่น ๆ</small></span>` : ''}
      </div>
    </div>
  `;
  els.importResult.querySelector('#copyImportedSku')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const copied = await copyText(rows.map(item => item.masterProductId).join('\n'));
    button.textContent = copied ? 'คัดลอกแล้ว' : 'คัดลอกไม่สำเร็จ';
    window.setTimeout(() => { button.textContent = 'คัดลอก SKU'; }, 1600);
  });
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
  els.categoryGrid.innerHTML = categorySummaries.map((item, index) => `
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

function importBreakdown() {
  const rows = selectedProducts();
  const keys = existingKeys();
  const readyRows = rows.filter(item => item.catalogStatus === 'published');
  const existingReadyRows = readyRows.filter(item => isExisting(item, keys));
  const importableRows = els.skipExisting.checked
    ? readyRows.filter(item => !isExisting(item, keys))
    : readyRows;
  return {
    selected: rows.length,
    ready: readyRows.length,
    importable: importableRows.length,
    skippedExisting: els.skipExisting.checked ? existingReadyRows.length : 0,
    draft: rows.length - readyRows.length
  };
}

function renderImportSummary() {
  const summary = importBreakdown();
  const emptyReason = !validation.valid
    ? `Catalog ไม่ผ่าน validation: ${validation.errors[0]}`
    : summary.importable
      ? 'พร้อมนำเข้าเฉพาะรายการที่ผ่านตรวจ โดยตั้งสต็อกเป็น 0 และยังไม่แสดงบน POS'
      : summary.ready && summary.skippedExisting
        ? `มีสินค้า ${summary.ready.toLocaleString('th-TH')} รายการที่พร้อมนำเข้า แต่ถูกข้ามทั้งหมดเพราะมี SKU หรือ Barcode อยู่ในร้านแล้ว`
        : summary.ready
          ? 'ยังไม่มีรายการพร้อมนำเข้าหลังตัวกรองปัจจุบัน'
          : 'หมวดที่เลือกยังมีเฉพาะรายการรอตรวจสอบ จึงยังไม่สามารถนำเข้าได้';
  els.catalogImportSummary.innerHTML = `
    <div class="summary-copy">
      <strong>${escapeHtml(emptyReason)}</strong>
      <span>ใช้ตัวเลขนี้ตรวจสอบก่อนกดยืนยัน ระบบจะไม่นำเข้าฉบับร่างและไม่แตะสต็อกเดิม</span>
    </div>
    <div class="summary-metrics">
      <span><small>เลือกอยู่</small><strong>${summary.selected.toLocaleString('th-TH')}</strong></span>
      <span class="ready"><small>พร้อมนำเข้า</small><strong>${summary.ready.toLocaleString('th-TH')}</strong></span>
      <span class="${summary.importable ? 'ready' : 'muted'}"><small>นำเข้าได้ตอนนี้</small><strong>${summary.importable.toLocaleString('th-TH')}</strong></span>
      <span class="${summary.skippedExisting ? 'warning' : 'muted'}"><small>ข้ามเพราะมีแล้ว</small><strong>${summary.skippedExisting.toLocaleString('th-TH')}</strong></span>
      <span class="${summary.draft ? 'warning' : 'muted'}"><small>รอตรวจสอบ</small><strong>${summary.draft.toLocaleString('th-TH')}</strong></span>
    </div>
  `;
}

function previewStatusCounts(rows) {
  const counts = { all: rows.length, importable: 0, ready: 0, existing: 0, draft: 0 };
  for (const item of rows) {
    const isReady = item.catalogStatus === 'published';
    if (!isReady) {
      counts.draft += 1;
      continue;
    }
    counts.ready += 1;
    const exists = isExisting(item);
    if (exists) counts.existing += 1;
    if (!els.skipExisting.checked || !exists) counts.importable += 1;
  }
  return counts;
}

function renderStatusFilterOptions(rows) {
  const currentValue = els.catalogStatusFilter.value || 'all';
  const counts = previewStatusCounts(rows);
  const options = [
    ['all', 'ทุกสถานะ', counts.all],
    ['importable', 'นำเข้าได้ตอนนี้', counts.importable],
    ['ready', 'พร้อมนำเข้า', counts.ready],
    ['existing', 'มีในร้านแล้ว', counts.existing],
    ['draft', 'รอตรวจสอบ', counts.draft]
  ];
  els.catalogStatusFilter.innerHTML = options.map(([value, label, count]) => (
    `<option value="${value}" ${value === currentValue ? 'selected' : ''}>${label} (${count.toLocaleString('th-TH')})</option>`
  )).join('');
}

function barcodeCell(item) {
  return item.barcode ? `<span class="pill">${escapeHtml(item.barcode)}</span>` : '<span class="pill muted">รอตรวจสอบ</span>';
}

function statusCell(item) {
  const reason = statusReason(item);
  if (item.catalogStatus !== 'published') {
    return `<span class="status-stack"><span class="pill muted">รอตรวจสอบ</span><small>${escapeHtml(reason)}</small></span>`;
  }
  if (isExisting(item)) {
    return `<span class="status-stack"><span class="pill warning">มีในร้านแล้ว</span><small>${escapeHtml(reason)}</small></span>`;
  }
  return `<span class="status-stack"><span class="pill">พร้อมนำเข้า</span><small>${escapeHtml(reason)}</small></span>`;
}

function statusReason(item) {
  if (item.catalogStatus === 'published') {
    return isExisting(item) ? 'ข้ามได้เพราะ SKU หรือ Barcode ซ้ำ' : 'มี Barcode และแหล่งตรวจสอบแล้ว';
  }
  const missing = [];
  if (!item.barcode) missing.push('Barcode จริง');
  if (!item.verificationSources?.length) missing.push('แหล่งตรวจสอบ');
  if (!item.imageUrl) missing.push('รูปสินค้า');
  return missing.length ? `ต้องเติม ${missing.join(', ')}` : 'รอตรวจคุณภาพข้อมูล';
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
  renderStatusFilterOptions(rows);
  const filteredRows = previewRows(rows);
  const published = rows.filter(item => item.catalogStatus === 'published').length;
  const importable = importBreakdown().importable;
  const visibleLimit = 50;
  els.previewSummary.textContent = `เลือก ${rows.length.toLocaleString('th-TH')} รายการ • แสดง ${filteredRows.length.toLocaleString('th-TH')} รายการ • พร้อมนำเข้า ${published.toLocaleString('th-TH')} • นำเข้าได้ตอนนี้ ${importable.toLocaleString('th-TH')}`;
  els.previewRows.innerHTML = filteredRows.length ? filteredRows.slice(0, visibleLimit).map(item => `
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
  `).join('') : '<tr><td colspan="8" class="empty-preview">ไม่พบรายการตามคำค้นหาหรือตัวกรองนี้</td></tr>';
  renderImportSummary();
}

function refreshCatalogView() {
  renderCategories();
  renderPreview();
  updateImportButton();
}

function previewRows(rows) {
  const query = String(els.catalogSearch.value || '').trim().toLowerCase();
  const status = els.catalogStatusFilter.value || 'all';
  return rows.filter(item => {
    const exists = isExisting(item);
    const isReady = item.catalogStatus === 'published';
    const statusMatch = status === 'all'
      || (status === 'ready' && isReady)
      || (status === 'importable' && isReady && (!els.skipExisting.checked || !exists))
      || (status === 'existing' && isReady && exists)
      || (status === 'draft' && !isReady);
    if (!statusMatch) return false;
    if (!query) return true;
    const haystack = [
      item.masterProductId,
      item.sku,
      item.barcode,
      item.name,
      item.nameTh,
      item.brand,
      item.brandTh,
      item.category,
      item.categoryId,
      item.keywords?.join(' ')
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

function renderStats() {
  els.totalProducts.textContent = catalog.productCount.toLocaleString('th-TH');
  els.readyProducts.textContent = catalog.publishedCount.toLocaleString('th-TH');
  els.currentProducts.textContent = existingProducts.length.toLocaleString('th-TH');
  els.reviewPending.textContent = catalog.draftCount.toLocaleString('th-TH');
}

function updateImportButton() {
  const breakdown = importBreakdown();
  const count = breakdown.importable;
  els.importButton.disabled = importing || !validation.valid || count === 0;
  els.importButton.dataset.posIcon = importing ? 'hourglass-split' : 'box-arrow-in-down';
  els.importButton.innerHTML = importing
    ? '<i class="bi bi-hourglass-split" aria-hidden="true"></i><span>กำลังนำเข้า...</span>'
    : '<i class="bi bi-box-arrow-in-down" aria-hidden="true"></i><span>นำเข้าทั้งหมด</span>';
  renderImportSummary();
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
  const summary = importBreakdown();
  els.importDialogCount.textContent = pendingImportRows.length.toLocaleString('th-TH');
  els.importDialogSummary.innerHTML = `
    <span><small>นำเข้าใหม่</small><strong>${summary.importable.toLocaleString('th-TH')}</strong></span>
    <span><small>ข้ามเพราะมีแล้ว</small><strong>${summary.skippedExisting.toLocaleString('th-TH')}</strong></span>
    <span><small>รอตรวจสอบ</small><strong>${summary.draft.toLocaleString('th-TH')}</strong></span>
  `;
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
    renderImportSuccess(rows);
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
els.selectAllCategories.addEventListener('click', () => {
  selectedCategoryIds.clear();
  for (const item of categorySummaries) selectedCategoryIds.add(item.id);
  refreshCatalogView();
});
els.selectReadyCategories.addEventListener('click', () => {
  selectedCategoryIds.clear();
  for (const item of categorySummaries) {
    if (item.published) selectedCategoryIds.add(item.id);
  }
  refreshCatalogView();
});
els.clearCategories.addEventListener('click', () => {
  selectedCategoryIds.clear();
  refreshCatalogView();
});
els.skipExisting.addEventListener('change', () => {
  renderPreview();
  updateImportButton();
});
els.catalogSearch.addEventListener('input', renderPreview);
els.catalogStatusFilter.addEventListener('change', renderPreview);
els.clearCatalogFilters.addEventListener('click', () => {
  els.catalogSearch.value = '';
  els.catalogStatusFilter.value = 'all';
  renderPreview();
});
els.importButton.addEventListener('click', requestImport);
els.cancelImport.addEventListener('click', () => {
  pendingImportRows = [];
  els.importDialog.close();
});
els.confirmImport.addEventListener('click', importCatalog);
await loadCatalogState();
