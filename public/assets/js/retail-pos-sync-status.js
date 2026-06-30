import { syncOfflineSalesToFirebase } from './retail-offline-sale-sync.js?v=20260630-060';

const SALES_KEY = 'retail_pos_sales_v1';
const SYNC_EVENT = 'retail-offline-sales-synced';
let syncButton;
let syncText;
let syncTimer;

function readSales() {
  try {
    const rows = JSON.parse(localStorage.getItem(SALES_KEY));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function countSyncStatus() {
  const rows = readSales();
  return rows.reduce((acc, sale) => {
    const status = String(sale?.syncStatus || '').toLowerCase();
    if (status === 'pending') acc.pending += 1;
    else if (status === 'syncing') acc.syncing += 1;
    else if (status === 'failed') acc.failed += 1;
    else if (status === 'conflict') acc.conflict += 1;
    return acc;
  }, { pending: 0, syncing: 0, failed: 0, conflict: 0 });
}

function ensureStyles() {
  if (document.querySelector('#retail-pos-sync-status-style')) return;
  const style = document.createElement('style');
  style.id = 'retail-pos-sync-status-style';
  style.textContent = `
    .pos-sync-status{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(255,255,255,.14);color:#fff;padding:7px 10px;font-weight:800;line-height:1;white-space:nowrap}
    .pos-sync-status[hidden]{display:none!important}
    .pos-sync-dot{width:9px;height:9px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.18)}
    .pos-sync-status.is-warning .pos-sync-dot{background:#fbbf24;box-shadow:0 0 0 3px rgba(251,191,36,.2)}
    .pos-sync-status.is-danger .pos-sync-dot{background:#f87171;box-shadow:0 0 0 3px rgba(248,113,113,.2)}
    .pos-sync-status button{border:0;border-radius:999px;background:#fff;color:#111827;padding:5px 9px;font-weight:900;cursor:pointer}
    .pos-sync-status button:disabled{opacity:.6;cursor:wait}
    @media(max-width:600px){.pos-sync-status{max-width:132px;gap:6px;padding:6px 8px;font-size:.74rem}.pos-sync-status button{padding:4px 7px}.pos-sync-text{overflow:hidden;text-overflow:ellipsis}}
  `;
  document.head.appendChild(style);
}

function buildLabel(counts) {
  const parts = [];
  if (counts.pending) parts.push(`รอ Sync ${counts.pending}`);
  if (counts.syncing) parts.push(`กำลัง Sync ${counts.syncing}`);
  if (counts.failed) parts.push(`ล้มเหลว ${counts.failed}`);
  if (counts.conflict) parts.push(`Conflict ${counts.conflict}`);
  return parts.join(' • ');
}

function renderSyncStatus() {
  if (!syncButton || !syncText) return;
  const counts = countSyncStatus();
  const total = counts.pending + counts.syncing + counts.failed + counts.conflict;
  const wrapper = syncButton.closest('.pos-sync-status');
  if (!wrapper) return;

  wrapper.hidden = total <= 0;
  wrapper.classList.toggle('is-warning', counts.pending + counts.syncing + counts.failed > 0 && counts.conflict === 0);
  wrapper.classList.toggle('is-danger', counts.conflict > 0);
  syncText.textContent = buildLabel(counts) || 'Sync ปกติ';
  syncButton.disabled = counts.syncing > 0 || navigator.onLine === false;
  syncButton.textContent = navigator.onLine === false ? 'Offline' : 'Sync';
}

async function manualSync() {
  if (!syncButton) return;
  syncButton.disabled = true;
  syncButton.textContent = 'กำลัง Sync...';
  try {
    await syncOfflineSalesToFirebase();
  } catch (error) {
    console.warn('[retail-pos-sync-status] manual sync failed', error);
  } finally {
    renderSyncStatus();
  }
}

function scheduleRender() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(renderSyncStatus, 80);
}

function mount() {
  ensureStyles();
  const actions = document.querySelector('.pos-header .header-actions');
  if (!actions || actions.querySelector('[data-pos-sync-status]')) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'pos-sync-status';
  wrapper.dataset.posSyncStatus = 'true';
  wrapper.hidden = true;
  wrapper.innerHTML = '<span class="pos-sync-dot"></span><span class="pos-sync-text">Sync ปกติ</span><button type="button" data-pos-sync-retry>Sync</button>';
  actions.prepend(wrapper);
  syncButton = wrapper.querySelector('[data-pos-sync-retry]');
  syncText = wrapper.querySelector('.pos-sync-text');
  syncButton.addEventListener('click', manualSync);
  renderSyncStatus();
}

window.addEventListener(SYNC_EVENT, scheduleRender);
window.addEventListener('online', scheduleRender);
window.addEventListener('offline', scheduleRender);
window.addEventListener('storage', event => {
  if (!event.key || event.key === SALES_KEY) scheduleRender();
});
window.addEventListener('focus', scheduleRender);

mount();
setInterval(renderSyncStatus, 15000);
