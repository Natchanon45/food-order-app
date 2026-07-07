import { generatePromptPayPayload } from './promptpay.js?v=20260622-1';
import { RetailCollections, getRecord, getTenantId } from './retail-db.js?v=20260629-032';

const SETTINGS_KEY = 'retail_pos_store_settings_v1';
let settingsCache = readLocalSettings();

const els = {
  dialog: document.querySelector('#paymentDialog'),
  form: document.querySelector('#paymentDialog .payment-form'),
  method: document.querySelector('#paymentMethod'),
  paymentTotal: document.querySelector('#paymentTotal'),
  grandTotal: document.querySelector('#grandTotal')
};

function readLocalSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}

async function refreshSettings() {
  try {
    const [store, payment] = await Promise.all([
      getRecord(RetailCollections.settings, 'store'),
      getRecord(RetailCollections.settings, 'payment')
    ]);
    settingsCache = { ...settingsCache, ...readLocalSettings(), ...(store || {}), ...(payment || {}) };
  } catch (error) {
    settingsCache = { ...settingsCache, ...readLocalSettings() };
    console.warn('[retail-pos-promptpay-payment] settings fallback', error);
  }
  render();
}

function moneyNumber(value) {
  return Number(String(value || '').replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
}

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function maskPromptPay(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `${digits.slice(0, 3)}-xxx-xx${digits.slice(-2)}`;
  if (digits.length === 13) return `${digits.slice(0, 3)}xxxxxxx${digits.slice(-3)}`;
  return `${digits.slice(0, 2)}xxx${digits.slice(-2)}`;
}

function qrImageUrl(payload) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(payload)}`;
}

function currentAmount() {
  return moneyNumber(els.paymentTotal?.textContent) || moneyNumber(els.grandTotal?.textContent);
}

function promptPayInfo() {
  const settings = settingsCache;
  const amount = currentAmount();
  const shopName = settings.shopName || 'POS ร้านค้าปลีก';
  const accountName = settings.promptPayAccountName || shopName;
  const promptPayId = String(settings.promptPayId || '').replace(/\D/g, '');
  const enabled = String(settings.promptPayEnabled || 'no') === 'yes';
  const method = els.method?.value || 'cash';
  const base = {
    method,
    amount,
    shopName,
    accountName,
    promptPayMasked: maskPromptPay(promptPayId),
    sourceOrigin: location.origin,
    tenantId: getTenantId(),
    enabled,
    configured: enabled && Boolean(promptPayId),
    updatedAt: Date.now()
  };
  if (method !== 'promptpay') return { ...base, visible: false };
  if (!enabled || !promptPayId) return { ...base, visible: true, error: 'ยังไม่ได้ตั้งค่า PromptPay ของร้าน' };
  if (amount <= 0) return { ...base, visible: true, error: 'ยอดชำระไม่ถูกต้อง' };
  try {
    const payload = generatePromptPayPayload(promptPayId, amount);
    return { ...base, visible: true, payload, qrImageUrl: qrImageUrl(payload), verified: true };
  } catch (error) {
    return { ...base, visible: true, error: error?.message || 'สร้าง QR PromptPay ไม่สำเร็จ' };
  }
}

function ensurePanel() {
  if (!els.form || document.querySelector('#promptPayPaymentPanel')) return;
  const panel = document.createElement('section');
  panel.id = 'promptPayPaymentPanel';
  panel.className = 'promptpay-payment-panel';
  panel.hidden = true;
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = `
    <div class="promptpay-payment-copy">
      <span>QR PromptPay / โอนเงิน</span>
      <strong id="promptPayPaymentAmount">0.00 บาท</strong>
      <small id="promptPayPaymentVerify"></small>
    </div>
    <div class="promptpay-payment-qr-wrap">
      <img id="promptPayPaymentQr" class="promptpay-payment-qr" alt="QR PromptPay สำหรับชำระเงิน" hidden>
      <div id="promptPayPaymentError" class="promptpay-payment-error" hidden></div>
    </div>`;
  const methodLabel = els.method?.closest('label');
  methodLabel?.insertAdjacentElement('afterend', panel);
}

function ensureStyle() {
  if (document.querySelector('#promptpayPaymentStyle')) return;
  const style = document.createElement('style');
  style.id = 'promptpayPaymentStyle';
  style.textContent = `
    #paymentDialog .promptpay-payment-panel{display:grid;grid-template-columns:minmax(0,1fr)112px;gap:12px;align-items:center;margin-top:12px;padding:13px 14px;border:1px solid #cfe8d8;border-radius:16px;background:linear-gradient(135deg,#f1faf4,#fffdf3);box-shadow:inset 0 1px 0 rgba(255,255,255,.82)}
    #paymentDialog .promptpay-payment-panel[hidden]{display:none!important}
    #paymentDialog .promptpay-payment-copy{display:grid;gap:4px;min-width:0}
    #paymentDialog .promptpay-payment-copy span{font-size:13px;color:#0f5132;font-weight:500}
    #paymentDialog .promptpay-payment-copy strong{font-size:23px;color:#0d6f34;font-weight:500;line-height:1.1}
    #paymentDialog .promptpay-payment-copy small{color:#496458;font-size:12px;line-height:1.35;font-weight:400}
    #paymentDialog .promptpay-payment-qr-wrap{display:grid;place-items:center;min-height:106px;border-radius:14px;background:#fff;border:1px solid #e3ede6;overflow:hidden}
    #paymentDialog .promptpay-payment-qr{width:104px;height:104px;object-fit:contain;display:block}
    #paymentDialog .promptpay-payment-error{padding:10px;text-align:center;color:#9a3412;font-size:12px;line-height:1.35;font-weight:400}
    @media(min-width:801px){#paymentDialog .payment-form.has-pos-pad{grid-template-areas:"head head" "total pad" "customer pad" "method pad" "promptpay pad" "received pad" "change pad" "error error" "actions actions"!important}#paymentDialog .payment-form.has-pos-pad .promptpay-payment-panel{grid-area:promptpay!important;margin-top:0}}
    @media(max-width:800px){#paymentDialog .promptpay-payment-panel{grid-template-columns:1fr;}.promptpay-payment-qr{width:150px!important;height:150px!important}}`;
  document.head.append(style);
}

function render() {
  ensurePanel();
  ensureStyle();
  const info = promptPayInfo();
  const panel = document.querySelector('#promptPayPaymentPanel');
  const amount = document.querySelector('#promptPayPaymentAmount');
  const verify = document.querySelector('#promptPayPaymentVerify');
  const image = document.querySelector('#promptPayPaymentQr');
  const error = document.querySelector('#promptPayPaymentError');
  if (!panel || !amount || !verify || !image || !error) return info;
  panel.hidden = !info.visible;
  amount.textContent = `${money(info.amount)} บาท`;
  verify.textContent = info.error
    ? 'กรุณาไปที่เมนู ตั้งค่าร้านค้าปลีก เพื่อใส่ข้อมูล PromptPay ก่อนรับโอน'
    : `ร้าน ${info.shopName} • ผู้รับ ${info.accountName} • สร้างจาก ${info.sourceOrigin}`;
  if (info.qrImageUrl) {
    image.src = info.qrImageUrl;
    image.hidden = false;
    error.hidden = true;
    error.textContent = '';
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    error.hidden = false;
    error.textContent = info.error || 'รอข้อมูล QR';
  }
  els.dialog?.dispatchEvent(new CustomEvent('pos:promptpay-payment-change', { detail: info }));
  return info;
}

function scheduleRender() {
  requestAnimationFrame(render);
}

ensurePanel();
ensureStyle();
render();
els.method?.addEventListener('change', scheduleRender);
els.dialog?.addEventListener('pos:customer-change', scheduleRender);
els.dialog?.addEventListener('close', scheduleRender);
window.addEventListener('storage', event => { if (event.key === SETTINGS_KEY) { settingsCache = { ...settingsCache, ...readLocalSettings() }; scheduleRender(); } });

if (els.dialog) new MutationObserver(scheduleRender).observe(els.dialog, { attributes: true, attributeFilter: ['open'] });
if (els.paymentTotal) new MutationObserver(scheduleRender).observe(els.paymentTotal, { childList: true, characterData: true, subtree: true });
refreshSettings();
