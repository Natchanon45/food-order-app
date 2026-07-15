# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.71
Build: 2026.07.15.014
Milestone: Catalog Import Confirmation Summary

Change: Improved `/pos/catalog` import confirmation so owners see a final summary before committing Retail Master Catalog products. The dialog now shows the new import count, rows skipped because SKU/barcode already exists, and draft rows still waiting for verification, while the preview label now correctly states it can show up to 50 rows. This is confirmation UI only and does not change category selection, import payload rules, tenant product fields, stock, VAT, payments, offline sale sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/catalog`, sign in as Owner, select at least one category with importable rows, click the import button, and verify the confirmation dialog shows `นำเข้าใหม่`, `ข้ามเพราะมีแล้ว`, and `รอตรวจสอบ` before confirming. Confirm the preview badge reads `Preview สูงสุด 50 รายการ`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/pos/catalog` loads `/assets/css/retail-catalog-import.css?v=20260715-014`, `/assets/js/retail-catalog-import.js?v=20260715-014`, and the Developer Panel shows Catalog Import Confirmation Summary.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
