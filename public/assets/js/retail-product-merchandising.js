import { deleteProductImage, getProductImageUrl, saveProductImage } from "./retail-product-image-store.js?v=20260627-2";

const PRODUCT_KEY = "retail_pos_products_v1";
const form = document.querySelector("#productForm");
const editingId = document.querySelector("#editingProductId");
const nameInput = document.querySelector("#productName");
const productTableBody = document.querySelector("#productTableBody");

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = "/assets/css/retail-product-merchandising.css?v=20260624-5";
document.head.appendChild(style);

const section = document.createElement("section");
section.className = "merch-form-section";
section.innerHTML = `
  <h3>ต้นทุนและการแสดงผลบนหน้าขาย</h3>
  <div class="merch-grid">
    <label>ราคาทุนต่อหน่วย
      <input id="productCost" type="number" min="0" step="0.01" placeholder="เช่น 7.50">
    </label>
    <label>หมวดสินค้า
      <input id="productCategory" maxlength="60" list="productCategoryList" placeholder="เช่น เครื่องดื่ม">
      <datalist id="productCategoryList"></datalist>
    </label>
    <label>ลำดับการแสดง
      <input id="productSortOrder" type="number" min="0" step="1" value="999">
    </label>
    <label class="full">อัปโหลดรูปสินค้า
      <input id="productImageFile" type="file" accept="image/*">
    </label>
    <label class="full">หรือ URL รูปสินค้า
      <input id="productImageUrl" type="url" maxlength="1000" placeholder="https://... หรือ /assets/images/products/สินค้า.webp">
    </label>
    <div class="full image-editor-row">
      <div class="product-image-preview" id="productImagePreview">ยังไม่มีรูป</div>
      <button id="removeProductImage" class="btn btn-danger" type="button">ลบรูป</button>
    </div>
  </div>
  <div class="merch-options">
    <label><input id="productShowOnPos" type="checkbox" checked> แสดงบนหน้าขาย</label>
  </div>
  <p class="product-sub">ราคาทุนใช้สำหรับคำนวณกำไรขั้นต้น โดยบันทึกติดไปกับบิล ณ เวลาขาย</p>
`;
form.querySelector(".form-grid")?.appendChild(section);

const costInput = document.querySelector("#productCost");
const categoryInput = document.querySelector("#productCategory");
const categoryList = document.querySelector("#productCategoryList");
const sortOrderInput = document.querySelector("#productSortOrder");
const imageFileInput = document.querySelector("#productImageFile");
const imageUrlInput = document.querySelector("#productImageUrl");
const imagePreview = document.querySelector("#productImagePreview");
const removeImageBtn = document.querySelector("#removeProductImage");
const showOnPosInput = document.querySelector("#productShowOnPos");

let selectedImageFile = null;
let removeSavedImage = false;
let previewObjectUrl = "";

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

function clearPreviewObjectUrl() {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = "";
}

function showPreview(url) {
  if (!url) {
    imagePreview.textContent = initials(nameInput.value);
    return;
  }
  imagePreview.innerHTML = `<img src="${escapeHtml(url)}" alt="ตัวอย่างรูปสินค้า" onerror="this.parentElement.textContent='โหลดรูปไม่สำเร็จ'">`;
}

function updateCategoryList() {
  const categories = [...new Set(readProducts().map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  categoryList.innerHTML = categories.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
}

async function updatePreviewFromSaved(product) {
  if (!product) return showPreview("");
  if (product.imageKey) {
    const localUrl = await getProductImageUrl(product.imageKey);
    if (localUrl) return showPreview(localUrl);
  }
  showPreview(product.imageUrl || "");
}

function resetMerchFields() {
  clearPreviewObjectUrl();
  selectedImageFile = null;
  removeSavedImage = false;
  costInput.value = "";
  categoryInput.value = "ทั่วไป";
  sortOrderInput.value = "999";
  imageFileInput.value = "";
  imageUrlInput.value = "";
  showOnPosInput.checked = true;
  showPreview("");
}

async function loadMerchFields(id) {
  clearPreviewObjectUrl();
  selectedImageFile = null;
  removeSavedImage = false;
  imageFileInput.value = "";
  const product = readProducts().find(item => item.id === id);
  if (!product) return resetMerchFields();
  costInput.value = Number.isFinite(Number(product.cost)) ? Number(product.cost) : "";
  categoryInput.value = product.category || "ทั่วไป";
  sortOrderInput.value = Number(product.sortOrder ?? 999);
  imageUrlInput.value = product.imageUrl || "";
  showOnPosInput.checked = product.showOnPos !== false;
  await updatePreviewFromSaved(product);
}

async function prepareProduct(product) {
  let nextProduct = {
    ...product,
    imageUrl: imageUrlInput.value.trim(),
    imagePath: product.imagePath || "",
    imageKey: product.imageKey || ""
  };

  if (removeSavedImage) {
    await deleteProductImage(nextProduct);
    nextProduct = { ...nextProduct, imageUrl: "", imagePath: "", imageKey: "" };
  } else if (selectedImageFile) {
    const previousImagePath = nextProduct.imagePath;
    const uploaded = await saveProductImage(product.id, selectedImageFile);
    if (previousImagePath && previousImagePath !== uploaded.imagePath) {
      await deleteProductImage({ imagePath: previousImagePath });
    }
    nextProduct = { ...nextProduct, ...uploaded };
  } else if (nextProduct.imagePath && nextProduct.imageUrl !== product.imageUrl) {
    await deleteProductImage(nextProduct);
    nextProduct = { ...nextProduct, imagePath: "", imageKey: "" };
  }

  return nextProduct;
}

globalThis.retailProductMerchandising = { prepareProduct };

document.querySelector("#addProductBtn")?.addEventListener("click", () => setTimeout(() => {
  resetMerchFields();
  updateCategoryList();
}, 0));

productTableBody?.addEventListener("click", event => {
  const button = event.target.closest('[data-action="edit"]');
  if (!button) return;
  setTimeout(() => loadMerchFields(button.dataset.id), 0);
});

imageFileInput.addEventListener("change", () => {
  clearPreviewObjectUrl();
  selectedImageFile = imageFileInput.files?.[0] || null;
  removeSavedImage = false;
  if (!selectedImageFile) return;
  previewObjectUrl = URL.createObjectURL(selectedImageFile);
  showPreview(previewObjectUrl);
});

imageUrlInput.addEventListener("input", () => {
  if (!selectedImageFile) showPreview(imageUrlInput.value.trim());
});

removeImageBtn.addEventListener("click", () => {
  clearPreviewObjectUrl();
  selectedImageFile = null;
  removeSavedImage = true;
  imageFileInput.value = "";
  imageUrlInput.value = "";
  showPreview("");
});

nameInput.addEventListener("input", () => {
  if (!selectedImageFile && !imageUrlInput.value.trim()) showPreview("");
});

async function setRowImage(container, product) {
  if (container.dataset.imageReady === "1") return;
  container.dataset.imageReady = "1";
  let url = "";
  if (product.imageKey) url = await getProductImageUrl(product.imageKey);
  if (!url) url = product.imageUrl || "";
  if (!url) return;
  container.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.parentElement.textContent='${escapeHtml(initials(product.name))}'">`;
}

function decorateProductRows() {
  const products = readProducts();
  [...productTableBody.querySelectorAll("tr")].forEach(row => {
    const id = row.cells[0]?.textContent.trim();
    const product = products.find(item => item.id === id);
    const cell = row.cells[1];
    if (!product || !cell || cell.querySelector(".product-cell")) return;

    const original = cell.innerHTML;
    const tags = [
      product.category ? `<span class="merch-tag">${escapeHtml(product.category)}</span>` : "",
      product.showOnPos === false ? '<span class="merch-tag hidden">ซ่อนจากหน้าขาย</span>' : ""
    ].join("");

    cell.innerHTML = `<div class="product-cell"><div class="product-thumb">${escapeHtml(initials(product.name))}</div><div>${original}<div class="merch-tags">${tags}</div></div></div>`;
    setRowImage(cell.querySelector(".product-thumb"), product);
  });
}

const observer = new MutationObserver(() => decorateProductRows());
observer.observe(productTableBody, { childList: true, subtree: true });

updateCategoryList();
resetMerchFields();
decorateProductRows();
