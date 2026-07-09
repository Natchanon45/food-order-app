# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.27
Build: 2026.07.10.002
Milestone: Tax Void Retry Diagnostics

Change: pending full tax invoice sync diagnostics now record and display the failing sync action and phase, such as `create / pending_create` or `void / pending_void`, so staff can distinguish create retries from void retries without inspecting localStorage while preserving source sale, VAT, payment, stock, duplicate protection, and Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/` with a pending/error full tax invoice and confirm the card diagnostic text includes the sync error, action/phase, attempt count, and latest attempt time. Search should also match the stored action, phase, or target document ID.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify pending create/void diagnostics on production synced Firestore data, then continue operator recovery actions for unresolved tax invoice sync errors.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
