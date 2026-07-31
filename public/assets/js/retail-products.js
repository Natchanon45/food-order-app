import { RetailCollections, listRecords, watchRecords, saveRecord, moveRecord, deleteRecord, migrateLocalArray } from './retail-db.js?v=20260627-3';
import { deleteProductImage } from './retail-product-image-store.js?v=20260715-008';
import { sweetConfirm } from "./sweet-dialog.js?v=20260731-089";

const PRODUCT_KEY = "retail_pos_products_v1";
const MOVEMENT_KEY = "retail_pos_stock_movements_v1";
const PRODUCT_CODE_PATTERN = /^P\d{9}$/;
const PRODUCT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const els = {
  productCount: document.querySelector("#productCount"),
  stockTotal: document.querySelector("#stockTotal"),
  lowStockCount: document.querySelector("#lowStockCount"),
  outStockCount: document.querySelector("#outStockCount"),
  productSearch: document.querySelector("#productSearch"),
  stockFilter: document.querySelector("#stockFilter"),
  productTableBody: document.querySelector("#productTableBody"),
  tableEmpty: document.querySelector("#tableEmpty"),
  productPagination: document.querySelector("#productPagination"),
  movementList: document.querySelector("#movementList"),
  movementEmpty: document.querySelector("#movementEmpty"),
  clearMovementBtn: document.querySelector("#clearMovementBtn"),
  addProductBtn: document.querySelector("#addProductBtn"),
  productDialog: document.querySelector("#productDialog"),
  productForm: document.querySelector("#productForm"),
  productDialogTitle: document.querySelector("#productDialogTitle"),
  editingProductId: document.querySelector("#editingProductId"),
  productId: document.querySelector("#productId"),
  productBarcode: document.querySelector("#productBarcode"),
  productName: document.querySelector("#productName"),
  productPrice: document.querySelector("#productPrice"),
  productUnit: document.querySelector("#productUnit"),
  productStock: document.querySelector("#productStock"),
  productMinStock: document.querySelector("#productMinStock"),
  productFormError: document.querySelector("#productFormError"),
  closeProductDialog: document.querySelector("#closeProductDialog"),
  cancelProductBtn: document.querySelector("#cancelProductBtn"),
  stockDialog: document.querySelector("#stockDialog"),
  stockForm: document.querySelector("#stockForm"),
  stockProductId: document.querySelector("#stockProductId"),
  stockProductName: document.querySelector("#stockProductName"),
  stockAction: document.querySelector("#stockAction"),
  stockQuantity: document.querySelector("#stockQuantity"),
  stockNote: document.querySelector("#stockNote"),
  stockFormError: document.querySelector("#stockFormError"),
  closeStockDialog: document.querySelector("#closeStockDialog"),
  cancelStockBtn: document.querySelector("#cancelStockBtn"),
  toast: document.querySelector("#toast")
};

let products = readJson(PRODUCT_KEY, []).map(product => ({ minStock: 5, ...product }));
let movements = readJson(MOVEMENT_KEY, []);
let toastTimer;
let stopProductWatch;
let editingDocumentId = "";
let productPage = 1;
let productPageSize = 20;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveProducts() {
  localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
  window.dispatchEvent(new CustomEvent("retail-pos-products-changed"));
}

function saveMovements() {
  localStorage.setItem(MOVEMENT_KEY, JSON.stringify(movements.slice(0, 500)));
}

async function loadProductsFromDb() {
  try {
    let rows = await listRecords(RetailCollections.products, { sortBy: "updatedAt", direction: "desc" });
    if (!rows.length && products.length) {
      await migrateLocalArray(PRODUCT_KEY, RetailCollections.products);
      rows = await listRecords(RetailCollections.products, { sortBy: "updatedAt", direction: "desc" });
    }
    applyProductsFromDb(rows);
    stopProductWatch?.();
    stopProductWatch = watchRecords(RetailCollections.products, applyProductsFromDb, {
      sortBy: "updatedAt",
      direction: "desc"
    });
  } catch (error) {
    console.warn("[retail-products] database load failed", error);
    renderProducts();
  }
}

function applyProductsFromDb(rows) {
  const byProductId = new Map();
  for (const row of rows || []) {
    const product = { minStock: 5, ...row };
    const id = String(product.id || product._documentId || "");
    if (!id) continue;
    const current = byProductId.get(id);
    if (!current) {
      byProductId.set(id, { ...product, id, _documentIds: [product._documentId || id] });
      continue;
    }
    const documentIds = [...new Set([
      ...(current._documentIds || []),
      product._documentId || id
    ])];
    const currentIsCanonical = current._documentId === id;
    const productIsCanonical = product._documentId === id;
    const currentUpdatedAt = Number(current.updatedAt || current.updatedAtServer?.seconds || 0);
    const productUpdatedAt = Number(product.updatedAt || product.updatedAtServer?.seconds || 0);
    const preferProduct = (productIsCanonical && !currentIsCanonical)
      || (productIsCanonical === currentIsCanonical && productUpdatedAt > currentUpdatedAt);
    byProductId.set(id, { ...(preferProduct ? product : current), id, _documentIds: documentIds });
  }
  products = [...byProductId.values()];
  saveProducts();
  renderProducts();
}

async function saveProductToDb(product) {
  try { await saveRecord(RetailCollections.products, product); }
  catch (error) { console.warn("[retail-products] database save failed", error); }
}

async function deleteProductFromDb(id) {
  try { await deleteRecord(RetailCollections.products, id); }
  catch (error) { console.warn("[retail-products] database delete failed", error); }
}

function safeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `movement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function stockClass(product) {
  if (Number(product.stock) <= 0) return "out";
  if (Number(product.stock) <= Number(product.minStock || 0)) return "low";
  return "";
}

function renderStats() {
  els.productCount.textContent = products.length.toLocaleString("th-TH");
  els.stockTotal.textContent = products.reduce((sum, item) => sum + Number(item.stock || 0), 0).toLocaleString("th-TH");
  els.lowStockCount.textContent = products.filter(item => item.stock > 0 && item.stock <= Number(item.minStock || 0)).length.toLocaleString("th-TH");
  els.outStockCount.textContent = products.filter(item => Number(item.stock || 0) <= 0).length.toLocaleString("th-TH");
}

function filteredProducts() {
  const keyword = els.productSearch.value.trim().toLowerCase();
  const filter = els.stockFilter.value;
  return [...products]
    .filter(product => {
      const matchesKeyword = !keyword || [product.id, product.barcode, product.name]
        .some(value => String(value || "").toLowerCase().includes(keyword));
      const isLow = product.stock > 0 && product.stock <= Number(product.minStock || 0);
      const isOut = Number(product.stock || 0) <= 0;
      const matchesStock = filter === "all" || (filter === "low" && isLow) || (filter === "out" && isOut);
      return matchesKeyword && matchesStock;
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "th"));
}

function renderProducts() {
  const rows = filteredProducts();
  const totalPages = Math.max(1, Math.ceil(rows.length / productPageSize));
  productPage = Math.min(productPage, totalPages);
  const visibleRows = rows.slice((productPage - 1) * productPageSize, productPage * productPageSize);
  els.tableEmpty.hidden = rows.length > 0;
  els.productTableBody.innerHTML = visibleRows.map(product => {
    const klass = stockClass(product);
    const costText = Number.isFinite(Number(product.cost)) ? ` • ทุน ${money(product.cost)}` : " • ยังไม่กำหนดทุน";
    return `
      <tr>
        <td>${escapeHtml(product.id)}</td>
        <td><div class="product-name">${escapeHtml(product.name)}</div><div class="product-sub">แจ้งเตือนเมื่อเหลือ ${Number(product.minStock || 0)}${costText}</div></td>
        <td>${escapeHtml(product.barcode)}</td>
        <td class="number">${money(product.price)}</td>
        <td class="number"><span class="stock-badge ${klass}">${Number(product.stock || 0).toLocaleString("th-TH")}</span></td>
        <td>${escapeHtml(product.unit)}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="stock" data-action="stock" data-id="${escapeHtml(product.id)}">ปรับสต็อก</button>
            <button type="button" data-action="edit" data-id="${escapeHtml(product.id)}">แก้ไข</button>
            <button type="button" class="delete" data-action="delete" data-id="${escapeHtml(product.id)}">ลบ</button>
          </div>
        </td>
      </tr>`;
  }).join("");
  renderProductPagination(rows.length, totalPages);
  renderStats();
}

function renderProductPagination(totalRows, totalPages) {
  if (!els.productPagination) return;
  if (!totalRows) { els.productPagination.innerHTML = ""; els.productPagination.hidden = true; return; }
  const start = (productPage - 1) * productPageSize + 1;
  const end = Math.min(totalRows, productPage * productPageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter(page => page === 1 || page === totalPages || Math.abs(page - productPage) <= 2);
  const pageControls = pageNumbers.map((page, index) => {
    const hasGap = index > 0 && page - pageNumbers[index - 1] > 1;
    const gap = hasGap ? '<span class="page-ellipsis" aria-hidden="true">…</span>' : "";
    return `${gap}<button type="button" class="page-number${page === productPage ? " active" : ""}" data-product-page="${page}" ${page === productPage ? 'aria-current="page"' : ""} aria-label="หน้า ${page.toLocaleString("th-TH")}">${page.toLocaleString("th-TH")}</button>`;
  }).join("");
  const sizeOptions = PRODUCT_PAGE_SIZE_OPTIONS.map(size => `<option value="${size}" ${size === productPageSize ? "selected" : ""}>${size.toLocaleString("th-TH")}</option>`).join("");
  els.productPagination.hidden = false;
  els.productPagination.innerHTML = `<div class="pagination-summary"><span>แสดง ${start.toLocaleString("th-TH")}–${end.toLocaleString("th-TH")} จาก ${totalRows.toLocaleString("th-TH")} รายการ</span><label>แสดงต่อหน้า <select data-product-page-size aria-label="จำนวนสินค้าต่อหน้า">${sizeOptions}</select> รายการ</label></div><div class="page-controls"><button type="button" data-product-page="prev" aria-label="หน้าก่อนหน้า" title="หน้าก่อนหน้า" ${productPage <= 1 ? "disabled" : ""}><i class="bi bi-arrow-left" aria-hidden="true"></i></button>${pageControls}<button type="button" data-product-page="next" aria-label="หน้าถัดไป" title="หน้าถัดไป" ${productPage >= totalPages ? "disabled" : ""}><i class="bi bi-arrow-right" aria-hidden="true"></i></button></div>`;
}

function renderMovements() {
  const latest = movements.slice(0, 50);
  els.movementEmpty.hidden = latest.length > 0;
  els.movementList.innerHTML = latest.map(item => {
    const delta = Number(item.after || 0) - Number(item.before || 0);
    const sign = delta > 0 ? "+" : "";
    const klass = delta >= 0 ? "plus" : "minus";
    const date = new Date(item.createdAt).toLocaleString("th-TH");
    return `
      <article class="movement-item">
        <div>
          <strong>${escapeHtml(item.productName)}</strong>
          <div class="movement-meta">${escapeHtml(item.productId)} • ${escapeHtml(item.note || "ปรับสต็อก")} • ${date}</div>
        </div>
        <div class="movement-qty ${klass}">${sign}${delta.toLocaleString("th-TH")} (${Number(item.before).toLocaleString("th-TH")} → ${Number(item.after).toLocaleString("th-TH")})</div>
      </article>`;
  }).join("");
}

function openAddProduct() {
  els.productForm.reset();
  els.editingProductId.value = "";
  editingDocumentId = "";
  els.productDialogTitle.textContent = "เพิ่มสินค้า";
  els.productId.disabled = false;
  els.productMinStock.value = "5";
  els.productStock.value = "0";
  els.productFormError.textContent = "";
  els.productDialog.showModal();
  setTimeout(() => els.productId.focus(), 50);
}

function openEditProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  els.editingProductId.value = product.id;
  editingDocumentId = product._documentId || product.id;
  els.productDialogTitle.textContent = "แก้ไขสินค้า";
  els.productId.value = product.id;
  els.productId.disabled = true;
  els.productBarcode.value = product.barcode;
  els.productName.value = product.name;
  els.productPrice.value = product.price;
  els.productUnit.value = product.unit;
  els.productStock.value = product.stock;
  els.productMinStock.value = product.minStock ?? 5;
  els.productFormError.textContent = "";
  els.productDialog.showModal();
}

function readMerchandisingFields(existingProduct = {}) {
  const costInput = document.querySelector("#productCost");
  const parsedCost = costInput && costInput.value !== "" ? Number(costInput.value) : existingProduct.cost;
  const categoryInput = document.querySelector("#productCategory");
  return {
    categoryId: categoryInput?.value || existingProduct.categoryId || "",
    category: categoryInput?.dataset.categoryName || existingProduct.category || "ทั่วไป",
    sortOrder: Number(document.querySelector("#productSortOrder")?.value || existingProduct.sortOrder || 999),
    imageUrl: document.querySelector("#productImageUrl")?.value.trim() || "",
    showOnPos: document.querySelector("#productShowOnPos")?.checked !== false,
    cost: Number.isFinite(Number(parsedCost)) && Number(parsedCost) >= 0 ? Number(parsedCost) : null
  };
}

async function submitProduct(event) {
  event.preventDefault();
  const editingId = els.editingProductId.value;
  const id = (editingId || els.productId.value).trim().toUpperCase();
  const barcode = els.productBarcode.value.trim();
  const name = els.productName.value.trim();
  const price = Number(els.productPrice.value);
  const stock = Number(els.productStock.value);
  const minStock = Number(els.productMinStock.value);
  const unit = els.productUnit.value.trim();
  const costValue = document.querySelector("#productCost")?.value ?? "";
  const categoryId = document.querySelector("#productCategory")?.value || "";

  if (!id || !barcode || !name || !unit || !categoryId || price < 0 || stock < 0 || minStock < 0 || (costValue !== "" && Number(costValue) < 0)) {
    els.productFormError.textContent = "กรุณากรอกข้อมูลสินค้าให้ครบและถูกต้อง";
    return;
  }
  if (!editingId && !PRODUCT_CODE_PATTERN.test(id)) {
    els.productFormError.textContent = "รหัสสินค้าต้องเป็น P ตามด้วยตัวเลข 9 หลัก เช่น P000000001";
    return;
  }
  if (products.some(item => item.id.toUpperCase() === id && item.id !== editingId)) {
    els.productFormError.textContent = "รหัสสินค้านี้มีอยู่แล้ว";
    return;
  }
  if (products.some(item => item.barcode === barcode && item.id !== editingId)) {
    els.productFormError.textContent = "บาร์โค้ดนี้ถูกใช้กับสินค้าอื่นแล้ว";
    return;
  }

  const old = editingId ? products.find(item => item.id === editingId) : null;
  let product = {
    ...(old || {}),
    id,
    barcode,
    name,
    price,
    stock,
    minStock,
    unit,
    ...readMerchandisingFields(old || {})
  };
  delete product.quickSale;

  try {
    if (globalThis.retailProductMerchandising?.prepareProduct) {
      product = await globalThis.retailProductMerchandising.prepareProduct(product);
    }
  } catch (error) {
    els.productFormError.textContent = error?.message?.includes("Firebase Storage")
      ? "อัปโหลดรูปสินค้าไม่สำเร็จ กรุณาตรวจสอบพื้นที่ Firebase Storage หรือใช้ URL รูปเดิมก่อน"
      : error?.message || "อัปโหลดรูปสินค้าไม่สำเร็จ";
    return;
  }
  const productImageWarning = globalThis.retailProductMerchandising?.consumeLastWarning?.() || "";

  const sourceDocumentId = editingDocumentId || editingId;
  const idChanged = Boolean(editingId && sourceDocumentId !== id);
  if (idChanged) {
    try {
      await moveRecord(RetailCollections.products, sourceDocumentId, product);
      product._documentId = id;
      product._documentIds = [id];
    } catch (error) {
      console.warn("[retail-products] product id change failed", error);
      els.productFormError.textContent = "เปลี่ยนรหัสสินค้าใน Firebase ไม่สำเร็จ กรุณาลองอีกครั้ง";
      return;
    }
  }

  if (editingId) {
    products = products.map(item => item.id === editingId ? product : item);
    if (old && Number(old.stock) !== stock) addMovement(product, Number(old.stock), stock, "แก้ไขยอดจากข้อมูลสินค้า");
  } else {
    products.push(product);
    if (stock > 0) addMovement(product, 0, stock, "เพิ่มสินค้าใหม่");
  }

  saveProducts();
  renderProducts();
  renderMovements();
  els.productDialog.close();
  showToast(productImageWarning || (editingId ? "แก้ไขสินค้าแล้ว" : "เพิ่มสินค้าแล้ว"));
  if (!idChanged) await saveProductToDb(product);
}

async function deleteProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  const confirmed = await sweetConfirm(
    `ลบสินค้า “${product.name}” หรือไม่?\nประวัติการขายเดิมจะไม่ถูกลบ`,
    {
      title: "ลบสินค้า",
      confirmText: "ลบสินค้า",
      cancelText: "ยกเลิก",
      type: "warning",
    },
  );
  if (!confirmed) return;
  try { await deleteProductImage(product); }
  catch (error) { console.warn("[retail-products] image delete failed", error); }
  products = products.filter(item => item.id !== id);
  saveProducts();
  renderProducts();
  showToast("ลบสินค้าแล้ว");
  const documentIds = [...new Set(product._documentIds || [product._documentId || id])];
  await Promise.all(documentIds.map(deleteProductFromDb));
}

function openStock(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  els.stockProductId.value = id;
  els.stockProductName.textContent = `${product.name} • คงเหลือ ${product.stock} ${product.unit}`;
  els.stockAction.value = "add";
  els.stockQuantity.value = "1";
  els.stockNote.value = "";
  els.stockFormError.textContent = "";
  els.stockDialog.showModal();
  setTimeout(() => els.stockQuantity.select(), 50);
}

function addMovement(product, before, after, note) {
  movements.unshift({
    id: safeId(),
    productId: product.id,
    productName: product.name,
    before,
    after,
    note,
    createdAt: new Date().toISOString()
  });
  saveMovements();
}

async function submitStock(event) {
  event.preventDefault();
  const product = products.find(item => item.id === els.stockProductId.value);
  if (!product) return;
  const quantity = Number(els.stockQuantity.value);
  const before = Number(product.stock || 0);
  let after = before;
  if (!Number.isFinite(quantity) || quantity < 0) {
    els.stockFormError.textContent = "จำนวนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป";
    return;
  }
  if (els.stockAction.value === "add") after = before + quantity;
  if (els.stockAction.value === "remove") after = before - quantity;
  if (els.stockAction.value === "set") after = quantity;
  if (after < 0) {
    els.stockFormError.textContent = "ไม่สามารถลดสต็อกให้ติดลบได้";
    return;
  }
  product.stock = after;
  addMovement(product, before, after, els.stockNote.value.trim() || "ปรับสต็อก");
  saveProducts();
  renderProducts();
  renderMovements();
  els.stockDialog.close();
  showToast("ปรับสต็อกแล้ว");
  await saveProductToDb(product);
}

els.addProductBtn.addEventListener("click", openAddProduct);
els.productId.addEventListener("input", () => {
  if (!els.editingProductId.value) els.productId.value = els.productId.value.toUpperCase();
});
els.productForm.addEventListener("submit", submitProduct);
els.closeProductDialog.addEventListener("click", () => els.productDialog.close());
els.cancelProductBtn.addEventListener("click", () => els.productDialog.close());
els.stockForm.addEventListener("submit", submitStock);
els.closeStockDialog.addEventListener("click", () => els.stockDialog.close());
els.cancelStockBtn.addEventListener("click", () => els.stockDialog.close());
els.productSearch.addEventListener("input", () => { productPage = 1; renderProducts(); });
els.stockFilter.addEventListener("change", () => { productPage = 1; renderProducts(); });
els.productPagination?.addEventListener("click", event => {
  const button = event.target.closest("[data-product-page]");
  if (!button || button.disabled) return;
  const target = button.dataset.productPage;
  productPage = target === "prev" ? productPage - 1 : target === "next" ? productPage + 1 : Number(target) || 1;
  renderProducts();
  document.querySelector(".management-panel")?.scrollIntoView({ behavior:"smooth", block:"start" });
});
els.productPagination?.addEventListener("change", event => {
  if (!event.target.matches("[data-product-page-size]")) return;
  productPageSize = Number(event.target.value) || 20;
  productPage = 1;
  renderProducts();
});
els.productTableBody.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit") openEditProduct(button.dataset.id);
  if (button.dataset.action === "stock") openStock(button.dataset.id);
  if (button.dataset.action === "delete") deleteProduct(button.dataset.id);
});
els.clearMovementBtn.addEventListener("click", async () => {
  if (!movements.length) return;
  const confirmed = await sweetConfirm(
    "ล้างประวัติการปรับสต็อกทั้งหมดในเครื่องนี้หรือไม่?\nการล้างประวัติจะไม่เปลี่ยนยอดสต็อกสินค้า",
    {
      title: "ล้างประวัติการปรับสต็อก",
      confirmText: "ล้างประวัติ",
      confirmIcon: "trash3",
      cancelText: "ยกเลิก",
      type: "warning",
    },
  );
  if (!confirmed) return;
  movements = [];
  saveMovements();
  renderMovements();
  showToast("ล้างประวัติแล้ว");
});

saveProducts();
renderProducts();
renderMovements();
loadProductsFromDb();
