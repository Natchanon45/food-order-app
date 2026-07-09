# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.26
Build: 2026.07.10.001
Milestone: Tax Void Transaction Validation

Change: online full tax invoice void transactions now validate the Firestore document before writing `status: void`, confirming tenant, invoice number, and source sale identity when those fields are available. Validation mismatches stop the void instead of falling back to a local pending void, preserving source sale, VAT, payment, stock, duplicate protection, and Firestore read-before-write behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, void a synced full tax invoice, and confirm the Firestore transaction reads the target invoice before writing void status. If the remote document does not match the current tenant, invoice number, or source sale identity, the action should fail instead of creating a local pending void fallback.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify online full tax invoice void validation on production synced Firestore data, then continue hardening pending void retry diagnostics and operator recovery.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
