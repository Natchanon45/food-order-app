# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.99
Build: 2026.07.08.012
Milestone: POS VAT Payment Totals Correction

Change: corrected POS VAT/payment totals by restoring the default 7% VAT rate when VAT registration is enabled but the saved rate is blank/zero, making received-cash/change parsing consistent between the payment UI and safe-confirm guard, syncing Customer Display VAT mode only when VAT controls are active, and reducing payment customer-picker name weight.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos`, set VAT to include VAT with VAT registration enabled, add a cart totaling 114.00, and verify the POS sidebar and Customer Display show before VAT 106.54, VAT 7.46, and net total 114.00. Open payment, enter received cash 120, and verify change displays 6.00 in both the payment UI path and safe-confirm path before confirming. Verify the payment customer-picker result names use font-weight 500 or lighter. Recheck the classic Customer Display layout remains white/green with dashed cart separators, readable cart count badge, centered stacked PromptPay QR, wider pairing QR hover panel, and bottom-pinned one-line thank-you badge.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test POS include-VAT totals, cash/change calculation, Customer Display VAT snapshot, and payment customer-picker text weight with real POS payment data, then continue validating tax profile and void workflow with synced Firestore data.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
