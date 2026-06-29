import { RetailCollections, getRecord, saveRecordStrict, watchRecords } from './retail-db.js?v=20260629-031';

const KEY = 'retail_pos_loyalty_settings_v1';
const DOCUMENT_ID = 'loyalty';
const defaults = { enabled: true, spendPerPoint: 10, pointValue: 1 };
const form = document.querySelector('#storeSettingsForm');

function readLocal() {
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return { ...defaults }; }
}

function writeLocal(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

if (form && !document.querySelector('#loyaltySettingsSection')) {
  const section = document.createElement('section');
  section.id = 'loyaltySettingsSection';
  section.innerHTML = `<h2>ระบบสะสมแต้มสมาชิก</h2><div class="settings-grid"><label>เปิดใช้งานระบบแต้ม<select id="loyaltyEnabled"><option value="1">เปิดใช้งาน</option><option value="0">ปิดใช้งาน</option></select></label><label>ยอดซื้อที่ได้รับ 1 แต้ม<input id="loyaltySpendPerPoint" type="number" min="0.01" step="0.01"></label><label>มูลค่าต่อ 1 แต้ม<input id="loyaltyPointValue" type="number" min="0.01" step="0.01"></label></div><div class="loyalty-settings-preview"><div><span>ตัวอย่างยอดซื้อ</span><strong id="loyaltyExampleSpend">100.00 บาท</strong></div><div><span>แต้มที่ได้รับ</span><strong id="loyaltyExampleEarn">10 แต้ม</strong></div><div><span>มูลค่า 10 แต้ม</span><strong id="loyaltyExampleValue">10.00 บาท</strong></div></div>`;
  form.querySelector('.settings-actions')?.insertAdjacentElement('beforebegin', section);
}

const enabled = document.querySelector('#loyaltyEnabled');
const spend = document.querySelector('#loyaltySpendPerPoint');
const pointValue = document.querySelector('#loyaltyPointValue');
const exampleSpend = document.querySelector('#loyaltyExampleSpend');
const exampleEarn = document.querySelector('#loyaltyExampleEarn');
const exampleValue = document.querySelector('#loyaltyExampleValue');
const error = document.querySelector('#settingsError');
const toast = document.querySelector('#toast');

function collect() {
  return {
    enabled: enabled.value === '1',
    spendPerPoint: Math.max(0.01, Number(spend.value || defaults.spendPerPoint)),
    pointValue: Math.max(0.01, Number(pointValue.value || defaults.pointValue))
  };
}

function preview() {
  const settings = collect();
  const sample = 100;
  const points = Math.floor(sample / settings.spendPerPoint);
  exampleSpend.textContent = `${sample.toFixed(2)} บาท`;
  exampleEarn.textContent = `${points.toLocaleString('th-TH')} แต้ม`;
  exampleValue.textContent = `${(10 * settings.pointValue).toFixed(2)} บาท`;
}

function fill(settings) {
  const value = { ...defaults, ...settings };
  enabled.value = value.enabled ? '1' : '0';
  spend.value = value.spendPerPoint;
  pointValue.value = value.pointValue;
  preview();
}

function showStatus(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

form?.addEventListener('input', preview);
form?.addEventListener('submit', async () => {
  const settings = collect();
  try {
    await saveRecordStrict(RetailCollections.settings, { id: DOCUMENT_ID, type: 'loyalty', ...settings });
    writeLocal(settings);
    error.textContent = '';
    showStatus('บันทึกระบบแต้มใน Firebase แล้ว');
  } catch (saveError) {
    console.error('[retail-loyalty-settings] firebase save failed', saveError);
    error.textContent = 'บันทึกระบบแต้มใน Firebase ไม่สำเร็จ กรุณาลองใหม่';
  }
});

const localSettings = readLocal();
const remoteSettings = await getRecord(RetailCollections.settings, DOCUMENT_ID);
if (remoteSettings) {
  writeLocal(remoteSettings);
  fill(remoteSettings);
} else {
  fill(localSettings);
  try {
    await saveRecordStrict(RetailCollections.settings, { id: DOCUMENT_ID, type: 'loyalty', ...localSettings });
  } catch (migrationError) {
    console.warn('[retail-loyalty-settings] migration failed', migrationError);
  }
}

const stopSettingsWatch = watchRecords(RetailCollections.settings, rows => {
  const settings = rows.find(row => String(row.id) === DOCUMENT_ID);
  if (!settings) return;
  writeLocal(settings);
  fill(settings);
}, { sortBy: 'updatedAt', direction: 'desc' });
window.addEventListener('beforeunload', stopSettingsWatch, { once: true });
