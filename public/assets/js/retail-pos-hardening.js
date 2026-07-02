export const POS_HARDENING_VERSION = 'HARDENING-001';

const SALES_KEY = 'retail_pos_sales_v1';
const TAB_ID_KEY = 'retail_pos_tab_id_v1';
const LEADER_KEY = 'retail_pos_leader_v1';
const SNAPSHOT_KEY = 'retail_pos_hardening_snapshot_v1';
const MAINTENANCE_EVENT = 'retail-pos-maintenance';
const HEARTBEAT_MS = 5000;
const LEADER_TTL_MS = 15000;
const STALE_SYNCING_MS = 120000;
const SYNCED_RETENTION_DAYS = 45;
const MAX_SYNCED_LOCAL_SALES = 500;
let heartbeatTimer = 0;
let maintenanceTimer = 0;
let disposed = false;

function nowMs() { return Date.now(); }
function nowIso() { return new Date().toISOString(); }
function safeParse(value, fallback) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }
function readSales() { return safeParse(localStorage.getItem(SALES_KEY), []); }
function writeSales(rows) { localStorage.setItem(SALES_KEY, JSON.stringify(rows || [])); }
function saleId(sale) { return String(sale?.id || sale?.saleId || sale?.saleNumber || '').trim(); }
function timeOf(value) { const time = new Date(value || 0).getTime(); return Number.isFinite(time) ? time : 0; }
function isActiveQueueSale(sale) { return ['pending', 'syncing', 'failed', 'conflict'].includes(String(sale?.syncStatus || '').toLowerCase()); }

function tabId() {
  let id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `tab-${nowMs()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

function leaderState() { return safeParse(localStorage.getItem(LEADER_KEY), null); }
function becomeLeader() {
  const state = { tabId: tabId(), updatedAt: nowMs(), version: POS_HARDENING_VERSION };
  localStorage.setItem(LEADER_KEY, JSON.stringify(state));
  return state;
}
function maintainLeadership() {
  if (disposed) return false;
  const current = leaderState();
  if (!current || current.tabId === tabId() || nowMs() - Number(current.updatedAt || 0) > LEADER_TTL_MS) {
    becomeLeader();
    return true;
  }
  return current.tabId === tabId();
}

function cleanupSyncedSales(rows) {
  const cutoff = nowMs() - SYNCED_RETENTION_DAYS * 86400000;
  const active = [];
  const synced = [];
  rows.forEach(sale => {
    if (isActiveQueueSale(sale) || !sale.firebaseSyncedAt) active.push(sale);
    else synced.push(sale);
  });
  const keptSynced = synced
    .filter(sale => timeOf(sale.firebaseSyncedAt || sale.syncedAt || sale.createdAt) >= cutoff)
    .sort((a, b) => timeOf(b.firebaseSyncedAt || b.syncedAt || b.createdAt) - timeOf(a.firebaseSyncedAt || a.syncedAt || a.createdAt))
    .slice(0, MAX_SYNCED_LOCAL_SALES);
  return [...active, ...keptSynced];
}

function resetStaleSyncing(rows) {
  let changed = 0;
  const next = rows.map(sale => {
    if (String(sale?.syncStatus || '').toLowerCase() !== 'syncing') return sale;
    const started = timeOf(sale.syncStartedAt || sale.lastSyncAttemptAt);
    if (!started || nowMs() - started < STALE_SYNCING_MS) return sale;
    changed += 1;
    return {
      ...sale,
      syncStatus: 'failed',
      syncError: sale.syncError || 'STALE_SYNCING_RECOVERED',
      syncLockId: '',
      syncStartedAt: '',
      nextRetryAt: nowIso(),
      recoveredAt: nowIso()
    };
  });
  return { rows: next, changed };
}

export function runPosMaintenance(reason = 'manual') {
  if (disposed) return { changed: false, reason, disposed: true };
  const isLeader = maintainLeadership();
  const beforeRows = readSales();
  let rows = beforeRows;
  let staleRecovered = 0;
  let cleaned = 0;

  if (isLeader) {
    const staleResult = resetStaleSyncing(rows);
    rows = staleResult.rows;
    staleRecovered = staleResult.changed;
    const beforeCleanupLength = rows.length;
    rows = cleanupSyncedSales(rows);
    cleaned = Math.max(0, beforeCleanupLength - rows.length);
    if (staleRecovered || cleaned || rows.length !== beforeRows.length) writeSales(rows);
  }

  const activeQueue = rows.filter(isActiveQueueSale).length;
  const snapshot = {
    version: POS_HARDENING_VERSION,
    tabId: tabId(),
    isLeader,
    reason,
    activeQueue,
    totalLocalSales: rows.length,
    staleRecovered,
    cleaned,
    updatedAt: nowIso()
  };
  sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: snapshot }));
  return snapshot;
}

function scheduleMaintenance(reason = 'scheduled', delay = 300) {
  clearTimeout(maintenanceTimer);
  maintenanceTimer = setTimeout(() => runPosMaintenance(reason), delay);
}

function start() {
  if (window.__retailPosHardeningStarted) return;
  window.__retailPosHardeningStarted = true;
  tabId();
  runPosMaintenance('start');
  heartbeatTimer = setInterval(() => runPosMaintenance('heartbeat'), HEARTBEAT_MS);
  window.addEventListener('online', () => scheduleMaintenance('online', 200));
  window.addEventListener('focus', () => scheduleMaintenance('focus', 300));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleMaintenance('visibility', 300);
  });
  window.addEventListener('pageshow', () => scheduleMaintenance('pageshow', 200));
  window.addEventListener('pagehide', () => {
    clearInterval(heartbeatTimer);
    clearTimeout(maintenanceTimer);
    disposed = true;
    const current = leaderState();
    if (current?.tabId === tabId()) localStorage.removeItem(LEADER_KEY);
  }, { once: true });
}

window.retailPosHardening = Object.freeze({
  version: POS_HARDENING_VERSION,
  runMaintenance: runPosMaintenance
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
