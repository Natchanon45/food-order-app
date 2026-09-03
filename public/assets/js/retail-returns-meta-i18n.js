import { getIntlLocale, getLocale } from './i18n.js?v=20260812-099';

if (getLocale() === 'en') {
  const intlLocale = getIntlLocale();
  function part(value) {
    const text = String(value || '').trim();
    if (text === 'เงินสด') return 'Cash';
    if (text === 'PromptPay / โอนเงิน') return 'PromptPay / Transfer';
    let match = text.match(/^([\d,.]+) บาท$/);
    if (match) return `฿${match[1]}`;
    match = text.match(/^คืนได้ ([\d,.]+) ชิ้น$/);
    if (match) return `${match[1]} items available`;
    match = text.match(/^([\d,.]+) รายการ$/);
    if (match) return `${match[1]} items`;
    match = text.match(/^สมาชิก\s+(.+)$/);
    if (match) return `Member ${match[1]}`;
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?$/);
    if (match) {
      const rawYear = Number(match[3]);
      const year = rawYear > 2400 ? rawYear - 543 : rawYear;
      const date = new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0));
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(intlLocale, match[4] ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
    }
    return text;
  }
  function refresh() {
    ['#returnSaleMeta','#returnTotal','.return-sale-card > div:first-child > span','.return-sale-total strong','.return-sale-total span','.return-history-head > div:first-child > span','.return-history-total strong'].forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        const translated = String(element.textContent || '').split(' • ').map(part).join(' • ');
        if (translated !== element.textContent.trim()) element.textContent = translated;
      });
    });
  }
  const later = () => setTimeout(refresh, 0);
  refresh();
  document.addEventListener('click', later);
  document.addEventListener('input', later);
  window.addEventListener('storage', later);
  window.addEventListener('retail:return-sync', later);
}
