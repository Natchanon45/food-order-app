# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.52
Build: 2026.07.12.011
Milestone: Tax Profile Sync Badges

Change: the `โปรไฟล์ภาษีลูกค้า` dialog now shows sync status badges for saved buyer tax profiles. Newly saved profiles are marked `pending_sync` until the existing Firestore profile sync succeeds, then the local profile records `syncStatus: "synced"` and `firebaseSyncedAt` for operator visibility. This does not change issued tax invoices, source sales, VAT, payments, stock, duplicate protection, or full tax invoice create/void transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, click `โปรไฟล์ภาษีลูกค้า`, save a buyer profile while online/offline, then verify the profile list shows `รอ Sync`, `Sync แล้ว`, or `เครื่องนี้` with the latest sync time when available.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/tax-invoices/` loads `retail-pos-tax-invoices.js?v=20260712-011`, then test buyer tax profile save/sync badges against online and offline profile rows.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
