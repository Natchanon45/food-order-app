# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.16
Build: 2026.07.08.029
Milestone: Custom Delivery Fee Options

Change: replaced fixed Delivery fee fields with editable delivery fee options whose labels and prices appear in the customer Delivery dropdown.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/admin`, expand `ข้อมูลร้านและการรับชำระ`, then add/edit Delivery fee option rows such as `รับที่ร้าน` with 0 baht and `ระยะทาง 0-2 กิโลเมตร` with 10 baht. Save the store settings, then open `/delivery` and confirm the dropdown shows the custom labels and applies the selected fee to subtotal/total before order creation.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify custom Delivery fee option save/load, Delivery dropdown display, and order totals with selected delivery fee labels.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
