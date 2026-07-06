# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B004 Offline Queue Worker + Retry + Conflict Resolver
Version: 0.13.18
Build: 2026.07.06.038

Change: upgraded the Retail POS offline queue worker. Added detailed queue snapshot, stale syncing recovery, retry backoff metadata, conflict details, manual retry/discard resolver APIs, and `window.retailOfflineQueue` for diagnostics and manual recovery. The sync flow still uses stable saleId, tenantId, idempotent counter reservation, and Firestore transaction read-before-write.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
