# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B004 Offline Queue Sync Timeout Hotfix
Version: 0.13.19
Build: 2026.07.06.039

Change: fixed POS sync status getting stuck at `กำลัง Sync...` by adding a per-sale sync timeout guard. If a Firestore transaction does not finish within 18 seconds, the sale is marked failed with retry metadata and the worker releases the syncing state. Existing stale syncing rows are recovered on startup.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
