# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.91
Build: 2026.07.08.004
Milestone: Customer Display Cart Count Contrast

Change: improved the Customer Display cart count badge contrast so counts such as `11 รายการ` stay readable against the liquid-glass cart header while preserving the pairing QR hover layer and PromptPay layout.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/customer-display/` with a PromptPay payment snapshot, including short PC screens such as 1912x870, and verify the total card shows the centered stacked PromptPay heading, baht amount, QR, and account name in a white/green/black glass style. Verify the cart header title and count badge such as `11 รายการ` are clearly readable. Hover or focus `เชื่อมอุปกรณ์` and verify the device-pairing QR panel stays above the cart and total cards. Verify translucent cards, dark green emphasis, and soft green highlights remain readable, and the `ขอบคุณที่ใช้บริการ` badge stays at the bottom edge on one line with font-weight 500 or lighter. Verify receipt behavior, one-full-tax-invoice-per-sale duplicate protection, VAT totals, stock deduction, offline sale sync, Customer Display sync, and printable document fonts remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test the Customer Display cart count badge contrast, pairing QR hover layer, and liquid-glass PromptPay theme on real POS payment data, then continue validating tax profile and void workflow with synced Firestore data.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
