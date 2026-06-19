import { dataService, usingDemoMode } from "./data-service.js";
if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';
const baseUrl = document.querySelector("#baseUrl");
baseUrl.value = location.origin === "null" ? "https://your-project.web.app" : location.origin;
const tables = await dataService.listTables();
async function render() {
  const root = document.querySelector("#qrGrid"); root.innerHTML = "";
  for (const table of tables.filter(x => x.active !== false)) {
    const url = `${baseUrl.value.replace(/\/$/, "")}/order/?table=${encodeURIComponent(table.code)}`;
    const card = document.createElement("article"); card.className = "card qr-card";
    card.innerHTML = `<h2>${table.name}</h2><div class="qrCanvas"></div><small>${url}</small><br><button class="btn btn-dark btn-sm" style="margin-top:10px" onclick="window.print()">พิมพ์</button>`;
    root.appendChild(card);
    await QRCode.toCanvas(card.querySelector(".qrCanvas").appendChild(document.createElement("canvas")), url, { width: 220, margin: 1 });
  }
}
baseUrl.addEventListener("change", render);
await render();
