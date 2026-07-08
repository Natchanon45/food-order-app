# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.06
Build: 2026.07.08.019
Milestone: POS PromptPay Payment Modal Compact Polish

Change: compacted the POS payment modal in PC mode so PromptPay QR details, member/loyalty controls, received amount, and change are visible without scrolling; the PromptPay confirmation copy now shows only the receiver instead of repeating shop name and source URL.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos`, select a customer with points, choose `PromptPay / โอนเงิน`, and open the payment modal on a PC viewport. The QR card should show `QR PromptPay / โอนเงิน`, amount, QR, and `ผู้รับ ...` only, without separate shop/source URL copy. The member picker, loyalty box, received amount, and change row should fit in the PC modal without needing to scroll down.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test the POS PromptPay payment modal on PC with selected member/loyalty points, then continue pending full tax invoice create/void sync validation.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
