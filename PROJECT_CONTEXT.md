# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.76
Build: 2026.07.16.001
Milestone: Catalog Post Import Checklist

Change: Added a post-import checklist to the `/pos/catalog` success panel so owners know the next required steps after importing master catalog rows: verify selling prices, set stock, and enable POS visibility only when ready. This is checklist UI only and does not change import payload rules, tenant product fields, stock defaults, stock movements, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/catalog`, sign in as Owner, import a small set of ready catalog rows, and verify the success panel shows the post-import checklist for `ตรวจราคา`, `ตั้งสต็อก`, and `เปิดขายบน POS` together with imported SKU examples, `ไปตรวจสินค้าที่นำเข้า`, and `คัดลอก SKU`. Confirm imported products still default to stock 0 and hidden from POS.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/catalog` loads `/assets/css/retail-catalog-import.css?v=20260716-001`, `/assets/js/retail-catalog-import.js?v=20260716-001`, and the Developer Panel shows Catalog Post Import Checklist.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
