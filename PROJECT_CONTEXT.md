# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.07
Build: 2026.07.08.020
Milestone: Full Tax Invoice Pending Sync Visibility

Change: strengthened pending full tax invoice sync by retrying queued local invoices before every create/reuse path and adding visible sync status badges in tax invoice history for local/pending documents.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: create or void a full tax invoice while offline or while transaction sync is unavailable, then return online and open `/pos/tax-invoices/` or issue a full tax invoice again from `/pos/receipt/`. The app should retry pending local invoices before creating/reusing documents, cache synced remote invoices, and show `รอ Sync`, `เอกสารในเครื่อง`, or `เลขชั่วคราว` badges in tax invoice history until Firestore sync succeeds.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test pending full tax invoice create/void sync badges across offline, online, receipt popup, and tax invoice history workflows.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
