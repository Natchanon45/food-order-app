# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.20
Build: 2026.07.09.001
Milestone: Tax Buyer Profile Delete Sync

Change: deleted tax buyer profiles now leave a tenant-scoped local tombstone while offline so the deletion can sync to Firestore `taxBuyerProfiles` when online. This prevents older remote profiles from reappearing after a local delete and preserves existing full tax invoice duplicate protection, pending sync, void, VAT, payment, and stock behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, open `โปรไฟล์ภาษีลูกค้า`, delete a profile while offline, and confirm the profile disappears locally. Return online or reload the tax invoice history to sync the pending deletion to `tenants/{tenantId}/taxBuyerProfiles`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify tax buyer profile offline delete, online delete sync, and hard-refresh reload behavior on production.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
