import { RetailCollections, getTenantId, saveRecordStrict } from './retail-db.js?v=20260629-032';

const QUEUE_PREFIX = 'retail_pos_settings_sync_queue_v1_';
const FIREBASE_SYNC_TIMEOUT_MS = 8000;
let activeSync = null;
let scheduledSync = 0;

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs);
    Promise.resolve(promise).then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function scheduleSync(delay = 500) {
  clearTimeout(scheduledSync);
  scheduledSync = setTimeout(() => {
    scheduledSync = 0;
    syncPendingSettings().catch(error => console.warn('[retail-pos-settings-sync] scheduled sync failed', error));
  }, delay);
}

function queueKey() {
  return `${QUEUE_PREFIX}${getTenantId()}`;
}

function readQueue() {
  try {
    const rows = JSON.parse(localStorage.getItem(queueKey())) || [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeQueue(rows) {
  localStorage.setItem(queueKey(), JSON.stringify(rows || []));
}

function normalizeDocument(row = {}) {
  const tenantId = getTenantId();
  const id = String(row.id || '').trim();
  if (!id) throw new Error('SETTINGS_DOCUMENT_ID_REQUIRED');
  return {
    ...row,
    id,
    tenantId,
    shopId: tenantId,
    syncStatus: 'pending_sync',
    syncQueuedAt: Date.now()
  };
}

function enqueue(documents = []) {
  const tenantId = getTenantId();
  const merged = new Map(
    readQueue()
      .filter(row => !row.tenantId || row.tenantId === tenantId)
      .map(row => [String(row.id), row])
  );
  documents.map(normalizeDocument).forEach(row => merged.set(row.id, row));
  const rows = [...merged.values()];
  writeQueue(rows);
  return rows;
}

export function hasPendingSettingsSync() {
  return readQueue().length > 0;
}

export async function syncPendingSettings() {
  if (activeSync) return activeSync;
  if (navigator.onLine === false || !hasPendingSettingsSync()) {
    return { synced: 0, pending: readQueue().length };
  }
  activeSync = (async () => {
    const tenantId = getTenantId();
    const queue = readQueue();
    const results = new Map();
    let synced = 0;
    for (const queued of queue) {
      if (queued.tenantId && queued.tenantId !== tenantId) {
        continue;
      }
      try {
        const syncedAt = Date.now();
        await withTimeout(
          saveRecordStrict(RetailCollections.settings, {
            ...queued,
            tenantId,
            shopId: tenantId,
            syncStatus: 'synced',
            firebaseSyncedAt: syncedAt,
            syncError: '',
            syncAttemptedAt: syncedAt
          }),
          FIREBASE_SYNC_TIMEOUT_MS,
          `SETTINGS_${queued.id}`
        );
        synced += 1;
        results.set(String(queued.id), { queuedAt: queued.syncQueuedAt, synced: true });
      } catch (error) {
        results.set(String(queued.id), {
          queuedAt: queued.syncQueuedAt,
          synced: false,
          row: {
          ...queued,
          tenantId,
          shopId: tenantId,
          syncStatus: 'pending_sync',
          syncAttemptedAt: Date.now(),
          syncAttemptCount: Number(queued.syncAttemptCount || 0) + 1,
          syncError: String(error?.message || error || 'FIREBASE_SETTINGS_SYNC_FAILED').slice(0, 300)
          }
        });
      }
    }
    const remaining = readQueue().flatMap(row => {
      const result = results.get(String(row.id));
      if (!result || row.syncQueuedAt !== result.queuedAt) return [row];
      return result.synced ? [] : [result.row];
    });
    const drain = remaining.some(row => {
      const result = results.get(String(row.id));
      return !result || row.syncQueuedAt !== result.queuedAt;
    });
    writeQueue(remaining);
    return { synced, pending: remaining.length, drain };
  })();
  let result;
  try {
    result = await activeSync;
    return result;
  } finally {
    activeSync = null;
    if (result?.drain && navigator.onLine !== false && hasPendingSettingsSync()) {
      scheduleSync(500);
    }
  }
}

export async function saveSettingsDocumentsLocalFirst(documents = []) {
  enqueue(documents);
  const pending = readQueue().length;
  if (navigator.onLine !== false) scheduleSync(100);
  return { synced: 0, pending };
}

window.addEventListener('online', () => {
  scheduleSync(300);
});

if (navigator.onLine !== false && hasPendingSettingsSync()) scheduleSync(1500);
