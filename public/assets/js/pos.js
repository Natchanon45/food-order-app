import { posService, usingDemoMode } from "./pos-service.js";
import { money, toast } from "./ui.js";

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: การขายจะถูกบันทึกในเบราว์เซอร์นี้</div>';

const productGrid = document.querySelector("#productGrid");
const cartRows = document.querySelector("#cartRows");
const searchInput = document.querySelector("#productSearch");
const categoryFilter = document.querySelector("#categoryFilter");
const paymentMethod = document.querySelector("#paymentMethod");
const receivedField = document.querySelector("#receivedField");
const receivedAmount = document.querySelector("#receivedAmount");
const checkoutButton = document.querySelector("#checkoutButton");
let products = [];
const cart = new Map();

const productStock = product => Math.max(0, Number(product.stock ?? product.qty ?? 0));
function totals() {
  const rows = [...cart.values()];
  return { qty: rows.reduce((sum, row) => sum + row.qty, 0), total: rows.reduce((sum, row) => sum + row.qty * Number(row.product.price || 0), 0) };
}

function renderProducts() {
  const keyword = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const filtered = products.filter(product => {
    const text = `${product.name || ""} ${product.sku || product.code || ""}`.toLowerCase();
    return product.active !== false && (!keyword || text.includes(keyword)) && (!category || product.category === category);
  });
  productGrid.innerHTML = filtered.length ? filtered.map(product => {
    const stock = productStock(product);
    const stockClass = stock <= 0 ? "pos-stock-out" : stock <= Number(product.lowStockLevel || 5) ? "pos-stock-low" : "";
    return `<article class="card pos-product-card" aria-disabled="${stock <= 0}"><div class="pos-product-meta"><span>${product.category || "ทั่วไป"}</span><span>${product.sku || product.code || ""}</span></div><h3>${product.name || "ไม่ระบุชื่อ"}</h3><div class="pos-product-price">${money(product.price || 0)} บาท</div><div class="pos-product-meta"><span class="${stockClass}">คงเหลือ ${stock}</span><button class="btn btn-primary btn-sm" data-add-product="${product.id}" ${stock <= 0 ? "disabled" : ""}>เพิ่ม</button></div></article>`;
  }).join("") : '<div class="card pos-empty">ไม่พบสินค้า</div>';
}

function renderCart() {
  const rows = [...cart.values()];
  cartRows.innerHTML = rows.length ? rows.map(row => `<div class="pos-cart-row"><div class="pos-cart-head"><strong>${row.product.name}</strong><button class="btn btn-danger btn-sm" data-remove-product="${row.product.id}">ลบ</button></div><div class="pos-cart-controls"><div class="pos-qty"><button class="btn btn-sm" data-decrease-product="${row.product.id}">−</button><strong>${row.qty}</strong><button class="btn btn-sm" data-increase-product="${row.product.id}">+</button></div><strong>${money(row.qty * Number(row.product.price || 0))} บาท</strong></div></div>`).join("") : '<div class="empty">ยังไม่มีสินค้าในรายการขาย</div>';
  const summary = totals();
  document.querySelector("#totalQty").textContent = summary.qty;
  document.querySelector("#grandTotal").textContent = money(summary.total);
  checkoutButton.disabled = rows.length === 0;
  updateChange();
}

function addProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  const current = cart.get(id)?.qty || 0;
  if (current >= productStock(product)) return toast("จำนวนสินค้าเกินสต็อกคงเหลือ", "error");
  cart.set(id, { product, qty: current + 1 });
  renderCart();
}

function updateChange() {
  const { total } = totals();
  const isCash = paymentMethod.value === "cash";
  receivedField.hidden = !isCash;
  const received = isCash ? Number(receivedAmount.value || 0) : total;
  document.querySelector("#changeAmount").textContent = money(Math.max(0, received - total));
}

productGrid.addEventListener("click", event => { const button = event.target.closest("[data-add-product]"); if (button) addProduct(button.dataset.addProduct); });
cartRows.addEventListener("click", event => {
  const remove = event.target.closest("[data-remove-product]");
  const decrease = event.target.closest("[data-decrease-product]");
  const increase = event.target.closest("[data-increase-product]");
  const id = remove?.dataset.removeProduct || decrease?.dataset.decreaseProduct || increase?.dataset.increaseProduct;
  if (!id || !cart.has(id)) return;
  if (remove) cart.delete(id);
  if (decrease) { const row = cart.get(id); row.qty -= 1; if (row.qty <= 0) cart.delete(id); }
  if (increase) addProduct(id);
  renderCart();
});

document.querySelector("#clearCart").addEventListener("click", () => { cart.clear(); renderCart(); });
searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
paymentMethod.addEventListener("change", updateChange);
receivedAmount.addEventListener("input", updateChange);

checkoutButton.addEventListener("click", async () => {
  const rows = [...cart.values()];
  const summary = totals();
  if (!rows.length) return;
  if (paymentMethod.value === "cash" && Number(receivedAmount.value || 0) < summary.total) { toast("จำนวนเงินที่รับมายังไม่ครบ", "error"); receivedAmount.focus(); return; }
  if (!confirm(`ยืนยันการขาย ${summary.qty} ชิ้น ยอด ${money(summary.total)} บาท ใช่หรือไม่?`)) return;
  checkoutButton.disabled = true;
  checkoutButton.textContent = "กำลังบันทึกการขาย...";
  try {
    const result = await posService.completeSale({ items: rows.map(row => ({ productId: row.product.id, qty: row.qty })), paymentMethod: paymentMethod.value, receivedAmount: paymentMethod.value === "cash" ? Number(receivedAmount.value || 0) : summary.total });
    toast(`บันทึกการขาย ${result.saleNumber || result.id} เรียบร้อย`);
    cart.clear();
    receivedAmount.value = "";
    products = await posService.listProducts();
    renderProducts();
    renderCart();
  } catch (error) {
    console.error(error);
    toast(error.message === "INSUFFICIENT_STOCK" ? `สต็อก ${error.productName || "สินค้า"} ไม่เพียงพอ` : "บันทึกการขายไม่สำเร็จ", "error");
  } finally {
    checkoutButton.textContent = "ยืนยันการขาย";
    checkoutButton.disabled = cart.size === 0;
  }
});

async function load() {
  products = await posService.listProducts();
  const categories = [...new Set(products.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  categoryFilter.innerHTML = '<option value="">ทุกหมวดหมู่</option>' + categories.map(name => `<option value="${name}">${name}</option>`).join("");
  renderProducts();
  renderCart();
}
await load();
