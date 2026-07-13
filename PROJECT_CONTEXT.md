# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.57
Build: 2026.07.13.005
Milestone: System UI Font Weight Sweep

Change: Order/Delivery and Retail POS now sweep remaining hardcoded heavy UI font weights down to the shared 500-600 range. Mobile cart bars, admin delivery fee rows, owner-password dialogs, sales reports, POS catalog/product management screens, Customer Display, and shared icon/user-menu UI now render lighter while `Kanit Local` heavy display requests no longer pull the heavier local font files on Customer Display. Printable receipt/tax invoice paper font behavior remains unchanged. This is presentation-only and does not change tenant data, orders, VAT, payments, stock, offline sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/delivery/`, `/order/`, `/pos/`, `/pos/products/`, `/pos/customer-display/`, `/admin/`, and `/admin/sales-report/` after a hard refresh. Verify that local Kanit text reads lighter across shared UI surfaces, product/category sort rows no longer look overly bold, buttons remain readable at 500-600, and printable bill/tax headers stay unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/delivery/`, `/order/`, `/pos/`, `/pos/products/`, `/pos/customer-display/`, `/admin/`, and `/admin/sales-report/` load the `20260713-005` cache-busted UI assets, especially `retail-toast-status.js`, `retail-products.css`, `retail-customer-display.css`, `sales-report.css`, `admin-payment.js`, and `admin-sort.js`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
