# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Tax Void Transaction Validation
Version: 0.14.26
Build: 2026.07.10.001

Change: online full tax invoice void transactions now validate the Firestore document before writing `status: void`, confirming tenant, invoice number, and source sale identity when those fields are available. Validation mismatches stop the void instead of falling back to a local pending void, preserving source sale, VAT, payment, stock, duplicate protection, and Firestore read-before-write behavior.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing PromptPay QR display, tax buyer DBD lookup, tax invoice history/reprint, later full tax invoice issuing from existing receipts, receipt behavior, stock deduction, offline sale sync, POS theme alignment, mobile product card overlay behavior, mobile button layout, payment modal visual tuning, and printable document fonts are unchanged.

Admin QR/collapse workflow: `/admin` Delivery and Takeaway QR copy buttons show a single `คัดลอกลิงก์` label with the clipboard icon. All collapsible admin cards are initialized as collapsed on every page load, and the legacy `admin_collapsed_cards_v1` browser state is cleared/ignored so old expanded sessions do not reopen cards automatically.

Admin sales report card workflow: the `รายงานยอดขาย` card is not collapsible and should not render a chevron toggle. Staff open the sales report only through the eye/report button on that card.

Custom Delivery fee workflow: `/admin` lets staff add, remove, rename, and price Delivery fee options such as `รับที่ร้าน` or `ระยะทาง 0-2 กิโลเมตร`. The options are saved to store settings as `deliveryFeeOptions` with tenant-scoped settings data, while the legacy `deliveryFeeNearby`, `deliveryFeeGeneral`, and `deliveryFeeFar` values remain populated for fallback compatibility. `/delivery` shows these custom options in the delivery-zone dropdown and saves the selected option ID, label, fee, subtotal, and total on the order.

Custom Delivery fee UI workflow: the `เพิ่มตัวเลือกค่าส่ง` action sits in the upper-right of the Delivery fee card as a green primary button with a plus icon. Delivery fee rows use clearer spacing, input-aligned row number badges, placeholder examples for option names, fee inputs, and red X icon remove buttons while preserving the saved `deliveryFeeOptions` data shape.

Tax invoice label workflow: POS receipt and tax invoice history user-facing Thai labels use `ใบกำกับภาษี` consistently across the receipt action button, buyer data dialogs, tax invoice history title, late-issue panel, empty state, profile helper copy, and void dialog. This wording polish does not change `taxInvoices` data, duplicate protection, sync, or void transaction behavior.

Tax buyer profile sync workflow: saved buyer tax profiles from `/pos/tax-invoices/` are stored locally first for offline use and sync to `tenants/{tenantId}/taxBuyerProfiles` when Firebase is online. Opening the profile dialog or tax invoice history merges local and remote profiles by stable profile ID, keeps tenant boundaries intact, and does not alter issued invoices, source sales, VAT totals, payments, or stock data.

Tax buyer profile delete sync workflow: deleting a buyer tax profile hides it from the local profile list immediately and stores a tenant-scoped delete tombstone when the browser is offline. The next online tax profile sync deletes the matching Firestore document from `tenants/{tenantId}/taxBuyerProfiles` and keeps older remote copies from being merged back into the local profile list.

Tax void sync diagnostics workflow: if an online full tax invoice void transaction cannot complete and the app falls back to a local `local_void`/`pending_void` state, the invoice records `syncError`, `syncErrorAt`, `syncAttemptedAt`, and `syncAttemptCount`. `/pos/tax-invoices/` surfaces those diagnostics through the existing `Sync Error` badge and search text while preserving retry behavior and never mutating the source sale, VAT, payment, or stock data.

Tax sync diagnostic visibility workflow: `/pos/tax-invoices/` renders sync diagnostics as readable card text when `syncError` exists, including the concise error, retry attempt count, and latest sync attempt time when available. This is display-only and does not change full tax invoice create, void, retry, VAT, payment, or stock behavior.

Tax sync retry action workflow: `/pos/tax-invoices/` shows `ลอง Sync` on invoice cards that have `syncError`, `pending_create`, `pending_void`, `local_only`, or `local_void`. The action calls the same page refresh flow that runs pending tax invoice sync and tax buyer profile sync, and does not introduce a separate Firestore write path.

Tax sync retry button state workflow: when staff click `ลอง Sync`, the button is disabled and changes to `กำลัง Sync...` until the existing tax invoice history refresh/sync flow finishes rendering. This prevents accidental duplicate clicks without adding a separate sync worker or Firestore write path.

Tax sync single-flight workflow: `syncPendingTaxInvoices()` keeps one in-flight pending tax invoice sync promise per browser tab. If page load, online reconnect, receipt popup, or `ลอง Sync` calls it while a sync is already running, the later caller waits for the same create/void retry cycle instead of starting a second overlapping run. The create and void paths still use the existing duplicate checks and Firestore read-before-write transactions.

Tax void transaction validation workflow: online full tax invoice voiding reads the target `taxInvoices/{taxInvoiceId}` document in a Firestore transaction, validates tenant ownership plus invoice number and source sale identity when present, then writes only the void status metadata. If validation detects a mismatched tenant, invoice number, or source sale, the operation fails and does not create a local pending-void fallback.

Full tax invoice duplicate workflow: issuing a full tax invoice first checks the local tax invoice cache, then checks Firestore by deterministic tax invoice IDs and loaded `taxInvoices` rows. If an existing invoice matches the sale ID or sale number, the app reuses and caches that invoice instead of creating a new document. If the Firestore transaction path cannot reserve/write the invoice, the fallback remains local/pending and does not write to Firestore outside a transaction.

Full tax invoice pending sync workflow: opening `/pos/tax-invoices/`, returning online on that page, or opening the receipt popup's full tax invoice flow retries local `pending_create`/`local_only` invoices through the same Firestore transaction path used for online issuing. The sync first rechecks for an existing remote invoice for the sale, caches any match, and only creates through the transaction-safe running-number reservation path. Local `pending_void`/`local_void` cancellations are also retried through the transaction void path without changing the source sale, VAT totals, payment, or stock data.

Full tax invoice sync visibility workflow: the full tax invoice create/reuse path now attempts pending sync before checking local duplicates when online, so local queued documents have a chance to become official before staff open/reissue them. `/pos/tax-invoices/` shows clear badges for `รอ Sync`, `เอกสารในเครื่อง`, and `เลขชั่วคราว` so offline/local fallback states can be validated without inspecting localStorage.

Customer Display pairing QR gradient workflow: hovering or focusing `เชื่อมอุปกรณ์` opens the device-pairing QR panel with a top-to-bottom green fade. The top edge and upper background are opaque/darker green, the lower edge and lower background become transparent enough to show underlying cart text, copy stays solid green on subtle translucent backplates, the POS button stays green, and the QR code remains on a clean white scan surface.

POS VAT/payment workflow: when the store is VAT registered, a blank or zero saved VAT rate falls back to 7% so include-VAT carts split totals correctly, for example 114.00 becomes before VAT 106.54, VAT 7.46, and net total 114.00. The payment modal and safe-confirm guard parse received cash the same way, so received 120.00 against 114.00 displays and saves a 6.00 change amount. Customer Display receives the corrected totals and only shows include/exclude VAT mode when POS VAT controls are active.

POS receipt VAT mode workflow: `/pos/receipt/` prints VAT sales with `ยอดก่อน VAT`, `VAT {rate}%`, and `โหมด VAT` whose value is `ราคารวม VAT` or `ราคาไม่รวม VAT`. The VAT mode row is informational and must not show a dash as an amount.

POS local stock idempotency workflow: local POS checkout stores the sale before Firebase sync and deducts local stock once per stable saleId. If the same saleId is saved again because of a re-entrant click, retry, or cached script overlap, the app preserves the existing local sale, skips product stock changes, and avoids adding duplicate local stock movement rows.

POS offline sync module workflow: `/pos` loads one active offline sale sync worker URL and the sync status chip imports that same worker URL, so manual Sync/Retry buttons operate on the same queue snapshot, retry timers, and worker state as the background offline sync process.

POS Developer Panel workflow: all POS pages that load the shared toast/status module now receive the current `app-info` build chain, so the Developer Panel shows the current version, build, milestone, and commit instead of the older POS hardening metadata.

Full tax invoice offline void sync workflow: if a full tax invoice was issued locally/offline and then voided before it reached Firestore, the pending sync flow creates the official invoice online through the transaction-safe TAX running-number path and immediately voids it through the Firestore void transaction. This keeps the document audit trail complete and prevents `local_void` documents from retrying forever when no remote invoice exists yet.

POS Developer Panel tax sync build workflow: the Developer Panel metadata now follows the full tax invoice offline void sync milestone through the `retail-toast-status -> app-version-badge -> app-info` cache chain, so staff can verify the deployed POS pages are on the latest tax sync hardening build.

Full tax invoice sync error visibility workflow: pending local full tax invoices record `syncError`, `syncErrorAt`, `syncAttemptedAt`, and `syncAttemptCount` when automatic sync is skipped or fails. `/pos/tax-invoices/` shows a `Sync Error` badge and includes the concise error message on the invoice card and in search, so staff can identify missing buyer data or transaction failures without opening localStorage.

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
