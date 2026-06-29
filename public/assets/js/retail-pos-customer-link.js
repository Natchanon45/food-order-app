import { RetailCollections, watchRecords, saveRecord } from './retail-db.js?v=20260629-027';

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
  wrap.innerHTML = `<span>สมาชิก / ลูกค้า (ไม่บังคับ)</span><div class="customer-search-wrap"><input id="saleCustomerSearch" class="customer-search-input" autocomplete="off" placeholder="ค้นหารหัสสมาชิก ชื่อ หรือเบอร์โทร"><button id="clearSaleCustomer" class="customer-clear-btn" type="button" aria-label="ล้างลูกค้า">×</button><div id="saleCustomerResults" class="customer-search-results" hidden></div></div><small id="saleCustomerSelectedNote" class="customer-selected-note">ลูกค้าทั่วไป / ไม่ระบุ</small>`;
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
  results.innerHTML = `<button class="customer-search-option ${selectedCustomerId ? "" : "is-active"}" type="button" data-customer-id=""><span><strong>ลูกค้าทั่วไป / ไม่ระบุ</strong><span>ขายโดยไม่ผูกกับทะเบียนลูกค้า</span></span></button>` +
    (rows.length ? rows.map(customer => `<button class="customer-search-option ${selectedCustomerId === customer.id ? "is-active" : ""}" type="button" data-customer-id="${esc(customer.id)}"><span><strong>${esc(customer.customerCode || "")} • ${esc(customer.name)}</strong><span>${esc([customer.phone, customer.email].filter(Boolean).join(" • ") || customer.id)}</span></span><small>${esc(customer.phone || "")}</small></button>`).join("") : '<div class="customer-search-empty">ไม่พบลูกค้าที่ค้นหา</div>');
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
    customerPhone: customer.phone || ""
  };
  const next = sales.map(item => String(item.id || item.saleNumber) === String(sale.id || sale.saleNumber) ? patch : item);
  write(SALES_KEY, next);
  try { await saveRecord(RetailCollections.sales, patch); }
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
clearBtn?.addEventListener("click", () => { selectCustomer(""); input.focus(); renderResults(); });
confirmBtn?.addEventListener("click", () => {
  const startedAt = Date.now();
  const customerIdValue = selectedCustomerId;
  setTimeout(() => tagLatestSale(customerIdValue, startedAt), 80);
}, true);
paymentDialog?.addEventListener("close", () => selectCustomer(""));

syncCustomers(read(CUSTOMER_KEY, []));
const stopCustomersWatch = watchRecords(RetailCollections.customers, syncCustomers, { sortBy: 'updatedAt', direction: 'desc' });
window.addEventListener('beforeunload', stopCustomersWatch, { once: true });
