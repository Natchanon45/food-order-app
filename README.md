# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS PromptPay QR Payment Display
Version: 0.13.84
Build: 2026.07.07.028

Change: added PromptPay / transfer payment QR support to the Retail POS payment modal and Customer Display, with shop payment settings stored under POS settings.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing tax buyer DBD lookup, tax invoice creation duplicate protection, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, offline sale sync, POS theme alignment, mobile product card overlay behavior, mobile button layout, payment modal visual tuning, and printable document fonts are unchanged.

Later tax invoice workflow: staff can open `/pos/tax-invoices/`, search the original POS sale number from an existing short tax invoice/receipt, review the source sale, enter buyer tax details, and issue or reopen the one full tax invoice allowed for that sale.

PromptPay QR workflow: staff can set PromptPay status, PromptPay ID, and the displayed account name in `/pos/settings/`. When the POS payment method is PromptPay / transfer, the payment modal shows a QR for the exact payable amount and Customer Display shows the same QR with amount, shop name, receiver, masked PromptPay ID, origin, and verified tenant/source context.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
