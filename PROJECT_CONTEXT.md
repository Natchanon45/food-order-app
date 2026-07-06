# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.18
Build: 2026.07.06.038
Milestone: P9-B004 Offline Queue Worker + Retry + Conflict Resolver

Change: upgraded the Retail POS offline queue worker. Added detailed queue snapshot, stale syncing recovery, retry backoff metadata, conflict details, manual retry/discard resolver APIs, and `window.retailOfflineQueue` for diagnostics and manual recovery. The sync flow still uses stable saleId, tenantId, idempotent counter reservation, and Firestore transaction read-before-write.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, and P9-B004 Offline Queue Worker + Retry + Conflict Resolver.

Next Task: P9-B005 Repository Layer

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
