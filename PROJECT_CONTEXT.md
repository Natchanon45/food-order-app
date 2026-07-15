# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.64
Build: 2026.07.15.007
Milestone: POS Sync Drain Safe Confirm

Change: Fixed Retail POS sync queue persistence by stopping the legacy safe-confirm fallback from intercepting every payment confirmation click. Normal POS checkout now reaches the canonical online Firestore transaction flow again, while the fallback remains available only when explicitly enabled. The offline sync worker also continues draining queued sales in 5-sale batches when more rows remain, so existing local pending rows can clear without needing repeated page reloads. This prevents repeated queue work and protects against duplicate Firestore writes or duplicate stock cuts.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos` after a hard refresh on a machine that has local queued sales. Existing pending rows should drain in short batches until the eligible queue is empty, while new online checkouts should no longer be forced through the local pending fallback. Manual diagnostics can call `window.retailOfflineQueue.reconcileRemote()` or `window.retailOfflineQueue.details()` from DevTools.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos` loads `retail-offline-sale-sync.js?v=20260715-007`, `retail-pos-sync-status.js?v=20260715-007`, and `retail-pos-safe-confirm.js?v=20260715-007`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
