const path = location.pathname;
const slugMatch = path.match(/^\/s\/([^/]+)/i);
const isPublicOrderingRoute = path.startsWith("/delivery") || path.startsWith("/order") || path.startsWith("/s/");

if (isPublicOrderingRoute && !slugMatch) {
  document.body.replaceChildren();
  const main = document.createElement("main");
  main.style.cssText = "min-height:100vh;display:grid;place-items:center;padding:20px;background:#f3f6f4;font-family:system-ui,-apple-system,sans-serif";
  const card = document.createElement("section");
  card.style.cssText = "width:min(440px,100%);padding:28px;border:1px solid #dde5df;border-radius:20px;background:#fff;text-align:center;box-shadow:0 16px 44px rgba(16,35,23,.08)";
  const title = document.createElement("h1");
  title.textContent = "ลิงก์ร้านค้าไม่สมบูรณ์";
  title.style.margin = "0 0 10px";
  const detail = document.createElement("p");
  detail.textContent = "กรุณาเปิดร้านผ่านลิงก์หรือ QR ที่มีชื่อร้าน เช่น /s/ชื่อร้าน/delivery";
  detail.style.cssText = "margin:0;color:#6b746f;line-height:1.6";
  card.append(title, detail);
  main.append(card);
  document.body.append(main);
  throw new Error("TENANT_SLUG_REQUIRED");
}
