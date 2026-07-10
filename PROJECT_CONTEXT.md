# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.31
Build: 2026.07.11.001
Milestone: Tax Sync Pending Copy

Change: tax invoice history now shows `คัดลอก Sync` on pending/local retryable tax invoice states even before a `Sync Error` appears, so staff can copy a recovery package for support handoff while preserving source sale, VAT, payment, stock, duplicate protection, and Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, filter `รอ Sync`, confirm pending/local cards show `คัดลอก Sync`, and verify the copied recovery text includes invoice, sale, buyer, sync status/action/phase/target, error if any, attempt count, escalation state, and latest attempt time without mutating tax invoice sync state.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `คัดลอก Sync` appears on production pending/local tax invoice sync states, then continue operator recovery actions for clearing or resolving stuck local/pending tax invoices.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
