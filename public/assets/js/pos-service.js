import {
  auth, db, isFirebaseConfigured, collection, doc, getDocs, runTransaction, serverTimestamp
} from "./firebase-config.js";
import { resolveShopContext, shopCollectionPath, shopDocumentPath } from "./tenant-context.js";

const usingDemoMode = !isFirebaseConfigured;

function activeShop() {
  return resolveShopContext();
}

function collectionRef(name) {
  return collection(db, ...shopCollectionPath(name, activeShop()));
}

function documentRef(name, id) {
  return doc(db, ...shopDocumentPath(name, id, activeShop()));
}

function mapDocs(snapshot) {
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

function saleNumber() {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
  const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
  return `POS-${date}-${time}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

function demoProducts() {
  return JSON.parse(localStorage.getItem(`products_${activeShop().id}`) || "[]");
}

function saveDemoProducts(products) {
  localStorage.setItem(`products_${activeShop().id}`, JSON.stringify(products));
}

export const posService = {
  async listProducts() {
    if (usingDemoMode) return demoProducts();
    return mapDocs(await getDocs(collectionRef("products")));
  },

  async completeSale({ items = [], paymentMethod = "cash", receivedAmount = 0 }) {
    const normalized = items
      .map(item => ({ productId: String(item.productId || ""), qty: Math.max(0, Number(item.qty || 0)) }))
      .filter(item => item.productId && item.qty > 0);
    if (!normalized.length) throw new Error("SALE_ITEMS_REQUIRED");

    if (usingDemoMode) {
      const products = demoProducts();
      const saleItems = normalized.map(item => {
        const product = products.find(row => row.id === item.productId);
        if (!product || Number(product.stock || 0) < item.qty) {
          const error = new Error("INSUFFICIENT_STOCK");
          error.productName = product?.name || item.productId;
          throw error;
        }
        product.stock = Number(product.stock || 0) - item.qty;
        return { productId: product.id, sku: product.sku || product.code || "", name: product.name, qty: item.qty, price: Number(product.price || 0), lineTotal: item.qty * Number(product.price || 0) };
      });
      const totalAmount = saleItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const sale = { id: crypto.randomUUID(), saleNumber: saleNumber(), tenantId: activeShop().id, items: saleItems, totalQty: saleItems.reduce((sum, item) => sum + item.qty, 0), totalAmount, paymentMethod, receivedAmount: Number(receivedAmount || 0), changeAmount: Math.max(0, Number(receivedAmount || 0) - totalAmount), status: "completed", createdAt: new Date().toISOString() };
      saveDemoProducts(products);
      const sales = JSON.parse(localStorage.getItem(`sales_${activeShop().id}`) || "[]");
      sales.unshift(sale);
      localStorage.setItem(`sales_${activeShop().id}`, JSON.stringify(sales));
      return sale;
    }

    const tenantId = activeShop().id;
    const saleRef = doc(collectionRef("sales"));
    const number = saleNumber();

    return runTransaction(db, async transaction => {
      const productRows = [];
      for (const item of normalized) {
        const ref = documentRef("products", item.productId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) {
          const error = new Error("PRODUCT_NOT_FOUND");
          error.productName = item.productId;
          throw error;
        }
        productRows.push({ requested: item, ref, data: { id: snapshot.id, ...snapshot.data() } });
      }

      const saleItems = productRows.map(row => {
        const currentStock = Number(row.data.stock ?? row.data.qty ?? 0);
        if (currentStock < row.requested.qty) {
          const error = new Error("INSUFFICIENT_STOCK");
          error.productName = row.data.name || row.data.id;
          throw error;
        }
        const price = Number(row.data.price || 0);
        return {
          productId: row.data.id,
          sku: row.data.sku || row.data.code || "",
          name: row.data.name || "ไม่ระบุชื่อ",
          qty: row.requested.qty,
          price,
          lineTotal: row.requested.qty * price,
          stockBefore: currentStock,
          stockAfter: currentStock - row.requested.qty
        };
      });

      const totalQty = saleItems.reduce((sum, item) => sum + item.qty, 0);
      const totalAmount = saleItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const received = Number(receivedAmount || 0);
      const sale = {
        tenantId,
        saleNumber: number,
        channel: "pos",
        status: "completed",
        items: saleItems,
        totalQty,
        totalAmount,
        paymentMethod,
        receivedAmount: received,
        changeAmount: Math.max(0, received - totalAmount),
        cashierId: auth?.currentUser?.uid || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      transaction.set(saleRef, sale);
      productRows.forEach((row, index) => {
        const item = saleItems[index];
        transaction.update(row.ref, { stock: item.stockAfter, updatedAt: serverTimestamp(), tenantId });
        const movementRef = doc(collectionRef("stockMovements"));
        transaction.set(movementRef, {
          tenantId,
          productId: item.productId,
          sku: item.sku,
          productName: item.name,
          type: "sale",
          direction: "out",
          qty: item.qty,
          stockBefore: item.stockBefore,
          stockAfter: item.stockAfter,
          referenceType: "sale",
          referenceId: saleRef.id,
          referenceNumber: number,
          createdBy: auth?.currentUser?.uid || "",
          createdAt: serverTimestamp()
        });
      });

      return { id: saleRef.id, saleNumber: number, totalQty, totalAmount };
    });
  }
};

export { usingDemoMode };
