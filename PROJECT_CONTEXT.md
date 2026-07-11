# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.37
Build: 2026.07.11.007
Milestone: Tax Sync Recovery Action

Change: tax invoice history now shows a display-only `คำแนะนำ` recovery action for retryable tax invoice sync states and includes `Recommended Action` in `คัดลอก Sync`, helping staff choose between `แก้ผู้ซื้อ`, `ลอง Sync`, `ดูบิลต้นทาง`, or `ส่ง Support` without mutating source sale, VAT, payment, stock, duplicate protection, or Firestore transaction behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/`, check retryable invoice cards for `คำแนะนำ`, and confirm `คัดลอก Sync` includes `Recommended Action` for support handoff.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the visible `คำแนะนำ`, searchable recommendation text, and copied `Recommended Action` line on production retryable tax invoice cards.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
