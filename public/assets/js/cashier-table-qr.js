import "./sweet-dialog.js?v=20260726-034";
import "./cashier-table-close-guard.js?v=20260812-122";
import { dataService, usingDemoMode } from "./data-service.js?v=20260718-021";
import { toast } from "./ui.js?v=20260805-081";
import { qrDataUrl } from "./local-qr.js?v=20260722-037";
import { t } from "./i18n.js?v=20260812-099";

if (!document.querySelector('link[href*="sweet-dialog.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/sweet-dialog.css?v=20260726-034";
  document.head.appendChild(link);
}

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = `<div class="demo-banner">${t("cashier_documents.table_qr.demo")}</div>`;
}

const availableTables = document.querySelector("#availableTables");
const occupiedTables = document.querySelector("#occupiedTables");
const availableCount = document.querySelector("#availableCount");
const occupiedCount = document.querySelector("#occupiedCount");
const issuedQrWrap = document.querySelector("#issuedQrWrap");
const issuedQr = document.querySelector("#issuedQr");
const qrPaperSize = document.querySelector("#qrPaperSize");
let tables = [];
let currentOrders = [];

function closeTableButtonMarkup(label = t("cashier_documents.table_qr.close_table")) {
  return `<i class="bi bi-door-closed app-icon" aria-hidden="true"></i><span>${label}</span>`;
}

function reprintTableButtonMarkup(label = t("cashier_documents.table_qr.reprint")) {
  return `<i class="bi bi-printer app-icon" aria-hidden="true"></i><span>${label}</span>`;
}

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function setPaperSize(value) {
  document.body.classList.remove("qr-size-58", "qr-size-80", "qr-size-a4");
  document.body.classList.add(value === "58" ? "qr-size-58" : value === "a4" ? "qr-size-a4" : "qr-size-80");
  localStorage.setItem("qr_paper_size", value);
}

qrPaperSize.value = localStorage.getItem("qr_paper_size") || "80";
setPaperSize(qrPaperSize.value);
qrPaperSize.addEventListener("change", () => setPaperSize(qrPaperSize.value));

function buildQrImageUrl(value) {
  return qrDataUrl(value, { size: 320, margin: 4 });
}

function buildTableOrderUrl(tenantSlug, tableCode, token) {
  const orderUrl = new URL(`/s/${encodeURIComponent(tenantSlug)}/order/`, location.origin);
  orderUrl.searchParams.set("table", tableCode);
  orderUrl.searchParams.set("token", token);
  return orderUrl.toString();
}

function createOrderToken() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function qrErrorMessage(error) {
  const code = String(error?.code || error?.message || "UNKNOWN_ERROR");
  if (code.includes("TABLE_HAS_UNPAID_ORDERS")) return t("cashier_documents.table_qr.unpaid_orders");
  if (code.includes("permission-denied")) return t("cashier_documents.table_qr.permission_denied");
  if (code.includes("TENANT_CONTEXT_REQUIRED") || code.includes("TENANT_NOT_RESOLVED")) return t("cashier_documents.table_qr.tenant_missing");
  if (code.includes("not-found")) return t("cashier_documents.table_qr.table_not_found");
  return t("cashier_documents.table_qr.qr_failed", { code });
}

function hasUnpaidTableOrders(table) {
  const tableCode = String(table?.code || table?.id || "");
  const tableToken = String(table?.orderToken || "");
  return currentOrders.some(order => {
    if (order?.orderType === "delivery") return false;
    if (["paid", "cancelled"].includes(order?.status)) return false;
    if (order?.paymentStatus === "paid") return false;
    const sameToken = tableToken && String(order?.tableToken || "") === tableToken;
    const sameTable = tableCode && String(order?.tableCode || "") === tableCode;
    return sameToken || sameTable;
  });
}

async function loadTables() {
  tables = await dataService.listTables();

  const available = tables.filter(table => table.active !== false && (!table.status || table.status === "available"));
  const occupied = tables.filter(table => table.active !== false && table.status === "occupied" && table.orderToken);

  availableCount.textContent = t("cashier_documents.table_qr.table_count", { count: available.length });
  occupiedCount.textContent = t("cashier_documents.table_qr.table_count", { count: occupied.length });

  availableTables.innerHTML = available.length ? available.map(table => `
    <article class="card">
      <h2 style="margin-top:0">${table.name}</h2>
      <div class="badge">${t("cashier_documents.table_qr.status_available")}</div>
      <button class="btn btn-primary" data-issue-table="${table.id}" style="width:100%;margin-top:14px">${t("cashier_documents.table_qr.issue_print")}</button>
    </article>
  `).join("") : `<div class="card empty">${t("cashier_documents.table_qr.no_available_tables")}</div>`;

  occupiedTables.innerHTML = occupied.length ? occupied.map(table => `
    <article class="card order-card">
      <h2 style="margin-top:0">${table.name}</h2>
      <div class="badge warning">${t("cashier_documents.table_qr.status_issued")}</div>
      <p class="menu-category" style="margin-bottom:0">${t("cashier_documents.table_qr.occupied_help")}</p>
      <div class="order-actions" style="margin-top:14px">
        <button class="btn btn-dark" data-reprint-table="${table.id}">${reprintTableButtonMarkup()}</button>
        <button class="btn btn-danger" data-close-table="${table.id}">${closeTableButtonMarkup()}</button>
      </div>
    </article>
  `).join("") : `<div class="card empty">${t("cashier_documents.table_qr.no_issued_tables")}</div>`;
}

function renderTicket(table, token, autoPrint = true) {
  const tenant = dataService.getActiveShop();
  const orderUrl = buildTableOrderUrl(tenant.slug || "", table.code || "", token || "");
  const qrUrl = buildQrImageUrl(orderUrl);

  issuedQr.innerHTML = `
    <article class="card qr-card print-target">
      <div class="qr-ticket">
        <div class="qr-ticket-header">
          <div class="qr-ticket-brand">FOOD ORDER QR</div>
          <div class="qr-ticket-title">${t("cashier_documents.table_qr.ticket_title")}</div>
          <div class="qr-ticket-table">${table.name}</div>
        </div>
        <div class="qr-ticket-rule"></div>
        <div class="qr-ticket-code"><img src="${qrUrl}" width="260" height="260" alt="${t("cashier_documents.table_qr.qr_alt", { table: table.name })}"></div>
        <div class="qr-ticket-rule"></div>
        <div class="qr-ticket-steps">
          <div>${t("cashier_documents.table_qr.ticket_step_camera")}</div>
          <div>${t("cashier_documents.table_qr.ticket_step_scan")}</div>
          <div>${t("cashier_documents.table_qr.ticket_step_order")}</div>
        </div>
        <div class="qr-ticket-footer">${t("cashier_documents.table_qr.ticket_footer", { table: table.name })}<br>${t("cashier_documents.table_qr.ticket_footer_check")}</div>
      </div>
      <button class="btn btn-dark" id="printIssuedQr" style="margin-top:12px">${t("cashier_documents.table_qr.print_again")}</button>
    </article>
  `;

  issuedQrWrap.hidden = false;
  issuedQrWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  if (!autoPrint) return;

  document.body.classList.add("qr-printing");
  const image = issuedQr.querySelector("img");
  const printNow = () => requestAnimationFrame(() => window.print());
  if (image.complete) printNow();
  else image.addEventListener("load", printNow, { once: true });
}

availableTables.addEventListener("click", async event => {
  const button = event.target.closest("[data-issue-table]");
  if (!button) return;
  const table = tables.find(item => item.id === button.dataset.issueTable);
  if (!table) return;

  button.disabled = true;
  button.textContent = t("cashier_documents.table_qr.issuing");

  try {
    const latestTable = await dataService.getTable(table.id);
    if (!latestTable || (latestTable.status && latestTable.status !== "available")) {
      toast(t("cashier_documents.table_qr.table_unavailable"), "error");
      await loadTables();
      return;
    }

    const token = createOrderToken();
    await dataService.updateTable(table.id, {
      status: "occupied",
      orderToken: token,
      currentRound: 0,
      orderIds: [],
      sessionStartedAt: new Date().toISOString()
    });

    renderTicket(table, token, true);
    await loadTables();
  } catch (error) {
    console.error("TABLE_QR_ISSUE_FAILED", error);
    toast(qrErrorMessage(error), "error");
    button.disabled = false;
    button.textContent = t("cashier_documents.table_qr.issue_print");
  }
});

occupiedTables.addEventListener("click", async event => {
  const closeButton = event.target.closest("[data-close-table]");
  if (closeButton) {
    const table = tables.find(item => item.id === closeButton.dataset.closeTable);
    if (!table) return;

    const latestTable = await dataService.getTable(table.id);
    const targetTable = latestTable || table;
    if (hasUnpaidTableOrders(targetTable)) {
      toast(t("cashier_documents.table_qr.unpaid_orders"), "error");
      return;
    }

    const ok = await askConfirm(`${t("cashier_documents.table_qr.close_confirm_message", { table: table.name })}\n\n${t("cashier_documents.table_qr.close_confirm_warning")}`, {
      title: t("cashier_documents.table_qr.close_confirm_title"),
      confirmText: t("cashier.common.confirm"),
      cancelText: t("cashier.common.cancel"),
      type: "warning"
    });
    if (!ok) return;

    closeButton.disabled = true;
    closeButton.innerHTML = closeTableButtonMarkup(t("cashier_documents.table_qr.closing"));

    try {
      await dataService.updateTable(table.id, {
        status: "available",
        orderToken: "",
        sessionStartedAt: null,
        currentRound: 0,
        orderIds: []
      });
      toast(t("cashier_documents.table_qr.close_success", { table: table.name }));
      await loadTables();
    } catch (error) {
      console.error("TABLE_CLOSE_FAILED", error);
      toast(qrErrorMessage(error), "error");
      closeButton.disabled = false;
      closeButton.innerHTML = closeTableButtonMarkup();
    }
    return;
  }

  const button = event.target.closest("[data-reprint-table]");
  if (!button) return;
  button.disabled = true;
  button.innerHTML = reprintTableButtonMarkup(t("cashier_documents.table_qr.reprint_preparing"));

  try {
    const table = await dataService.getTable(button.dataset.reprintTable);
    if (!table || table.status !== "occupied" || !table.orderToken) {
      toast(t("cashier_documents.table_qr.expired"), "error");
      await loadTables();
      return;
    }
    renderTicket(table, table.orderToken, true);
  } catch (error) {
    console.error("TABLE_QR_REPRINT_FAILED", error);
    toast(qrErrorMessage(error), "error");
  } finally {
    button.disabled = false;
    button.innerHTML = reprintTableButtonMarkup();
  }
});

issuedQr.addEventListener("click", event => {
  if (!event.target.closest("#printIssuedQr")) return;
  document.body.classList.add("qr-printing");
  window.print();
});

window.addEventListener("afterprint", () => document.body.classList.remove("qr-printing"));

dataService.subscribeOrders(orders => {
  currentOrders = orders || [];
});

await loadTables();
