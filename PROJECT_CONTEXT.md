# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.11
Build: 2026.07.08.024
Milestone: Full Tax Invoice Offline Void Sync

Change: hardened pending full-tax-invoice void sync so a locally issued-and-voided invoice can be created online first, then voided through the Firestore transaction path instead of staying local forever.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: issue a full tax invoice while offline or while transaction sync is unavailable, void that local invoice before it syncs, then return online and open `/pos/tax-invoices/` or the receipt popup flow. The app should create the official invoice online first and then void it through the Firestore transaction path so the local `pending_void`/`local_void` state can clear.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test a locally issued full tax invoice that is voided before sync, then reconnect and confirm the invoice reaches Firestore as void instead of remaining `local_void`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
