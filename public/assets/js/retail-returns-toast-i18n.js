import { getLocale } from './i18n.js?v=20260812-099';

if (getLocale() === 'en') {
  const parts = new Map([
    ['ส่งเข้าระบบแล้ว', 'Synced'],
    ['ต้องตรวจสอบข้อมูล', 'Needs review'],
    ['รอส่งเมื่อออนไลน์', 'Waiting to sync'],
  ]);
  function translate(value) {
    const text = String(value || '').trim();
    let match = text.match(/^บันทึกการคืนสินค้า (.+) แล้ว$/);
    if (match) return `Return ${match[1]} saved`;
    match = text.match(/^บันทึกการยกเลิกบิล (.+) แล้ว$/);
    if (match) return `VOID ${match[1]} saved`;
    return parts.get(text) || text;
  }
  function refresh() {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    const translated = toast.textContent.split(' • ').map(translate).join(' • ');
    if (translated !== toast.textContent.trim()) toast.textContent = translated;
  }
  const later = () => setTimeout(refresh, 0);
  refresh();
  document.addEventListener('click', later);
  window.addEventListener('retail:return-sync', later);
}
