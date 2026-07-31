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
  link.classList.toggle("is-open", Boolean(shift));
  link.innerHTML = shift
    ? `<i class="bi bi-clock-history" aria-hidden="true"></i><span>กะ: ${escapeHtml(shift.cashierName || "-")}</span>`
    : '<i class="bi bi-play-circle" aria-hidden="true"></i><span>เปิดกะ</span>';
  link.setAttribute("aria-label", shift ? `กะกำลังเปิดโดย ${shift.cashierName || "-"}` : "เปิดกะ");
  link.title = shift ? `${shift.terminalCode} • เปิดเมื่อ ${new Date(shift.openedAt).toLocaleString("th-TH")}` : "ยังไม่ได้เปิดกะ";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
