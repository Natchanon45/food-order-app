import { dataService, usingDemoMode } from "./data-service.js";

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';
}

const baseUrl = document.querySelector("#baseUrl");
const root = document.querySelector("#qrGrid");
baseUrl.value = location.origin === "null" ? "https://chat-45754.web.app" : location.origin;

function buildQrImageUrl(value) {
  const encoded = encodeURIComponent(value);
  return `https://quickchart.io/qr?text=${encoded}&size=320&margin=1`;
}

function clearPrintTarget() {
  document.body.classList.remove("qr-printing");
  document.querySelectorAll(".qr-card.print-target").forEach(card => {
    card.classList.remove("print-target");
  });
}

async function render() {
  root.innerHTML = '<div class="card empty">กำลังสร้าง QR...</div>';

  try {
    const tables = await dataService.listTables();
    const activeTables = tables.filter(table => table.active !== false);

    if (!activeTables.length) {
      root.innerHTML = '<div class="card empty">ยังไม่มีโต๊ะ กรุณาเพิ่มโต๊ะในหน้าจัดการระบบก่อน</div>';
      return;
    }

    root.innerHTML = activeTables.map(table => {
      const orderUrl = `${baseUrl.value.replace(/\/$/, "")}/order/?table=${encodeURIComponent(table.code)}`;
      const qrUrl = buildQrImageUrl(orderUrl);

      return `
        <article class="card qr-card">
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
              กรุณาตรวจสอบเลขโต๊ะก่อนสั่งอาหาร<br>
              ขอบคุณที่ใช้บริการ
            </div>
          </div>

          <small class="qr-ticket-url">${orderUrl}</small>
          <button class="btn btn-dark btn-sm" data-print-card>พิมพ์สำหรับวางที่โต๊ะ</button>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    root.innerHTML = '<div class="card empty">สร้าง QR ไม่สำเร็จ กรุณาตรวจสอบ Firebase Config และลองใหม่</div>';
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
baseUrl.addEventListener("change", render);
await render();
