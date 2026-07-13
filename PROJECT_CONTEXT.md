# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.55
Build: 2026.07.13.003
Milestone: Unified Green UI Icon Polish

Change: Order/Delivery and Retail POS now share a cleaner green, black, and white UI polish layer. Main headings and primary action buttons receive single Bootstrap Icons where appropriate, the Order table title keeps its heading icon when runtime text changes, and the shared icon decorators guard against adjacent duplicate icons while skipping printable bill/tax document headers. This is presentation-only and does not change tenant data, orders, VAT, payments, stock, offline sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/delivery/`, `/order/`, and `/pos/` after a hard refresh. Verify the refreshed green/black/white cards, headers, heading icons, and action button icons. Check that buttons/cards do not show two adjacent icons, printable bill headers stay text-only, and no emoji appears in the UI.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify `/delivery/`, `/order/`, and `/pos/` load `app.css?v=20260713-003`, `retail-pos.css?v=20260713-003`, `ui.js?v=20260713-003`, `retail-pos-navigation.js?v=20260713-003`, and `retail-toast-status.js?v=20260713-003`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
