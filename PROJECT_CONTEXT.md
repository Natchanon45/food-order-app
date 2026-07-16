# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.81
Build: 2026.07.16.006
Milestone: POS Local First Loyalty Receipt

Change: Changed Retail POS checkout to save locally first on every completed bill. The cashier flow no longer waits for Firebase before clearing the cart and opening the receipt. Local sales are saved as `pending` with the same stable saleId used by the existing offline sync worker, local stock is deducted once, and duplicate local saves with the same saleId preserve the existing sale instead of cutting stock again. Customer/member fields are embedded in the sale payload at local save time, and checkout waits briefly for the local loyalty/customer patch before opening the receipt so the first printed bill can show masked customer/member rows and loyalty point rows.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos`, select a member/customer in the payment modal, optionally use loyalty points, and confirm payment. The receipt popup should open from the local sale without waiting for Firebase, show the masked customer/member rows and loyalty point rows on the first render, and the POS header should show the pending sync count until the background worker writes the sale to Firestore.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos` loads `/assets/js/retail-pos.js?v=20260716-006`, `/assets/js/retail-pos-loyalty.js?v=20260716-006`, and `/assets/js/retail-toast-status.js?v=20260716-006`; complete a member POS sale and confirm the receipt shows customer/member and loyalty rows before Firebase sync finishes; then confirm the sync worker changes the local sale from `pending` to `synced` without duplicate bills or duplicate stock deduction.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
