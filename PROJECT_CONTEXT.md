# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.94
Build: 2026.07.17.002
Milestone: POS Catalog Single Renderer

Change: Made `retail-pos-catalog.js` the sole owner of the `/pos` product grid. The sales module now requests a catalog refresh instead of replacing image cards with the legacy text-card renderer, the older performance limiter yields to the catalog renderer, and large catalogs remain paged at 96 products per render.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos` with 400-500 products. Verify the first render contains at most 96 square visual cards, products with images remain image cards, products without images use the square initial fallback, no narrow legacy text cards appear, category/search filters work, and `แสดงเพิ่ม` loads the next batch.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Previous build note: Login Validation Layout Polish from build `2026.07.16.011` remains unchanged for login validation feedback below the full input group and stable email/password icons.

Previous build note: Tax Buyer DBD And Validation Layout Polish from build `2026.07.16.010` remains unchanged for tax invoice history open/print button contrast, DBD lookup with manual-copy fallback in the tax buyer edit dialog, and product form validation that does not stretch product code/barcode inputs or move scanner icons.

Previous build note: Tax Sync Permission And Cross Tab Lock from build `2026.07.16.017` remains unchanged for tenant tax permissions and retry-loop protection.

Previous build note: Tax Buyer Tax ID First from build `2026.07.16.016` remains unchanged for the buyer tax ID field order.

Previous build note: Retail POS Settings Nonblocking Sync from build `2026.07.16.015` remains unchanged for responsive settings saves and background Firebase sync.

Previous build note: Retail POS Settings Offline Sync from build `2026.07.16.014` remains unchanged for tenant-scoped local-first settings persistence.

Previous build note: Retail POS Action Bar Text Only from build `2026.07.16.013` remains unchanged across the main POS page and submenus.

Previous build note: Admin Hero Title Icon Cleanup from build `2026.07.16.012` remains unchanged for the text-only `/admin` hero heading `จัดการร้าน`.

Next Task: deploy hosting and verify build `20260717-002` with a 400-500 product tenant on desktop and mobile, including category switching, search, product selection, and repeated `แสดงเพิ่ม`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
