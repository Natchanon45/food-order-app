# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.02
Build: 2026.07.08.015
Milestone: Full Tax Invoice Duplicate Hardening

Change: hardened full tax invoice issuing so the receipt popup and tax invoice history page check Firestore for an existing full tax invoice before creating a new one, cache any remote match locally, and avoid non-transaction Firestore writes when the online transaction path is unavailable.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: from `/pos/receipt/` or `/pos/tax-invoices/`, attempt to issue a full tax invoice for a sale that already has one in Firestore but not in the local `retail_pos_tax_invoices_v1` cache. The app should open/reuse the existing invoice instead of creating a duplicate and should cache the remote invoice locally. If the Firestore transaction path is unavailable, the fallback invoice should remain local/pending and must not write directly to Firestore outside a transaction. Recheck the Customer Display QR polish, POS include-VAT totals, cash/change calculation, Customer Display VAT snapshot, and payment customer-picker text weight remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test full tax invoice duplicate protection across receipt popup, tax invoice history, Firestore-loaded invoices, and local fallback behavior, then continue broader offline POS sync validation.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
