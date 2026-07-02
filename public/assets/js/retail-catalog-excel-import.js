import { requireRole } from './auth-service.js?v=20260630-067';
import { RetailCollections, listRecords, saveRecordsStrict } from './retail-db.js?v=20260629-032';

await requireRole(['owner']);

const MAX_ROWS = 1000;
const els = {
  file: document.querySelector('#excelFile'),
  dropzone: document.querySelector('#excelDropzone'),
  result: document.querySelector('#excelImportResult'),
  preview: document.querySelector('#excelPreview'),
  summary: document.querySelector('#excelPreviewSummary'),
  rows: document.querySelector('#excelPreviewRows'),
  button: document.querySelector('#excelImportButton')
};
let parsedRows = [];
let validRows = [];
let importing = false;

const headerAliases = new Map([
  ['รหัสสินค้า', 'id'], ['productid', 'id'], ['sku', 'id'],
  ['บาร์โค้ด', 'barcode'], ['barcode', 'barcode'],
  ['ชื่อสินค้า', 'name'], ['productname', 'name'],
  ['หมวดหมู่', 'category'], ['category', 'category'],
  ['แบรนด์', 'brand'], ['brand', 'brand'],
  ['ราคาขาย', 'price'], ['price', 'price'],
  ['ราคาทุน', 'cost'], ['cost', 'cost'],
  ['หน่วยนับ', 'unit'], ['unit', 'unit'],
  ['สต็อกเริ่มต้น', 'stock'], ['stock', 'stock'],
  ['จุดแจ้งเตือน', 'minStock'], ['minstock', 'minStock'],
  ['แสดงบนpos', 'showOnPos'], ['showonpos', 'showOnPos'],
  ['รายละเอียด', 'description'], ['description', 'description']
]);

function normalizeHeader(value) { return String(value ?? '').trim().toLowerCase().replace(/[*\s_/-]+/g, ''); }
function text(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text || '').trim();
    if ('result' in value) return String(value.result ?? '').trim();
    if (Array.isArray(value.richText)) return value.richText.map(item => item.text || '').join('').trim();
  }
  return String(value).trim();
}
function numberValue(value) { const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value; return normalized === '' || normalized == null ? null : Number(normalized); }
function booleanValue(value) { return ['ใช่', 'yes', 'true', '1', 'เปิด', 'แสดง'].includes(text(value).toLowerCase()); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function money(value) { return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function setResult(message, tone = '') { els.result.textContent = message; els.result.dataset.tone = tone; }

function findHeaderRow(rows) {
  for (let rowIndex = 0; rowIndex < Math.min(12, rows.length); rowIndex += 1) {
    if ((rows[rowIndex] || []).some(value => normalizeHeader(text(value)) === 'รหัสสินค้า')) return rowIndex;
  }
  return -1;
}

function columnMap(headerValues) {
  const result = new Map();
  (headerValues || []).forEach((value, column) => { const key = headerAliases.get(normalizeHeader(text(value))); if (key) result.set(key, column); });
  return result;
}

function validateRow(row, existingIds, existingBarcodes, fileIds, fileBarcodes) {
  const errors = [];
  if (!/^P\d{9}$/.test(row.id)) errors.push('รหัสต้องเป็น P ตามด้วยตัวเลข 9 หลัก');
  if (!row.barcode) errors.push('ไม่มีบาร์โค้ด');
  if (!row.name) errors.push('ไม่มีชื่อสินค้า');
  if (!row.category) errors.push('ไม่มีหมวดหมู่');
  if (!Number.isFinite(row.price) || row.price < 0) errors.push('ราคาขายไม่ถูกต้อง');
  if (!row.unit) errors.push('ไม่มีหน่วยนับ');
  if (!Number.isInteger(row.stock) || row.stock < 0) errors.push('สต็อกต้องเป็นจำนวนเต็ม 0 ขึ้นไป');
  if (!Number.isInteger(row.minStock) || row.minStock < 0) errors.push('จุดแจ้งเตือนต้องเป็นจำนวนเต็ม 0 ขึ้นไป');
  if (existingIds.has(row.id)) errors.push('รหัสสินค้ามีอยู่แล้ว');
  if (existingBarcodes.has(row.barcode)) errors.push('บาร์โค้ดมีอยู่แล้ว');
  if (fileIds.has(row.id)) errors.push('รหัสสินค้าซ้ำในไฟล์');
  if (fileBarcodes.has(row.barcode)) errors.push('บาร์โค้ดซ้ำในไฟล์');
  if (row.id) fileIds.add(row.id);
  if (row.barcode) fileBarcodes.add(row.barcode);
  return errors;
}

async function parseWorkbook(file) {
  if (!globalThis.XLSX) throw new Error('ตัวอ่าน Excel ยังโหลดไม่สำเร็จ กรุณา Reload หน้า');
  if (!file?.name?.toLowerCase().endsWith('.xlsx')) throw new Error('กรุณาเลือกไฟล์ .xlsx เท่านั้น');
  const workbook = globalThis.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames.includes('นำเข้าสินค้า') ? 'นำเข้าสินค้า' : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error('ไม่พบ Worksheet ในไฟล์');
  const matrix = globalThis.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
  const headerRow = findHeaderRow(matrix);
  if (headerRow < 0) throw new Error('ไม่พบหัวคอลัมน์ “รหัสสินค้า*” กรุณาใช้แบบฟอร์มตัวอย่าง');
  const columns = columnMap(matrix[headerRow]);
  const required = ['id', 'barcode', 'name', 'category', 'price', 'unit', 'stock'];
  if (required.some(key => !columns.has(key))) throw new Error('หัวคอลัมน์ไม่ครบ กรุณาดาวน์โหลดแบบฟอร์มใหม่');
  const existing = await listRecords(RetailCollections.products);
  const existingIds = new Set(existing.map(item => String(item.id || '')));
  const existingBarcodes = new Set(existing.map(item => String(item.barcode || '')).filter(Boolean));
  let nextIdNumber = Math.max(0, ...[...existingIds].map(id => /^P(\d{9})$/.test(id) ? Number(id.slice(1)) : 0));
  const allocateId = () => { do { nextIdNumber += 1; } while (existingIds.has(`P${String(nextIdNumber).padStart(9, '0')}`)); return `P${String(nextIdNumber).padStart(9, '0')}`; };
  const fileIds = new Set(), fileBarcodes = new Set(), rows = [];
  const lastRow = Math.min(matrix.length, headerRow + 1 + MAX_ROWS);
  for (let rowIndex = headerRow + 1; rowIndex < lastRow; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const get = key => columns.has(key) ? row[columns.get(key)] : '';
    if (![get('id'), get('barcode'), get('name')].some(value => text(value))) continue;
    const product = {
      rowNumber: rowIndex + 1,
      id: text(get('id')).toUpperCase() || allocateId(),
      barcode: text(get('barcode')).replace(/\.0$/, ''),
      name: text(get('name')),
      category: text(get('category')),
      brand: text(get('brand')),
      price: numberValue(get('price')),
      cost: numberValue(get('cost')),
      unit: text(get('unit')),
      stock: numberValue(get('stock')),
      minStock: numberValue(get('minStock')) ?? 5,
      showOnPos: booleanValue(get('showOnPos')),
      description: text(get('description'))
    };
    product.errors = validateRow(product, existingIds, existingBarcodes, fileIds, fileBarcodes);
    rows.push(product);
  }
  if (!rows.length) throw new Error('ไม่พบข้อมูลสินค้าหลังแถวหัวคอลัมน์');
  if (matrix.length > headerRow + 1 + MAX_ROWS) throw new Error(`ไฟล์เกิน ${MAX_ROWS.toLocaleString('th-TH')} รายการ กรุณาแบ่งไฟล์`);
  return rows;
}

function renderPreview() {
  validRows = parsedRows.filter(row => !row.errors.length);
  const invalidCount = parsedRows.length - validRows.length;
  els.preview.hidden = false;
  els.summary.textContent = `ทั้งหมด ${parsedRows.length.toLocaleString('th-TH')} รายการ • พร้อมนำเข้า ${validRows.length.toLocaleString('th-TH')} • ต้องแก้ไข ${invalidCount.toLocaleString('th-TH')}`;
  els.rows.innerHTML = parsedRows.slice(0, 50).map(row => `<tr><td>${row.rowNumber}</td><td>${escapeHtml(row.id)}</td><td><strong>${escapeHtml(row.name || '-')}</strong></td><td>${escapeHtml(row.category || '-')}</td><td class="number">${money(row.price)}</td><td class="${row.errors.length ? 'excel-row-error' : 'excel-row-ready'}">${row.errors.length ? escapeHtml(row.errors.join(' • ')) : 'พร้อมนำเข้า'}</td></tr>`).join('');
  els.button.disabled = importing || !validRows.length || invalidCount > 0;
  setResult(invalidCount ? `พบข้อมูลที่ต้องแก้ไข ${invalidCount.toLocaleString('th-TH')} รายการ กรุณาแก้ใน Excel แล้วอัปโหลดใหม่` : `ตรวจไฟล์สำเร็จ ${validRows.length.toLocaleString('th-TH')} รายการ พร้อมนำเข้า`, invalidCount ? 'error' : '');
}

async function handleFile(file) {
  parsedRows = []; validRows = []; els.preview.hidden = true; els.button.disabled = true;
  setResult(`กำลังตรวจไฟล์ ${file?.name || ''}...`);
  try { parsedRows = await parseWorkbook(file); renderPreview(); }
  catch (error) { console.error('[excel-import] parse failed', error); setResult(error?.message || 'อ่านไฟล์ไม่สำเร็จ', 'error'); }
}

async function importExcel() {
  if (importing || !validRows.length || parsedRows.some(row => row.errors.length)) return;
  if (!confirm(`ยืนยันนำเข้าสินค้า ${validRows.length.toLocaleString('th-TH')} รายการลง Firebase หรือไม่?`)) return;
  importing = true; els.button.disabled = true;
  try {
    const rows = validRows.map(({ rowNumber, errors, ...product }) => ({ ...product, importedFromExcel: true, importedAt: new Date().toISOString(), activationStatus: product.showOnPos ? 'active' : 'setup_required' }));
    await saveRecordsStrict(RetailCollections.products, rows, { onProgress: ({ completed, total }) => setResult(`กำลังนำเข้า ${completed.toLocaleString('th-TH')} / ${total.toLocaleString('th-TH')} รายการ`) });
    setResult(`นำเข้าสินค้าจาก Excel สำเร็จ ${rows.length.toLocaleString('th-TH')} รายการ`);
    parsedRows = []; validRows = []; els.preview.hidden = true; els.file.value = '';
    window.dispatchEvent(new CustomEvent('retail-pos-products-changed'));
  } catch (error) { console.error('[excel-import] save failed', error); setResult(String(error?.code || '').includes('permission-denied') ? 'นำเข้าไม่สำเร็จ: เฉพาะเจ้าของร้านเท่านั้น' : `นำเข้าไม่สำเร็จ: ${error?.message || 'กรุณาลองใหม่'}`, 'error'); }
  finally { importing = false; }
}

els.file?.addEventListener('change', () => handleFile(els.file.files?.[0]));
els.dropzone?.addEventListener('dragover', event => { event.preventDefault(); els.dropzone.classList.add('is-dragover'); });
els.dropzone?.addEventListener('dragleave', () => els.dropzone.classList.remove('is-dragover'));
els.dropzone?.addEventListener('drop', event => { event.preventDefault(); els.dropzone.classList.remove('is-dragover'); const file = event.dataTransfer?.files?.[0]; if (file) handleFile(file); });
els.button?.addEventListener('click', importExcel);
