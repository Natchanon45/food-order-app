import {
  auth, db, isFirebaseConfigured, collection, doc, getDocs, query, orderBy, limit,
  runTransaction, serverTimestamp
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

function nowIso() {
  return new Date().toISOString();
}

function saleNumber() {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
  const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
  return `POS-${date}-${time}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

function demoKey(name) {
  return `${name}_${activeShop().id}`;
}

function demoProducts() {
  return JSON.parse(localStorage.getItem(demoKey("products")) || "[]");
}

function saveDemoProducts(products) {
  localStorage.setItem(demoKey("products"), JSON.stringify(products));
}

function demoList(name) {
  return JSON.parse(localStorage.getItem(demoKey(name)) || "[]");
}

function saveDemoList(name, rows) {
  localStorage.setItem(demoKey(name), JSON.stringify(rows));
}

function normalizeProduct(product) {
  return {
    ...product,
    name: product.name || "ไม่ระบุชื่อ",
    sku: product.sku || product.code || "",
    category: product.category || "ทั่วไป",
    price: Number(product.price || 0),
    stock: Number(product.stock ?? product.qty ?? 0),
    lowStockLevel: Number(product.lowStockLevel || 5)
  };
}

function sortByCreatedDesc(rows = []) {
  return [...rows].sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function normalizeSaleInput({ items = [], paymentMethod = "cash", receivedAmount = 0 }) {
  const normalized = items
    .map(item => ({ productId: String(item.productId || ""), qty: Math.max(0, Number(item.qty || 0)) }))
    .filter(item => item.productId && item.qty > 0);
  if (!normalized.length) throw new Error("SALE_ITEMS_REQUIRED");
  return { items: normalized, paymentMethod, receivedAmount: Number(receivedAmount || 0) };
}

export const posService = {
  async listProducts() {
    if (usingDemoMode) return demoProducts().map(normalizeProduct);
    return mapDocs(await getDocs(collectionRef("products"))).map(normalizeProduct);
  },

  async listSales(maxRows = 20) {
    if (usingDemoMode) return sortByCreatedDesc(demoList("sales")).slice(0, maxRows);
    const salesQuery = query(collectionRef("sales"), orderBy("createdAt", "desc"), limit(maxRows));
    return mapDocs(await getDocs(salesQuery));
  },

  async listStockMovements(maxRows = 30) {
    if (usingDemoMode) return sortByCreatedDesc(demoList("stockMovements")).slice(0, maxRows);
    const movementQuery = query(collectionRef("stockMovements"), orderBy("createdAt", "desc"), limit(maxRows));
    return mapDocs(await getDocs(movementQuery));
  },

  async completeSale(payload) {
    const { items: normalized, paymentMethod, receivedAmount } = normalizeSaleInput(payload || {});

    if (usingDemoMode) {
      const tenantId = activeShop().id;
      const products = demoProducts().map(normalizeProduct);
      const number = saleNumber();
      const saleId = crypto.randomUUID();
      const movementRows = [];
      const saleItems = normalized.map(item => {
        const product = products.find(row => row.id === item.productId);
        if (!product || Number(product.stock || 0) < item.qty) {
          const error = new Error("INSUFFICIENT_STOCK");
          error.productName = product?.name || item.productId;
          throw error;
        }
        const stockBefore = Number(product.stock || 0);
        const stockAfter = stockBefore - item.qty;
        product.stock = stockAfter;
        const saleItem = {
          productId: product.id,
          sku: product.sku || product.code || "",
          name: product.name,
          qty: item.qty,
          price: Number(product.price || 0),
          lineTotal: item.qty * Number(product.price || 0),
          stockBefore,
          stockAfter
        };
        movementRows.push({
          id: crypto.randomUUID(),
          tenantId,
          productId: saleItem.productId,
          sku: saleItem.sku,
          productName: saleItem.name,
          type: "sale",
          direction: "out",
          qty: saleItem.qty,
          stockBefore,
          stockAfter,
          referenceType: "sale",
          referenceId: saleId,
          referenceNumber: number,
          createdBy: auth?.currentUser?.uid || "demo",
          createdAt: nowIso()
        });
        return saleItem;
      });
      const totalQty = saleItems.reduce((sum, item) => sum + item.qty, 0);
      const totalAmount = saleItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const sale = {
        id: saleId,
        saleNumber: number,
        tenantId,
        channel: "pos",
        status: "completed",
        items: saleItems,
        totalQty,
        totalAmount,
        paymentMethod,
        receivedAmount,
        changeAmount: Math.max(0, receivedAmount - totalAmount),
        cashierId: auth?.currentUser?.uid || "demo",
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      saveDemoProducts(products);
      saveDemoList("sales", [sale, ...demoList("sales")]);
      saveDemoList("stockMovements", [...movementRows, ...demoList("stockMovements")]);
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
        productRows.push({ requested: item, ref, data: normalizeProduct({ id: snapshot.id, ...snapshot.data() }) });
      }

      const saleItems = productRows.map(row => {
        const currentStock = Number(row.data.stock || 0);
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
      const sale = {
        tenantId,
        saleNumber: number,
        channel: "pos",
        status: "completed",
        items: saleItems,
        totalQty,
        totalAmount,
        paymentMethod,
        receivedAmount,
        changeAmount: Math.max(0, receivedAmount - totalAmount),
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

      return { id: saleRef.id, saleNumber: number, totalQty, totalAmount, changeAmount: sale.changeAmount };
    });
  }
};

export { usingDemoMode };
