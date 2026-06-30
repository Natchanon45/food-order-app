const SALES_KEY = 'retail_pos_sales_v1';
const styleId = 'retailPosReceiptModalStyle';
let lastShownSaleId = '';
let autoPrintTimer = 0;

const receiptFontFace = `@font-face{font-family:'TH Sarabun PSK Local';src:url('/assets/fonts/THSarabun.ttf') format('truetype');font-style:normal;font-weight:400;font-display:swap}@font-face{font-family:'TH Sarabun PSK Local';src:url('/assets/fonts/THSarabun-Bold.ttf') format('truetype');font-style:normal;font-weight:700;font-display:swap}`;
const receiptFontStack = `'TH Sarabun PSK Local','TH Sarabun New',Sarabun,sans-serif`;

function readSales() {
  try {
    const rows = JSON.parse(localStorage.getItem(SALES_KEY));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function saleId(sale) {
  return String(sale?.id || sale?.saleNumber || '').trim();
}

function ensureStyle() {
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
${receiptFontFace}
.receipt-modal[hidden]{display:none!important}.receipt-modal{position:fixed;inset:0;z-index:2147483645;display:grid;place-items:center;padding:16px}.receipt-modal-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.58);backdrop-filter:blur(3px)}.receipt-modal-card{position:relative;width:min(420px,100%);max-height:calc(100dvh - 28px);overflow:auto;border-radius:22px;background:#fff;color:#111827;box-shadow:0 28px 80px rgba(15,23,42,.35);padding:16px}.receipt-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.receipt-modal-head h2{margin:0;font-size:22px}.receipt-close{border:0;border-radius:999px;width:34px;height:34px;background:#eef3f0;font-size:22px;line-height:1}.receipt-paper{font-family:${receiptFontStack};font-size:20px;line-height:1.05;border:1px dashed #cbd5e1;border-radius:14px;padding:14px;background:#fbfbfb}.receipt-center{text-align:center}.receipt-shop{font-weight:700;font-size:26px;line-height:1}.receipt-muted{color:#64748b;font-size:18px}.receipt-rule{border:0;border-top:1px dashed #cbd5e1;margin:9px 0}.receipt-row{display:flex;justify-content:space-between;gap:10px;margin:3px 0}.receipt-item{display:grid;grid-template-columns:1fr auto;gap:8px;margin:5px 0}.receipt-item strong{font-weight:700}.receipt-item small{display:block;color:#64748b;font-size:18px}.receipt-total{font-size:24px;font-weight:700}.receipt-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.receipt-actions button{border:0;border-radius:14px;min-height:46px;font-weight:900}.receipt-print{background:#159447;color:#fff}.receipt-secondary{background:#eef3f0;color:#111827}@media(max-width:640px){.receipt-modal{align-items:end;padding:10px}.receipt-modal-card{border-radius:22px 22px 0 0;width:100%;max-height:88dvh}.receipt-actions{grid-template-columns:1fr}.receipt-print{order:-1}}
@media print{body>*:not(.receipt-print-root){display:none!important}.receipt-print-root{display:block!important;position:static!important;inset:auto!important;padding:0!important;background:#fff!important}.receipt-modal-backdrop,.receipt-actions,.receipt-modal-head{display:none!important}.receipt-modal-card{box-shadow:none!important;border-radius:0!important;width:80mm!important;max-height:none!important;overflow:visible!important;padding:0!important}.receipt-paper{border:0!important;border-radius:0!important;background:#fff!important;width:80mm!important;max-width:100%!important}}
`;
  document.head.appendChild(style);
}

function receiptHtml(sale) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  return `
    <div class="receipt-paper">
      <div class="receipt-center">
        <div class="receipt-shop">Food Order POS</div>
        <div class="receipt-muted">ใบเสร็จรับเงิน</div>
      </div>
      <hr class="receipt-rule">
      <div class="receipt-row"><span>เลขที่</span><strong>${escapeHtml(sale.saleNumber || sale.id || '-')}</strong></div>
      <div class="receipt-row"><span>วันที่</span><span>${escapeHtml(new Date(sale.createdAt || Date.now()).toLocaleString('th-TH'))}</span></div>
      <div class="receipt-row"><span>ชำระเงิน</span><span>${escapeHtml(sale.paymentMethod || sale.payment?.method || '-')}</span></div>
      <hr class="receipt-rule">
      ${items.map(item => `<div class="receipt-item"><div><strong>${escapeHtml(item.name || item.productName || '-')}</strong><small>${money(item.price)} x ${Number(item.qty || 0).toLocaleString('th-TH')}</small></div><div>${money(item.lineTotal || Number(item.price || 0) * Number(item.qty || 0))}</div></div>`).join('')}
      <hr class="receipt-rule">
      <div class="receipt-row"><span>รวม</span><span>${money(sale.subtotal)}</span></div>
      <div class="receipt-row"><span>ส่วนลด</span><span>${money(sale.discount)}</span></div>
      <div class="receipt-row receipt-total"><span>สุทธิ</span><span>${money(sale.totalAmount || sale.total)}</span></div>
      <div class="receipt-row"><span>รับเงิน</span><span>${money(sale.receivedAmount || sale.payment?.received || sale.totalAmount || sale.total)}</span></div>
      <div class="receipt-row"><span>เงินทอน</span><span>${money(sale.changeAmount || sale.payment?.change || 0)}</span></div>
      ${sale.syncStatus === 'pending' ? '<hr class="receipt-rule"><div class="receipt-center receipt-muted">บิลนี้บันทึกแบบออฟไลน์ รอ Sync Firebase</div>' : ''}
      <hr class="receipt-rule"><div class="receipt-center receipt-muted">ขอบคุณที่ใช้บริการ</div>
    </div>`;
}

function ensureModal() {
  ensureStyle();
  let modal = document.querySelector('[data-pos-receipt-modal]');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'receipt-modal receipt-print-root';
  modal.dataset.posReceiptModal = 'true';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="receipt-modal-backdrop" data-close-receipt></div>
    <section class="receipt-modal-card" role="dialog" aria-modal="true" aria-label="พิมพ์บิล">
      <header class="receipt-modal-head"><h2>พิมพ์บิล</h2><button type="button" class="receipt-close" data-close-receipt>×</button></header>
      <div data-receipt-content></div>
      <div class="receipt-actions"><button type="button" class="receipt-secondary" data-close-receipt>ปิด</button><button type="button" class="receipt-print" data-print-receipt>พิมพ์บิล</button></div>
    </section>`;
  modal.querySelectorAll('[data-close-receipt]').forEach(el => el.addEventListener('click', closeReceipt));
  modal.querySelector('[data-print-receipt]').addEventListener('click', printCurrentReceipt);
  document.body.appendChild(modal);
  return modal;
}

function showReceipt(sale, { autoPrint = false } = {}) {
  if (!sale) return;
  const id = saleId(sale);
  if (!id) return;
  lastShownSaleId = id;
  const modal = ensureModal();
  modal.querySelector('[data-receipt-content]').innerHTML = receiptHtml(sale);
  modal.hidden = false;
  if (autoPrint) {
    clearTimeout(autoPrintTimer);
    autoPrintTimer = setTimeout(printCurrentReceipt, 350);
  }
}

function closeReceipt() {
  const modal = document.querySelector('[data-pos-receipt-modal]');
  if (modal) modal.hidden = true;
}

function printCurrentReceipt() {
  const sale = readSales().find(item => saleId(item) === lastShownSaleId) || readSales()[0];
  if (!sale) return;
  const modal = ensureModal();
  modal.hidden = false;
  window.print();
}

function maybeShowLatestSale(previousFirstId = '') {
  const latest = readSales()[0];
  const id = saleId(latest);
  if (id && id !== previousFirstId && id !== lastShownSaleId) showReceipt(latest, { autoPrint: true });
}

const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function patchedSetItem(key, value) {
  const before = key === SALES_KEY ? saleId(readSales()[0]) : '';
  originalSetItem(key, value);
  if (key === SALES_KEY) setTimeout(() => maybeShowLatestSale(before), 0);
};

window.addEventListener('retail-offline-sales-synced', () => {
  // Sync event should not reopen old receipt.
});

export { showReceipt, printCurrentReceipt };
