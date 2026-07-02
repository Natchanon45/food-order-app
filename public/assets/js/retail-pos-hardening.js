export const POS_HARDENING_VERSION = 'HARDENING-002';

const SALES_KEY = 'retail_pos_sales_v1';
const TAB_ID_KEY = 'retail_pos_tab_id_v1';
const LEADER_KEY = 'retail_pos_leader_v1';
const SNAPSHOT_KEY = 'retail_pos_hardening_snapshot_v1';
const DIAGNOSTICS_KEY = 'retail_pos_hardening_diagnostics_v1';
const MAINTENANCE_EVENT = 'retail-pos-maintenance';
const DIAGNOSTICS_EVENT = 'retail-pos-diagnostics';
const HEARTBEAT_MS = 5000;
const LEADER_TTL_MS = 15000;
const STALE_SYNCING_MS = 120000;
const SYNCED_RETENTION_DAYS = 45;
const MAX_SYNCED_LOCAL_SALES = 500;
let heartbeatTimer = 0;
let maintenanceTimer = 0;
let diagnosticsTimer = 0;
let disposed = false;
let startedAt = Date.now();
let maintenanceCount = 0;
let eventCounters = { online: 0, focus: 0, visibility: 0, pageshow: 0, storage: 0 };
let lastSnapshot = null;

function nowMs() { return Date.now(); }
function nowIso() { return new Date().toISOString(); }
function safeParse(value, fallback) { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } }
function readSales() { return safeParse(localStorage.getItem(SALES_KEY), []); }
function writeSales(rows) { localStorage.setItem(SALES_KEY, JSON.stringify(rows || [])); }
function storageBytes(key) { try { return new Blob([localStorage.getItem(key) || '']).size; } catch { return (localStorage.getItem(key) || '').length; } }
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

function queueSummary(rows) {
  return rows.reduce((acc, sale) => {
    const status = String(sale?.syncStatus || 'synced').toLowerCase();
    if (status === 'pending') acc.pending += 1;
    else if (status === 'syncing') acc.syncing += 1;
    else if (status === 'failed') acc.failed += 1;
    else if (status === 'conflict') acc.conflict += 1;
    else if (status === 'synced' || sale.firebaseSyncedAt) acc.synced += 1;
    else acc.other += 1;
    return acc;
  }, { pending: 0, syncing: 0, failed: 0, conflict: 0, synced: 0, other: 0 });
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

export function collectPosDiagnostics(reason = 'diagnostics') {
  const rows = readSales();
  const leader = leaderState();
  const memory = performance?.memory ? {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
  } : null;
  const diagnostics = {
    version: POS_HARDENING_VERSION,
    reason,
    tabId: tabId(),
    isLeader: leader?.tabId === tabId(),
    leaderAgeMs: leader?.updatedAt ? nowMs() - Number(leader.updatedAt) : null,
    uptimeMs: nowMs() - startedAt,
    maintenanceCount,
    eventCounters: { ...eventCounters },
    queue: queueSummary(rows),
    totalLocalSales: rows.length,
    storage: {
      salesBytes: storageBytes(SALES_KEY),
      leaderBytes: storageBytes(LEADER_KEY),
      snapshotBytes: storageBytes(SNAPSHOT_KEY)
    },
    memory,
    visibilityState: document.visibilityState,
    online: navigator.onLine !== false,
    updatedAt: nowIso(),
    lastSnapshot
  };
  sessionStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(diagnostics));
  window.dispatchEvent(new CustomEvent(DIAGNOSTICS_EVENT, { detail: diagnostics }));
  return diagnostics;
}

export function runPosMaintenance(reason = 'manual') {
  if (disposed) return { changed: false, reason, disposed: true };
  maintenanceCount += 1;
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
    queue: queueSummary(rows),
    staleRecovered,
    cleaned,
    uptimeMs: nowMs() - startedAt,
    maintenanceCount,
    updatedAt: nowIso()
  };
  lastSnapshot = snapshot;
  sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: snapshot }));
  if (reason !== 'heartbeat') collectPosDiagnostics(reason);
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
  diagnosticsTimer = setInterval(() => collectPosDiagnostics('interval'), 60000);
  window.addEventListener('online', () => { eventCounters.online += 1; scheduleMaintenance('online', 200); });
  window.addEventListener('focus', () => { eventCounters.focus += 1; scheduleMaintenance('focus', 300); });
  window.addEventListener('storage', event => { if (!event.key || event.key === SALES_KEY || event.key === LEADER_KEY) { eventCounters.storage += 1; scheduleMaintenance('storage', 500); } });
  document.addEventListener('visibilitychange', () => {
    eventCounters.visibility += 1;
    if (!document.hidden) scheduleMaintenance('visibility', 300);
  });
  window.addEventListener('pageshow', () => { eventCounters.pageshow += 1; scheduleMaintenance('pageshow', 200); });
  window.addEventListener('pagehide', () => {
    clearInterval(heartbeatTimer);
    clearInterval(diagnosticsTimer);
    clearTimeout(maintenanceTimer);
    disposed = true;
    const current = leaderState();
    if (current?.tabId === tabId()) localStorage.removeItem(LEADER_KEY);
  }, { once: true });
}

window.retailPosHardening = Object.freeze({
  version: POS_HARDENING_VERSION,
  runMaintenance: runPosMaintenance,
  diagnostics: collectPosDiagnostics
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
