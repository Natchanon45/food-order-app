import { dataService } from './data-service.js?v=20260701-009';

const closing = new Set();

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

async function finalizeOrder(order) {
  if (closing.has(order.id)) return;
  closing.add(order.id);
  try {
    await dataService.updateOrder(order.id, patchFor(order));
  } catch (error) {
    console.error('FINALIZE_SERVED_PAID_ORDER_FAILED', order.id, error);
    closing.delete(order.id);
  }
}

dataService.subscribeOrders(orders => {
  (orders || []).filter(shouldFinalize).forEach(finalizeOrder);
});
