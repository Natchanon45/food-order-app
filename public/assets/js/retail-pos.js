import { auth, db, isFirebaseConfigured, collection, doc, query, orderBy, getDocs, runTransaction, serverTimestamp } from './firebase-config.js';
import { getTenantId, RetailCollections, listRecords } from './retail-db.js?v=20260627-3';

const PRODUCT_KEY = "retail_pos_products_v1";
const SALES_KEY = "retail_pos_sales_v1";
const MOVEMENT_KEY = "retail_pos_stock_movements_v1";

const sampleProducts = [
  { id: "P001", barcode: "8850000000011", name: "น้ำดื่ม 600 มล.", price: 10, cost: 6, stock: 48, unit: "ขวด" },
  { id: "P002", barcode: "8850000000028", name: "บะหมี่กึ่งสำเร็จรูป", price: 8, cost: 5.5, stock: 60, unit: "ซอง" },
  { id: "P003", barcode: "8850000000035", name: "นมกล่อง UHT", price: 15, cost: 10, stock: 36, unit: "กล่อง" },
  { id: "P004", barcode: "8850000000042", name: "ขนมมันฝรั่ง", price: 20, cost: 13, stock: 25, unit: "ถุง" },
  { id: "P005", barcode: "8850000000059", name: "สบู่ก้อน", price: 18, cost: 12, stock: 30, unit: "ก้อน" },
  { id: "P006", barcode: "8850000000066", name: "น้ำยาล้างจาน", price: 35, cost: 24, stock: 18, unit: "ขวด" }
];

const els = {
  barcodeInput: document.querySelector("#barcodeInput"),
  searchInput: document.querySelector("#searchInput"),
  productGrid: document.querySelector("#productGrid"),
  cartList: document.querySelector("#cartList"),
  cartEmpty: document.querySelector("#cartEmpty"),
  itemCount: document.querySelector("#itemCount"),
  subtotal: document.querySelector("#subtotal"),
  discountInput: document.querySelector("#discountInput"),
  grandTotal: document.querySelector("#grandTotal"),
  payBtn: document.querySelector("#payBtn"),
  clearSaleBtn: document.querySelector("#clearSaleBtn"),
  seedBtn: document.querySelector("#seedBtn"),
  paymentDialog: document.querySelector("#paymentDialog"),
  paymentTotal: document.querySelector("#paymentTotal"),
  paymentMethod: document.querySelector("#paymentMethod"),
  receivedWrap: document.querySelector("#receivedWrap"),
  receivedInput: document.querySelector("#receivedInput"),
  changeAmount: document.querySelector("#changeAmount"),
  paymentError: document.querySelector("#paymentError"),
  confirmPaymentBtn: document.querySelector("#confirmPaymentBtn"),
  toast: document.querySelector("#toast")
};

let products = readJson(PRODUCT_KEY, []);
let cart = [];
let toastTimer;
let savingSale = false;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function safeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saleNumber() {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
  const time = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0"), String(now.getSeconds()).padStart(2, "0")].join("");
  return `POS-${date}-${time}-${crypto.randomUUID?.().slice(0, 4).toUpperCase() || Math.random().toString(16).slice(2, 6).toUpperCase()}`;
}

function tenantCollection(name) {
  return collection(db, 'tenants', getTenantId(), name);
}

function tenantDoc(name, id) {
  return doc(db, 'tenants', getTenantId(), name, String(id));
}

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function normalizeProduct(product = {}) {
  return {
    ...product,
    id: String(product.id || product.code || ""),
    barcode: String(product.barcode || ""),
    name: product.name || "ไม่ระบุชื่อ",
    price: Number(product.price || 0),
    cost: Number.isFinite(Number(product.cost)) ? Number(product.cost) : null,
    stock: Number(product.stock ?? product.qty ?? 0),
    unit: product.unit || "ชิ้น",
    showOnPos: product.showOnPos !== false
  };
}

function normalizeProducts(rows = []) {
  const byId = new Map();
  rows.map(normalizeProduct).forEach(product => {
    if (!product.id) return;
    const current = byId.get(product.id);
    const productIsCanonical = product._documentId === product.id;
    const currentIsCanonical = current?._documentId === current?.id;
    if (!current
      || (productIsCanonical && !currentIsCanonical)
      || (productIsCanonical === currentIsCanonical && Number(product.updatedAt || 0) > Number(current.updatedAt || 0))) {
      byId.set(product.id, product);
    }
  });
  return [...byId.values()];
}

function getTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = Math.max(0, Math.min(subtotal, Number(els.discountInput.value || 0)));
  return { subtotal, discount, total: subtotal - discount };
}

function renderProducts() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const filtered = products.filter(product => {
    const searchText = `${product.name || ""} ${product.id || ""} ${product.barcode || ""}`.toLowerCase();
    return product.showOnPos !== false && (!keyword || searchText.includes(keyword));
  });

  els.productGrid.innerHTML = filtered.length ? filtered.map(product => `
    <button class="product-card" type="button" data-product-id="${escapeHtml(product.id)}" ${savingSale || product.stock <= 0 ? "disabled" : ""}>
      <span class="name">${escapeHtml(product.name)}</span>
      <span class="code">${escapeHtml(product.id)} • ${escapeHtml(product.barcode)}</span>
      <span class="stock">คงเหลือ ${Number(product.stock || 0).toLocaleString("th-TH")} ${escapeHtml(product.unit)}</span>
      <span class="price">${money(product.price)} บาท</span>
    </button>
  `).join("") : '<div class="empty-state">ไม่พบสินค้า</div>';
}

function renderCart() {
  els.cartEmpty.hidden = cart.length > 0;
  els.cartList.innerHTML = cart.map(item => `
    <div class="cart-row">
      <div>
        <div class="cart-name">${escapeHtml(item.name)}</div>
        <div class="cart-meta">${money(item.price)} บาท / ${escapeHtml(item.unit)}</div>
        <div class="qty-tools">
          <button type="button" data-action="decrease" data-id="${escapeHtml(item.id)}" ${savingSale ? "disabled" : ""}>−</button>
          <strong>${item.qty}</strong>
          <button type="button" data-action="increase" data-id="${escapeHtml(item.id)}" ${savingSale ? "disabled" : ""}>+</button>
          <button type="button" class="remove" data-action="remove" data-id="${escapeHtml(item.id)}" ${savingSale ? "disabled" : ""}>ลบ</button>
        </div>
      </div>
      <div class="line-total">${money(item.price * item.qty)}</div>
    </div>
  `).join("");

  const qty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totals = getTotals();
  els.itemCount.textContent = `${qty} รายการ`;
  els.subtotal.textContent = money(totals.subtotal);
  els.grandTotal.textContent = money(totals.total);
  els.payBtn.disabled = cart.length === 0 || totals.total <= 0 || savingSale;
}

function addProduct(productId) {
  const product = products.find(item => item.id === productId);
  if (!product || product.stock <= 0) return;
  const current = cart.find(item => item.id === productId);
  const currentQty = current?.qty || 0;
  if (currentQty >= product.stock) {
    showToast("จำนวนในบิลเกินสต็อกคงเหลือ");
    return;
  }
  if (current) current.qty += 1;
  else cart.push({ ...product, qty: 1 });
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(entry => entry.id === id);
  const product = products.find(entry => entry.id === id);
  if (!item || !product) return;
  const next = item.qty + delta;
  if (next > product.stock) return showToast("จำนวนในบิลเกินสต็อกคงเหลือ");
  if (next <= 0) cart = cart.filter(entry => entry.id !== id);
  else item.qty = next;
  renderCart();
}

function resetSale() {
  cart = [];
  els.discountInput.value = "0";
  renderCart();
  els.barcodeInput.focus();
}

function openPayment() {
  const totals = getTotals();
  if (!cart.length || totals.total <= 0) return;
  els.paymentTotal.textContent = `${money(totals.total)} บาท`;
  els.paymentMethod.value = "cash";
  els.receivedInput.value = totals.total.toFixed(2);
  els.paymentError.textContent = "";
  updatePaymentUi();
  els.paymentDialog.showModal();
  setTimeout(() => els.receivedInput.select(), 50);
}

function updatePaymentUi() {
  const totals = getTotals();
  const cash = els.paymentMethod.value === "cash";
  els.receivedWrap.hidden = !cash;
  const received = cash ? Number(els.receivedInput.value || 0) : totals.total;
  els.changeAmount.textContent = `${money(Math.max(0, received - totals.total))} บาท`;
}

function saveLocalSale(sale, nextProducts, movements) {
  const sales = readJson(SALES_KEY, []);
  writeJson(PRODUCT_KEY, nextProducts);
  writeJson(SALES_KEY, [sale, ...sales].slice(0, 500));
  writeJson(MOVEMENT_KEY, [...movements, ...readJson(MOVEMENT_KEY, [])].slice(0, 500));
}

async function completeSaleOffline({ method, received, totals, number, createdAt, saleItems }) {
  const movementRows = [];
  const nextProducts = products.map(product => {
    const sold = saleItems.find(item => item.id === product.id)?.qty || 0;
    if (!sold) return product;
    const before = Number(product.stock || 0);
    const after = before - sold;
    movementRows.push({
      id: safeId("movement"),
      tenantId: getTenantId(),
      productId: product.id,
      productName: product.name,
      type: "sale",
      direction: "out",
      qty: sold,
      before,
      after,
      note: `ขายสินค้า ${number}`,
      referenceType: "sale",
      referenceId: number,
      referenceNumber: number,
      createdAt
    });
    return { ...product, stock: after };
  });
  const sale = buildSale({ id: number, number, method, received, totals, createdAt, saleItems });
  saveLocalSale(sale, nextProducts, movementRows);
  products = nextProducts;
  return sale;
}

function buildSale({ id, number, method, received, totals, createdAt, saleItems = cart }) {
  return {
    id,
    saleNumber: number,
    tenantId: getTenantId(),
    channel: "retail-pos",
    status: "completed",
    createdAt,
    items: saleItems.map(({ id, barcode, name, price, cost, qty, unit }) => ({
      id,
      productId: id,
      barcode,
      name,
      price,
      cost: Number.isFinite(Number(cost)) ? Number(cost) : null,
      qty,
      unit,
      lineTotal: Number(price || 0) * Number(qty || 0)
    })),
    totalQty: saleItems.reduce((sum, item) => sum + item.qty, 0),
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    totalAmount: totals.total,
    payment: { method, received, change: Math.max(0, received - totals.total) },
    paymentMethod: method,
    receivedAmount: received,
    changeAmount: Math.max(0, received - totals.total),
    cashierId: auth?.currentUser?.uid || ""
  };
}

async function completeSaleFirestore({ method, received, totals, number, createdAt, saleItems }) {
  const saleRef = doc(tenantCollection(RetailCollections.sales));
  let committedSale = null;
  const localMovements = [];
  await runTransaction(db, async transaction => {
    localMovements.length = 0;
    const rows = [];
    for (const cartItem of saleItems) {
      const productRef = tenantDoc(RetailCollections.products, cartItem._documentId || cartItem.id);
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists()) throw new Error(`PRODUCT_NOT_FOUND:${cartItem.name}`);
      const product = normalizeProduct({ id: snapshot.id, ...snapshot.data() });
      if (Number(product.stock || 0) < Number(cartItem.qty || 0)) throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
      rows.push({ cartItem, productRef, product });
    }

    const sale = buildSale({ id: saleRef.id, number, method, received, totals, createdAt, saleItems });
    committedSale = { ...sale, id: saleRef.id };
    transaction.set(saleRef, { ...sale, id: saleRef.id, createdAtServer: serverTimestamp(), updatedAt: Date.now(), updatedAtServer: serverTimestamp() });

    rows.forEach(({ cartItem, productRef, product }) => {
      const before = Number(product.stock || 0);
      const after = before - Number(cartItem.qty || 0);
      transaction.update(productRef, { stock: after, tenantId: getTenantId(), updatedAt: Date.now(), updatedAtServer: serverTimestamp() });
      const movementRef = doc(tenantCollection('stockMovements'));
      const movement = {
        id: movementRef.id,
        tenantId: getTenantId(),
        productId: product.id,
        productName: product.name,
        type: "sale",
        direction: "out",
        qty: Number(cartItem.qty || 0),
        before,
        after,
        stockBefore: before,
        stockAfter: after,
        note: `ขายสินค้า ${number}`,
        referenceType: "sale",
        referenceId: saleRef.id,
        referenceNumber: number,
        createdBy: auth?.currentUser?.uid || "",
        createdAt,
        createdAtServer: serverTimestamp()
      };
      transaction.set(movementRef, movement);
      localMovements.push({ ...movement, createdAtServer: null });
    });
  });

  const nextProducts = products.map(product => {
    const sold = saleItems.find(item => item.id === product.id)?.qty || 0;
    return sold ? { ...product, stock: Number(product.stock || 0) - sold } : product;
  });
  saveLocalSale(committedSale, nextProducts, localMovements);
  products = nextProducts;
  return committedSale;
}

async function confirmPayment() {
  if (savingSale) return;
  const totals = getTotals();
  const method = els.paymentMethod.value;
  const received = method === "cash" ? Number(els.receivedInput.value || 0) : totals.total;
  if (received < totals.total) {
    els.paymentError.textContent = "จำนวนเงินที่รับมายังไม่ครบ";
    return;
  }

  savingSale = true;
  els.confirmPaymentBtn.disabled = true;
  els.confirmPaymentBtn.textContent = "กำลังบันทึก...";
  renderCart();

  const number = saleNumber();
  const createdAt = new Date().toISOString();
  const saleItems = cart.map(item => ({ ...item }));
  try {
    const sale = isFirebaseConfigured && db
      ? await completeSaleFirestore({ method, received, totals, number, createdAt, saleItems })
      : await completeSaleOffline({ method, received, totals, number, createdAt, saleItems });
    els.paymentDialog.close();
    renderProducts();
    resetSale();
    showToast(`บันทึกการขาย ${sale.saleNumber || sale.id} สำเร็จ`);
  } catch (error) {
    console.error("[retail-pos] sale failed", error);
    const message = String(error?.message || error);
    if (message.startsWith("INSUFFICIENT_STOCK:")) els.paymentError.textContent = `สต็อก ${message.split(":").slice(1).join(":")} ไม่พอ`;
    else if (message.startsWith("PRODUCT_NOT_FOUND:")) els.paymentError.textContent = `ไม่พบสินค้า ${message.split(":").slice(1).join(":")}`;
    else els.paymentError.textContent = "บันทึกการขายไม่สำเร็จ กรุณาลองใหม่";
  } finally {
    savingSale = false;
    els.confirmPaymentBtn.disabled = false;
    els.confirmPaymentBtn.textContent = "ยืนยันการขาย";
    renderCart();
  }
}

async function loadProducts() {
  try {
    const rows = await listRecords(RetailCollections.products, { sortBy: "updatedAt", direction: "desc" });
    if (rows.length) products = normalizeProducts(rows);
    else if (isFirebaseConfigured && db) products = [];
    else if (!products.length) products = normalizeProducts(structuredClone(sampleProducts));
    writeJson(PRODUCT_KEY, products);
  } catch (error) {
    console.warn("[retail-pos] load products fallback", error);
    if (!products.length) products = normalizeProducts(structuredClone(sampleProducts));
  }
  renderProducts();
  renderCart();
}

els.productGrid.addEventListener("click", event => {
  if (savingSale) return;
  const button = event.target.closest("[data-product-id]");
  if (button) addProduct(button.dataset.productId);
});

els.cartList.addEventListener("click", event => {
  if (savingSale) return;
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "increase") changeQty(button.dataset.id, 1);
  if (button.dataset.action === "decrease") changeQty(button.dataset.id, -1);
  if (button.dataset.action === "remove") {
    cart = cart.filter(item => item.id !== button.dataset.id);
    renderCart();
  }
});

els.barcodeInput.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const code = els.barcodeInput.value.trim();
  const product = products.find(item => item.barcode === code || item.id.toLowerCase() === code.toLowerCase());
  if (product) addProduct(product.id);
  else showToast("ไม่พบบาร์โค้ดหรือรหัสสินค้านี้");
  els.barcodeInput.value = "";
});

els.searchInput.addEventListener("input", renderProducts);
els.discountInput.addEventListener("input", renderCart);
els.clearSaleBtn.addEventListener("click", resetSale);
els.payBtn.addEventListener("click", openPayment);
els.paymentMethod.addEventListener("change", updatePaymentUi);
els.receivedInput.addEventListener("input", updatePaymentUi);
els.confirmPaymentBtn.addEventListener("click", confirmPayment);
els.seedBtn.addEventListener("click", () => {
  if (products.length && !confirm("แทนที่ข้อมูลสินค้าปัจจุบันด้วยข้อมูลตัวอย่างหรือไม่?")) return;
  products = structuredClone(sampleProducts).map(normalizeProduct);
  writeJson(PRODUCT_KEY, products);
  resetSale();
  renderProducts();
  showToast("โหลดสินค้าตัวอย่างแล้ว");
});

els.seedBtn.hidden = Boolean(isFirebaseConfigured && db);
await loadProducts();
els.barcodeInput.focus();
