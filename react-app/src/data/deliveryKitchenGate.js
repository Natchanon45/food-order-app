// Delivery kitchen admission is determined only by authoritative payment status.
export function deliveryKitchenAdmitted(order = {}) {
  if (String(order.orderType || '').toLowerCase() !== 'delivery') return true;
  const method = String(order.paymentMethod || '').toLowerCase();
  const status = String(order.paymentStatus || '').toLowerCase();
  if (method === 'cod') return true;
  if (method === 'promptpay')return status === 'paid' || (
    status === 'pending_verification' &&
    order.paymentQrMode === 'confirmed_order_5m' &&
    order.deliveryProvider === 'lalamove' &&
    order.companionKitchenRelease?.status === 'admitted_unverified' &&
    order.companionKitchenRelease?.bankConfirmed === false &&
    order.companionKitchenRelease?.paymentVerified === false &&
    order.companionKitchenRelease?.canDispatchRider === false &&
    order.paymentQrSlipFallbackStatus === 'not_required' &&
    !order.paymentSlipPath);
  return status === 'paid';
}
