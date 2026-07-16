import { RetailCollections, getTenantId, saveRecordStrict } from './retail-db.js?v=20260629-032';

const QUEUE_PREFIX = 'retail_pos_settings_sync_queue_v1_';
let activeSync = null;

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
        await saveRecordStrict(RetailCollections.settings, {
          ...queued,
          tenantId,
          shopId: tenantId,
          syncStatus: 'synced',
          firebaseSyncedAt: syncedAt,
          syncError: '',
          syncAttemptedAt: syncedAt
        });
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
      setTimeout(() => {
        syncPendingSettings().catch(error => console.warn('[retail-pos-settings-sync] queue drain failed', error));
      }, 0);
    }
  }
}

export async function saveSettingsDocumentsLocalFirst(documents = []) {
  enqueue(documents);
  if (navigator.onLine === false) return { synced: 0, pending: readQueue().length };
  return syncPendingSettings();
}

window.addEventListener('online', () => {
  syncPendingSettings().catch(error => console.warn('[retail-pos-settings-sync] online sync failed', error));
});

syncPendingSettings().catch(error => console.warn('[retail-pos-settings-sync] startup sync failed', error));
