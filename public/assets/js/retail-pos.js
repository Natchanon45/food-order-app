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

function getTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = Math.max(0, Math.min(subtotal, Number(els.discountInput.value || 0)));
  return { subtotal, discount, total: subtotal - discount };
}

function renderProducts() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const filtered = products.filter(product => {
    return !keyword || product.name.toLowerCase().includes(keyword) || product.id.toLowerCase().includes(keyword) || product.barcode.includes(keyword);
  });

  els.productGrid.innerHTML = filtered.length ? filtered.map(product => `
    <button class="product-card" type="button" data-product-id="${escapeHtml(product.id)}" ${product.stock <= 0 ? "disabled" : ""}>
      <span class="name">${escapeHtml(product.name)}</span>
      <span class="code">${escapeHtml(product.id)} • ${escapeHtml(product.barcode)}</span>
      <span class="stock">คงเหลือ ${product.stock} ${escapeHtml(product.unit)}</span>
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
          <button type="button" data-action="decrease" data-id="${escapeHtml(item.id)}">−</button>
          <strong>${item.qty}</strong>
          <button type="button" data-action="increase" data-id="${escapeHtml(item.id)}">+</button>
          <button type="button" class="remove" data-action="remove" data-id="${escapeHtml(item.id)}">ลบ</button>
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
  els.payBtn.disabled = cart.length === 0 || totals.total <= 0;
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

function confirmPayment() {
  const totals = getTotals();
  const method = els.paymentMethod.value;
  const received = method === "cash" ? Number(els.receivedInput.value || 0) : totals.total;
  if (received < totals.total) {
    els.paymentError.textContent = "จำนวนเงินที่รับมายังไม่ครบ";
    return;
  }

  const saleId = `SALE-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const sale = {
    id: saleId,
    createdAt,
    items: cart.map(({ id, barcode, name, price, cost, qty, unit }) => ({
      id,
      barcode,
      name,
      price,
      cost: Number.isFinite(Number(cost)) ? Number(cost) : null,
      qty,
      unit
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    payment: { method, received, change: Math.max(0, received - totals.total) }
  };

  const movements = readJson(MOVEMENT_KEY, []);
  products = products.map(product => {
    const sold = cart.find(item => item.id === product.id)?.qty || 0;
    if (!sold) return product;
    const before = Number(product.stock || 0);
    const after = before - sold;
    movements.unshift({
      id: safeId("movement"),
      productId: product.id,
      productName: product.name,
      before,
      after,
      note: `ขายสินค้า ${saleId}`,
      createdAt
    });
    return { ...product, stock: after };
  });

  const sales = readJson(SALES_KEY, []);
  sales.unshift(sale);
  writeJson(PRODUCT_KEY, products);
  writeJson(SALES_KEY, sales.slice(0, 500));
  writeJson(MOVEMENT_KEY, movements.slice(0, 500));

  els.paymentDialog.close();
  renderProducts();
  resetSale();
  showToast(`บันทึกการขาย ${saleId} สำเร็จ`);
}

els.productGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-product-id]");
  if (button) addProduct(button.dataset.productId);
});

els.cartList.addEventListener("click", event => {
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
  products = structuredClone(sampleProducts);
  writeJson(PRODUCT_KEY, products);
  resetSale();
  renderProducts();
  showToast("โหลดสินค้าตัวอย่างแล้ว");
});

if (!products.length) {
  products = structuredClone(sampleProducts);
  writeJson(PRODUCT_KEY, products);
}
renderProducts();
renderCart();
els.barcodeInput.focus();