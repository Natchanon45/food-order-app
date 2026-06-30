import { auth } from './firebase-config.js?v=20260630-073';
import { RetailCollections, listRecords, saveRecordStrict, saveRecordsStrict, deleteRecordStrict, watchRecords } from './retail-db.js?v=20260629-032';

const HOLD_KEY = "retail_pos_held_bills_v1";
const holdBtn = document.querySelector("#holdBillBtn");
const heldBtn = document.querySelector("#heldBillsBtn");
const heldCount = document.querySelector("#heldBillsCount");
const heldDialog = document.querySelector("#heldBillsDialog");
const heldList = document.querySelector("#heldBillsList");
const closeHeldDialog = document.querySelector("#closeHeldDialog");
const discountInput = document.querySelector("#discountInput");
let holds = [];

function readLegacyHolds() {
  try { return JSON.parse(localStorage.getItem(HOLD_KEY)) || []; }
  catch { return []; }
}

function cacheLegacyHolds(items) {
  localStorage.setItem(HOLD_KEY, JSON.stringify((items || []).slice(0, 100)));
}

function safeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `hold-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currentCartFromDom() {
  return [...document.querySelectorAll("#cartList .cart-row")].map(row => {
    const button = row.querySelector("[data-id]");
    const qty = Number(row.querySelector(".qty-tools strong")?.textContent || 0);
    return button?.dataset.id && qty > 0 ? { id: button.dataset.id, qty } : null;
  }).filter(Boolean);
}

function clearCurrentBill() {
  document.querySelector("#clearSaleBtn")?.click();
}

function renderHeldCount() {
  const count = holds.length;
  if (heldCount) heldCount.textContent = count;
  if (heldBtn) heldBtn.classList.toggle("has-held", count > 0);
}

function renderHeldBills() {
  heldList.innerHTML = holds.length ? holds.map(item => `
    <article class="held-bill-card">
      <div><strong>${item.note || "บิลพัก"}</strong><div>${new Date(item.createdAt).toLocaleString("th-TH")} • ${item.items.reduce((sum, row) => sum + row.qty, 0)} รายการ</div></div>
      <div class="held-bill-side"><strong>${money(item.total)} บาท</strong><div><button type="button" data-resume-id="${item.id}">เรียกบิล</button><button type="button" class="danger" data-delete-id="${item.id}">ลบ</button></div></div>
    </article>`).join("") : '<div class="empty-state">ไม่มีบิลที่พักไว้</div>';
}

async function refreshHeldBills() {
  try {
    holds = await listRecords(RetailCollections.heldBills, { sortBy: 'createdAt', direction: 'desc' });
  } catch {
    holds = readLegacyHolds();
  }
  cacheLegacyHolds(holds);
  renderHeldCount();
  if (heldDialog?.open) renderHeldBills();
}

async function holdCurrentBill() {
  const items = currentCartFromDom();
  if (!items.length) return alert("ยังไม่มีสินค้าในบิลสำหรับพักไว้");
  const note = prompt("ระบุชื่อบิลพัก เช่น ลูกค้าเสื้อแดง หรือ คิว 1", "") ?? "";
  const products = JSON.parse(localStorage.getItem("retail_pos_products_v1") || "[]");
  const productMap = new Map(products.map(item => [item.id, item]));
  const total = items.reduce((sum, item) => sum + Number(productMap.get(item.id)?.price || 0) * item.qty, 0) - Number(discountInput?.value || 0);
  const hold = { id: safeId(), note: note.trim(), items, discount: Number(discountInput?.value || 0), total: Math.max(0, total), createdAt: new Date().toISOString(), status: 'held', createdBy: auth?.currentUser?.uid || '' };
  try {
    await saveRecordStrict(RetailCollections.heldBills, hold);
  } catch (error) {
    console.error('[retail-pos-hold] save firebase failed', error);
    alert("พักบิลใน Firebase ไม่สำเร็จ กรุณาลองใหม่");
    return;
  }
  holds = [hold, ...holds].slice(0, 100);
  cacheLegacyHolds(holds);
  renderHeldCount();
  clearCurrentBill();
  alert("พักบิลใน Firebase เรียบร้อยแล้ว");
  await refreshHeldBills();
}

async function resumeBill(id) {
  const hold = holds.find(item => String(item.id) === String(id));
  if (!hold) return;
  if (currentCartFromDom().length && !confirm("บิลปัจจุบันยังมีสินค้า ต้องการล้างแล้วเรียกบิลพักหรือไม่?")) return;
  try { await deleteRecordStrict(RetailCollections.heldBills, id); }
  catch (error) {
    console.error('[retail-pos-hold] delete firebase failed', error);
    alert("เรียกบิลพักไม่สำเร็จ เพราะลบสถานะพักใน Firebase ไม่ได้");
    return;
  }
  clearCurrentBill();
  setTimeout(() => {
    hold.items.forEach(item => {
      const card = document.querySelector(`[data-product-id="${CSS.escape(item.id)}"]`);
      for (let index = 0; index < item.qty; index += 1) card?.click();
    });
    if (discountInput) {
      discountInput.value = hold.discount || 0;
      discountInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    holds = holds.filter(item => String(item.id) !== String(id));
    cacheLegacyHolds(holds);
    renderHeldCount();
    heldDialog.close();
  }, 30);
}

async function deleteHeldBill(id) {
  const hold = holds.find(item => String(item.id) === String(id));
  if (!hold || !confirm(`ลบบิลพัก “${hold.note || "บิลพัก"}” หรือไม่?`)) return;
  try { await deleteRecordStrict(RetailCollections.heldBills, id); }
  catch (error) {
    console.error('[retail-pos-hold] delete firebase failed', error);
    alert("ลบบิลพักใน Firebase ไม่สำเร็จ กรุณาลองใหม่");
    return;
  }
  holds = holds.filter(item => String(item.id) !== String(id));
  cacheLegacyHolds(holds);
  renderHeldCount();
  renderHeldBills();
}

holdBtn?.addEventListener("click", holdCurrentBill);
heldBtn?.addEventListener("click", async () => { await refreshHeldBills(); renderHeldBills(); heldDialog.showModal(); });
closeHeldDialog?.addEventListener("click", () => heldDialog.close());
heldList?.addEventListener("click", event => {
  const resume = event.target.closest("[data-resume-id]");
  const remove = event.target.closest("[data-delete-id]");
  if (resume) resumeBill(resume.dataset.resumeId);
  if (remove) deleteHeldBill(remove.dataset.deleteId);
});

const legacyHolds = readLegacyHolds();
const remoteHolds = await listRecords(RetailCollections.heldBills, { sortBy: 'createdAt', direction: 'desc' });
if (!remoteHolds.length && legacyHolds.length) {
  const createdBy = auth?.currentUser?.uid || '';
  await saveRecordsStrict(RetailCollections.heldBills, legacyHolds.map(hold => ({ ...hold, status: 'held', createdBy: hold.createdBy || createdBy })));
}
const stopWatch = watchRecords(RetailCollections.heldBills, rows => {
  holds = rows;
  cacheLegacyHolds(holds);
  renderHeldCount();
  if (heldDialog?.open) renderHeldBills();
}, { sortBy: 'createdAt', direction: 'desc' });
window.addEventListener('beforeunload', stopWatch, { once: true });
await refreshHeldBills();
