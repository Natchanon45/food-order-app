# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Customer Display Cart Count Contrast
Version: 0.13.91
Build: 2026.07.08.004

Change: improved `/pos/customer-display/` cart count badge contrast so counts like `11 รายการ` stay readable against the liquid-glass cart header, while keeping the pairing QR layer, PromptPay card, and bottom-pinned thank-you badge.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing PromptPay QR display, tax buyer DBD lookup, tax invoice creation duplicate protection, tax invoice history/reprint, later full tax invoice issuing from existing receipts, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, offline sale sync, POS theme alignment, mobile product card overlay behavior, mobile button layout, payment modal visual tuning, and printable document fonts are unchanged.

Customer Display PromptPay workflow: `/pos/customer-display/` stacks `ชำระผ่าน PromptPay / โอนเงิน`, the total amount in baht, the enlarged centered QR, and the account owner name inside the total card. The presentation now uses a white/green/black glass style with dark and soft green layers. The `ขอบคุณที่ใช้บริการ` badge stays pinned to the bottom edge of the card, centered on one line, and uses font-weight 500 or lighter.

Customer Display pairing QR workflow: hovering or focusing `เชื่อมอุปกรณ์` opens the device-pairing QR panel above the cart and total cards so the QR remains fully visible on the top layer of the Customer Display page.

Customer Display cart count workflow: the `รายการในบิล` header count badge uses high-contrast white text, a dark green glass background, and a defined chip shape so item counts remain readable.

Later tax invoice workflow: staff can open `/pos/tax-invoices/`, search the original POS sale number from an existing short tax invoice/receipt, review the source sale, enter buyer tax details, and issue or reopen the one full tax invoice allowed for that sale.

Tax profile and void workflow: staff can open `/pos/tax-invoices/`, manage saved buyer tax profiles from `โปรไฟล์ภาษีลูกค้า`, and cancel an issued full tax invoice with a reason. Online cancellation uses a Firestore transaction that reads the invoice before writing the void status. If transaction sync is unavailable, the local invoice is marked pending/local void without changing the source sale, VAT total, payment, or stock data.

PromptPay QR workflow: staff can set PromptPay status, PromptPay ID, and the displayed account name in `/pos/settings/`. When the POS payment method is PromptPay / transfer, the payment modal shows a QR for the exact payable amount and Customer Display shows the same QR with amount, shop name, receiver, masked PromptPay ID, origin, and verified tenant/source context.

Display layout workflow: in PC mode, `/pos/customer-display/` keeps the customer card and total/payment QR card stacked in the left column, keeps the cart card in a separate right column, matches the combined left-column height to the cart card height, and keeps the thank-you message visible even on shorter PC screens.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
