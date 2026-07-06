# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.19
Build: 2026.07.06.039
Milestone: P9-B004 Offline Queue Sync Timeout Hotfix

Change: fixed POS sync status getting stuck at `กำลัง Sync...` by adding a per-sale sync timeout guard. If a Firestore transaction does not finish within 18 seconds, the sale is marked failed with retry metadata and the worker releases the syncing state. Existing stale syncing rows are recovered on startup.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, and Sync Timeout Hotfix.

Next Task: P9-B005 Repository Layer

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
