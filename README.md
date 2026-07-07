# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Customer Display Classic Green Polish
Version: 0.13.97
Build: 2026.07.08.010

Change: polished `/pos/customer-display/` classic green theme by changing cart item separators to dashed lines and tightening the pairing QR hover panel so its text and action button remain readable without covering too much of the cart.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing PromptPay QR display, tax buyer DBD lookup, tax invoice creation duplicate protection, tax invoice history/reprint, later full tax invoice issuing from existing receipts, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, offline sale sync, POS theme alignment, mobile product card overlay behavior, mobile button layout, payment modal visual tuning, and printable document fonts are unchanged.

Customer Display PromptPay workflow: `/pos/customer-display/` stacks `ชำระผ่าน PromptPay / โอนเงิน`, the total amount in baht, the enlarged centered QR, and the account owner name inside the total card. The presentation uses the classic white and green theme with green text and borders. The `ขอบคุณที่ใช้บริการ` badge stays pinned to the bottom edge of the card, centered on one line, and uses font-weight 500 or lighter.

Customer Display pairing QR workflow: hovering or focusing `เชื่อมอุปกรณ์` opens the device-pairing QR panel above the cart and total cards so the QR remains fully visible on the top layer of the Customer Display page.

Customer Display pairing QR polish: the pairing QR hover panel should stay compact, centered, readable, and white/green without gradient or glass effects.

Customer Display cart count workflow: the `รายการในบิล` header count badge uses green text, a light green background, and a defined chip shape so item counts remain readable.

Customer Display classic green workflow: the Customer Display visual theme uses a white background, solid green action bar, white cards, green text, green borders, and no gradient/glass effects. QR image surfaces remain white so scan reliability and visual clarity are preserved.

Later tax invoice workflow: staff can open `/pos/tax-invoices/`, search the original POS sale number from an existing short tax invoice/receipt, review the source sale, enter buyer tax details, and issue or reopen the one full tax invoice allowed for that sale.

Tax profile and void workflow: staff can open `/pos/tax-invoices/`, manage saved buyer tax profiles from `โปรไฟล์ภาษีลูกค้า`, and cancel an issued full tax invoice with a reason. Online cancellation uses a Firestore transaction that reads the invoice before writing the void status. If transaction sync is unavailable, the local invoice is marked pending/local void without changing the source sale, VAT total, payment, or stock data.

PromptPay QR workflow: staff can set PromptPay status, PromptPay ID, and the displayed account name in `/pos/settings/`. When the POS payment method is PromptPay / transfer, the payment modal shows a QR for the exact payable amount and Customer Display shows the same QR with amount, shop name, receiver, masked PromptPay ID, origin, and verified tenant/source context.

Display layout workflow: in PC mode, `/pos/customer-display/` keeps the customer card and total/payment QR card stacked in the left column, keeps the cart card in a separate right column, matches the combined left-column height to the cart card height, and keeps the thank-you message visible even on shorter PC screens.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
