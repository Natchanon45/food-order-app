import { dataService, usingDemoMode } from "./data-service.js";
import { money, toast, getTableCode } from "./ui.js";

const tableCode = getTableCode();
const menuGrid = document.querySelector("#menuGrid");
const cartList = document.querySelector("#cartList");
const cart = new Map();
let menus = [];

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: ยังไม่ได้ใส่ Firebase Config ข้อมูลจะเก็บในเบราว์เซอร์นี้</div>';
}

document.querySelector("#tableBadge").textContent = tableCode ? `โต๊ะ ${tableCode}` : "ไม่พบรหัสโต๊ะ";
document.querySelector("#tableTitle").textContent = tableCode ? `เมนูสำหรับโต๊ะ ${tableCode}` : "กรุณาสแกน QR ของโต๊ะ";
document.querySelector("#submitOrder").disabled = !tableCode;

function categories() { return ["ทั้งหมด", ...new Set(menus.filter(x => x.active !== false).map(x => x.category || "อื่น ๆ"))]; }
function renderFilters() { document.querySelector("#categoryFilter").innerHTML = categories().map(x => `<option value="${x}">${x}</option>`).join(""); }
function renderMenus() {
  const keyword = document.querySelector("#searchInput").value.trim().toLowerCase();
  const category = document.querySelector("#categoryFilter").value || "ทั้งหมด";
  const filtered = menus.filter(item => item.active !== false && (!keyword || item.name.toLowerCase().includes(keyword)) && (category === "ทั้งหมด" || (item.category || "อื่น ๆ") === category));
  menuGrid.innerHTML = filtered.length ? filtered.map(item => `
    <article class="card menu-card"><div class="menu-image">${item.image ? `<img src="${item.image}" alt="${item.name}">` : "🍲"}</div><div class="menu-name">${item.name}</div><div class="menu-category">${item.category || "อื่น ๆ"}</div><div class="menu-footer"><span class="price">${money(item.price)} บาท</span><button class="btn btn-primary btn-sm" data-add="${item.id}">เพิ่ม</button></div></article>
  `).join("") : '<div class="card empty">ไม่พบเมนู</div>';
}
function updateCart() {
  const items = [...cart.values()];
  cartList.innerHTML = items.length ? items.map(item => `
    <div class="cart-row"><div><strong>${item.name}</strong><div class="menu-category">${money(item.price)} บาท</div><input class="input" data-note="${item.id}" value="${item.note || ""}" placeholder="หมายเหตุ เช่น ไม่เผ็ด" style="margin-top:7px"></div><div class="qty"><button data-dec="${item.id}">−</button><strong>${item.qty}</strong><button data-inc="${item.id}">+</button></div></div>
  `).join("") : '<div class="empty">ยังไม่มีรายการในตะกร้า</div>';
  const totalQty = items.reduce((sum, x) => sum + x.qty, 0);
  const total = items.reduce((sum, x) => sum + x.qty * x.price, 0);
  document.querySelector("#cartCount").textContent = `${totalQty} รายการ`;
  document.querySelector("#cartTotal").textContent = money(total);
  document.querySelector("#submitOrder").disabled = !tableCode || !items.length;
}
menuGrid.addEventListener("click", e => { const id = e.target.dataset.add; if (!id) return; const menu = menus.find(x => x.id === id); const current = cart.get(id); cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" }); updateCart(); toast(`เพิ่ม ${menu.name} แล้ว`); });
cartList.addEventListener("click", e => { const inc = e.target.dataset.inc; const dec = e.target.dataset.dec; const id = inc || dec; if (!id) return; const item = cart.get(id); item.qty += inc ? 1 : -1; if (item.qty <= 0) cart.delete(id); else cart.set(id, item); updateCart(); });
cartList.addEventListener("input", e => { const id = e.target.dataset.note; if (!id) return; const item = cart.get(id); item.note = e.target.value; cart.set(id, item); });
document.querySelector("#searchInput").addEventListener("input", renderMenus);
document.querySelector("#categoryFilter").addEventListener("change", renderMenus);
document.querySelector("#submitOrder").addEventListener("click", async () => {
  const button = document.querySelector("#submitOrder");
  const items = [...cart.values()].map(({ id, name, price, qty, note }) => ({ menuId: id, name, price: Number(price), qty, note: note || "" }));
  const totalAmount = items.reduce((sum, x) => sum + x.price * x.qty, 0);
  button.disabled = true; button.textContent = "กำลังส่ง...";
  try { await dataService.createOrder({ tableCode, status: "pending", totalAmount, note: document.querySelector("#orderNote").value.trim(), items }); cart.clear(); document.querySelector("#orderNote").value = ""; updateCart(); toast("ส่งรายการเข้าครัวเรียบร้อย"); }
  catch (error) { console.error(error); toast("ส่งออเดอร์ไม่สำเร็จ", "error"); }
  finally { button.textContent = "ยืนยันการสั่ง"; updateCart(); }
});
menus = await dataService.listMenus();
renderFilters();
renderMenus();
updateCart();
