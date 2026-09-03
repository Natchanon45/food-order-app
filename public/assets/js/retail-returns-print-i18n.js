import { getIntlLocale, getLocale } from './i18n.js?v=20260812-099';

if (getLocale() === 'en') {
  const intlLocale = getIntlLocale();
  const labels = globalThis.APP_I18N?.messages?.pos_returns_print || {};
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
  };

  function refreshPrintLabels() {
    setText('.return-receipt-dialog .dialog-head h2', labels.dialog_title);
    setText('.return-receipt-head p', labels.document_title);
    const meta = document.querySelectorAll('.return-receipt-meta span');
    [labels.return_number, labels.sale_reference, labels.return_date, labels.refund_by].forEach((value, index) => {
      if (meta[index] && value) meta[index].textContent = value;
    });
    const headings = document.querySelectorAll('.return-receipt-table th');
    ['Item', 'Qty', 'Unit amount', 'Line total'].forEach((value, index) => {
      if (headings[index]) headings[index].textContent = value;
    });
    setText('.return-receipt-summary .grand span', 'Return total');
    const reasonLabels = document.querySelectorAll('.return-receipt-reason strong');
    if (reasonLabels[0]) reasonLabels[0].textContent = 'Reason:';
    if (reasonLabels[1]) reasonLabels[1].textContent = 'Note:';
    setText('.return-receipt-footer', 'Store system document.');
    setText('#closeReturnReceiptBtn', 'Close');
    setText('#printReturnReceipt', 'Print document');
    document.querySelectorAll('[data-return-receipt]').forEach(button => { button.textContent = 'View & print'; });

    const method = document.querySelector('#rrMethod');
    const methodMap = { 'เงินสด': 'Cash', 'โอนเงิน': 'Transfer', 'ช่องทางเดิม': 'Original method', 'เครดิตร้าน': 'Store credit' };
    if (method && methodMap[method.textContent.trim()]) method.textContent = methodMap[method.textContent.trim()];

    const date = document.querySelector('#rrDate');
    if (date && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date.textContent.trim())) {
      const [day, month, rawYear] = date.textContent.trim().split('/').map(Number);
      const year = rawYear > 2400 ? rawYear - 543 : rawYear;
      date.textContent = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(new Date(year, month - 1, day));
    }
  }

  refreshPrintLabels();
  document.addEventListener('click', () => setTimeout(refreshPrintLabels, 0));
  window.addEventListener('storage', () => setTimeout(refreshPrintLabels, 0));
  window.addEventListener('retail:return-sync', () => setTimeout(refreshPrintLabels, 0));
}
