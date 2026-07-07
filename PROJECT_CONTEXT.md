# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.01
Build: 2026.07.08.014
Milestone: Customer Display Transparent Pairing QR Polish

Change: refined only the Customer Display device-pairing QR hover panel so the gradient fades from dark green at the top to true transparency at the bottom, allowing underlying cart text to show through. Panel text now uses solid green with small translucent text backplates, and the `เปิด POS สำหรับจอนี้` button uses a solid green treatment.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/customer-display/`, hover or focus `เชื่อมอุปกรณ์`, and verify only the device-pairing QR panel fades from dark green at the top to transparent at the bottom. The cart/list text underneath should remain visible through the lower part of the panel, the panel copy should be solid green on small translucent backplates, the POS button should be green, and the QR image itself should remain on a clean white scan surface. Recheck POS include-VAT totals, cash/change calculation, Customer Display VAT snapshot, and payment customer-picker text weight remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test the transparent Customer Display device-pairing QR hover panel on PC and mobile widths, then recheck POS include-VAT totals, cash/change calculation, and Customer Display VAT snapshot with real POS payment data.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
