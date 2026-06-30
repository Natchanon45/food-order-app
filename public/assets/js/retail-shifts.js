import { auth, db, doc, setDoc, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { getTenantId, watchRecords, RetailCollections } from './retail-db.js?v=20260629-032';

const SHIFT_KEY = "retail_pos_active_shift_v1";
const SHIFT_HISTORY_KEY = "retail_pos_shift_history_v1";
const SALES_KEY = "retail_pos_sales_v1";

const els = {
  noActiveShift: document.querySelector("#noActiveShift"),
  activeShiftPanel: document.querySelector("#activeShiftPanel"),
  openShiftForm: document.querySelector("#openShiftForm"),
  cashierName: document.querySelector("#cashierName"),
  terminalCode: document.querySelector("#terminalCode"),
  openingCash: document.querySelector("#openingCash"),
  openNote: document.querySelector("#openNote"),
  openShiftError: document.querySelector("#openShiftError"),
  activeShiftMeta: document.querySelector("#activeShiftMeta"),
  openingCashDisplay: document.querySelector("#openingCashDisplay"),
  shiftSalesTotal: document.querySelector("#shiftSalesTotal"),
  shiftCashSales: document.querySelector("#shiftCashSales"),
  shiftTransferSales: document.querySelector("#shiftTransferSales"),
  shiftBillCount: document.querySelector("#shiftBillCount"),
  expectedCash: document.querySelector("#expectedCash"),
  closeShiftForm: document.querySelector("#closeShiftForm"),
  actualCash: document.querySelector("#actualCash"),
  closeNote: document.querySelector("#closeNote"),
  cashDifference: document.querySelector("#cashDifference"),
  closeShiftError: document.querySelector("#closeShiftError"),
  differenceBox: document.querySelector(".difference-box"),
  shiftHistoryBody: document.querySelector("#shiftHistoryBody"),
  shiftHistoryEmpty: document.querySelector("#shiftHistoryEmpty"),
  clearShiftHistory: document.querySelector("#clearShiftHistory"),
  toast: document.querySelector("#toast")
};

let toastTimer;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function safeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `shift-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function activeShift() {
  return readJson(SHIFT_KEY, null);
}

function salesForShift(shift) {
  if (!shift) return [];
  const sales = readJson(SALES_KEY, []);
  return sales.filter(sale => sale.shiftId === shift.id || (!sale.shiftId && new Date(sale.createdAt) >= new Date(shift.openedAt)));
}

function shiftTotals(shift) {
  const sales = salesForShift(shift);
  const total = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const cash = sales.filter(sale => sale.payment?.method === "cash").reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const transfer = sales.filter(sale => sale.payment?.method !== "cash").reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const expectedCash = Number(shift?.openingCash || 0) + cash;
  return { sales, total, cash, transfer, expectedCash };
}

function renderActiveShift() {
  const shift = activeShift();
  els.noActiveShift.hidden = Boolean(shift);
  els.activeShiftPanel.hidden = !shift;
  if (!shift) return;

  const totals = shiftTotals(shift);
  els.activeShiftMeta.textContent = `${shift.cashierName} • ${shift.terminalCode} • เปิดเมื่อ ${new Date(shift.openedAt).toLocaleString("th-TH")}`;
  els.openingCashDisplay.textContent = money(shift.openingCash);
  els.shiftSalesTotal.textContent = money(totals.total);
  els.shiftCashSales.textContent = money(totals.cash);
  els.shiftTransferSales.textContent = money(totals.transfer);
  els.shiftBillCount.textContent = totals.sales.length.toLocaleString("th-TH");
  els.expectedCash.textContent = money(totals.expectedCash);
  if (!els.actualCash.value) els.actualCash.value = totals.expectedCash.toFixed(2);
  updateDifference();
}

function updateDifference() {
  const shift = activeShift();
  if (!shift) return;
  const totals = shiftTotals(shift);
  const actual = Number(els.actualCash.value || 0);
  const difference = actual - totals.expectedCash;
  els.cashDifference.textContent = money(difference);
  els.differenceBox.classList.toggle("positive", difference > 0);
  els.differenceBox.classList.toggle("negative", difference < 0);
}

async function openShift(event) {
  event.preventDefault();
  if (activeShift()) {
    els.openShiftError.textContent = "มีกะที่เปิดใช้งานอยู่แล้ว";
    return;
  }
  const cashierName = els.cashierName.value.trim();
  const terminalCode = els.terminalCode.value.trim();
  const openingCash = Number(els.openingCash.value);
  if (!cashierName || !terminalCode || !Number.isFinite(openingCash) || openingCash < 0) {
    els.openShiftError.textContent = "กรุณากรอกข้อมูลเปิดกะให้ครบและถูกต้อง";
    return;
  }
  const shift = {
    id: safeId(),
    cashierName,
    terminalCode,
    openingCash,
    openNote: els.openNote.value.trim(),
    openedAt: new Date().toISOString(),
    status: "open",
    tenantId: getTenantId(),
    createdBy: auth?.currentUser?.uid || "",
    updatedAt: Date.now()
  };
  try {
    await setDoc(doc(db, "tenants", getTenantId(), RetailCollections.shifts, shift.id), {
      ...shift, openedAtServer: serverTimestamp(), updatedAtServer: serverTimestamp()
    });
    writeJson(SHIFT_KEY, shift);
  } catch (error) {
    console.error("[retail-shifts] open failed", error);
    els.openShiftError.textContent = "เปิดกะใน Firebase ไม่สำเร็จ กรุณาลองใหม่";
    return;
  }
  els.openShiftForm.reset();
  els.terminalCode.value = "POS-01";
  els.openingCash.value = "0";
  els.openShiftError.textContent = "";
  renderActiveShift();
  showToast("เปิดกะเรียบร้อยแล้ว");
}

async function closeShift(event) {
  event.preventDefault();
  const shift = activeShift();
  if (!shift) return;
  const actualCash = Number(els.actualCash.value);
  if (!Number.isFinite(actualCash) || actualCash < 0) {
    els.closeShiftError.textContent = "กรุณากรอกเงินสดนับจริงให้ถูกต้อง";
    return;
  }
  const totals = shiftTotals(shift);
  const closed = {
    ...shift,
    status: "closed",
    closedAt: new Date().toISOString(),
    closeNote: els.closeNote.value.trim(),
    billCount: totals.sales.length,
    salesTotal: totals.total,
    cashSales: totals.cash,
    transferSales: totals.transfer,
    expectedCash: totals.expectedCash,
    actualCash,
    cashDifference: actualCash - totals.expectedCash,
    updatedAt: Date.now(),
    closedBy: auth?.currentUser?.uid || ""
  };
  try {
    await setDoc(doc(db, "tenants", getTenantId(), RetailCollections.shifts, shift._documentId || shift.id), {
      ...closed, closedAtServer: serverTimestamp(), updatedAtServer: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("[retail-shifts] close failed", error);
    els.closeShiftError.textContent = "ปิดกะใน Firebase ไม่สำเร็จ กรุณาลองใหม่";
    return;
  }
  const history = readJson(SHIFT_HISTORY_KEY, []);
  history.unshift(closed);
  writeJson(SHIFT_HISTORY_KEY, history.slice(0, 100));
  localStorage.removeItem(SHIFT_KEY);
  els.closeShiftForm.reset();
  els.closeShiftError.textContent = "";
  renderActiveShift();
  renderHistory();
  showToast("ปิดกะเรียบร้อยแล้ว");
}

function renderHistory() {
  const history = readJson(SHIFT_HISTORY_KEY, []).slice(0, 30);
  els.shiftHistoryEmpty.hidden = history.length > 0;
  els.shiftHistoryBody.innerHTML = history.map(shift => {
    const diff = Number(shift.cashDifference || 0);
    const diffClass = diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "";
    return `<tr>
      <td><strong>${shift.cashierName}</strong><div class="product-sub">${shift.terminalCode}</div></td>
      <td>${new Date(shift.openedAt).toLocaleString("th-TH")}</td>
      <td>${shift.closedAt ? new Date(shift.closedAt).toLocaleString("th-TH") : "-"}</td>
      <td class="number">${money(shift.salesTotal)}</td>
      <td class="number">${money(shift.actualCash)}</td>
      <td class="number ${diffClass}">${money(diff)}</td>
    </tr>`;
  }).join("");
}

els.openShiftForm.addEventListener("submit", openShift);
els.closeShiftForm.addEventListener("submit", closeShift);
els.actualCash.addEventListener("input", updateDifference);
els.clearShiftHistory.addEventListener("click", () => {
  const history = readJson(SHIFT_HISTORY_KEY, []);
  if (!history.length || !confirm("ล้างประวัติกะทั้งหมดในเครื่องนี้หรือไม่?")) return;
  writeJson(SHIFT_HISTORY_KEY, []);
  renderHistory();
  showToast("ล้างประวัติกะแล้ว");
});
window.addEventListener("storage", () => { renderActiveShift(); renderHistory(); });
renderActiveShift();
renderHistory();

const stopSalesWatch = watchRecords(RetailCollections.sales, rows => {
  writeJson(SALES_KEY, rows);
  document.documentElement.dataset.shiftSalesSource = "firestore";
  window.dispatchEvent(new Event("storage"));
}, { sortBy: "createdAt", direction: "desc" });
const stopShiftsWatch = watchRecords(RetailCollections.shifts, rows => {
  const uid = auth?.currentUser?.uid || "";
  const active = rows.find(row => row.status === "open" && (!uid || row.createdBy === uid)) || null;
  const history = rows.filter(row => row.status === "closed");
  if (active) writeJson(SHIFT_KEY, active); else localStorage.removeItem(SHIFT_KEY);
  writeJson(SHIFT_HISTORY_KEY, history);
  document.documentElement.dataset.shiftsSource = "firestore";
  renderActiveShift();
  renderHistory();
}, { sortBy: "updatedAt", direction: "desc" });
window.addEventListener("beforeunload", () => { stopSalesWatch(); stopShiftsWatch(); }, { once: true });
