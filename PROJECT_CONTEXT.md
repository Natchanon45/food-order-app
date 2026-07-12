# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.51
Build: 2026.07.12.010
Milestone: Tax Sync Health Shortcuts

Change: the `สถานะ Sync ใบกำกับภาษี` diagnostic panel on tax invoice history now has clickable shortcut chips. Staff can click `Sync Error`, `รอ Sync`, `ค้าง Sync`, `ตรวจข้อมูล`, `Firestore`, `เครื่องนี้`, `ทั้งสอง`, or `ทั้งหมด` to apply the matching sync/source filters immediately. This is UI-only and does not change tax invoice create/void transactions, buyer profile data, source sales, VAT, payment, stock, or retry counters.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, click `รีเฟรช`, then click the sync health shortcut chips and verify the main filter chips plus list summary follow the selected sync/source filter.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/tax-invoices/` loads `retail-pos-tax-invoices.js?v=20260712-010`, then test the sync health shortcut chips against normal, pending/local, and Sync Error invoice rows.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
