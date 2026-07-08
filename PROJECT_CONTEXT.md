# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.03
Build: 2026.07.08.016
Milestone: Full Tax Invoice Pending Sync Hardening

Change: added a pending full tax invoice sync pass so locally queued full tax invoices and local/pending voids retry through the transaction-safe Firestore path when the receipt popup or tax invoice history page is opened, or when the browser returns online.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: from `/pos/receipt/` or `/pos/tax-invoices/`, create a full tax invoice while offline or while the online transaction path is unavailable, then restore internet and reopen the receipt popup or tax invoice history page. The app should retry queued `pending_create`/`local_only` invoices through the transaction path, reuse any existing remote invoice for the same sale, cache the synced invoice locally, and retry `pending_void`/`local_void` cancellations without touching the source sale, VAT total, payment, or stock data.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test pending full tax invoice create/void sync from offline/local fallback back to Firestore, then continue broader offline POS sync validation.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
