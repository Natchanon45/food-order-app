import { iconMarkup } from './bootstrap-icons.js?v=20260701-001';

const grid = document.querySelector('#orderGrid');

function replaceButtonIcon(button, iconName) {
  if (!button) return;
  const currentIcon = button.querySelector('.app-icon, i.bi');
  const nextIcon = iconMarkup(iconName);
  if (currentIcon) currentIcon.outerHTML = nextIcon;
  else button.insertAdjacentHTML('afterbegin', nextIcon);
}

function applyCashierIcons() {
  document.querySelectorAll('[data-table-payment]').forEach(button => replaceButtonIcon(button, 'check-circle'));
  document.querySelectorAll('[data-table-move]').forEach(button => replaceButtonIcon(button, 'easel2'));
  document.querySelectorAll('.user-menu-link[href="/cashier/table-qr"]').forEach(link => replaceButtonIcon(link, 'easel2'));
}

applyCashierIcons();
if (grid) new MutationObserver(applyCashierIcons).observe(grid, { childList: true, subtree: true });
new MutationObserver(applyCashierIcons).observe(document.body, { childList: true, subtree: true });
