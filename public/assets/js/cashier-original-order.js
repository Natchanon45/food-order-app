import { t } from "./i18n.js?v=20260812-099";

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

  const note = textAfterLabel(details, t("cashier.items.note_label"));
  const replacedFrom = textAfterLabel(details, t("cashier.items.changed_from_label"));
  const originalQty = textAfterLabel(details, t("cashier.items.original_qty_label"));
  if (!replacedFrom && !originalQty) return;

  const current = currentItemInfo(li);
  const originalName = replacedFrom || current.name;
  const originalAmount = originalQty || current.qty;
  const lines = [];
  if (note) lines.push(`<small><strong>${t("cashier.items.note_label")}</strong> ${note}</small>`);
  lines.push(`<small><strong>${t("cashier.items.original_order_label")}</strong> ${originalName} × ${originalAmount}</small>`);

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
