# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.04
Build: 2026.07.08.017
Milestone: POS Receipt VAT Mode Label Polish

Change: clarified the POS receipt VAT mode row so include/exclude VAT prints as `โหมด VAT` with `ราคารวม VAT` or `ราคาไม่รวม VAT` as the value instead of showing a confusing dash.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/receipt/?saleId=...` for a VAT sale. The receipt should show `ยอดก่อน VAT`, `VAT 7%`, then `โหมด VAT` with the value `ราคารวม VAT` or `ราคาไม่รวม VAT`; the row should no longer show `ราคารวม VAT` with `-` on the amount side. Recheck that VAT totals, received cash, change amount, full tax invoice issuing, pending invoice sync, and stock behavior remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: deploy hosting and test POS receipt VAT mode wording on include/exclude VAT sales, then continue pending full tax invoice create/void sync validation.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
