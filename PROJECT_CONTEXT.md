# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.54
Build: 2026.07.13.002
Milestone: Tax Profile Sync Diagnostics

Change: buyer tax profile sync now records diagnostics when direct Firestore saves fail. Failed saves remain `pending_sync` and store `syncError`, `syncAttemptedAt`, and `syncAttemptCount`; successful direct/profile sync clears the error and records `firebaseSyncedAt`. The `โปรไฟล์ภาษีลูกค้า` dialog shows the concise sync error and attempt count beside the profile row. This does not change issued tax invoices, source sales, VAT, payments, stock, duplicate protection, or full tax invoice create/void transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, click `โปรไฟล์ภาษีลูกค้า`, save a buyer profile while online/offline, then verify the profile row can show `Sync แล้ว`, `รอ Sync`, or a concise `Sync: ...` diagnostic with attempt count when a save/sync fails.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/tax-invoices/` loads `retail-pos-tax-invoices.js?v=20260713-002`, then test buyer profile save failure/success diagnostics in the profile dialog.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
