// Delivery kitchen admission is determined only by authoritative payment status.
export function deliveryKitchenAdmitted(order = {}) {
  if (String(order.orderType || '').toLowerCase() !== 'delivery') return true;
  const method = String(order.paymentMethod || '').toLowerCase();
  const status = String(order.paymentStatus || '').toLowerCase();
  if (method === 'cod') return true;
  if (method === 'promptpay') return status === 'paid';
  return status === 'paid';
}
