import { dataService, usingDemoMode } from "./data-service.js";

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';
}

const baseUrl = document.querySelector("#baseUrl");
const root = document.querySelector("#qrGrid");
baseUrl.value = location.origin === "null" ? "https://chat-45754.web.app" : location.origin;

function buildQrImageUrl(value) {
  const encoded = encodeURIComponent(value);
  return `https://quickchart.io/qr?text=${encoded}&size=220&margin=1`;
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
          <h2>${table.name}</h2>
          <img src="${qrUrl}" width="220" height="220" alt="QR ${table.name}">
          <small style="display:block;overflow-wrap:anywhere">${orderUrl}</small>
          <button class="btn btn-dark btn-sm" data-print-card style="margin-top:10px">พิมพ์</button>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    root.innerHTML = '<div class="card empty">สร้าง QR ไม่สำเร็จ กรุณาตรวจสอบ Firebase Config และลองใหม่</div>';
  }
}

root.addEventListener("click", event => {
  if (!event.target.matches("[data-print-card]")) return;
  const card = event.target.closest(".qr-card");
  document.querySelectorAll(".qr-card").forEach(item => item.classList.toggle("print-target", item === card));
  window.print();
});

baseUrl.addEventListener("change", render);
await render();
