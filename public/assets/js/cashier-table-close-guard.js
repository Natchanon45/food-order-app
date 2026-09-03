import './sweet-dialog.js?v=20260726-034';
import { dataService } from './data-service.js?v=20260718-021';
import { toast } from './ui.js?v=20260805-081';
import { t } from './i18n.js?v=20260812-099';

const occupiedTables = document.querySelector('#occupiedTables');
let currentOrders = [];

function closeButtonMarkup(label = t('cashier_documents.table_qr.close_table')) {
  return `<i class="bi bi-door-closed app-icon" aria-hidden="true"></i><span>${label}</span>`;
}

async function latestOrders() {
  return currentOrders;
}

function isUnpaidTableOrder(order) {
  return order?.orderType !== 'delivery' && !['paid', 'cancelled'].includes(order?.status) && order?.paymentStatus !== 'paid';
}

function orderBelongsToTable(order, table) {
  const orderTableToken = String(order?.tableToken || '');
  const tableToken = String(table?.orderToken || '');
  const orderTableCode = String(order?.tableCode || '');
  const tableCode = String(table?.code || table?.id || '');
  return (tableToken && orderTableToken === tableToken) || (tableCode && orderTableCode === tableCode);
}

async function hasUnpaidOrdersForTable(table) {
  const orders = await latestOrders();
  return orders.some(order => isUnpaidTableOrder(order) && orderBelongsToTable(order, table));
}

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === 'function') return await window.sweetConfirm(message, options);
  return confirm(message);
}

const originalUpdateTable = dataService.updateTable.bind(dataService);
dataService.updateTable = async function guardedUpdateTable(id, patch = {}) {
  if (patch && patch.status === 'available') {
    const table = await dataService.getTable(id);
    if (table && await hasUnpaidOrdersForTable(table)) {
      throw new Error('TABLE_HAS_UNPAID_ORDERS');
    }
  }
  return originalUpdateTable(id, patch);
};

async function closeTableSafely(button) {
  const table = await dataService.getTable(button.dataset.closeTable);
  if (!table) {
    toast(t('cashier_documents.table_qr.table_not_found'), 'error');
    return;
  }

  button.disabled = true;
  button.innerHTML = closeButtonMarkup(t('cashier_documents.table_qr.checking_orders'));

  try {
    if (await hasUnpaidOrdersForTable(table)) {
      toast(t('cashier_documents.table_qr.unpaid_orders'), 'error');
      button.disabled = false;
      button.innerHTML = closeButtonMarkup();
      return;
    }

    const tableLabel = table.name || t('cashier_documents.table_qr.table_fallback', { table: table.code || table.id });
    const ok = await askConfirm(`${t('cashier_documents.table_qr.close_confirm_message', { table: tableLabel })}\n\n${t('cashier_documents.table_qr.close_confirm_warning')}`, { title: t('cashier_documents.table_qr.close_confirm_title'), confirmText: t('cashier.common.confirm'), cancelText: t('cashier.common.cancel'), type: 'warning' });
    if (!ok) {
      button.disabled = false;
      button.innerHTML = closeButtonMarkup();
      return;
    }

    button.innerHTML = closeButtonMarkup(t('cashier_documents.table_qr.closing'));
    await dataService.updateTable(table.id, { status: 'available', orderToken: '', sessionStartedAt: null, currentRound: 0 });
    toast(t('cashier_documents.table_qr.close_success', { table: tableLabel }));
    setTimeout(() => location.reload(), 350);
  } catch (error) {
    console.error('SAFE_TABLE_CLOSE_FAILED', error);
    const message = String(error?.message || '');
    toast(message.includes('TABLE_HAS_UNPAID_ORDERS') ? t('cashier_documents.table_qr.unpaid_orders') : t('cashier_documents.table_qr.close_failed'), 'error');
    button.disabled = false;
    button.innerHTML = closeButtonMarkup();
  }
}

if (occupiedTables) {
  occupiedTables.addEventListener('click', event => {
    const button = event.target.closest('[data-close-table]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeTableSafely(button);
  }, true);
}

dataService.subscribeOrders(orders => {
  currentOrders = orders || [];
});
