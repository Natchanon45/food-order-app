import {
  RetailCollections,
  watchRecords,
  getRecord,
  deleteRecordStrict,
  commitTenantRecordsStrict
} from "./retail-db.js?v=20260731-082";
import { sweetConfirm } from "./sweet-dialog.js?v=20260731-088";

const PRODUCT_KEY = "retail_pos_products_v1";
const ORDER_KEY = "retail_pos_catalog_order_v1";
const CATALOG_ORDER_SETTINGS_ID = "catalog-order";
const CATEGORY_PAGE_SIZE_OPTIONS = [10, 20, 50];
const CATEGORY_BATCH_SIZE = 400;
const RESERVED_CATEGORY_NAMES = new Set(["ขายดี", "ทั้งหมด"].map(nameKey));

const root = document.querySelector("#categoryManagerRoot");
const addButton = document.querySelector("#addCategoryBtn");
const searchInput = document.querySelector("#categorySearch");
const searchClearButton = document.querySelector("#clearCategorySearch");
const statusFilter = document.querySelector("#categoryStatusFilter");
const sortSelect = document.querySelector("#categorySort");
const pageSizeSelect = document.querySelector("#categoryPageSize");
const summary = document.querySelector("#categoryManagerSummary");
const countBadge = document.querySelector("#categoryCountBadge");
const pagination = document.querySelector("#categoryPagination");
const dialog = document.querySelector("#categoryDialog");
const form = document.querySelector("#categoryForm");
const dialogTitle = document.querySelector("#categoryDialogTitle");
const nameInput = document.querySelector("#categoryName");
const dialogHint = document.querySelector("#categoryDialogHint");
const formError = document.querySelector("#categoryFormError");
const closeDialogButton = document.querySelector("#closeCategoryDialog");
const cancelDialogButton = document.querySelector("#cancelCategoryBtn");
const submitDialogButton = document.querySelector("#saveCategoryBtn");
const toast = document.querySelector("#toast");

let categories = [];
let categoryPage = 1;
let categoryPageSize = 10;
let dialogMode = "add";
let sourceCategory = null;
let saving = false;
let toastTimer;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function readProducts() {
  const rows = readJson(PRODUCT_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function writeProducts(rows) {
  localStorage.setItem(PRODUCT_KEY, JSON.stringify(rows || []));
  window.dispatchEvent(new CustomEvent("retail-pos-products-changed"));
}

function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function nameKey(value) {
  return normalizeName(value).toLocaleLowerCase("th");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);
}

function safeId() {
  return globalThis.crypto?.randomUUID
    ? `cat-${globalThis.crypto.randomUUID()}`
    : `cat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notify(message) {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function categoryNames(item) {
  const aliases = Array.isArray(item?.aliases) ? item.aliases : [];
  return [...new Set([item?.name, ...aliases].map(normalizeName).filter(Boolean))];
}

function categoryMatchKeys(item) {
  return new Set(categoryNames(item).map(nameKey));
}

function mergedCategories() {
  const managed = (categories || [])
    .map(item => ({ ...item, name: normalizeName(item?.name), derived: false }))
    .filter(item => item.id && item.name);
  const managedById = new Map(managed.map(item => [String(item.id), item]));
  const managedByName = new Map();

  managed.forEach(item => {
    categoryMatchKeys(item).forEach(key => {
      if (key && !managedByName.has(key)) managedByName.set(key, item);
    });
  });

  const derivedByName = new Map();
  readProducts().forEach(product => {
    const productCategoryId = String(product?.categoryId || "").trim();
    const productCategoryName = normalizeName(product?.category);
    const productCategoryKey = nameKey(productCategoryName);
    if (productCategoryId && managedById.has(productCategoryId)) return;
    if (productCategoryKey && managedByName.has(productCategoryKey)) return;
    if (!productCategoryName || derivedByName.has(productCategoryKey)) return;
    derivedByName.set(productCategoryKey, {
      id: `derived:${productCategoryName}`,
      name: productCategoryName,
      aliases: [],
      sortOrder: 9999,
      derived: true
    });
  });

  return [...managed, ...derivedByName.values()].sort((a, b) =>
    Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999)
      || String(a.name).localeCompare(String(b.name), "th")
  );
}

function productsForCategory(item, productRows = readProducts()) {
  if (!item) return [];
  const id = item.derived ? "" : String(item.id || "");
  const keys = categoryMatchKeys(item);
  return productRows.filter(product => {
    const productCategoryId = String(product?.categoryId || "").trim();
    const productCategoryKey = nameKey(product?.category);
    if (item.derived) return Boolean(productCategoryKey && keys.has(productCategoryKey));
    if (productCategoryId) return Boolean(id && productCategoryId === id);
    return Boolean(productCategoryKey && keys.has(productCategoryKey));
  });
}

function enrichedCategories() {
  const productRows = readProducts();
  return mergedCategories().map(item => ({
    ...item,
    productCount: productsForCategory(item, productRows).length
  }));
}

function publish() {
  const rows = mergedCategories();
  globalThis.retailProductCategories = {
    currentCategories: () => rows.map(item => ({ ...item }))
  };
  window.dispatchEvent(new CustomEvent("retail:categories-changed", { detail: rows }));
}

function filteredCategories(rows) {
  const needle = nameKey(searchInput?.value || "");
  const status = statusFilter?.value || "all";
  const sort = sortSelect?.value || "name";
  const filtered = rows.filter(item => {
    const matchesSearch = !needle || categoryNames(item).some(name => nameKey(name).includes(needle));
    const matchesStatus = status === "all"
      || (status === "used" && !item.derived && item.productCount > 0)
      || (status === "empty" && !item.derived && item.productCount === 0)
      || (status === "derived" && item.derived);
    return matchesSearch && matchesStatus;
  });

  return filtered.sort((a, b) => {
    if (sort === "count-desc") {
      return b.productCount - a.productCount || String(a.name).localeCompare(String(b.name), "th");
    }
    if (sort === "empty-first") {
      return Number(a.productCount > 0) - Number(b.productCount > 0)
        || Number(a.derived) - Number(b.derived)
        || String(a.name).localeCompare(String(b.name), "th");
    }
    if (sort === "manual") {
      return Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999)
        || String(a.name).localeCompare(String(b.name), "th");
    }
    return String(a.name).localeCompare(String(b.name), "th");
  });
}

function renderSummary(allRows, visibleCount) {
  const managedRows = allRows.filter(item => !item.derived);
  const usedCount = managedRows.filter(item => item.productCount > 0).length;
  const emptyCount = managedRows.filter(item => item.productCount === 0).length;
  const derivedCount = allRows.filter(item => item.derived).length;

  if (countBadge) countBadge.textContent = `${allRows.length.toLocaleString("th-TH")} หมวด`;
  if (!summary) return;
  summary.innerHTML = `
    <span class="category-summary-chip"><strong>${visibleCount.toLocaleString("th-TH")}</strong>รายการที่แสดง</span>
    <span class="category-summary-chip"><strong>${usedCount.toLocaleString("th-TH")}</strong>ใช้งานอยู่</span>
    <span class="category-summary-chip"><strong>${emptyCount.toLocaleString("th-TH")}</strong>ยังไม่มีสินค้า</span>
    ${derivedCount ? `<span class="category-summary-chip"><strong>${derivedCount.toLocaleString("th-TH")}</strong>รอบันทึกหมวด</span>` : ""}
  `;
}

function rowStatus(item) {
  if (item.derived) return { className: "derived", label: "ยังไม่บันทึก" };
  if (item.productCount > 0) return { className: "used", label: "ใช้งานอยู่" };
  return { className: "empty", label: "ยังไม่มีสินค้า" };
}

function rowMeta(item) {
  if (item.derived) return "พบจากข้อมูลสินค้าเดิม — บันทึกเพื่อสร้าง Stable ID";
  const aliases = categoryNames(item).filter(name => nameKey(name) !== nameKey(item.name));
  if (aliases.length) return `ชื่อเดิม: ${aliases.slice(0, 2).join(", ")}`;
  return "พร้อมใช้บนหน้าขาย POS";
}

function renderRows(rows) {
  if (!root) return;
  if (!rows.length) {
    const hasFilter = Boolean(nameKey(searchInput?.value || "")) || (statusFilter?.value || "all") !== "all";
    root.innerHTML = `<div class="category-manager-empty"><strong>${hasFilter ? "ไม่พบหมวดสินค้าที่ตรงกับเงื่อนไข" : "ยังไม่มีหมวดสินค้า"}</strong><span>${hasFilter ? "ลองล้างคำค้นหาหรือเปลี่ยนตัวกรอง" : "กด “เพิ่มหมวดหมู่” เพื่อเริ่มจัดหมวดสินค้า"}</span></div>`;
    return;
  }

  root.innerHTML = `
    <div class="category-list-head" aria-hidden="true">
      <span>หมวดสินค้า</span><span>จำนวนสินค้า</span><span>สถานะ</span><span>จัดการ</span>
    </div>
    ${rows.map(item => {
      const status = rowStatus(item);
      const firstCharacter = normalizeName(item.name).slice(0, 1) || "•";
      const editLabel = `แก้ไขหมวด ${item.name}`;
      const deleteDisabled = item.productCount > 0;
      return `<article class="category-row" data-category-id="${escapeHtml(item.id)}">
        <div class="category-main">
          <span class="category-avatar" aria-hidden="true">${escapeHtml(firstCharacter)}</span>
          <div class="category-main-text">
            <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
            <small title="${escapeHtml(rowMeta(item))}">${escapeHtml(rowMeta(item))}</small>
          </div>
        </div>
        <div class="category-product-count"><strong>${item.productCount.toLocaleString("th-TH")}</strong><span>รายการ</span></div>
        <div class="category-status-cell"><span class="category-status ${status.className}">${status.label}</span></div>
        <div class="category-card-actions">
          ${item.derived
            ? `<button class="save" type="button" data-materialize-category="${escapeHtml(item.id)}" aria-label="บันทึกหมวด ${escapeHtml(item.name)}"><i class="bi bi-check2-circle" aria-hidden="true"></i><span>บันทึกหมวด</span></button>`
            : `<button class="edit" type="button" data-edit-category="${escapeHtml(item.id)}" aria-label="${escapeHtml(editLabel)}"><i class="bi bi-pencil-square" aria-hidden="true"></i><span>แก้ไข</span></button>
               <button class="delete" type="button" data-delete-category="${escapeHtml(item.id)}" aria-label="ลบหมวด ${escapeHtml(item.name)}" ${deleteDisabled ? 'disabled title="ย้ายสินค้าออกจากหมวดนี้ก่อนจึงจะลบได้"' : ""}><i class="bi bi-trash3" aria-hidden="true"></i><span>ลบ</span></button>`}
        </div>
      </article>`;
    }).join("")}
  `;
}

function visiblePageNumbers(totalPages) {
  return Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter(page => page === 1 || page === totalPages || Math.abs(page - categoryPage) <= 2);
}

function renderPagination(totalRows, totalPages) {
  if (!pagination) return;
  if (!totalRows) {
    pagination.hidden = true;
    pagination.innerHTML = "";
    return;
  }

  const start = (categoryPage - 1) * categoryPageSize + 1;
  const end = Math.min(totalRows, categoryPage * categoryPageSize);
  const pages = visiblePageNumbers(totalPages);
  const pageButtons = pages.map((page, index) => {
    const gap = index > 0 && page - pages[index - 1] > 1
      ? '<span class="category-page-ellipsis" aria-hidden="true">…</span>'
      : "";
    return `${gap}<button type="button" class="${page === categoryPage ? "active" : ""}" data-category-page="${page}" ${page === categoryPage ? 'aria-current="page"' : ""} aria-label="หน้า ${page.toLocaleString("th-TH")}">${page.toLocaleString("th-TH")}</button>`;
  }).join("");

  pagination.hidden = false;
  pagination.innerHTML = `
    <div class="category-pagination-summary">แสดง ${start.toLocaleString("th-TH")}–${end.toLocaleString("th-TH")} จาก ${totalRows.toLocaleString("th-TH")} หมวด</div>
    <div class="category-page-controls">
      <button type="button" data-category-page="prev" ${categoryPage <= 1 ? "disabled" : ""} aria-label="หน้าก่อนหน้า"><i class="bi bi-arrow-left" aria-hidden="true"></i></button>
      ${pageButtons}
      <button type="button" data-category-page="next" ${categoryPage >= totalPages ? "disabled" : ""} aria-label="หน้าถัดไป"><i class="bi bi-arrow-right" aria-hidden="true"></i></button>
    </div>
  `;
}

function render() {
  if (!root) return;
  const allRows = enrichedCategories();
  const filteredRows = filteredCategories(allRows);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / categoryPageSize));
  categoryPage = Math.min(Math.max(categoryPage, 1), totalPages);
  const visibleRows = filteredRows.slice((categoryPage - 1) * categoryPageSize, categoryPage * categoryPageSize);

  if (searchClearButton) searchClearButton.hidden = !normalizeName(searchInput?.value || "");
  renderSummary(allRows, filteredRows.length);
  renderRows(visibleRows);
  renderPagination(filteredRows.length, totalPages);
  publish();
}

function nextSortOrder() {
  const orders = categories.map(item => Number(item.sortOrder)).filter(Number.isFinite);
  return (orders.length ? Math.max(...orders) : 0) + 10;
}

function dialogProductCount() {
  return sourceCategory ? productsForCategory(sourceCategory).length : 0;
}

function setDialogSaving(nextSaving) {
  saving = nextSaving;
  [nameInput, closeDialogButton, cancelDialogButton].forEach(element => {
    if (element) element.disabled = nextSaving;
  });
  if (submitDialogButton) {
    submitDialogButton.disabled = nextSaving;
    submitDialogButton.textContent = nextSaving ? "กำลังบันทึก..." : "บันทึกหมวดหมู่";
  }
}

function openCategoryDialog(mode, item = null) {
  if (!dialog || !form || !nameInput) return;
  dialogMode = mode;
  sourceCategory = item ? { ...item } : null;
  form.reset();
  formError.textContent = "";

  if (mode === "edit") {
    dialogTitle.textContent = "แก้ไขหมวดสินค้า";
    nameInput.value = item?.name || "";
  } else if (mode === "materialize") {
    dialogTitle.textContent = "บันทึกหมวดสินค้าจากข้อมูลเดิม";
    nameInput.value = item?.name || "";
  } else {
    dialogTitle.textContent = "เพิ่มหมวดสินค้า";
    nameInput.value = "";
  }

  const productCount = dialogProductCount();
  if (dialogHint) {
    if (mode === "edit" && productCount > 0) {
      dialogHint.innerHTML = `เมื่อเปลี่ยนชื่อ ระบบจะอัปเดตข้อมูลหมวดของสินค้า <strong>${productCount.toLocaleString("th-TH")} รายการ</strong> ให้ใช้ชื่อใหม่และ Stable ID เดิม`;
    } else if (mode === "materialize") {
      dialogHint.innerHTML = `ระบบจะสร้าง Stable ID และผูกสินค้าเดิม <strong>${productCount.toLocaleString("th-TH")} รายการ</strong> เข้ากับหมวดนี้`;
    } else {
      dialogHint.textContent = "ชื่อหมวดจะแสดงบนหน้าขาย POS และใช้ร่วมกับการจัดลำดับสินค้า";
    }
  }

  setDialogSaving(false);
  dialog.showModal();
  setTimeout(() => nameInput.focus(), 40);
}

function closeCategoryDialog() {
  if (!dialog || saving) return;
  if (dialog.open) dialog.close();
  dialogMode = "add";
  sourceCategory = null;
  if (formError) formError.textContent = "";
}

function aliasesForRow(current, source, newName) {
  const candidates = [
    ...(Array.isArray(current?.aliases) ? current.aliases : []),
    ...(Array.isArray(source?.aliases) ? source.aliases : []),
    current?.name,
    source?.name
  ].map(normalizeName).filter(Boolean);
  const newKey = nameKey(newName);
  return [...new Set(candidates)].filter(name => nameKey(name) !== newKey).slice(0, 20);
}

function categoryOrderId(name) {
  return `category:${normalizeName(name)}`;
}

async function categoryOrderRename(source, newName) {
  if (!source || nameKey(source.name) === nameKey(newName)) return null;
  const remote = await getRecord(RetailCollections.settings, CATALOG_ORDER_SETTINGS_ID).catch(() => null);
  const localOrder = readJson(ORDER_KEY, []);
  const currentOrder = Array.isArray(localOrder) && localOrder.length
    ? localOrder
    : Array.isArray(remote?.categoryOrder)
      ? remote.categoryOrder
      : [];
  if (!currentOrder.length) return null;

  const previousIds = new Set(categoryNames(source).map(categoryOrderId));
  const replacement = categoryOrderId(newName);
  const categoryOrder = [...new Set(currentOrder.map(id => previousIds.has(String(id)) ? replacement : String(id)))];
  if (JSON.stringify(categoryOrder) === JSON.stringify(currentOrder.map(String))) return null;
  return {
    row: {
      ...(remote || {}),
      id: CATALOG_ORDER_SETTINGS_ID,
      type: "catalog-order",
      categoryOrder
    },
    categoryOrder
  };
}

async function persistCategoryAndProducts(categoryRow, productRows, orderUpdate) {
  const operations = [
    { collectionName: RetailCollections.categories, row: categoryRow },
    ...(orderUpdate?.row
      ? [{ collectionName: RetailCollections.settings, row: orderUpdate.row }]
      : []),
    ...(productRows || []).map(row => ({ collectionName: RetailCollections.products, row }))
  ];

  for (let index = 0; index < operations.length; index += CATEGORY_BATCH_SIZE) {
    await commitTenantRecordsStrict(operations.slice(index, index + CATEGORY_BATCH_SIZE));
  }
}

async function saveCategory(event) {
  event.preventDefault();
  if (saving) return;

  const name = normalizeName(nameInput?.value || "");
  const key = nameKey(name);
  if (!name) {
    formError.textContent = "กรุณากรอกชื่อหมวดสินค้า";
    nameInput?.focus();
    return;
  }
  if (RESERVED_CATEGORY_NAMES.has(key)) {
    formError.textContent = `ไม่สามารถใช้ชื่อ “${name}” ได้ เนื่องจากเป็นหมวดระบบ`;
    nameInput?.focus();
    return;
  }

  const current = dialogMode === "edit"
    ? categories.find(item => String(item.id) === String(sourceCategory?.id))
    : null;
  const excludedIds = new Set([
    current?.id,
    dialogMode === "materialize" ? sourceCategory?.id : ""
  ].filter(Boolean).map(String));
  const duplicate = mergedCategories().find(item =>
    categoryNames(item).some(categoryName => nameKey(categoryName) === key)
      && !excludedIds.has(String(item.id))
  );
  if (duplicate) {
    formError.textContent = "มีหมวดสินค้านี้แล้ว กรุณาใช้ชื่ออื่น";
    nameInput?.focus();
    return;
  }

  const id = current?.id || safeId();
  const row = {
    ...(current || {}),
    id,
    name,
    aliases: aliasesForRow(current, sourceCategory, name),
    sortOrder: current?.sortOrder ?? nextSortOrder(),
    updatedAt: Date.now()
  };

  const localProducts = readProducts();
  const affectedProducts = sourceCategory
    ? productsForCategory(sourceCategory, localProducts)
    : [];
  const affectedIds = new Set(affectedProducts.map(item => String(item.id)));
  const updatedProducts = affectedProducts.map(product => ({
    ...product,
    categoryId: id,
    category: name
  }));

  setDialogSaving(true);
  formError.textContent = "";
  try {
    const orderUpdate = await categoryOrderRename(sourceCategory, name);
    await persistCategoryAndProducts(row, updatedProducts, orderUpdate);
    categories = [...categories.filter(item => String(item.id) !== String(id)), row];
    if (updatedProducts.length) {
      const updatedById = new Map(updatedProducts.map(item => [String(item.id), item]));
      writeProducts(localProducts.map(product =>
        affectedIds.has(String(product.id)) ? updatedById.get(String(product.id)) : product
      ));
    }
    if (orderUpdate?.categoryOrder) {
      localStorage.setItem(ORDER_KEY, JSON.stringify(orderUpdate.categoryOrder));
      window.dispatchEvent(new StorageEvent("storage", { key: ORDER_KEY }));
    }
    dialog.close();
    dialogMode = "add";
    sourceCategory = null;
    categoryPage = 1;
    render();
    notify(updatedProducts.length
      ? `บันทึกหมวดหมู่และอัปเดตสินค้า ${updatedProducts.length.toLocaleString("th-TH")} รายการแล้ว`
      : "บันทึกหมวดหมู่แล้ว");
  } catch (error) {
    console.error("[retail-product-categories] save failed", error);
    formError.textContent = "บันทึกหมวดหมู่ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตและสิทธิ์ผู้ใช้งาน";
  } finally {
    setDialogSaving(false);
  }
}

async function deleteCategory(id) {
  const item = mergedCategories().find(category => String(category.id) === String(id));
  if (!item || item.derived) return;
  const productCount = productsForCategory(item).length;
  if (productCount > 0) {
    notify(`ยังลบไม่ได้ เนื่องจากมีสินค้า ${productCount.toLocaleString("th-TH")} รายการอยู่ในหมวดนี้`);
    return;
  }
  const confirmed = await sweetConfirm(
    `ลบหมวด “${item.name}” ใช่หรือไม่?`,
    {
      title: "ลบหมวดสินค้า",
      confirmText: "ลบหมวด",
      cancelText: "ยกเลิก",
      type: "warning",
    },
  );
  if (!confirmed) return;

  try {
    await deleteRecordStrict(RetailCollections.categories, id);
    categories = categories.filter(category => String(category.id) !== String(id));
    render();
    notify("ลบหมวดหมู่แล้ว");
  } catch (error) {
    console.error("[retail-product-categories] delete failed", error);
    notify("ลบหมวดหมู่ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ผู้ใช้งาน");
  }
}

root?.addEventListener("click", event => {
  const editId = event.target.closest("[data-edit-category]")?.dataset.editCategory;
  if (editId) {
    const item = mergedCategories().find(category => String(category.id) === String(editId));
    if (item) openCategoryDialog("edit", item);
    return;
  }

  const materializeId = event.target.closest("[data-materialize-category]")?.dataset.materializeCategory;
  if (materializeId) {
    const item = mergedCategories().find(category => String(category.id) === String(materializeId));
    if (item) openCategoryDialog("materialize", item);
    return;
  }

  const deleteId = event.target.closest("[data-delete-category]")?.dataset.deleteCategory;
  if (deleteId) deleteCategory(deleteId);
});

pagination?.addEventListener("click", event => {
  const button = event.target.closest("[data-category-page]");
  if (!button || button.disabled) return;
  const target = button.dataset.categoryPage;
  categoryPage = target === "prev"
    ? categoryPage - 1
    : target === "next"
      ? categoryPage + 1
      : Number(target) || 1;
  render();
  document.querySelector("#productCategoryManager")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

addButton?.addEventListener("click", () => openCategoryDialog("add"));
form?.addEventListener("submit", saveCategory);
closeDialogButton?.addEventListener("click", closeCategoryDialog);
cancelDialogButton?.addEventListener("click", closeCategoryDialog);
dialog?.addEventListener("cancel", event => {
  if (saving) event.preventDefault();
  else sourceCategory = null;
});

searchInput?.addEventListener("input", () => {
  categoryPage = 1;
  render();
});
searchInput?.addEventListener("search", () => {
  categoryPage = 1;
  render();
});
searchClearButton?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  categoryPage = 1;
  render();
  searchInput?.focus();
});
statusFilter?.addEventListener("change", () => {
  categoryPage = 1;
  render();
});
sortSelect?.addEventListener("change", () => {
  categoryPage = 1;
  render();
});
pageSizeSelect?.addEventListener("change", () => {
  const value = Number(pageSizeSelect.value);
  categoryPageSize = CATEGORY_PAGE_SIZE_OPTIONS.includes(value) ? value : 10;
  categoryPage = 1;
  render();
});

window.addEventListener("retail-pos-products-changed", () => {
  categoryPage = 1;
  render();
});

if (root) {
  render();
  watchRecords(
    RetailCollections.categories,
    rows => {
      categories = Array.isArray(rows) ? rows : [];
      render();
    },
    { sortBy: "sortOrder", direction: "asc" }
  );
}
