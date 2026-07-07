# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.00
Build: 2026.07.08.013
Milestone: Customer Display Pairing QR Gradient Polish

Change: tuned only the Customer Display device-pairing QR hover panel with a vertical green fade from opaque top to translucent bottom, a matching green opacity border, readable white copy over the darker area, and a clean white QR surface for reliable scanning.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/customer-display/`, hover or focus `เชื่อมอุปกรณ์`, and verify only the device-pairing QR panel uses the new top-to-bottom green gradient fade. The upper panel and top border should be solid/darker green, the lower panel and lower border should become translucent, panel text remains readable, and the QR image itself remains on a clean white surface. Recheck POS include-VAT totals, cash/change calculation, Customer Display VAT snapshot, and payment customer-picker text weight from the prior build remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test the Customer Display device-pairing QR gradient hover panel on PC and mobile widths, then recheck POS include-VAT totals, cash/change calculation, and Customer Display VAT snapshot with real POS payment data.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
