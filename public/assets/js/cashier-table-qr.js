import { dataService, usingDemoMode } from "./data-service.js";
import { toast } from "./ui.js";

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';
}

const availableTables = document.querySelector("#availableTables");
const issuedQrWrap = document.querySelector("#issuedQrWrap");
const issuedQr = document.querySelector("#issuedQr");
let tables = [];

function buildQrImageUrl(value) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(value)}&size=320&margin=1`;
}

async function loadTables() {
  tables = await dataService.listTables();
  const available = tables.filter(table =>
    table.active !== false &&
    (!table.status || table.status === "available")
  );

  availableTables.innerHTML = available.length ? available.map(table => `
    <article class="card">
      <h2 style="margin-top:0">${table.name}</h2>
      <div class="badge">โต๊ะว่าง</div>
      <button class="btn btn-primary" data-issue-table="${table.id}" style="width:100%;margin-top:14px">
        ออก QR และพิมพ์
      </button>
    </article>
  `).join("") : '<div class="card empty">ขณะนี้ไม่มีโต๊ะว่าง</div>';
}

function renderTicket(table, token) {
  const orderUrl = `${location.origin}/order/?table=${encodeURIComponent(table.code)}&token=${encodeURIComponent(token)}`;
  const qrUrl = buildQrImageUrl(orderUrl);

  issuedQr.innerHTML = `
    <article class="card qr-card print-target">
      <div class="qr-ticket">
        <div class="qr-ticket-header">
          <div class="qr-ticket-brand">FOOD ORDER QR</div>
          <div class="qr-ticket-title">สแกนเพื่อสั่งอาหาร</div>
          <div class="qr-ticket-table">${table.name}</div>
        </div>
        <div class="qr-ticket-rule"></div>
        <div class="qr-ticket-code">
          <img src="${qrUrl}" width="260" height="260" alt="QR ${table.name}">
        </div>
        <div class="qr-ticket-rule"></div>
        <div class="qr-ticket-steps">
          <div>1. เปิดกล้องโทรศัพท์</div>
          <div>2. สแกน QR Code</div>
          <div>3. เลือกเมนูและยืนยันออเดอร์</div>
        </div>
        <div class="qr-ticket-footer">
          QR นี้ใช้สำหรับ ${table.name} เท่านั้น<br>
          กรุณาตรวจสอบเลขโต๊ะก่อนสั่งอาหาร
        </div>
      </div>
      <button class="btn btn-dark" id="printIssuedQr" style="margin-top:12px">พิมพ์อีกครั้ง</button>
    </article>
  `;

  issuedQrWrap.hidden = false;
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
  button.textContent = "กำลังออก QR...";

  try {
    const token = crypto.randomUUID();
    await dataService.updateTable(table.id, {
      status: "occupied",
      orderToken: token,
      sessionStartedAt: new Date().toISOString()
    });
    renderTicket(table, token);
    toast(`ออก QR สำหรับ ${table.name} แล้ว`);
    await loadTables();
  } catch (error) {
    console.error(error);
    toast("ออก QR ไม่สำเร็จ", "error");
  }
});

issuedQr.addEventListener("click", event => {
  if (!event.target.closest("#printIssuedQr")) return;
  document.body.classList.add("qr-printing");
  window.print();
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("qr-printing");
});

await loadTables();
