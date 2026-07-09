# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.21
Build: 2026.07.09.002
Milestone: Tax Void Sync Diagnostics

Change: full tax invoice void fallback now records sync diagnostics when an online Firestore transaction fails and the invoice is marked local/pending void. Tax invoice history can show the existing `Sync Error` badge and concise error message immediately, while preserving source sale, VAT, payment, stock, duplicate protection, and retry behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, void an invoice while Firestore transaction sync is unavailable, and confirm the invoice remains void locally with `local_void`/`pending_void` retry state plus sync diagnostics surfaced in the history card.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify full tax invoice void fallback diagnostics, pending void retry, and online void transaction behavior on production.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
