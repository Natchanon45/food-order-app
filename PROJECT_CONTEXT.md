# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.36
Build: 2026.07.11.006
Milestone: Tax Sync Quality Hints

Change: tax invoice history now adds a `ตรวจข้อมูล` quality hint badge/filter for retryable tax invoice sync states with missing buyer name, missing buyer tax ID, or missing source sale reference, while keeping the hint display-only and preserving source sale, VAT, payment, stock, duplicate protection, and Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, confirm the filter chips include `ตรวจข้อมูล`, and use it to find retryable invoices that should be reviewed or fixed with `แก้ผู้ซื้อ` before pressing `ลอง Sync`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the `ตรวจข้อมูล` count, badge, search text, and copied `Quality Check` line on production retryable tax invoice cards.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
