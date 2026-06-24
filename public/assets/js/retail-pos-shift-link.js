const SHIFT_KEY = "retail_pos_active_shift_v1";
const SALES_KEY = "retail_pos_sales_v1";

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function activeShift() {
  return readJson(SHIFT_KEY, null);
}

function ensureShiftNavigation() {
  const actions = document.querySelector(".header-actions");
  if (!actions || document.querySelector("#shiftNavLink")) return;
  const link = document.createElement("a");
  link.id = "shiftNavLink";
  link.href = "/pos/shifts";
  link.className = "btn btn-secondary header-link";
  actions.prepend(link);
  renderShiftNavigation();
}

function renderShiftNavigation() {
  const link = document.querySelector("#shiftNavLink");
  if (!link) return;
  const shift = activeShift();
  link.textContent = shift ? `กะ: ${shift.cashierName}` : "เปิดกะ";
  link.title = shift ? `${shift.terminalCode} • เปิดเมื่อ ${new Date(shift.openedAt).toLocaleString("th-TH")}` : "ยังไม่ได้เปิดกะ";
}

function tagLatestSale() {
  const shift = activeShift();
  if (!shift) return;
  const sales = readJson(SALES_KEY, []);
  if (!sales.length || sales[0].shiftId) return;
  sales[0] = {
    ...sales[0],
    shiftId: shift.id,
    cashierName: shift.cashierName,
    terminalCode: shift.terminalCode
  };
  localStorage.setItem(SALES_KEY, JSON.stringify(sales));
}

const confirmButton = document.querySelector("#confirmPaymentBtn");
confirmButton?.addEventListener("click", () => setTimeout(tagLatestSale, 80), { capture: true });
window.addEventListener("storage", renderShiftNavigation);
ensureShiftNavigation();
