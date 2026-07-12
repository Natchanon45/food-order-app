# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.49
Build: 2026.07.12.008
Milestone: POS Offline Sync Synced Flag

Change: POS offline sale sync now writes and backfills `offlineSyncHash` / `syncHashVersion` on local sales that have already reached Firestore, and the queue/status badge skips those synced rows unless the sale payload hash changes. This reduces repeated localStorage sync work while preserving stable saleId, duplicate protection, transaction read-before-write, VAT, payment, and stock behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos`, let the offline queue worker run, and verify local sales with `syncStatus: "synced"` or `firebaseSyncedAt` receive `offlineSyncHash` and stop appearing in the `รอ Sync` badge unless their sale payload changes.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos` loads `retail-offline-sale-sync.js?v=20260712-008` plus `retail-pos-sync-status.js?v=20260712-008`, then confirm synced local sales no longer keep the sync badge active.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
