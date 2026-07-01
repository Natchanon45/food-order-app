import { iconMarkup } from './bootstrap-icons.js?v=20260701-001';

const grid = document.querySelector('#orderGrid');
let pending = false;

function currentIconName(element) {
  return element?.querySelector('i.bi')?.className?.match(/bi-([a-z0-9-]+)/)?.[1] || '';
}

function replaceButtonIcon(button, iconName) {
  if (!button || currentIconName(button) === iconName) return;
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

function scheduleApply() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    applyCashierIcons();
  });
}

applyCashierIcons();
if (grid) new MutationObserver(scheduleApply).observe(grid, { childList: true, subtree: true });
