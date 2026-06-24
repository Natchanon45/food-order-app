const SALES_KEY = "retail_pos_sales_v1";

const salesStats = document.querySelector(".sales-stats");
const reportGrid = document.querySelector(".report-grid");
const saleSearch = document.querySelector("#saleSearch");
const dateFrom = document.querySelector("#dateFrom");
const dateTo = document.querySelector("#dateTo");
const paymentFilter = document.querySelector("#paymentFilter");
const todayBtn = document.querySelector("#todayBtn");
const monthBtn = document.querySelector("#monthBtn");
const clearFilterBtn = document.querySelector("#clearFilterBtn");
const salesTableBody = document.querySelector("#salesTableBody");

salesStats?.insertAdjacentHTML("beforeend", `
  <article class="stat-card profit-stat">
    <span>ต้นทุนสินค้าที่ขาย</span>
    <strong id="costOfGoodsTotal">0.00</strong>
  </article>
  <article class="stat-card profit-stat">
    <span>กำไรขั้นต้น</span>
    <strong id="grossProfitTotal">0.00</strong>
  </article>
  <article class="stat-card profit-stat">
    <span>อัตรากำไรขั้นต้น</span>
    <strong id="grossMarginPercent">0.0%</strong>
  </article>
`);

const profitPanel = document.createElement("section");
profitPanel.className = "panel profit-panel";
profitPanel.innerHTML = `
  <div class="section-heading">
    <div>
      <h2>สินค้าที่ทำกำไรสูงสุด</h2>
      <p>คำนวณจากราคาขายลบต้นทุนในช่วงที่เลือก</p>
    </div>
  </div>
  <div id="profitRankingList" class="ranking-list"></div>
  <div id="profitRankingEmpty" class="empty-state" hidden>ยังไม่มีข้อมูลต้นทุนสำหรับช่วงนี้</div>
  <p id="missingCostNote" class="missing-cost-note" hidden></p>
`;
reportGrid?.insertAdjacentElement("afterend", profitPanel);

document.querySelector(".receipt-summary")?.insertAdjacentHTML("beforeend", `
  <div id="receiptProfitRow" class="receipt-profit-row" hidden>
    <span>กำไรขั้นต้น</span>
    <strong id="receiptGrossProfit">0.00</strong>
  </div>
  <p id="receiptProfitNote" class="receipt-profit-note" hidden></p>
`);

const els = {
  costOfGoodsTotal: document.querySelector("#costOfGoodsTotal"),
  grossProfitTotal: document.querySelector("#grossProfitTotal"),
  grossMarginPercent: document.querySelector("#grossMarginPercent"),
  profitRankingList: document.querySelector("#profitRankingList"),
  profitRankingEmpty: document.querySelector("#profitRankingEmpty"),
  missingCostNote: document.querySelector("#missingCostNote"),
  receiptProfitRow: document.querySelector("#receiptProfitRow"),
  receiptGrossProfit: document.querySelector("#receiptGrossProfit"),
  receiptProfitNote: document.querySelector("#receiptProfitNote")
};

function readSales() {
  try { return JSON.parse(localStorage.getItem(SALES_KEY)) || []; }
  catch { return []; }
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

function filteredSales() {
  const keyword = saleSearch?.value.trim().toLowerCase() || "";
  const from = dateFrom?.value || "";
  const to = dateTo?.value || "";
  const method = paymentFilter?.value || "all";

  return readSales().filter(sale => {
    const date = localDateKey(sale.createdAt);
    const items = (sale.items || []).map(item => `${item.name || ""} ${item.id || ""} ${item.barcode || ""}`).join(" ").toLowerCase();
    const matchesKeyword = !keyword || String(sale.id || "").toLowerCase().includes(keyword) || items.includes(keyword);
    const matchesFrom = !from || date >= from;
    const matchesTo = !to || date <= to;
    const matchesMethod = method === "all" || sale.payment?.method === method;
    return matchesKeyword && matchesFrom && matchesTo && matchesMethod;
  });
}

function calculateProfit(rows) {
  const products = new Map();
  let costTotal = 0;
  let grossProfit = 0;
  let coveredRevenue = 0;
  let missingItemCount = 0;

  rows.forEach(sale => {
    (sale.items || []).forEach(item => {
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const hasCost = item.cost !== null && item.cost !== undefined && Number.isFinite(Number(item.cost));
      if (!hasCost) {
        missingItemCount += qty;
        return;
      }

      const cost = Number(item.cost);
      const revenue = price * qty;
      const totalCost = cost * qty;
      const profit = revenue - totalCost;
      costTotal += totalCost;
      grossProfit += profit;
      coveredRevenue += revenue;

      const key = String(item.id || item.barcode || item.name || "ไม่ทราบสินค้า");
      const current = products.get(key) || {
        id: item.id || item.barcode || "-",
        name: item.name || "ไม่ทราบสินค้า",
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0
      };
      current.qty += qty;
      current.revenue += revenue;
      current.cost += totalCost;
      current.profit += profit;
      products.set(key, current);
    });
  });

  return {
    costTotal,
    grossProfit,
    grossMargin: coveredRevenue > 0 ? (grossProfit / coveredRevenue) * 100 : 0,
    missingItemCount,
    ranking: [...products.values()].sort((a, b) => b.profit - a.profit || b.revenue - a.revenue)
  };
}

function renderProfit() {
  const result = calculateProfit(filteredSales());
  els.costOfGoodsTotal.textContent = money(result.costTotal);
  els.grossProfitTotal.textContent = money(result.grossProfit);
  els.grossMarginPercent.textContent = `${result.grossMargin.toFixed(1)}%`;

  const ranking = result.ranking.slice(0, 10);
  els.profitRankingEmpty.hidden = ranking.length > 0;
  els.profitRankingList.innerHTML = ranking.map((item, index) => `
    <article class="ranking-item profit-ranking-item">
      <div class="ranking-position">${index + 1}</div>
      <div class="ranking-info">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.id)} • ขาย ${item.qty.toLocaleString("th-TH")} ชิ้น</span>
      </div>
      <div class="ranking-total">
        <strong>กำไร ${money(item.profit)}</strong>
        <span>ยอดขาย ${money(item.revenue)} • ทุน ${money(item.cost)}</span>
      </div>
    </article>
  `).join("");

  els.missingCostNote.hidden = result.missingItemCount <= 0;
  els.missingCostNote.textContent = result.missingItemCount > 0
    ? `มีสินค้าขายแล้ว ${result.missingItemCount.toLocaleString("th-TH")} ชิ้นที่ยังไม่มีข้อมูลต้นทุน จึงยังไม่รวมในกำไรขั้นต้น`
    : "";
}

function renderSaleProfit(saleId) {
  const sale = readSales().find(item => item.id === saleId);
  if (!sale) return;
  const result = calculateProfit([sale]);
  const hasCoveredItems = result.ranking.length > 0;
  els.receiptProfitRow.hidden = !hasCoveredItems;
  els.receiptGrossProfit.textContent = money(result.grossProfit);
  els.receiptProfitNote.hidden = result.missingItemCount <= 0;
  els.receiptProfitNote.textContent = result.missingItemCount > 0
    ? `บิลนี้มี ${result.missingItemCount.toLocaleString("th-TH")} ชิ้นที่ไม่มีข้อมูลต้นทุน`
    : "";
}

[saleSearch, dateFrom, dateTo, paymentFilter].forEach(element => {
  element?.addEventListener(element.tagName === "INPUT" ? "input" : "change", renderProfit);
});
[todayBtn, monthBtn, clearFilterBtn].forEach(button => button?.addEventListener("click", () => setTimeout(renderProfit, 0)));
salesTableBody?.addEventListener("click", event => {
  const button = event.target.closest("[data-sale-id]");
  if (button) renderSaleProfit(button.dataset.saleId);
}, true);
window.addEventListener("storage", renderProfit);

renderProfit();
