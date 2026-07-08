# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Local Stock Deduction Idempotency
Version: 0.14.08
Build: 2026.07.08.021

Change: hardened local POS sale persistence so saving the same stable saleId again reuses the existing local sale and does not deduct local stock or append duplicate stock movement rows.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing PromptPay QR display, tax buyer DBD lookup, tax invoice history/reprint, later full tax invoice issuing from existing receipts, receipt behavior, stock deduction, offline sale sync, POS theme alignment, mobile product card overlay behavior, mobile button layout, payment modal visual tuning, and printable document fonts are unchanged.

Full tax invoice duplicate workflow: issuing a full tax invoice first checks the local tax invoice cache, then checks Firestore by deterministic tax invoice IDs and loaded `taxInvoices` rows. If an existing invoice matches the sale ID or sale number, the app reuses and caches that invoice instead of creating a new document. If the Firestore transaction path cannot reserve/write the invoice, the fallback remains local/pending and does not write to Firestore outside a transaction.

Full tax invoice pending sync workflow: opening `/pos/tax-invoices/`, returning online on that page, or opening the receipt popup's full tax invoice flow retries local `pending_create`/`local_only` invoices through the same Firestore transaction path used for online issuing. The sync first rechecks for an existing remote invoice for the sale, caches any match, and only creates through the transaction-safe running-number reservation path. Local `pending_void`/`local_void` cancellations are also retried through the transaction void path without changing the source sale, VAT totals, payment, or stock data.

Full tax invoice sync visibility workflow: the full tax invoice create/reuse path now attempts pending sync before checking local duplicates when online, so local queued documents have a chance to become official before staff open/reissue them. `/pos/tax-invoices/` shows clear badges for `รอ Sync`, `เอกสารในเครื่อง`, and `เลขชั่วคราว` so offline/local fallback states can be validated without inspecting localStorage.

Customer Display pairing QR gradient workflow: hovering or focusing `เชื่อมอุปกรณ์` opens the device-pairing QR panel with a top-to-bottom green fade. The top edge and upper background are opaque/darker green, the lower edge and lower background become transparent enough to show underlying cart text, copy stays solid green on subtle translucent backplates, the POS button stays green, and the QR code remains on a clean white scan surface.

POS VAT/payment workflow: when the store is VAT registered, a blank or zero saved VAT rate falls back to 7% so include-VAT carts split totals correctly, for example 114.00 becomes before VAT 106.54, VAT 7.46, and net total 114.00. The payment modal and safe-confirm guard parse received cash the same way, so received 120.00 against 114.00 displays and saves a 6.00 change amount. Customer Display receives the corrected totals and only shows include/exclude VAT mode when POS VAT controls are active.

POS receipt VAT mode workflow: `/pos/receipt/` prints VAT sales with `ยอดก่อน VAT`, `VAT {rate}%`, and `โหมด VAT` whose value is `ราคารวม VAT` or `ราคาไม่รวม VAT`. The VAT mode row is informational and must not show a dash as an amount.

POS local stock idempotency workflow: local POS checkout stores the sale before Firebase sync and deducts local stock once per stable saleId. If the same saleId is saved again because of a re-entrant click, retry, or cached script overlap, the app preserves the existing local sale, skips product stock changes, and avoids adding duplicate local stock movement rows.

Full tax invoice A4 pagination workflow: `/pos/tax-invoice/` prints as `ใบกำกับภาษี`, labels the buyer block `ผู้ซื้อ / ลูกค้า`, and keeps document metadata labels such as `อ้างอิงบิล` separated from long values. A4 print pages show at most 10 line items per page. When an invoice has more than 10 items, each continuation page repeats the invoice header and buyer block, item numbering continues from the previous page, and totals/signatures render only on the final page.

Payment customer picker workflow: customer names in the payment modal result list use font-weight 500 or lighter so selected customers remain readable without looking overly bold.

Customer Display PromptPay workflow: `/pos/customer-display/` stacks `ชำระผ่าน PromptPay / โอนเงิน`, the total amount in baht, the enlarged centered QR, and the account owner name inside the total card. The presentation uses the classic white and green theme with green text and borders. The `ขอบคุณที่ใช้บริการ` badge stays pinned to the bottom edge of the card, centered on one line, and uses font-weight 500 or lighter.

Customer Display pairing QR workflow: hovering or focusing `เชื่อมอุปกรณ์` opens the device-pairing QR panel above the cart and total cards so the QR remains fully visible on the top layer of the Customer Display page.

Customer Display pairing QR polish: the pairing QR hover panel should use the wider two-column layout on PC, extend left from the button, and stay readable in white/green without gradient or glass effects.

Customer Display cart count workflow: the `รายการในบิล` header count badge uses green text, a light green background, and a defined chip shape so item counts remain readable.

Customer Display classic green workflow: the Customer Display visual theme uses a white background, solid green action bar, white cards, green text, green borders, and no gradient/glass effects. QR image surfaces remain white so scan reliability and visual clarity are preserved.

Later tax invoice workflow: staff can open `/pos/tax-invoices/`, search the original POS sale number from an existing short tax invoice/receipt, review the source sale, enter buyer tax details, and issue or reopen the one full tax invoice allowed for that sale.

Tax profile and void workflow: staff can open `/pos/tax-invoices/`, manage saved buyer tax profiles from `โปรไฟล์ภาษีลูกค้า`, and cancel an issued full tax invoice with a reason. Online cancellation uses a Firestore transaction that reads the invoice before writing the void status. If transaction sync is unavailable, the local invoice is marked pending/local void without changing the source sale, VAT total, payment, or stock data.

PromptPay QR workflow: staff can set PromptPay status, PromptPay ID, and the displayed account name in `/pos/settings/`. When the POS payment method is PromptPay / transfer, the payment modal shows a QR for the exact payable amount and Customer Display shows the same QR with amount, shop name, receiver, masked PromptPay ID, origin, and verified tenant/source context.

POS PromptPay payment modal workflow: in PC mode, the POS payment modal keeps the member picker and loyalty controls compact enough that `รับเงินมา` and `เงินทอน` stay visible without scrolling. The PromptPay QR card shows the QR title, amount, QR image, and receiver line only; it does not repeat the shop name or source URL inside the modal.

Display layout workflow: in PC mode, `/pos/customer-display/` keeps the customer card and total/payment QR card stacked in the left column, keeps the cart card in a separate right column, matches the combined left-column height to the cart card height, and keeps the thank-you message visible even on shorter PC screens.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
