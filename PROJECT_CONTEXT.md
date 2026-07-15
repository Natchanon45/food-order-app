# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.62
Build: 2026.07.15.005
Milestone: POS Offline Sync Reconcile

Change: Hardened Retail POS offline sale sync so the worker reconciles local queued sales with Firestore before attempting another sync. If `tenants/{tenantId}/sales/{saleId}` already exists, the local row is marked `synced` with `firebaseSyncedAt`, `offlineSyncHash`, and clean queue metadata instead of being retried on every page load. This prevents repeated queue work and protects against duplicate Firestore writes or duplicate stock cuts after a previous sync succeeded but the browser did not finish marking localStorage.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos` after a hard refresh on a machine that has local queued sales. The offline sync worker should first reconcile existing remote sales, then the sync badge should drop rows that were already written to Firestore instead of re-syncing them repeatedly. Manual diagnostics can call `window.retailOfflineQueue.reconcileRemote()` or `window.retailOfflineQueue.details()` from DevTools.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos` loads `retail-offline-sale-sync.js?v=20260715-005` and `retail-pos-sync-status.js?v=20260715-005`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
