import { dataService, usingDemoMode } from "./data-service.js";
import { toast } from "./ui.js";

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';
}

const availableTables = document.querySelector("#availableTables");
const occupiedTables = document.querySelector("#occupiedTables");
const availableCount = document.querySelector("#availableCount");
const occupiedCount = document.querySelector("#occupiedCount");
const issuedQrWrap = document.querySelector("#issuedQrWrap");
const issuedQr = document.querySelector("#issuedQr");
const qrPaperSize = document.querySelector("#qrPaperSize");
let tables = [];

function setPaperSize(value) {
  document.body.classList.remove("qr-size-58", "qr-size-80", "qr-size-a4");
  document.body.classList.add(value === "58" ? "qr-size-58" : value === "a4" ? "qr-size-a4" : "qr-size-80");
  localStorage.setItem("qr_paper_size", value);
}

qrPaperSize.value = localStorage.getItem("qr_paper_size") || "80";
setPaperSize(qrPaperSize.value);
qrPaperSize.addEventListener("change", () => setPaperSize(qrPaperSize.value));

function buildQrImageUrl(value) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(value)}&size=320&margin=1`;
}

async function loadTables() {
  tables = await dataService.listTables();

  const available = tables.filter(table => table.active !== false && (!table.status || table.status === "available"));
  const occupied = tables.filter(table => table.active !== false && table.status === "occupied" && table.orderToken);

  availableCount.textContent = `${available.length} โต๊ะ`;
  occupiedCount.textContent = `${occupied.length} โต๊ะ`;

  availableTables.innerHTML = available.length ? available.map(table => `
    <article class="card">
      <h2 style="margin-top:0">${table.name}</h2>
      <div class="badge">โต๊ะว่าง</div>
      <button class="btn btn-primary" data-issue-table="${table.id}" style="width:100%;margin-top:14px">ออก QR และพิมพ์</button>
    </article>
  `).join("") : '<div class="card empty">ขณะนี้ไม่มีโต๊ะว่าง</div>';

  occupiedTables.innerHTML = occupied.length ? occupied.map(table => `
    <article class="card order-card">
      <h2 style="margin-top:0">${table.name}</h2>
      <div class="badge warning">ออก QR แล้ว</div>
      <p class="menu-category" style="margin-bottom:0">สามารถพิมพ์ซ้ำได้โดยใช้ QR เดิม ไม่สร้าง Token ใหม่</p>
      <button class="btn btn-dark" data-reprint-table="${table.id}" style="width:100%;margin-top:14px">พิมพ์ QR ซ้ำ</button>
    </article>
  `).join("") : '<div class="card empty">ยังไม่มีโต๊ะที่ออก QR</div>';
}

function renderTicket(table, token, autoPrint = true) {
  const tenant = dataService.getActiveShop();
  const tenantSlug = encodeURIComponent(tenant.slug || "");
  const orderUrl = `${location.origin}/s/${tenantSlug}/order/?table=${encodeURIComponent(table.code)}&token=${encodeURIComponent(token)}`;
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
        <div class="qr-ticket-code"><img src="${qrUrl}" width="260" height="260" alt="QR ${table.name}"></div>
        <div class="qr-ticket-rule"></div>
        <div class="qr-ticket-steps">
          <div>1. เปิดกล้องโทรศัพท์</div>
          <div>2. สแกน QR Code</div>
          <div>3. เลือกเมนูและยืนยันออเดอร์</div>
        </div>
        <div class="qr-ticket-footer">QR นี้ใช้สำหรับ ${table.name} เท่านั้น<br>กรุณาตรวจสอบเลขโต๊ะก่อนสั่งอาหาร</div>
      </div>
      <button class="btn btn-dark" id="printIssuedQr" style="margin-top:12px">พิมพ์อีกครั้ง</button>
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
  button.textContent = "กำลังออก QR...";

  try {
    const latestTable = await dataService.getTable(table.id);
    if (!latestTable || (latestTable.status && latestTable.status !== "available")) {
      toast("โต๊ะนี้ไม่ว่างแล้ว กรุณารีเฟรชรายการ", "error");
      await loadTables();
      return;
    }

    const token = crypto.randomUUID();
    await dataService.updateTable(table.id, {
      status: "occupied",
      orderToken: token,
      currentRound: 0,
      sessionStartedAt: new Date().toISOString()
    });

    renderTicket(table, token, true);
    toast(`ออก QR สำหรับ ${table.name} แล้ว`);
    await loadTables();
  } catch (error) {
    console.error(error);
    toast("ออก QR ไม่สำเร็จ", "error");
    button.disabled = false;
    button.textContent = "ออก QR และพิมพ์";
  }
});

occupiedTables.addEventListener("click", async event => {
  const button = event.target.closest("[data-reprint-table]");
  if (!button) return;
  button.disabled = true;
  button.textContent = "กำลังเตรียม QR...";

  try {
    const table = await dataService.getTable(button.dataset.reprintTable);
    if (!table || table.status !== "occupied" || !table.orderToken) {
      toast("QR ของโต๊ะนี้หมดอายุหรือโต๊ะถูกปิดแล้ว", "error");
      await loadTables();
      return;
    }
    renderTicket(table, table.orderToken, true);
    toast(`พิมพ์ QR เดิมของ ${table.name} ซ้ำ`);
  } catch (error) {
    console.error(error);
    toast("เตรียม QR สำหรับพิมพ์ซ้ำไม่สำเร็จ", "error");
  } finally {
    button.disabled = false;
    button.textContent = "พิมพ์ QR ซ้ำ";
  }
});

issuedQr.addEventListener("click", event => {
  if (!event.target.closest("#printIssuedQr")) return;
  document.body.classList.add("qr-printing");
  window.print();
});

window.addEventListener("afterprint", () => document.body.classList.remove("qr-printing"));

await loadTables();
