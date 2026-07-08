# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.17
Build: 2026.07.08.030
Milestone: Custom Delivery Fee UI Polish

Change: polished the custom Delivery fee option editor by moving the add button to the card header with a plus icon, making it green, aligning row number badges with the inputs, replacing the label field caption with a helpful placeholder, and changing remove actions to red X icon buttons.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/admin`, expand `ข้อมูลร้านและการรับชำระ`, and confirm the Delivery fee card shows the green plus-icon `เพิ่มตัวเลือกค่าส่ง` button in the top-right, aligned row number badges, placeholder examples such as `รับเองที่ร้าน` or `ระยะทาง 1-2 กิโลเมตร`, and red X icon buttons for removing rows. Add/edit Delivery fee option rows, save store settings, then open `/delivery` and confirm the dropdown still shows the custom labels and applies the selected fee to subtotal/total before order creation.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the polished Delivery fee editor UI, custom option save/load, Delivery dropdown display, and order totals with selected delivery fee labels.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
