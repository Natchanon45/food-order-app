const PRODUCT_KEY = "retail_pos_products_v1";
const MOVEMENT_KEY = "retail_pos_stock_movements_v1";

function readJson(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

const confirmButton = document.querySelector("#confirmPaymentBtn");
if (confirmButton) {
  confirmButton.addEventListener("click", () => {
    const beforeProducts = readJson(PRODUCT_KEY);
    const capturedAt = new Date().toISOString();

    setTimeout(() => {
      const afterProducts = readJson(PRODUCT_KEY);
      const afterMap = new Map(afterProducts.map(product => [product.id, product]));
      const changes = beforeProducts.flatMap(before => {
        const after = afterMap.get(before.id);
        if (!after || Number(after.stock) >= Number(before.stock)) return [];
        return [{
          id: crypto.randomUUID(),
          productId: before.id,
          productName: before.name,
          before: Number(before.stock || 0),
          after: Number(after.stock || 0),
          note: "ขายสินค้าหน้าร้าน",
          referenceType: "sale",
          createdAt: capturedAt
        }];
      });
      if (!changes.length) return;
      const movements = readJson(MOVEMENT_KEY);
      localStorage.setItem(MOVEMENT_KEY, JSON.stringify([...changes, ...movements].slice(0, 500)));
    }, 50);
  }, { capture: true });
}
