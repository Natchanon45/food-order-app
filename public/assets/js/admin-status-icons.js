function icon(active) {
  const cls = active ? 'bi-check-square' : 'bi-square';
  const color = active ? '#159447' : '#8a9490';
  const label = active ? 'ใช้งาน' : 'ไม่ได้ใช้งาน';
  return '<span class="admin-status-icon" style="color:' + color + ';display:inline-flex;align-items:center;gap:6px;font-weight:800"><i class="bi ' + cls + ' app-icon" aria-hidden="true"></i><span>' + label + '</span></span>';
}
function apply() {
  document.querySelectorAll('#menuRows tr').forEach(row => {
    const cell = row.children && row.children[4];
    if (!cell || cell.dataset.statusIconApplied) return;
    const text = cell.textContent.trim();
    if (!text) return;
    cell.innerHTML = icon(text.includes('เปิด') || text.includes('ใช้งาน'));
    cell.dataset.statusIconApplied = '1';
  });
  document.querySelectorAll('#tableRows tr').forEach(row => {
    const cell = row.children && row.children[2];
    if (!cell || cell.dataset.statusIconApplied) return;
    const text = cell.textContent.trim();
    if (!text) return;
    cell.innerHTML = icon(text.includes('เปิด') || text.includes('ใช้งาน'));
    cell.dataset.statusIconApplied = '1';
  });
}
apply();
['#menuRows','#tableRows'].forEach(sel => {
  const node = document.querySelector(sel);
  if (node) new MutationObserver(apply).observe(node, { childList: true, subtree: true });
});
