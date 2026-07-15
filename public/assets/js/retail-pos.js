import { auth, db, isFirebaseConfigured, collection, doc, query, orderBy, getDocs, runTransaction, serverTimestamp, onAuthStateChanged } from './firebase-config.js?v=20260630-073';
import { getTenantId, RetailCollections, getRecord, listRecords, watchRecords } from './retail-db.js?v=20260629-030';
import {
  POS_COLLECTIONS,
  POS_FIRESTORE_VERSION,
  getDeviceId,
  dateKeyFrom,
  monthKeyFrom,
  normalizeSaleForFirestore,
  buildSaleItemRows,
  applySaleToDailySummary,
  buildSyncQueueRow
} from './retail-pos-firestore-foundation.js?v=20260702-002';
import { reserveRunningNumber } from './retail-pos-counter.js?v=20260702-003';
import { showReceipt } from './retail-pos-receipt-modal.js?v=20260706-028';

const PRODUCT_KEY = "retail_pos_products_v1";
const SALES_KEY = "retail_pos_sales_v1";
const MOVEMENT_KEY = "retail_pos_stock_movements_v1";
const SHIFT_KEY = "retail_pos_active_shift_v1";
const CUSTOMER_KEY = "retail_pos_customers_v1";
const SETTINGS_KEY = "retail_pos_store_settings_v1";
const FIRESTORE_SAVE_TIMEOUT_MS = 10000;

const DEFAULT_TAX_SETTINGS = Object.freeze({
  vatRegistered: "no",
  vatRate: 7,
  defaultVatMode: "include",
  vatCalculationBase: "after_discount_and_points",
  shortTaxInvoiceEnabled: true
});

const els = {
  barcodeInput: document.querySelector("#barcodeInput"),
  searchInput: document.querySelector("#searchInput"),
  productGrid: document.querySelector("#productGrid"),
  cartList: document.querySelector("#cartList"),
  cartEmpty: document.querySelector("#cartEmpty"),
  itemCount: document.querySelector("#itemCount"),
  subtotal: document.querySelector("#subtotal"),
  discountInput: document.querySelector("#discountInput"),
  vatModeWrap: document.querySelector("#vatModeWrap"),
  vatMode: document.querySelector("#vatMode"),
  beforeVatWrap: document.querySelector("#beforeVatWrap"),
  beforeVatAmount: document.querySelector("#beforeVatAmount"),
  vatAmountWrap: document.querySelector("#vatAmountWrap"),
  vatAmountLabel: document.querySelector("#vatAmountLabel"),
  vatAmount: document.querySelector("#vatAmount"),
  grandTotal: document.querySelector("#grandTotal"),
  payBtn: document.querySelector("#payBtn"),
  clearSaleBtn: document.querySelector("#clearSaleBtn"),
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
let taxSettings = { ...DEFAULT_TAX_SETTINGS };

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

function movementId(saleId, productId) {
  return `${saleId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function auditLogId(action, entityId) {
  return `${action}_${entityId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function auditLogRow({ action, entityType = "sale", entityId, entityNumber = "", userId = "", deviceId = "", summary = {}, createdAt = new Date().toISOString() }) {
  const tenantId = getTenantId();
  const id = auditLogId(action, entityId);
  return { id, tenantId, shopId: tenantId, deviceId, schemaVersion: POS_FIRESTORE_VERSION, deleted: false, action, entityType, entityId, entityNumber, channel: "retail-pos", createdBy: userId, updatedBy: userId, createdAt, updatedAt: Date.now(), summary };
}

function pendingSaleNumber(createdAt, saleId) {
  const dateKey = dateKeyFrom(createdAt);
  const suffix = String(saleId || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || Math.random().toString(16).slice(2, 8).toUpperCase();
  return `POS-${dateKey}-PENDING-${suffix}`;
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

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
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

function waitForAuthUser(timeout = 3000) {
  if (!isFirebaseConfigured || !auth) return Promise.resolve(null);
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise(resolve => {
    let settled = false;
    let unsubscribe = () => {};
    const finish = user => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(user || auth.currentUser || null);
    };
    const timer = setTimeout(() => finish(auth.currentUser || null), timeout);
    unsubscribe = onAuthStateChanged(auth, finish, () => finish(null));
  });
}

function shouldFallbackToOffline(error) {
  if (navigator.onLine === false) return true;
  const text = String(error?.code || error?.message || error || "").toLowerCase();
  return ["network", "offline", "unavailable", "timeout", "deadline-exceeded", "failed to fetch", "firebaseerror"].some(part => text.includes(part));
}

function normalizeProduct(product = {}) {
  return { ...product, id: String(product.id || product.code || ""), barcode: String(product.barcode || ""), name: product.name || "ไม่ระบุชื่อ", price: Number(product.price || 0), cost: Number.isFinite(Number(product.cost)) ? Number(product.cost) : null, stock: Number(product.stock ?? product.qty ?? 0), unit: product.unit || "ชิ้น", showOnPos: product.showOnPos !== false };
}

function normalizeProducts(rows = []) {
  const byId = new Map();
  rows.map(normalizeProduct).forEach(product => {
    if (!product.id) return;
    const current = byId.get(product.id);
    const productIsCanonical = product._documentId === product.id;
    const currentIsCanonical = current?._documentId === current?.id;
    if (!current || (productIsCanonical && !currentIsCanonical) || (productIsCanonical === currentIsCanonical && Number(product.updatedAt || 0) > Number(current.updatedAt || 0))) byId.set(product.id, product);
  });
  return [...byId.values()];
}

function normalizeVatMode(value, fallback = taxSettings.defaultVatMode || DEFAULT_TAX_SETTINGS.defaultVatMode) {
  return String(value || fallback || DEFAULT_TAX_SETTINGS.defaultVatMode) === "exclude" ? "exclude" : "include";
}

function normalizeVatRegistered(value) {
  const normalized = String(value ?? "no").trim().toLowerCase();
  return value === true || ["yes", "true", "1", "registered", "enabled"].includes(normalized) ? "yes" : "no";
}

function normalizeVatRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) return DEFAULT_TAX_SETTINGS.vatRate;
  return Math.min(100, round2(rate));
}

function normalizeTaxSettings(settings = {}) {
  const vatRegistered = normalizeVatRegistered(settings.vatRegistered ?? settings.vatEnabled ?? settings.taxRegistered);
  let vatRate = normalizeVatRate(settings.vatRate ?? settings.taxRate ?? settings.vatPercent);
  if (vatRegistered === "yes" && vatRate <= 0) vatRate = DEFAULT_TAX_SETTINGS.vatRate;
  return {
    ...DEFAULT_TAX_SETTINGS,
    ...settings,
    vatRegistered,
    vatRate,
    defaultVatMode: normalizeVatMode(settings.defaultVatMode, DEFAULT_TAX_SETTINGS.defaultVatMode)
  };
}

function isVatEnabled() {
  return normalizeVatRegistered(taxSettings.vatRegistered) === "yes" && normalizeVatRate(taxSettings.vatRate) > 0;
}

function readLocalTaxSettings() {
  const local = readJson(SETTINGS_KEY, {});
  return normalizeTaxSettings({ ...DEFAULT_TAX_SETTINGS, ...local });
}

async function loadTaxSettings() {
  const local = readLocalTaxSettings();
  try {
    const tax = await getRecord(RetailCollections.settings, "tax");
    taxSettings = normalizeTaxSettings({ ...DEFAULT_TAX_SETTINGS, ...local, ...(tax || {}) });
  } catch (error) {
    console.warn("[retail-pos] tax settings fallback", error);
    taxSettings = local;
  }
  if (els.vatMode) els.vatMode.value = taxSettings.defaultVatMode;
  renderVatControls();
}

function renderVatControls() {
  const enabled = isVatEnabled();
  [els.vatModeWrap, els.beforeVatWrap, els.vatAmountWrap].forEach(node => { if (node) node.hidden = !enabled; });
  if (els.vatAmountLabel) els.vatAmountLabel.textContent = `VAT ${money(taxSettings.vatRate).replace(/\.00$/, "")}%`;
}

function getTotals() {
  const subtotal = round2(cart.reduce((sum, item) => sum + item.price * item.qty, 0));
  const discount = round2(Math.max(0, Math.min(subtotal, Number(els.discountInput.value || 0))));
  const discountedBase = round2(Math.max(0, subtotal - discount));
  const vatRate = normalizeVatRate(taxSettings.vatRate);
  const vatRegistered = isVatEnabled();
  const vatMode = vatRegistered ? normalizeVatMode(els.vatMode?.value || taxSettings.defaultVatMode) : "none";
  let beforeVat = discountedBase;
  let vatAmount = 0;
  let total = discountedBase;
  if (vatRegistered && vatMode === "include") {
    vatAmount = round2(discountedBase * vatRate / (100 + vatRate));
    beforeVat = round2(discountedBase - vatAmount);
    total = discountedBase;
  } else if (vatRegistered && vatMode === "exclude") {
    beforeVat = discountedBase;
    vatAmount = round2(discountedBase * vatRate / 100);
    total = round2(discountedBase + vatAmount);
  }
  return { subtotal, discount, pointDiscount: 0, discountedBase, taxableBase: beforeVat, beforeVat, vatAmount, vatRate, vatMode, vatRegistered, vatCalculationBase: "after_discount_and_points", total };
}

function renderProducts() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const filtered = products.filter(product => {
    const searchText = `${product.name || ""} ${product.id || ""} ${product.barcode || ""}`.toLowerCase();
    return product.showOnPos !== false && (!keyword || searchText.includes(keyword));
  });
  els.productGrid.innerHTML = filtered.length ? filtered.map(product => `<button class="product-card" type="button" data-product-id="${escapeHtml(product.id)}" ${savingSale || product.stock <= 0 ? "disabled" : ""}><span class="name">${escapeHtml(product.name)}</span><span class="code">${escapeHtml(product.id)} • ${escapeHtml(product.barcode)}</span><span class="stock">คงเหลือ ${Number(product.stock || 0).toLocaleString("th-TH")} ${escapeHtml(product.unit)}</span><span class="price">${money(product.price)} บาท</span></button>`).join("") : '<div class="empty-state">ไม่พบสินค้า</div>';
}

function renderCart() {
  els.cartEmpty.hidden = cart.length > 0;
  els.cartList.innerHTML = cart.map(item => `<div class="cart-row"><div><div class="cart-name">${escapeHtml(item.name)}</div><div class="cart-meta">${money(item.price)} บาท / ${escapeHtml(item.unit)}</div><div class="qty-tools"><button type="button" data-action="decrease" data-id="${escapeHtml(item.id)}" ${savingSale ? "disabled" : ""}>−</button><strong>${item.qty}</strong><button type="button" data-action="increase" data-id="${escapeHtml(item.id)}" ${savingSale ? "disabled" : ""}>+</button><button type="button" class="remove" data-action="remove" data-id="${escapeHtml(item.id)}" ${savingSale ? "disabled" : ""}>ลบ</button></div></div><div class="line-total">${money(item.price * item.qty)}</div></div>`).join("");
  const qty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totals = getTotals();
  els.itemCount.textContent = `${qty} รายการ`;
  els.subtotal.textContent = money(totals.subtotal);
  if (els.beforeVatAmount) els.beforeVatAmount.textContent = money(totals.beforeVat);
  if (els.vatAmount) els.vatAmount.textContent = money(totals.vatAmount);
  els.grandTotal.textContent = money(totals.total);
  els.payBtn.disabled = cart.length === 0 || totals.total <= 0 || savingSale;
}

function addProduct(productId) {
  const product = products.find(item => item.id === productId);
  if (!product || product.stock <= 0) return;
  const current = cart.find(item => item.id === productId);
  const currentQty = current?.qty || 0;
  if (currentQty >= product.stock) return showToast("จำนวนในบิลเกินสต็อกคงเหลือ");
  if (current) current.qty += 1; else cart.push({ ...product, qty: 1 });
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(entry => entry.id === id);
  const product = products.find(entry => entry.id === id);
  if (!item || !product) return;
  const next = item.qty + delta;
  if (next > product.stock) return showToast("จำนวนในบิลเกินสต็อกคงเหลือ");
  if (next <= 0) cart = cart.filter(entry => entry.id !== id); else item.qty = next;
  renderCart();
}

function resetSale() { cart = []; els.discountInput.value = "0"; renderCart(); els.barcodeInput.focus(); }
function readyForNextSale() { resetSale(); setTimeout(() => els.barcodeInput?.focus(), 120); }

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
  const enteredReceived = moneyInputValue(els.receivedInput.value);
  const received = cash || enteredReceived > 0 ? enteredReceived : totals.total;
  els.changeAmount.textContent = `${money(Math.max(0, received - totals.total))} บาท`;
}

function moneyInputValue(value) {
  return Number(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0;
}

function saveLocalSale(sale, nextProducts, movements) {
  const sales = readJson(SALES_KEY, []);
  const saleKey = String(sale?.id || sale?.saleNumber || "");
  const existing = sales.filter(item => String(item?.id || item?.saleNumber || "") !== saleKey);
  writeJson(PRODUCT_KEY, nextProducts);
  writeJson(SALES_KEY, [sale, ...existing].slice(0, 500));
  writeJson(MOVEMENT_KEY, [...movements, ...readJson(MOVEMENT_KEY, [])].slice(0, 500));
}

function updateLocalSaleOnly(sale) {
  const saleKey = String(sale?.id || sale?.saleNumber || "");
  if (!saleKey) return false;
  const sales = readJson(SALES_KEY, []);
  let changed = false;
  const next = sales.map(item => {
    if (String(item?.id || item?.saleNumber || "") !== saleKey) return item;
    changed = true;
    return { ...item, ...sale };
  });
  if (changed) writeJson(SALES_KEY, next);
  return changed;
}

async function completeSaleOffline({ saleId, method, received, totals, createdAt, saleItems }) {
  const number = pendingSaleNumber(createdAt, saleId);
  const movementRows = [];
  const nextProducts = products.map(product => {
    const sold = saleItems.find(item => item.id === product.id)?.qty || 0;
    if (!sold) return product;
    const before = Number(product.stock || 0);
    const after = before - sold;
    const id = movementId(saleId, product.id);
    movementRows.push({ id, tenantId: getTenantId(), productId: product.id, productName: product.name, type: "sale", direction: "out", qty: sold, before, after, stockBefore: before, stockAfter: after, note: `ขายสินค้า ${number}`, referenceType: "sale", referenceId: saleId, referenceNumber: number, createdAt });
    return { ...product, stock: after };
  });
  const sale = buildSale({ id: saleId, number, method, received, totals, createdAt, saleItems, syncStatus: "pending" });
  saveLocalSale(sale, nextProducts, movementRows);
  products = nextProducts;
  return sale;
}

function buildSale({ id, number, method, received, totals, createdAt, saleItems = cart, cashierId = auth?.currentUser?.uid || "", syncStatus = "synced" }) {
  const shift = readJson(SHIFT_KEY, null);
  const selectedCustomerId = document.querySelector("#paymentDialog")?.dataset.customerId || "";
  const customer = readJson(CUSTOMER_KEY, []).find(item => String(item.id) === String(selectedCustomerId));
  const tenantId = getTenantId();
  const deviceId = getDeviceId();
  const dateKey = dateKeyFrom(createdAt);
  const monthKey = monthKeyFrom(createdAt);
  return { id, saleNumber: number, tenantId, shopId: tenantId, deviceId, schemaVersion: POS_FIRESTORE_VERSION, deleted: false, dateKey, monthKey, channel: "retail-pos", orderType: "pos", status: "completed", paymentStatus: "paid", syncStatus, createdAt, items: saleItems.map(({ id, barcode, name, price, cost, qty, unit }) => ({ id, productId: id, barcode, name, price, cost: Number.isFinite(Number(cost)) ? Number(cost) : null, qty, unit, lineTotal: Number(price || 0) * Number(qty || 0) })), totalQty: saleItems.reduce((sum, item) => sum + item.qty, 0), subtotal: totals.subtotal, discount: totals.discount, pointDiscount: totals.pointDiscount || 0, discountedBase: totals.discountedBase, taxableBase: totals.taxableBase, beforeVat: totals.beforeVat, vatAmount: totals.vatAmount, vatRate: totals.vatRate, vatMode: totals.vatMode, vatRegistered: totals.vatRegistered, vatCalculationBase: totals.vatCalculationBase, total: totals.total, totalAmount: totals.total, payment: { method, received, change: Math.max(0, received - totals.total) }, paymentMethod: method, receivedAmount: received, changeAmount: Math.max(0, received - totals.total), cashierId, customerId: customer?.id || "", customerCode: customer?.customerCode || "", customerName: customer?.name || "", customerPhone: customer?.phone || "", shiftId: shift?.id || "", cashierName: shift?.cashierName || "", terminalCode: shift?.terminalCode || "" };
}

async function completeSaleFirestore({ saleId, method, received, totals, createdAt, saleItems }) {
  const user = await waitForAuthUser();
  if (!user?.uid) throw new Error("AUTH_REQUIRED");
  const tenantId = getTenantId();
  const saleRef = tenantDoc(RetailCollections.sales, saleId);
  let committedSale = null;
  const localMovements = [];
  await runTransaction(db, async transaction => {
    localMovements.length = 0;
    const existingSale = await transaction.get(saleRef);
    if (existingSale.exists()) { committedSale = { id: saleRef.id, ...existingSale.data(), syncStatus: "synced" }; return; }
    const rows = [];
    for (const cartItem of saleItems) {
      const productRef = tenantDoc(RetailCollections.products, cartItem._documentId || cartItem.id);
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists()) throw new Error(`PRODUCT_NOT_FOUND:${cartItem.name}`);
      const product = normalizeProduct({ id: snapshot.id, ...snapshot.data() });
      if (Number(product.stock || 0) < Number(cartItem.qty || 0)) throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
      rows.push({ cartItem, productRef, product });
    }
    const saleDateValue = createdAt || new Date();
    const saleDateKey = dateKeyFrom(saleDateValue);
    const summaryRef = tenantDoc(POS_COLLECTIONS.dailySummary, saleDateKey);
    const summarySnapshot = await transaction.get(summaryRef);
    const reserved = await reserveRunningNumber(transaction, db, { type: "SALE", value: saleDateValue, tenantId, documentId: saleId, userId: user.uid });
    const number = reserved.documentNumber;
    const sale = buildSale({ id: saleId, number, method, received, totals, createdAt, saleItems, cashierId: user.uid, syncStatus: "synced" });
    const normalizedSale = normalizeSaleForFirestore(sale, { tenantId, userId: user.uid, deviceId: sale.deviceId });
    const nextSummary = applySaleToDailySummary(summarySnapshot.exists() ? summarySnapshot.data() : {}, normalizedSale);
    committedSale = { ...normalizedSale, id: saleId, syncStatus: "synced" };
    transaction.set(saleRef, { ...normalizedSale, id: saleId, syncStatus: "synced", createdAtServer: serverTimestamp(), updatedAt: Date.now(), updatedAtServer: serverTimestamp() });
    buildSaleItemRows(normalizedSale).forEach(item => transaction.set(tenantDoc(POS_COLLECTIONS.saleItems, item.id), { ...item, createdBy: user.uid, updatedBy: user.uid, deviceId: normalizedSale.deviceId, schemaVersion: POS_FIRESTORE_VERSION, deleted: false, createdAtServer: serverTimestamp(), updatedAt: Date.now(), updatedAtServer: serverTimestamp() }, { merge: true }));
    rows.forEach(({ cartItem, productRef, product }) => {
      const before = Number(product.stock || 0);
      const after = before - Number(cartItem.qty || 0);
      transaction.update(productRef, { stock: after, tenantId: getTenantId(), shopId: getTenantId(), updatedAt: Date.now(), updatedAtServer: serverTimestamp() });
      const id = movementId(saleId, product.id);
      const movementRef = tenantDoc(RetailCollections.stockMovements, id);
      const movement = { id, tenantId: getTenantId(), shopId: getTenantId(), deviceId: normalizedSale.deviceId, schemaVersion: POS_FIRESTORE_VERSION, deleted: false, dateKey: normalizedSale.dateKey, monthKey: normalizedSale.monthKey, productId: product.id, productName: product.name, type: "sale", direction: "out", qty: Number(cartItem.qty || 0), before, after, stockBefore: before, stockAfter: after, note: `ขายสินค้า ${number}`, referenceType: "sale", referenceId: saleId, referenceNumber: number, createdBy: user.uid, updatedBy: user.uid, createdAt, createdAtServer: serverTimestamp(), updatedAt: Date.now(), updatedAtServer: serverTimestamp() };
      transaction.set(movementRef, movement, { merge: true });
      localMovements.push({ ...movement, createdAtServer: null, updatedAtServer: null });
    });
    const audit = auditLogRow({ action: "pos_sale_completed", entityId: saleId, entityNumber: number, userId: user.uid, deviceId: normalizedSale.deviceId, createdAt, summary: { saleNumber: number, totalAmount: normalizedSale.totalAmount, totalQty: normalizedSale.totalQty, paymentMethod: normalizedSale.paymentMethod, customerId: normalizedSale.customerId || "", shiftId: normalizedSale.shiftId || "", vatMode: normalizedSale.vatMode || "none", vatAmount: normalizedSale.vatAmount || 0, syncStatus: "synced" } });
    transaction.set(tenantDoc(POS_COLLECTIONS.auditLogs, audit.id), { ...audit, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp() }, { merge: true });
    transaction.set(summaryRef, { ...nextSummary, updatedBy: user.uid, updatedAtServer: serverTimestamp() }, { merge: true });
    transaction.set(tenantDoc(POS_COLLECTIONS.syncQueue, saleId), { ...buildSyncQueueRow(normalizedSale, { status: "synced" }), createdBy: user.uid, updatedBy: user.uid, updatedAtServer: serverTimestamp() }, { merge: true });
  });
  if (updateLocalSaleOnly(committedSale)) return committedSale;
  const nextProducts = products.map(product => {
    const sold = saleItems.find(item => item.id === product.id)?.qty || 0;
    return sold ? { ...product, stock: Number(product.stock || 0) - sold } : product;
  });
  saveLocalSale(committedSale, nextProducts, localMovements);
  products = nextProducts;
  return committedSale;
}

function withTimeout(promise, ms = FIRESTORE_SAVE_TIMEOUT_MS) {
  let timer = 0;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("POS_FIRESTORE_SAVE_TIMEOUT")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function saveSaleWithFallback({ saleId, method, received, totals, createdAt, saleItems }) {
  const payload = { saleId, method, received, totals, createdAt, saleItems };
  if (!isFirebaseConfigured || !db || navigator.onLine === false) return { sale: await completeSaleOffline(payload), offline: true };
  try { return { sale: await withTimeout(completeSaleFirestore(payload)), offline: false }; }
  catch (error) { if (!shouldFallbackToOffline(error)) throw error; console.warn("[retail-pos] firebase unavailable, saved sale offline", error); return { sale: await completeSaleOffline(payload), offline: true }; }
}

async function confirmPayment() {
  if (savingSale) return;
  const totals = getTotals();
  const method = els.paymentMethod.value;
  const enteredReceived = moneyInputValue(els.receivedInput.value);
  const received = method === "cash" || enteredReceived > 0 ? enteredReceived : totals.total;
  if (received < totals.total) { els.paymentError.textContent = "จำนวนเงินที่รับมายังไม่ครบ"; return; }
  savingSale = true;
  els.confirmPaymentBtn.disabled = true;
  els.confirmPaymentBtn.textContent = "กำลังบันทึก...";
  renderCart();
  const saleId = safeId("sale");
  const createdAt = new Date().toISOString();
  const saleItems = cart.map(item => ({ ...item }));
  try {
    const { sale, offline } = await saveSaleWithFallback({ saleId, method, received, totals, createdAt, saleItems });
    els.paymentDialog.close();
    renderProducts();
    readyForNextSale();
    showToast(offline ? `บันทึกการขาย ${sale.saleNumber || sale.id} แบบออฟไลน์แล้ว` : `บันทึกการขาย ${sale.saleNumber || sale.id} สำเร็จ`);
    showReceipt(sale, { autoPrint: false }).catch(error => console.warn("[retail-pos] receipt popup skipped", error));
  }
  catch (error) { console.error("[retail-pos] sale failed", error); const message = String(error?.message || error); if (message.startsWith("INSUFFICIENT_STOCK:")) els.paymentError.textContent = `สต็อก ${message.split(":").slice(1).join(":")} ไม่พอ`; else if (message.startsWith("PRODUCT_NOT_FOUND:")) els.paymentError.textContent = `ไม่พบสินค้า ${message.split(":").slice(1).join(":")}`; else if (message === "AUTH_REQUIRED") els.paymentError.textContent = "กรุณาเข้าสู่ระบบก่อนบันทึกการขาย"; else els.paymentError.textContent = "บันทึกการขายไม่สำเร็จ กรุณาลองใหม่"; }
  finally { savingSale = false; els.confirmPaymentBtn.disabled = false; els.confirmPaymentBtn.textContent = "ยืนยันการขาย"; renderProducts(); renderCart(); }
}

async function loadProducts() {
  try {
    const rows = await listRecords(RetailCollections.products, { sortBy: "updatedAt", direction: "desc" });
    if (rows.length) products = normalizeProducts(rows);
    else if (isFirebaseConfigured && db) products = [];
    writeJson(PRODUCT_KEY, products);
  } catch (error) { console.warn("[retail-pos] load products failed", error); }
  renderProducts();
  renderCart();
}

els.productGrid.addEventListener("click", event => { if (savingSale) return; const button = event.target.closest("[data-product-id]"); if (button) addProduct(button.datasetProductId || button.dataset.productId); });
els.cartList.addEventListener("click", event => { if (savingSale) return; const button = event.target.closest("button[data-action]"); if (!button) return; if (button.dataset.action === "increase") changeQty(button.dataset.id, 1); if (button.dataset.action === "decrease") changeQty(button.dataset.id, -1); if (button.dataset.action === "remove") { cart = cart.filter(item => item.id !== button.dataset.id); renderCart(); } });
els.barcodeInput.addEventListener("keydown", event => { if (event.key !== "Enter") return; event.preventDefault(); const code = els.barcodeInput.value.trim(); const product = products.find(item => item.barcode === code || item.id.toLowerCase() === code.toLowerCase()); if (product) addProduct(product.id); else showToast("ไม่พบบาร์โค้ดหรือรหัสสินค้านี้"); els.barcodeInput.value = ""; });
els.searchInput.addEventListener("input", renderProducts);
els.discountInput.addEventListener("input", renderCart);
els.vatMode?.addEventListener("change", renderCart);
els.clearSaleBtn.addEventListener("click", resetSale);
els.payBtn.addEventListener("click", openPayment);
els.paymentMethod.addEventListener("change", updatePaymentUi);
els.receivedInput.addEventListener("input", updatePaymentUi);
els.receivedInput.addEventListener("change", updatePaymentUi);
els.receivedInput.addEventListener("keyup", updatePaymentUi);
els.confirmPaymentBtn.addEventListener("click", confirmPayment);
await loadTaxSettings();
await loadProducts();
const stopShiftWatch=watchRecords(RetailCollections.shifts,rows=>{ const uid=auth?.currentUser?.uid||""; const active=rows.find(row=>row.status==="open"&&(!uid||row.createdBy===uid))||null; if(active)writeJson(SHIFT_KEY,active);else localStorage.removeItem(SHIFT_KEY); document.documentElement.dataset.shiftSource="firestore"; window.dispatchEvent(new Event("storage")); },{sortBy:"updatedAt",direction:"desc"});
window.addEventListener("beforeunload",stopShiftWatch,{once:true});
els.barcodeInput.focus();
