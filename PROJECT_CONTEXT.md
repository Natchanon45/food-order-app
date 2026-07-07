# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.88
Build: 2026.07.08.001
Milestone: Customer Display PromptPay Visual Refresh

Change: refreshed the Customer Display PromptPay and thank-you presentation. The PromptPay panel is centered in the total card, stacks the payment heading, total amount, enlarged QR, and account name in order, uses livelier mixed color accents, and keeps the thank-you badge pinned to the bottom edge of the card with single-line centered text at font-weight 500 or lighter.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, and Customer Display PromptPay visual refresh.

Usage: open `/pos/customer-display/` with a PromptPay payment snapshot, including short PC screens such as 1912x870, and verify the total card shows `ชำระผ่าน PromptPay / โอนเงิน`, the total amount in baht, the largest centered QR that fits, and the account name below it. Verify the `ขอบคุณที่ใช้บริการ` badge stays at the bottom edge of the total card, remains centered on one line, and does not exceed font-weight 500. Verify receipt behavior, one-full-tax-invoice-per-sale duplicate protection, VAT totals, stock deduction, offline sale sync, Customer Display sync, and printable document fonts remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: test Customer Display PromptPay on real POS payment data after deploy, then continue validating tax profile and void workflow with synced Firestore data.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
