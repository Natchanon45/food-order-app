# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.68
Build: 2026.07.15.011
Milestone: Unified Icon Color System

Change: Unified the shared icon color language across Order/Delivery, Admin, table QR, staff user menus, and Retail POS entry surfaces. User menu icons now use the same color-coded chips on every authenticated page, and Admin heading icons injected by `admin-icon-polish.js` use matching color tokens instead of a page-specific all-green override. The change keeps the green/black/white theme, prevents adjacent duplicate icons in menu links and buttons, keeps printable bill/tax headers text-only, and does not use emoji. This does not change tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/`, `/admin`, `/admin/users`, `/admin/sales-report`, and `/cashier/table-qr`, sign in, and verify the user menu icons use the same color-coded chip mapping on every page. On Admin pages, verify injected heading icons use the shared colored token set without adjacent duplicate icons.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify shared pages load `/assets/css/icons.css?v=20260715-011`, Admin pages load `admin-icon-polish.js?v=20260715-011`, POS pages load `retail-toast-status.js?v=20260715-011`, and the Developer Panel shows Unified Icon Color System.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
