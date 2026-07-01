import { dataService } from './data-service.js?v=20260701-009';

const closing = new Set();

function isTableOrder(order) {
  return order?.orderType !== 'delivery' && order?.orderType !== 'takeaway' && order?.tableToken && order?.tableCode;
}

function shouldFinalize(order) {
  if (!order?.id) return false;
  if (['paid', 'cancelled'].includes(order.status)) return false;
  if (order.status !== 'served') return false;
  return order.paymentStatus === 'paid';
}

function patchFor(order) {
  const now = new Date().toISOString();
  const patch = {
    status: 'paid',
    paymentStatus: 'paid',
    completedAt: order.completedAt || now,
    paidAt: order.paidAt || now
  };
  if (order.orderType === 'takeaway') {
    patch.pickupStatus = order.pickupStatus === 'picked_up' ? order.pickupStatus : 'picked_up';
    patch.pickedUpAt = order.pickedUpAt || now;
  }
  return patch;
}

function isStillOpenTableRound(order, closingOrderId) {
  if (!order?.id || order.id === closingOrderId) return false;
  if (['paid', 'cancelled'].includes(order.status)) return false;
  if (order.status === 'served' && order.paymentStatus === 'paid') return false;
  return order.paymentStatus !== 'paid' || order.status !== 'served';
}

async function closeTableIfSessionComplete(order, orders) {
  if (!isTableOrder(order)) return;
  const hasOpenRound = (orders || []).some(item =>
    item?.tableToken === order.tableToken &&
    item?.orderType !== 'delivery' &&
    item?.orderType !== 'takeaway' &&
    isStillOpenTableRound(item, order.id)
  );
  if (hasOpenRound) return;
  const table = await dataService.getTable(order.tableCode);
  if (table && table.orderToken === order.tableToken) {
    await dataService.updateTable(table.id, { status: 'available', orderToken: '', sessionStartedAt: null, currentRound: 0, orderIds: [] });
  }
}

async function finalizeOrder(order, orders) {
  if (closing.has(order.id)) return;
  closing.add(order.id);
  try {
    await dataService.updateOrder(order.id, patchFor(order));
    await closeTableIfSessionComplete(order, orders);
  } catch (error) {
    console.error('FINALIZE_SERVED_PAID_ORDER_FAILED', order.id, error);
    closing.delete(order.id);
  }
}

dataService.subscribeOrders(orders => {
  (orders || []).filter(shouldFinalize).forEach(order => finalizeOrder(order, orders));
});
