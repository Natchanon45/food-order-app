import { syncOfflineSalesToFirebase, retryFailedOfflineSales, getOfflineQueueWorkerSnapshot } from './retail-offline-sale-sync.js?v=20260702-004';
import { listLocalSales } from './retail-pos-repository.js?v=20260702-005';

const SYNC_EVENT = 'retail-offline-sales-synced';
const WORKER_EVENT = 'retail-offline-queue-worker';
let syncButton;
let syncText;
let syncTimer;
let manualSyncRunning = false;

function countSyncStatus() {
  const rows = listLocalSales();
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

function buildLabel(counts, worker) {
  const parts = [];
  if (counts.pending) parts.push(`รอ Sync ${counts.pending}`);
  if (counts.syncing || worker?.state === 'syncing') parts.push(`กำลัง Sync ${counts.syncing || ''}`.trim());
  if (counts.failed) parts.push(`รอ Retry ${counts.failed}`);
  if (counts.conflict) parts.push(`Conflict ${counts.conflict}`);
  return parts.join(' • ');
}

function renderSyncStatus() {
  if (!syncButton || !syncText) return;
  const counts = countSyncStatus();
  const worker = typeof getOfflineQueueWorkerSnapshot === 'function' ? getOfflineQueueWorkerSnapshot() : null;
  const total = counts.pending + counts.syncing + counts.failed + counts.conflict;
  const wrapper = syncButton.closest('.pos-sync-status');
  if (!wrapper) return;

  wrapper.hidden = total <= 0;
  wrapper.classList.toggle('is-warning', counts.pending + counts.syncing + counts.failed > 0 && counts.conflict === 0);
  wrapper.classList.toggle('is-danger', counts.conflict > 0);
  syncText.textContent = buildLabel(counts, worker) || 'Sync ปกติ';

  const offline = navigator.onLine === false;
  const syncing = manualSyncRunning || counts.syncing > 0 || worker?.state === 'syncing';
  syncButton.disabled = syncing || offline;
  syncButton.textContent = offline ? 'Offline' : syncing ? 'กำลัง Sync...' : (counts.failed || counts.conflict ? 'Retry' : 'Sync');
}

async function manualSync(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (!syncButton || manualSyncRunning || navigator.onLine === false) return;
  manualSyncRunning = true;
  syncButton.disabled = true;
  syncButton.textContent = 'กำลัง Sync...';
  try {
    retryFailedOfflineSales({ includeConflicts: false });
    const result = await syncOfflineSalesToFirebase({ forceRetry: true });
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: result }));
  } catch (error) {
    console.warn('[retail-pos-sync-status] manual sync failed', error);
  } finally {
    manualSyncRunning = false;
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
window.addEventListener(WORKER_EVENT, scheduleRender);
window.addEventListener('online', scheduleRender);
window.addEventListener('offline', scheduleRender);
window.addEventListener('storage', scheduleRender);
window.addEventListener('retail-pos-repository-change', scheduleRender);
window.addEventListener('focus', scheduleRender);

mount();
setInterval(renderSyncStatus, 5000);
