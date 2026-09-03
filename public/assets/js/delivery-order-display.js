export function effectiveDeliveryAmounts(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemSubtotal = items
    .filter(item => !item.cancelled && item.isGift !== true)
    .reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  const storedSubtotal = Number(order.subtotalAmount);
  const subtotal = Number.isFinite(storedSubtotal) ? storedSubtotal : itemSubtotal;
  const storedFee = Math.max(0, Number(order.deliveryFee || 0) || 0);
  const storedTotal = Number(order.totalAmount);
  const total = Number.isFinite(storedTotal) ? storedTotal : subtotal + storedFee;

  let deliveryFee = storedFee;
  if (order.freeShippingApplied === true) deliveryFee = 0;
  else if (Number.isFinite(total) && subtotal + storedFee > total + 0.009) {
    deliveryFee = Math.max(0, total - subtotal);
  }

  return {
    subtotal,
    deliveryFee,
    total,
    baseFee: Math.max(storedFee, Number(order.deliveryBaseFee || 0) || 0),
  };
}

export function enrichDeliveryGiftItems(order = {}, menus = []) {
  if (order?.orderType !== "delivery") return order;
  const giftIds = [...new Set((Array.isArray(order.freeGiftMenuIds) ? order.freeGiftMenuIds : [])
    .map(value => String(value || "").trim()).filter(Boolean))];
  if (!giftIds.length) return order;

  const items = Array.isArray(order.items) ? [...order.items] : [];
  const existingGiftIds = new Set(items.filter(item => item?.isGift === true)
    .map(item => String(item.menuId || item.id || "").trim()).filter(Boolean));
  const menuMap = new Map((Array.isArray(menus) ? menus : [])
    .map(menu => [String(menu?.id || "").trim(), menu]));

  for (const menuId of giftIds) {
    if (existingGiftIds.has(menuId)) continue;
    const menu = menuMap.get(menuId);
    if (!menu) continue;
    items.push({
      menuId,
      name: String(menu.name || menuId),
      price: 0,
      qty: 1,
      note: "",
      cancelled: false,
      isGift: true,
      syntheticGift: true,
    });
  }

  return { ...order, items };
}
