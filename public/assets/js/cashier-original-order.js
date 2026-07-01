import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";
import { toast } from "./ui.js?v=20260701-003";
import { getStoredTenant } from "./tenant-context.js";

function textAfterLabel(container, label) {
  const item = [...container.querySelectorAll("small")].find(node => node.textContent.trim().startsWith(label));
  return item ? item.textContent.trim().slice(label.length).trim() : "";
}

function currentItemInfo(li) {
  const first = li.firstElementChild;
  if (!first) return { qty: "", name: "" };
  const clone = first.cloneNode(true);
  clone.querySelectorAll("strong").forEach(node => node.remove());
  const match = clone.textContent.trim().match(/^(\d+)\s*[×x]\s*(.+)$/i);
  return match ? { qty: match[1], name: match[2].trim() } : { qty: "", name: "" };
}

function normalizeItem(li) {
  const details = li.querySelector(":scope > .menu-category");
  if (!details || details.dataset.originalOrderNormalized === "true") return;

  const note = textAfterLabel(details, "หมายเหตุ:");
  const replacedFrom = textAfterLabel(details, "เปลี่ยนจาก:");
  const originalQty = textAfterLabel(details, "จำนวนเดิม:");
  if (!replacedFrom && !originalQty) return;

  const current = currentItemInfo(li);
  const originalName = replacedFrom || current.name;
  const originalAmount = originalQty || current.qty;
  const lines = [];
  if (note) lines.push(`<small><strong>หมายเหตุ:</strong> ${note}</small>`);
  lines.push(`<small><strong>ลูกค้าสั่งเดิม:</strong> ${originalName} × ${originalAmount}</small>`);

  details.innerHTML = lines.join("<br>");
  details.dataset.originalOrderNormalized = "true";
}

function normalizeAll(root = document) {
  root.querySelectorAll?.(".order-items > li").forEach(normalizeItem);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function takeawayUrl() {
  const tenant = getStoredTenant?.();
  const path = tenant?.slug ? `/s/${encodeURIComponent(tenant.slug)}/takeaway/` : "/takeaway/";
  return new URL(path, location.origin).toString();
}

function qrImage(url) {
  return `https://quickchart.io/qr?size=260&margin=2&text=${encodeURIComponent(url)}`;
}

function ensureTakeawayQrModal(url) {
  let modal = document.querySelector("#takeawayQrModal");
  if (modal) return modal;
  const style = document.createElement("style");
  style.textContent = `#takeawayQrModal[hidden]{display:none!important}#takeawayQrModal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px}.takeaway-qr-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.58);backdrop-filter:blur(3px)}.takeaway-qr-card{position:relative;width:min(390px,100%);background:#fff;border-radius:24px;padding:24px;text-align:center;box-shadow:0 24px 80px rgba(15,23,42,.28)}.takeaway-qr-card img{width:260px;max-width:100%;height:auto;background:#fff;border:1px solid #dfe8e2;border-radius:18px;padding:10px;margin:12px auto}.takeaway-qr-card input{width:100%;box-sizing:border-box;border:1px solid #dfe8e2;border-radius:12px;padding:10px;margin:8px 0 12px}.takeaway-qr-close{position:absolute;right:12px;top:10px;width:34px;height:34px;border:0;border-radius:999px;background:#edf5ef;font-size:22px}`;
  document.head.appendChild(style);
  modal = document.createElement("div");
  modal.id = "takeawayQrModal";
  modal.hidden = true;
  modal.innerHTML = `<div class="takeaway-qr-backdrop" data-close-takeaway-qr></div><section class="takeaway-qr-card"><button class="takeaway-qr-close" type="button" data-close-takeaway-qr>×</button><h2>QR สั่งกลับบ้าน</h2><p>ให้ลูกค้า Walk-in สแกนเพื่อสั่งกลับบ้าน</p><img src="${qrImage(url)}" alt="Take Away QR"><input readonly value="${escapeHtml(url)}"><div class="order-actions"><button class="btn btn-warning" type="button" id="copyTakeawayQrUrl">${iconMarkup("copy")}<span>คัดลอกลิงก์</span></button><a class="btn btn-primary" href="${escapeHtml(url)}" target="_blank" rel="noopener">${iconMarkup("view")}<span>เปิดหน้าสั่ง</span></a></div></section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close-takeaway-qr]").forEach(el => el.addEventListener("click", () => modal.hidden = true));
  modal.querySelector("#copyTakeawayQrUrl")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(url); toast("คัดลอกลิงก์ Take Away แล้ว"); }
    catch { alert(url); }
  });
  return modal;
}

function mountTakeawayTools() {
  const hero = document.querySelector(".hero");
  if (!hero || document.querySelector("#takeawayCashierTools")) return;
  document.querySelector("#takeawayQrTools")?.remove();
  const url = takeawayUrl();
  hero.insertAdjacentHTML("beforeend", `<div id="takeawayCashierTools" class="order-actions" style="margin-top:14px"><button class="btn btn-primary" type="button" id="showTakeawayQr">${iconMarkup("qr")}<span>QR Take Away</span></button><a class="btn btn-warning" href="${escapeHtml(url)}" target="_blank" rel="noopener">${iconMarkup("plus")}<span>สั่งกลับบ้าน</span></a><button class="btn btn-secondary" type="button" id="copyTakeawayUrl">${iconMarkup("copy")}<span>คัดลอกลิงก์</span></button><small style="display:block;width:100%;opacity:.75">ใช้ QR สำหรับลูกค้ามีมือถือ หรือกดสั่งกลับบ้านเมื่อ Cashier ต้องสั่งแทนลูกค้า</small></div>`);
  document.querySelector("#showTakeawayQr")?.addEventListener("click", () => { ensureTakeawayQrModal(url).hidden = false; });
  document.querySelector("#copyTakeawayUrl")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(url); toast("คัดลอกลิงก์ Take Away แล้ว"); }
    catch { alert(url); }
  });
}

function initialize() {
  normalizeAll();
  mountTakeawayTools();
  const grid = document.querySelector("#orderGrid");
  if (!grid) return;
  new MutationObserver(() => normalizeAll(grid)).observe(grid, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
else initialize();
