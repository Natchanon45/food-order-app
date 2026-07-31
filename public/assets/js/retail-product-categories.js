import { RetailCollections, watchRecords, saveRecordStrict, deleteRecordStrict } from "./retail-db.js?v=20260731-082";

const PRODUCT_KEY = "retail_pos_products_v1";
const root = document.querySelector("#categoryManagerRoot");
const addButton = document.querySelector("#addCategoryBtn");
const toast = document.querySelector("#toast");
let categories = [];
let editingId = "";
let toastTimer;

const readProducts = () => {
  try { return JSON.parse(localStorage.getItem(PRODUCT_KEY)) || []; } catch { return []; }
};
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
})[char]);
const safeId = () => globalThis.crypto?.randomUUID
  ? `cat-${crypto.randomUUID()}`
  : `cat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const notify = message => {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
};
const productCategoryNames = () => [...new Set(readProducts()
  .map(item => String(item.category || "").trim())
  .filter(Boolean))];
const mergedCategories = () => {
  const map = new Map(categories.map(item => [String(item.name || "").trim(), item]));
  productCategoryNames().forEach(name => {
    if (!map.has(name)) map.set(name, { id:`derived:${name}`, name, derived:true });
  });
  return [...map.values()].filter(item => item.name).sort((a,b) =>
    Number(a.sortOrder ?? 9999)-Number(b.sortOrder ?? 9999) ||
    String(a.name).localeCompare(String(b.name),"th"));
};
function publish() {
  globalThis.retailProductCategories = { currentCategories: () => mergedCategories() };
  window.dispatchEvent(new CustomEvent("retail:categories-changed", { detail: mergedCategories() }));
}
function render(formOpen = false) {
  if (!root) return;
  const rows = mergedCategories();
  root.innerHTML = `${formOpen ? `<form class="category-inline-form" data-category-form>
    <input name="name" maxlength="80" required autocomplete="off" placeholder="ชื่อหมวดหมู่" value="${escapeHtml(categories.find(item => item.id === editingId)?.name || "")}">
    <button class="btn btn-pay" type="submit">บันทึก</button>
    <button class="btn btn-secondary" type="button" data-cancel-category>ยกเลิก</button>
  </form>` : ""}${rows.length ? rows.map((item,index) => {
    const count = readProducts().filter(product => String(product.category || "").trim() === item.name).length;
    return `<article class="category-card"><div><strong>${escapeHtml(item.name)}</strong><small>${count.toLocaleString("th-TH")} รายการ</small></div>
      <div class="category-card-actions"><button class="edit" type="button" data-edit-category="${escapeHtml(item.id)}" ${item.derived ? "disabled title=\"บันทึกหมวดหมู่นี้ก่อนจึงจะแก้ไขได้\"" : ""}>แก้ไข</button>
      <button class="delete" type="button" data-delete-category="${escapeHtml(item.id)}" ${item.derived ? "disabled" : ""}>ลบ</button></div></article>`;
  }).join("") : '<div class="category-manager-empty">ยังไม่มีหมวดสินค้า</div>'}`;
  root.querySelector("input")?.focus();
  publish();
}
async function saveCategory(form) {
  const name = String(new FormData(form).get("name") || "").trim();
  if (!name) return;
  const duplicate = mergedCategories().find(item => item.name.toLocaleLowerCase("th") === name.toLocaleLowerCase("th") && item.id !== editingId);
  if (duplicate) return notify("มีหมวดหมู่นี้แล้ว");
  const current = categories.find(item => item.id === editingId);
  const row = { ...(current || {}), id:current?.id || safeId(), name, sortOrder:current?.sortOrder ?? categories.length * 10 + 10, updatedAt:Date.now() };
  try {
    await saveRecordStrict(RetailCollections.categories, row);
    editingId = "";
    notify("บันทึกหมวดหมู่แล้ว");
  } catch (error) {
    console.error("[retail-product-categories] save failed", error);
    notify("บันทึกหมวดหมู่ไม่สำเร็จ");
  }
}
root?.addEventListener("submit", event => {
  if (!event.target.matches("[data-category-form]")) return;
  event.preventDefault();
  saveCategory(event.target);
});
root?.addEventListener("click", async event => {
  if (event.target.closest("[data-cancel-category]")) { editingId = ""; render(); return; }
  const edit = event.target.closest("[data-edit-category]")?.dataset.editCategory;
  if (edit) { editingId = edit; render(true); return; }
  const id = event.target.closest("[data-delete-category]")?.dataset.deleteCategory;
  if (!id) return;
  const row = categories.find(item => item.id === id);
  if (!row) return;
  if (readProducts().some(item => String(item.category || "").trim() === row.name)) return notify("ยังลบไม่ได้ เนื่องจากมีสินค้าอยู่ในหมวดนี้");
  if (!confirm(`ลบหมวด “${row.name}” ใช่หรือไม่?`)) return;
  try { await deleteRecordStrict(RetailCollections.categories, id); notify("ลบหมวดหมู่แล้ว"); }
  catch (error) { console.error("[retail-product-categories] delete failed", error); notify("ลบหมวดหมู่ไม่สำเร็จ"); }
});
addButton?.addEventListener("click", () => { editingId = ""; render(true); });
window.addEventListener("retail-pos-products-changed", () => render());
if (root) watchRecords(RetailCollections.categories, rows => { categories = rows || []; render(); }, { sortBy:"sortOrder", direction:"asc" });
