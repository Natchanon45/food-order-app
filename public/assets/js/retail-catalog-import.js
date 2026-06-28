import { RetailCollections, saveRecords, listRecords } from './retail-db.js?v=20260627-3';
import { buildRetailMasterCatalogThailand } from './rmct.js?v=20260628-1';

const els = {
  totalProducts: document.querySelector('#totalProducts'),
  currentProducts: document.querySelector('#currentProducts'),
  importButton: document.querySelector('#importButton'),
  previewRows: document.querySelector('#previewRows'),
  importResult: document.querySelector('#importResult'),
  skipExisting: document.querySelector('#skipExisting')
};

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setResult(message, tone = '') {
  els.importResult.textContent = message;
  els.importResult.dataset.tone = tone;
}

async function loadPreview() {
  const catalog = buildRetailMasterCatalogThailand();
  const existing = await listRecords(RetailCollections.products);
  els.totalProducts.textContent = catalog.productCount.toLocaleString('th-TH');
  els.currentProducts.textContent = existing.length.toLocaleString('th-TH');
  els.previewRows.innerHTML = catalog.products.slice(0, 30).map(item => `
    <tr>
      <td>${item.id}</td>
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>${item.brandTh || item.brand}</td>
      <td class="number">${money(item.price)}</td>
      <td>${item.barcodeStatus === 'pending_verification' ? 'รอตรวจสอบ' : item.barcode}</td>
    </tr>
  `).join('');
}

async function importCatalog() {
  const catalog = buildRetailMasterCatalogThailand();
  const existing = await listRecords(RetailCollections.products);
  const existingIds = new Set(existing.map(item => String(item.id)));
  const rows = els.skipExisting.checked
    ? catalog.products.filter(item => !existingIds.has(String(item.id)))
    : catalog.products;

  if (!rows.length) return setResult('ไม่มีสินค้าที่ต้องนำเข้า', 'ok');
  if (!confirm(`ยืนยันนำเข้าสินค้าพื้นฐาน ${rows.length.toLocaleString('th-TH')} รายการหรือไม่?`)) return;

  els.importButton.disabled = true;
  els.importButton.textContent = 'กำลังนำเข้า...';
  setResult('กำลังบันทึกสินค้า กรุณารอสักครู่...');

  try {
    await saveRecords(RetailCollections.products, rows);
    setResult(`นำเข้าสำเร็จ ${rows.length.toLocaleString('th-TH')} รายการ`, 'ok');
    await loadPreview();
  } catch (error) {
    console.error('[catalog-import]', error);
    setResult('นำเข้าไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Firestore หรือ Console', 'error');
  } finally {
    els.importButton.disabled = false;
    els.importButton.textContent = 'นำเข้าสินค้าพื้นฐาน';
  }
}

els.importButton.addEventListener('click', importCatalog);
await loadPreview();
