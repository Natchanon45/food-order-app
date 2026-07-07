import { RetailCollections, listRecords, saveRecordsStrict, watchRecords, saveRecordStrict } from './retail-db.js?v=20260629-030';

const CUSTOMER_KEY = "retail_pos_customers_v1";
const SALES_KEY = "retail_pos_sales_v1";
const paymentForm = document.querySelector("#paymentDialog .payment-form");
const method = document.querySelector("#paymentMethod");
const confirmBtn = document.querySelector("#confirmPaymentBtn");
const paymentDialog = document.querySelector("#paymentDialog");
let customers = [];
let selectedCustomerId = "";

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function maskNamePart(part = "") {
  const text = String(part || "").trim();
  if (!text) return "";
  if (text.length <= 1) return "*";
  if (text.length === 2) return `${text[0]}*`;
  return `${text[0]}${"*".repeat(Math.min(text.length - 2, 4))}${text.slice(-1)}`;
}

function maskCustomerName(value) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).map(maskNamePart).join(" ");
}

function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return `${digits.slice(0, 1)}***`;
  if (digits.length < 10) return `${digits.slice(0, 2)}xxx${digits.slice(-2)}`;
  return `${digits.slice(0, 3)}-xxx-xx${digits.slice(-2)}`;
}

function customerId(customer) {
  return String(customer?._documentId || customer?.id || "");
}

function syncCustomers(rows = []) {
  customers = rows.map(row => ({ ...row, id: customerId(row) })).filter(row => row.id);
  write(CUSTOMER_KEY, customers);
  if (selectedCustomerId && !customers.some(customer => customer.id === selectedCustomerId)) selectCustomer("");
}

if (paymentForm && method && !document.querySelector("#saleCustomerSearch")) {
  const wrap = document.createElement("div");
  wrap.className = "customer-picker";
  wrap.innerHTML = `<span>สมาชิก / ลูกค้า (ไม่บังคับ)</span><div class="customer-search-wrap"><input id="saleCustomerSearch" class="customer-search-input" autocomplete="off" placeholder="ค้นหารหัสสมาชิก ชื่อ หรือเบอร์โทร"><button id="clearSaleCustomer" class="customer-clear-btn" type="button" aria-label="ล้างลูกค้า"><i class="bi bi-x-lg" aria-hidden="true"></i></button><div id="saleCustomerResults" class="customer-search-results" hidden></div></div><small id="saleCustomerSelectedNote" class="customer-selected-note">ลูกค้าทั่วไป / ไม่ระบุ</small>`;
  method.closest("label")?.insertAdjacentElement("beforebegin", wrap);
}

const input = document.querySelector("#saleCustomerSearch");
const results = document.querySelector("#saleCustomerResults");
const clearBtn = document.querySelector("#clearSaleCustomer");
const note = document.querySelector("#saleCustomerSelectedNote");

function sortedCustomers() {
  return [...customers].sort((a, b) => String(a.customerCode || a.name || a.id).localeCompare(String(b.customerCode || b.name || b.id), "th"));
}

function filteredCustomers() {
  const query = (input?.value || "").trim().toLowerCase();
  return sortedCustomers()
    .filter(customer => !query || [customer.customerCode, customer.name, customer.phone, customer.email, customer.id].some(value => String(value || "").toLowerCase().includes(query)))
    .slice(0, 30);
}

function renderResults() {
  if (!results) return;
  const rows = filteredCustomers();
  results.innerHTML = `<button class="customer-search-option ${selectedCustomerId ? "" : "is-active"}" type="button" data-customer-id="" aria-pressed="${selectedCustomerId ? "false" : "true"}"><span class="customer-option-avatar"><i class="bi bi-person" aria-hidden="true"></i></span><span class="customer-option-body"><span class="customer-option-name">ลูกค้าทั่วไป <small>ไม่ระบุสมาชิก</small></span><span class="customer-option-contact">ขายโดยไม่ผูกกับทะเบียนลูกค้า</span></span><span class="customer-option-check"><i class="bi bi-check-lg" aria-hidden="true"></i></span></button>` +
    (rows.length ? rows.map(customer => `<button class="customer-search-option ${selectedCustomerId === customer.id ? "is-active" : ""}" type="button" data-customer-id="${esc(customer.id)}" aria-pressed="${selectedCustomerId === customer.id ? "true" : "false"}"><span class="customer-option-avatar"><i class="bi bi-person" aria-hidden="true"></i></span><span class="customer-option-body"><span class="customer-option-name">${esc(customer.name)}${customer.customerCode ? `<small>${esc(customer.customerCode)}</small>` : ""}</span><span class="customer-option-contact">${customer.phone ? `<span><i class="bi bi-telephone" aria-hidden="true"></i>${esc(customer.phone)}</span>` : ""}${customer.email ? `<span><i class="bi bi-envelope" aria-hidden="true"></i>${esc(customer.email)}</span>` : ""}${!customer.phone && !customer.email ? `<span>${esc(customer.id)}</span>` : ""}</span></span><span class="customer-option-check"><i class="bi bi-check-lg" aria-hidden="true"></i></span></button>`).join("") : '<div class="customer-search-empty">ไม่พบลูกค้าที่ค้นหา</div>');
  results.hidden = false;
}

function selectCustomer(id) {
  selectedCustomerId = id || "";
  const customer = customers.find(item => item.id === selectedCustomerId);
  if (customer) {
    input.value = `${customer.customerCode || ""} ${customer.name || ""}`.trim();
    note.textContent = [customer.customerCode, customer.name, customer.phone].filter(Boolean).join(" • ");
  } else {
    input.value = "";
    note.textContent = "ลูกค้าทั่วไป / ไม่ระบุ";
  }
  paymentDialog.dataset.customerId = selectedCustomerId;
  paymentDialog.dispatchEvent(new CustomEvent("pos:customer-change", { detail: { customerId: selectedCustomerId, customer: customer || null } }));
  if (results) results.hidden = true;
}

function clearCustomerSelection({ focus = false, showResults = false } = {}) {
  selectedCustomerId = "";
  if (input) input.value = "";
  if (note) note.textContent = "ลูกค้าทั่วไป / ไม่ระบุ";
  if (paymentDialog) {
    paymentDialog.dataset.customerId = "";
    paymentDialog.dispatchEvent(new CustomEvent("pos:customer-change", { detail: { customerId: "", customer: null } }));
  }
  if (results) {
    if (showResults) renderResults();
    else {
      results.hidden = true;
      results.innerHTML = "";
    }
  }
  if (focus) setTimeout(() => {
    input?.focus({ preventScroll: true });
    if (!showResults && results) results.hidden = true;
  }, 0);
}

function closeResultsSoon() {
  setTimeout(() => { if (results) results.hidden = true; }, 120);
}

async function tagLatestSale(customerIdValue, startedAt) {
  if (!customerIdValue) return;
  const customer = customers.find(item => item.id === customerIdValue);
  if (!customer) return;
  const sales = read(SALES_KEY, []);
  const sale = sales.find(item => new Date(item.createdAt).getTime() >= startedAt - 5000 && !item.customerId);
  if (!sale) return;

  const patch = {
    ...sale,
    customerId: customer.id,
    customerCode: customer.customerCode || "",
    customerName: customer.name || "",
    customerPhone: customer.phone || "",
    customerDisplayName: maskCustomerName(customer.name || ""),
    customerDisplayPhone: maskPhone(customer.phone || "")
  };
  const next = sales.map(item => String(item.id || item.saleNumber) === String(sale.id || sale.saleNumber) ? patch : item);
  write(SALES_KEY, next);
  try { await saveRecordStrict(RetailCollections.sales, patch); }
  catch (error) { console.warn('[retail-pos-customer-link] sale customer tag firebase failed', error); }
}

input?.addEventListener("focus", renderResults);
input?.addEventListener("input", () => {
  selectedCustomerId = "";
  note.textContent = "ยังไม่ได้เลือกลูกค้า";
  paymentDialog.dataset.customerId = "";
  paymentDialog.dispatchEvent(new CustomEvent("pos:customer-change", { detail: { customerId: "", customer: null } }));
  renderResults();
});
input?.addEventListener("keydown", event => {
  if (event.key === "Escape") results.hidden = true;
  if (event.key === "Enter") {
    event.preventDefault();
    const first = results.querySelector("[data-customer-id]");
    if (first) selectCustomer(first.dataset.customerId);
  }
});
input?.addEventListener("blur", closeResultsSoon);
results?.addEventListener("mousedown", event => {
  event.preventDefault();
  const button = event.target.closest("[data-customer-id]");
  if (button) selectCustomer(button.dataset.customerId);
});
clearBtn?.addEventListener("pointerdown", event => event.preventDefault());
clearBtn?.addEventListener("click", event => {
  event.preventDefault();
  event.stopPropagation();
  clearCustomerSelection({ focus: false, showResults: false });
});
confirmBtn?.addEventListener("click", () => {
  const startedAt = Date.now();
  const customerIdValue = selectedCustomerId;
  setTimeout(() => tagLatestSale(customerIdValue, startedAt), 80);
}, true);
paymentDialog?.addEventListener("close", () => clearCustomerSelection());

const localCustomers = read(CUSTOMER_KEY, []);
const remoteCustomers = await listRecords(RetailCollections.customers, { sortBy: 'updatedAt', direction: 'desc' });
if (!remoteCustomers.length && localCustomers.length) await saveRecordsStrict(RetailCollections.customers, localCustomers);
syncCustomers(remoteCustomers.length ? remoteCustomers : localCustomers);
const stopCustomersWatch = watchRecords(RetailCollections.customers, syncCustomers, { sortBy: 'updatedAt', direction: 'desc' });
window.addEventListener('beforeunload', stopCustomersWatch, { once: true });
