import { dataService } from './data-service.js';
import { toast } from './ui.js';

const grid = document.querySelector('#orderGrid');
let currentOrders = [];

function activeItems(items) {
  return (items || []).filter(item => !item.cancelled);
}

function canServe(order, item) {
  return order && order.orderType !== 'delivery' && ['ready', 'served'].includes(order.status) && item && !item.cancelled && item.served !== true;
}

function allServed(order, items) {
  const rows = activeItems(items);
  return order.orderType !== 'delivery' && rows.length > 0 && rows.every(item => item.served === true);
}

function installButtons() {
  if (!grid) return;
  grid.querySelectorAll('[data-edit-item]').forEach(editButton => {
    const orderId = editButton.dataset.editItem;
    const itemIndex = Number(editButton.dataset.itemIndex);
    const order = currentOrders.find(row => row.id === orderId);
    const item = order && order.items ? order.items[itemIndex] : null;
    const actions = editButton.closest('.kitchen-item-actions');
    if (!actions || !canServe(order, item)) return;
    if (actions.querySelector('[data-serve-item]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-dark btn-sm';
    button.dataset.serveItem = orderId;
    button.dataset.itemIndex = String(itemIndex);
    button.textContent = 'เสิร์ฟรายการนี้';
    actions.appendChild(button);
  });
}

async function serveItem(button) {
  const order = currentOrders.find(row => row.id === button.dataset.serveItem);
  const itemIndex = Number(button.dataset.itemIndex);
  const item = order && order.items ? order.items[itemIndex] : null;
  if (!canServe(order, item)) return;
  button.disabled = true;
  try {
    const now = new Date().toISOString();
    const items = order.items.map((row, index) => index === itemIndex ? { ...row, served: true, servedAt: now } : row);
    const patch = { items, lastServedItemAt: now };
    if (allServed(order, items)) {
      patch.status = 'served';
      patch.servedAt = now;
    }
    await dataService.updateOrder(order.id, patch);
    toast(patch.status === 'served' ? 'เสิร์ฟครบทั้งออเดอร์แล้ว' : 'เสิร์ฟรายการนี้แล้ว');
  } catch (error) {
    console.error('SERVE_ITEM_FAILED', error);
    toast('บันทึกเสิร์ฟรายการไม่สำเร็จ', 'error');
    button.disabled = false;
  }
}

if (grid) {
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-serve-item]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    serveItem(button);
  }, true);
  new MutationObserver(installButtons).observe(grid, { childList: true, subtree: true });
}

dataService.subscribeOrders(orders => {
  currentOrders = orders || [];
  setTimeout(installButtons, 0);
});

installButtons();
