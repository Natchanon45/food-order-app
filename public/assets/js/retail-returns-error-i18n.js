import { getLocale } from './i18n.js?v=20260812-099';

if (getLocale() === 'en') {
  const messages = new Map([
    ['กรุณาเลือกบิล', 'Select a sale'],
    ['กรุณาระบุจำนวนสินค้าที่ต้องการคืน', 'Enter the quantity to return'],
    ['จำนวนคืนมากกว่าจำนวนที่คืนได้', 'Return quantity exceeds the available quantity'],
    ['กรุณากรอกวันที่และเหตุผลการคืน', 'Enter the return date and reason'],
    ['ไม่พบบิลขายในฐานข้อมูล', 'Sale not found'],
  ]);
  function refresh() {
    const element = document.querySelector('#returnError');
    if (!element) return;
    const text = element.textContent.trim();
    if (messages.has(text)) element.textContent = messages.get(text);
  }
  const later = () => setTimeout(refresh, 0);
  refresh();
  document.addEventListener('click', later);
  document.addEventListener('input', later);
}
