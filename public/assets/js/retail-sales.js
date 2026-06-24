const SALES_KEY = "retail_pos_sales_v1";

const els = {
  saleCount: document.querySelector("#saleCount"),
  saleTotal: document.querySelector("#saleTotal"),
  discountTotal: document.querySelector("#discountTotal"),
  cashTotal: document.querySelector("#cashTotal"),
  transferTotal: document.querySelector("#transferTotal"),
  itemQtyTotal: document.querySelector("#itemQtyTotal"),
  averageSale: document.querySelector("#averageSale"),
  highestSale: document.querySelector("#highestSale"),
  cashPercent: document.querySelector("#cashPercent"),
  transferPercent: document.querySelector("#transferPercent"),
  cashBar: document.querySelector("#cashBar"),
  transferBar: document.querySelector("#transferBar"),
  bestSellerList: document.querySelector("#bestSellerList"),
  bestSellerEmpty: document.querySelector("#bestSellerEmpty"),
  reportPeriodText: document.querySelector("#reportPeriodText"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  saleSearch: document.querySelector("#saleSearch"),
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  paymentFilter: document.querySelector("#paymentFilter"),
  todayBtn: document.querySelector("#todayBtn"),
  monthBtn: document.querySelector("#monthBtn"),
  clearFilterBtn: document.querySelector("#clearFilterBtn"),
  salesTableBody: document.querySelector("#salesTableBody"),
  salesEmpty: document.querySelector("#salesEmpty"),
  saleDialog: document.querySelector("#saleDialog"),
  closeSaleDialog: document.querySelector("#closeSaleDialog"),
  closeSaleBtn: document.querySelector("#closeSaleBtn"),
  printReceiptBtn: document.querySelector("#printReceiptBtn"),
  receiptSaleId: document.querySelector("#receiptSaleId"),
  receiptDate: document.querySelector("#receiptDate"),
  receiptPayment: document.querySelector("#receiptPayment"),
  receiptItems: document.querySelector("#receiptItems"),
  receiptSubtotal: document.querySelector("#receiptSubtotal"),
  receiptDiscount: document.querySelector("#receiptDiscount"),
  receiptTotal: document.querySelector("#receiptTotal"),
  receiptReceived: document.querySelector("#receiptReceived"),
  receiptChange: document.querySelector("#receiptChange"),
  receiptReceivedRow: document.querySelector("#receiptReceivedRow"),
  receiptChangeRow: document.querySelector("#receiptChangeRow")
};

let sales = readJson(SALES_KEY, []);

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function localDateKey(value) {
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function paymentName(method) {
  return method === "cash" ? "เงินสด" : "PromptPay / โอนเงิน";
}

function filteredSales() {
  const keyword = els.saleSearch.value.trim().toLowerCase();
  const from = els.dateFrom.value;
  const to = els.dateTo.value;
  const method = els.paymentFilter.value;

  return sales.filter(sale => {
    const date = localDateKey(sale.createdAt);
    const items = (sale.items || []).map(item => `${item.name || ""} ${item.id || ""} ${item.barcode || ""}`).join(" ").toLowerCase();
    const matchesKeyword = !keyword || String(sale.id || "").toLowerCase().includes(keyword) || items.includes(keyword);
    const matchesFrom = !from || date >= from;
    const matchesTo = !to || date <= to;
    const matchesMethod = method === "all" || sale.payment?.method === method;
    return matchesKeyword && matchesFrom && matchesTo && matchesMethod;
  });
}

function buildProductRanking(rows) {
  const ranking = new Map();
  rows.forEach(sale => {
    (sale.items || []).forEach(item => {
      const key = String(item.id || item.barcode || item.name || "ไม่ทราบสินค้า");
      const current = ranking.get(key) || {
        id: item.id || item.barcode || "-",
        name: item.name || "ไม่ทราบสินค้า",
        qty: 0,
        revenue: 0
      };
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      current.qty += qty;
      current.revenue += qty * price;
      ranking.set(key, current);
    });
  });

  return [...ranking.values()].sort((a, b) =>
    b.qty - a.qty || b.revenue - a.revenue || a.name.localeCompare(b.name, "th")
  );
}

function renderStats(rows) {
  const saleTotal = rows.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const discountTotal = rows.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);
  const cashTotal = rows.filter(sale => sale.payment?.method === "cash").reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const transferTotal = rows.filter(sale => sale.payment?.method !== "cash").reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const itemQtyTotal = rows.reduce((sum, sale) => sum + (sale.items || []).reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0), 0);
  const highestSale = rows.reduce((max, sale) => Math.max(max, Number(sale.total || 0)), 0);
  const averageSale = rows.length ? saleTotal / rows.length : 0;
  const cashPercent = saleTotal > 0 ? (cashTotal / saleTotal) * 100 : 0;
  const transferPercent = saleTotal > 0 ? (transferTotal / saleTotal) * 100 : 0;

  els.saleCount.textContent = rows.length.toLocaleString("th-TH");
  els.saleTotal.textContent = money(saleTotal);
  els.discountTotal.textContent = money(discountTotal);
  els.cashTotal.textContent = money(cashTotal);
  els.transferTotal.textContent = money(transferTotal);
  els.itemQtyTotal.textContent = itemQtyTotal.toLocaleString("th-TH");
  els.averageSale.textContent = money(averageSale);
  els.highestSale.textContent = money(highestSale);
  els.cashPercent.textContent = `${cashPercent.toFixed(1)}%`;
  els.transferPercent.textContent = `${transferPercent.toFixed(1)}%`;
  els.cashBar.style.width = `${cashPercent}%`;
  els.transferBar.style.width = `${transferPercent}%`;
}

function renderBestSellers(rows) {
  const ranking = buildProductRanking(rows).slice(0, 10);
  els.bestSellerEmpty.hidden = ranking.length > 0;
  els.bestSellerList.innerHTML = ranking.map((item, index) => `
    <article class="ranking-item">
      <div class="ranking-position">${index + 1}</div>
      <div class="ranking-info">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.id)}</span>
      </div>
      <div class="ranking-total">
        <strong>${item.qty.toLocaleString("th-TH")} ชิ้น</strong>
        <span>${money(item.revenue)} บาท</span>
      </div>
    </article>
  `).join("");
}

function renderPeriodText() {
  const from = els.dateFrom.value;
  const to = els.dateTo.value;
  if (!from && !to) {
    els.reportPeriodText.textContent = "ข้อมูลทั้งหมด";
    return;
  }
  if (from && to) {
    els.reportPeriodText.textContent = from === to ? `วันที่ ${from}` : `ตั้งแต่ ${from} ถึง ${to}`;
    return;
  }
  els.reportPeriodText.textContent = from ? `ตั้งแต่ ${from}` : `ถึงวันที่ ${to}`;
}

function renderSales() {
  sales = readJson(SALES_KEY, []);
  const rows = filteredSales();
  els.salesEmpty.hidden = rows.length > 0;
  els.salesTableBody.innerHTML = rows.map(sale => {
    const qty = (sale.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const method = sale.payment?.method || "cash";
    return `<tr>
      <td class="sale-id">${escapeHtml(sale.id)}</td>
      <td>${new Date(sale.createdAt).toLocaleString("th-TH")}</td>
      <td class="number">${qty.toLocaleString("th-TH")}</td>
      <td><span class="payment-badge ${method}">${paymentName(method)}</span></td>
      <td class="number">${money(sale.discount)}</td>
      <td class="number"><strong>${money(sale.total)}</strong></td>
      <td><button type="button" class="view-sale" data-sale-id="${escapeHtml(sale.id)}">ดูบิล</button></td>
    </tr>`;
  }).join("");

  renderStats(rows);
  renderBestSellers(rows);
  renderPeriodText();
}

function openSale(id) {
  const sale = sales.find(item => item.id === id);
  if (!sale) return;
  els.receiptSaleId.textContent = sale.id;
  els.receiptDate.textContent = new Date(sale.createdAt).toLocaleString("th-TH");
  const method = sale.payment?.method || "cash";
  els.receiptPayment.textContent = paymentName(method);
  els.receiptItems.innerHTML = (sale.items || []).map(item => `
    <tr>
      <td>${escapeHtml(item.name)}<div class="product-sub">${escapeHtml(item.id || item.barcode || "")}</div></td>
      <td class="number">${Number(item.qty || 0).toLocaleString("th-TH")}</td>
      <td class="number">${money(item.price)}</td>
      <td class="number">${money(Number(item.price || 0) * Number(item.qty || 0))}</td>
    </tr>
  `).join("");
  els.receiptSubtotal.textContent = money(sale.subtotal);
  els.receiptDiscount.textContent = money(sale.discount);
  els.receiptTotal.textContent = money(sale.total);
  const isCash = method === "cash";
  els.receiptReceivedRow.hidden = !isCash;
  els.receiptChangeRow.hidden = !isCash;
  els.receiptReceived.textContent = money(sale.payment?.received);
  els.receiptChange.textContent = money(sale.payment?.change);
  els.saleDialog.showModal();
}

function setToday() {
  const today = localDateKey(new Date());
  els.dateFrom.value = today;
  els.dateTo.value = today;
  renderSales();
}

function setThisMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  els.dateFrom.value = localDateKey(first);
  els.dateTo.value = localDateKey(last);
  renderSales();
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = filteredSales();
  if (!rows.length) {
    alert("ไม่มีข้อมูลสำหรับส่งออก");
    return;
  }

  const lines = [[
    "เลขที่บิล",
    "วันและเวลา",
    "ช่องทางชำระ",
    "จำนวนสินค้า",
    "รวมสินค้า",
    "ส่วนลด",
    "ยอดสุทธิ",
    "รับเงิน",
    "เงินทอน",
    "พนักงาน",
    "เครื่อง POS"
  ]];

  rows.forEach(sale => {
    const qty = (sale.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
    lines.push([
      sale.id,
      new Date(sale.createdAt).toLocaleString("th-TH"),
      paymentName(sale.payment?.method || "cash"),
      qty,
      Number(sale.subtotal || 0).toFixed(2),
      Number(sale.discount || 0).toFixed(2),
      Number(sale.total || 0).toFixed(2),
      Number(sale.payment?.received || 0).toFixed(2),
      Number(sale.payment?.change || 0).toFixed(2),
      sale.cashierName || "",
      sale.terminalCode || ""
    ]);
  });

  const csv = `\uFEFF${lines.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `retail-sales-${els.dateFrom.value || "all"}-${els.dateTo.value || "all"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

els.salesTableBody.addEventListener("click", event => {
  const button = event.target.closest("[data-sale-id]");
  if (button) openSale(button.dataset.saleId);
});

[els.saleSearch, els.dateFrom, els.dateTo, els.paymentFilter].forEach(element => {
  element.addEventListener(element.tagName === "INPUT" ? "input" : "change", renderSales);
});

els.todayBtn.addEventListener("click", setToday);
els.monthBtn.addEventListener("click", setThisMonth);
els.clearFilterBtn.addEventListener("click", () => {
  els.saleSearch.value = "";
  els.dateFrom.value = "";
  els.dateTo.value = "";
  els.paymentFilter.value = "all";
  renderSales();
});
els.exportCsvBtn.addEventListener("click", exportCsv);
els.closeSaleDialog.addEventListener("click", () => els.saleDialog.close());
els.closeSaleBtn.addEventListener("click", () => els.saleDialog.close());
els.printReceiptBtn.addEventListener("click", () => window.print());
window.addEventListener("storage", renderSales);

renderSales();
