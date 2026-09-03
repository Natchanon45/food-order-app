import { dataService, usingDemoMode } from "./data-service.js?v=20260903-203";
import { qrDataUrl } from "./local-qr.js?v=20260722-037";
import translations from "./admin-qr-translations.js?v=20260903-204";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";

configureI18n(translations);
applyTranslations();
document.title = t("admin_qr.meta.title");

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = `<div class="demo-banner">${t("admin_qr.demo")}</div>`;
}

const baseUrl = document.querySelector("#baseUrl");
const root = document.querySelector("#qrGrid");

function tenantBaseUrl() {
  const tenant = dataService.getActiveShop();
  if (!tenant?.slug) throw new Error("TENANT_SLUG_MISSING");
  return `${location.origin}/s/${encodeURIComponent(tenant.slug)}/`;
}

baseUrl.value = tenantBaseUrl();
baseUrl.readOnly = true;

function buildQrImageUrl(value) {
  return qrDataUrl(value, { size: 320, margin: 4 });
}

function clearPrintTarget() {
  document.body.classList.remove("qr-printing");
  document.querySelectorAll(".qr-card.print-target").forEach(card => {
    card.classList.remove("print-target");
  });
}

async function render() {
  root.innerHTML = `<div class="card empty">${t("admin_qr.states.loading")}</div>`;

  try {
    const tables = await dataService.listTables();
    const activeTables = tables.filter(table => table.active !== false);

    if (!activeTables.length) {
      root.innerHTML = `<div class="card empty">${t("admin_qr.states.no_tables")}</div>`;
      return;
    }

    const shopRoot = tenantBaseUrl();
    baseUrl.value = shopRoot;

    root.innerHTML = activeTables.map(table => {
      const orderUrl = `${shopRoot}order/?table=${encodeURIComponent(table.code)}`;
      const qrUrl = buildQrImageUrl(orderUrl);

      return `
        <article class="card qr-card">
          <div class="qr-ticket">
            <div class="qr-ticket-header">
              <div class="qr-ticket-brand">FOOD ORDER QR</div>
              <div class="qr-ticket-title">${t("admin_qr.ticket.scan_to_order")}</div>
              <div class="qr-ticket-table">${table.name}</div>
            </div>

            <div class="qr-ticket-rule"></div>

            <div class="qr-ticket-code">
              <img src="${qrUrl}" width="260" height="260" alt="QR ${table.name}">
            </div>

            <div class="qr-ticket-rule"></div>

            <div class="qr-ticket-steps">
              <div>${t("admin_qr.ticket.step_camera")}</div>
              <div>${t("admin_qr.ticket.step_scan")}</div>
              <div>${t("admin_qr.ticket.step_order")}</div>
            </div>

            <div class="qr-ticket-footer">
              ${t("admin_qr.ticket.check_table")}<br>
              ${t("admin_qr.ticket.thanks")}
            </div>
          </div>

          <small class="qr-ticket-url">${orderUrl}</small>
          <button class="btn btn-dark btn-sm" data-print-card>${t("admin_qr.ticket.print")}</button>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    root.innerHTML = `<div class="card empty">${t("admin_qr.states.error")}</div>`;
  }
}

root.addEventListener("click", event => {
  const button = event.target.closest("[data-print-card]");
  if (!button) return;

  clearPrintTarget();
  const card = button.closest(".qr-card");
  card.classList.add("print-target");
  document.body.classList.add("qr-printing");

  requestAnimationFrame(() => window.print());
});

window.addEventListener("afterprint", clearPrintTarget);
await render();
