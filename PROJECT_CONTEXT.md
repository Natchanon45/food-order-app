# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.53
Build: 2026.07.13.001
Milestone: Tax Profile Direct Sync

Change: buyer tax profiles saved while Firebase is online now update their local sync badge to `Sync แล้ว` as soon as the direct Firestore `saveRecord()` succeeds, even when the profile was created from receipt/full-tax flows outside the tax invoice history dialog. Offline or failed saves remain `pending_sync` for the existing profile sync worker. This does not change issued tax invoices, source sales, VAT, payments, stock, duplicate protection, or full tax invoice create/void transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, click `โปรไฟล์ภาษีลูกค้า`, save a buyer profile while online, then verify the profile list can move from `รอ Sync` to `Sync แล้ว` without waiting for a later manual history refresh. Offline saves should still stay `รอ Sync`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/tax-invoices/` loads `retail-pos-tax-invoices.js?v=20260713-001`, then test direct buyer profile save from POS receipt/full-tax flows and the profile dialog badge update.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
