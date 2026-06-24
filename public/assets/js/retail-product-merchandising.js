const PRODUCT_KEY = "retail_pos_products_v1";
const form = document.querySelector("#productForm");
const dialog = document.querySelector("#productDialog");
const editingId = document.querySelector("#editingProductId");
const nameInput = document.querySelector("#productName");
const productTableBody = document.querySelector("#productTableBody");

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = "/assets/css/retail-product-merchandising.css?v=20260624-1";
document.head.appendChild(style);

const section = document.createElement("section");
section.className = "merch-form-section";
section.innerHTML = `
  <h3>การแสดงผลบนหน้าขาย</h3>
  <div class="merch-grid">
    <label>หมวดสินค้า
      <input id="productCategory" maxlength="60" list="productCategoryList" placeholder="เช่น เครื่องดื่ม">
      <datalist id="productCategoryList"></datalist>
    </label>
    <label>ลำดับการแสดง
      <input id="productSortOrder" type="number" min="0" step="1" value="999">
    </label>
    <label class="full">URL รูปสินค้า
      <input id="productImageUrl" type="url" maxlength="1000" placeholder="https://... หรือ /assets/images/products/สินค้า.webp">
    </label>
    <div class="full product-image-preview" id="productImagePreview">ยังไม่มีรูป</div>
  </div>
  <div class="merch-options">
    <label><input id="productShowOnPos" type="checkbox" checked> แสดงบนหน้าขาย</label>
    <label><input id="productQuickSale" type="checkbox"> สินค้าขายด่วน / ขายดี</label>
  </div>
`;
form.querySelector(".form-grid")?.appendChild(section);

const categoryInput = document.querySelector("#productCategory");
const categoryList = document.querySelector("#productCategoryList");
const sortOrderInput = document.querySelector("#productSortOrder");
const imageUrlInput = document.querySelector("#productImageUrl");
const imagePreview = document.querySelector("#productImagePreview");
const showOnPosInput = document.querySelector("#productShowOnPos");
const quickSaleInput = document.querySelector("#productQuickSale");

function readProducts() {
  try { return JSON.parse(localStorage.getItem(PRODUCT_KEY)) || []; }
  catch { return []; }
}

function writeProducts(products) {
  localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function initials(name) {
  return String(name || "สินค้า").trim().slice(0, 2).toUpperCase();
}

function updateCategoryList() {
  const categories = [...new Set(readProducts().map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  categoryList.innerHTML = categories.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function updatePreview() {
  const url = imageUrlInput.value.trim();
  if (!url) {
    imagePreview.textContent = initials(nameInput.value);
    return;
  }
  imagePreview.innerHTML = `<img src="${escapeHtml(url)}" alt="ตัวอย่างรูปสินค้า" onerror="this.parentElement.textContent='โหลดรูปไม่สำเร็จ'">`;
}

function resetMerchFields() {
  categoryInput.value = "ทั่วไป";
  sortOrderInput.value = "999";
  imageUrlInput.value = "";
  showOnPosInput.checked = true;
  quickSaleInput.checked = false;
  updatePreview();
}

function loadMerchFields(id) {
  const product = readProducts().find(item => item.id === id);
  if (!product) return resetMerchFields();
  categoryInput.value = product.category || "ทั่วไป";
  sortOrderInput.value = Number(product.sortOrder ?? 999);
  imageUrlInput.value = product.imageUrl || "";
  showOnPosInput.checked = product.showOnPos !== false;
  quickSaleInput.checked = product.quickSale === true;
  updatePreview();
}

function enrichSavedProduct(snapshot) {
  setTimeout(() => {
    const products = readProducts();
    const targetId = snapshot.id;
    const index = products.findIndex(item => item.id === targetId);
    if (index < 0) return;
    products[index] = {
      ...products[index],
      category: snapshot.category || "ทั่วไป",
      sortOrder: snapshot.sortOrder,
      imageUrl: snapshot.imageUrl,
      showOnPos: snapshot.showOnPos,
      quickSale: snapshot.quickSale
    };
    writeProducts(products);
    updateCategoryList();
    document.querySelector("#productSearch")?.dispatchEvent(new Event("input", { bubbles: true }));
  }, 40);
}

form.addEventListener("submit", () => {
  const id = (editingId.value || document.querySelector("#productId").value).trim().toUpperCase();
  enrichSavedProduct({
    id,
    category: categoryInput.value.trim(),
    sortOrder: Number(sortOrderInput.value || 999),
    imageUrl: imageUrlInput.value.trim(),
    showOnPos: showOnPosInput.checked,
    quickSale: quickSaleInput.checked
  });
}, { capture: true });

document.querySelector("#addProductBtn")?.addEventListener("click", () => setTimeout(() => {
  resetMerchFields();
  updateCategoryList();
}, 0));

productTableBody?.addEventListener("click", event => {
  const button = event.target.closest('[data-action="edit"]');
  if (!button) return;
  setTimeout(() => loadMerchFields(button.dataset.id), 0);
});

imageUrlInput.addEventListener("input", updatePreview);
nameInput.addEventListener("input", () => { if (!imageUrlInput.value.trim()) updatePreview(); });

const observer = new MutationObserver(() => {
  const products = readProducts();
  [...productTableBody.querySelectorAll("tr")].forEach(row => {
    const id = row.cells[0]?.textContent.trim();
    const product = products.find(item => item.id === id);
    const cell = row.cells[1];
    if (!product || !cell || cell.querySelector(".product-cell")) return;
    const original = cell.innerHTML;
    const image = product.imageUrl
      ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" onerror="this.parentElement.textContent='${escapeHtml(initials(product.name))}'">`
      : escapeHtml(initials(product.name));
    const tags = [
      product.category ? `<span class="merch-tag">${escapeHtml(product.category)}</span>` : "",
      product.quickSale ? '<span class="merch-tag quick">ขายด่วน</span>' : "",
      product.showOnPos === false ? '<span class="merch-tag hidden">ซ่อนจากหน้าขาย</span>' : ""
    ].join("");
    cell.innerHTML = `<div class="product-cell"><div class="product-thumb">${image}</div><div>${original}<div class="merch-tags">${tags}</div></div></div>`;
  });
});
observer.observe(productTableBody, { childList: true, subtree: true });

updateCategoryList();
resetMerchFields();
