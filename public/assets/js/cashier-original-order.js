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

function initialize() {
  normalizeAll();
  const grid = document.querySelector("#orderGrid");
  if (!grid) return;
  new MutationObserver(() => normalizeAll(grid)).observe(grid, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
else initialize();
