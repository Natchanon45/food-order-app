import { t } from "./i18n.js?v=20260903-202";

function icon(active) {
  const cls = active ? "bi-check-square" : "bi-square";
  const color = active ? "#159447" : "#8a9490";
  const label = active ? t("admin.common.enabled") : t("admin.common.disabled");
  return `<i class="bi ${cls} admin-status-icon" style="color:${color}" role="img" title="${label}" aria-label="${label}"></i>`;
}
function apply() {
  document.querySelectorAll('#menuRows tr').forEach(row => {
    const cell = row.children && row.children[4];
    if (!cell || cell.dataset.statusIconApplied) return;
    cell.innerHTML = icon(row.dataset.active !== 'false');
    cell.dataset.statusIconApplied = '1';
  });
  document.querySelectorAll('#tableRows tr').forEach(row => {
    const cell = row.children && row.children[3];
    if (!cell || cell.dataset.statusIconApplied) return;
    cell.innerHTML = icon(row.dataset.active !== 'false');
    cell.dataset.statusIconApplied = '1';
  });
}
apply();
['#menuRows','#tableRows'].forEach(sel => {
  const node = document.querySelector(sel);
  if (node) new MutationObserver(apply).observe(node, { childList: true, subtree: true });
});
