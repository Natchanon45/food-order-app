# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.60
Build: 2026.07.15.003
Milestone: Validation Feedback Under Fields

Change: Updated shared Bootstrap-style validation for web forms across Order/Delivery, Admin, Register, and Retail POS so invalid fields show red feedback text directly under the field and shared forms suppress native browser validation bubbles. Fields become red when required data is missing or native format rules fail after touch/submit, become green when filled and valid, and optional empty fields remain neutral. Printable receipt/tax documents are skipped. This is presentation-only and does not change tenant data, orders, VAT, payments, stock, offline sync, duplicate protection, or tax invoice transactions.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/admin`, `/delivery`, `/register`, `/pos/settings/`, `/pos/products/`, and `/pos/tax-invoices/` after a hard refresh. Touch or submit required fields to verify invalid fields show red and display a red message directly under the field, then enter valid values to verify green success styling and hidden feedback. Confirm optional blank fields remain neutral and print/receipt/tax document surfaces do not receive validation borders or messages.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and verify the validation layer loads through `ui.js?v=20260715-003`, `auth-service.js?v=20260715-003`, `retail-pos-navigation.js?v=20260715-003`, and `public-register.js?v=20260715-003`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
