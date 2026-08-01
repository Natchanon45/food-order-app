# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.16.6
Build: 2026.08.02.005

<!-- WAITING_QUEUE_TICKET_MODAL_READABILITY_20260802_005 -->
Waiting Queue ticket modal presentation rule:

The staff modal must prioritize the W-number, QR, party size, estimated wait, groups ahead, and received time at readable operational sizes. The raw private tracking URL is held in a hidden copy source rather than displayed in the modal; QR and copy actions remain unchanged.

<!-- WAITING_QUEUE_TABLE_SESSION_BRIDGE_20260802_004 -->
Waiting Queue table-session bridge rule:

A seated Waiting Queue table must use the canonical restaurant session fields `status: occupied`, non-empty `orderToken`, `sessionStartedAt`, numeric `currentRound`, and list `orderIds`. The customer order URL must include the tenant storefront slug, table code, and active token. Existing seated rows missing this contract may be repaired only for the same stable queue/table relationship through the transaction-safe seating path.

Customer table orders inherit `waitingQueueId` and `waitingQueueNumber` from the validated active table session. Closing or moving the table continues to use the existing Table QR/Cashier workflows.

<!-- WAITING_QUEUE_TICKET_PRINT_POLISH_20260802_003 -->
Waiting Queue ticket print rule:

Printed customer tickets use local TH Sarabun PSK regular and bold font files, a fixed 80 x 160 mm receipt page, and defer `window.print()` until the font set and QR image are ready. The ticket may show the stable W-number, party size, suitable groups ahead, estimated wait, received time, tracking URL, and privacy guidance, but never customer name or phone number.

<!-- WAITING_QUEUE_IMMEDIATE_TICKET_HANDOFF_20260802_002 -->
Waiting Queue immediate ticket handoff rule:

Successful staff intake opens the canonical customer ticket dialog directly. The same stable queue object drives the W-number, local QR tracking URL, estimate, received time, copy action, and 80 mm print output. This presentation handoff must not add another queue write or expose customer PII.

<!-- WAITING_QUEUE_RUNTIME_REPAIR_20260802_001 -->
Waiting Queue authoritative mirror and deterministic order rule:

Public and Board documents are replaceable privacy-safe mirrors. Staff status and seating operations must not merge unknown legacy fields into these mirrors.

Table opening may create or idempotently update only the deterministic empty order `order-wq-{waitingQueueId}` for the same tenant and queue. The table patch is restricted to the existing Waiting Queue occupation fields, and the private queue, table, order, dedupe record, mirror records, and audit remain protected by the transaction's read-before-write sequence.

A QR ticket modal must retain one QR render target and must not display the library fallback image together with its canvas.


<!-- WAITING_QUEUE_TICKET_QR_CALL_RECOVERY_20260801_006 -->
Waiting Queue ticket, audio-arm, and call authorization rule:

Customer QR tickets encode only the existing privacy-safe tracking URL. Printed tickets may show the W-number, party size, estimated wait, received time, and QR Code, but must not print customer name, phone, phone hash, special note, or control/audit metadata. QR generation must execute locally.

Arming public-display audio may play a chime but must not speak a synthetic `sound enabled` sentence. Spoken output is reserved for real queue numbers and retains the operator-gesture requirement.

Staff queue calls must use the tenant from the authenticated role-guard profile before generic Local Storage candidates. Firestore authorization must remain tenant-scoped through active user profile, membership, tenant ownership, or validated claims. Legacy identity backfill is allowed only when the document ID and tenant remain stable.


<!-- WAITING_QUEUE_OWNER_ACCESS_DIALOG_20260801_005 -->
Waiting Queue authoritative tenant and modal action rule:

For authenticated staff, the tenant ID from the active `users/{uid}` profile is authoritative over generic browser keys. A mismatched local tenant must never be used to write or drain an outbox under another tenant. The old cache may be retained for recovery but is excluded from the active tenant workflow.

Waiting Queue Firestore authorization must verify one of: an active allowed-role user profile matching the tenant, an active canonical membership, tenant ownership, or validated tenant/role Auth claims. Every queue write still requires tenant equality and stable document identity. Legacy compatibility permits only same-tenant idempotent identity backfills.

Waiting Queue modal actions use inset responsive footers with balanced buttons and accessible icons. Styling must not alter the read-before-write table seating transaction or duplicate protection.


<!-- WAITING_QUEUE_USABILITY_PERMISSION_20260801_004 -->
Waiting Queue permission and accessibility rule:

Waiting Queue write access must use the same tenant membership and allowed staff roles as the rest of the application: owner, admin, manager, cashier, or super_admin. The legacy tenant-map checks remain fallback compatibility only. Public customer response and public display privacy rules remain unchanged.

Waiting Queue validation layout rule: required-field feedback must not change input width or push action buttons out of balance. The add-queue dialog uses stable two-column desktop controls, responsive mobile stacking, and equal action widths with accessible icons.

Waiting Queue readability rule: operational staff/customer text must remain legible at normal browser zoom on PC and mobile. Public display icons must be centered in their visual badges. Spoken W-numbers must pronounce each digit separately and end with a polite Thai instruction.


<!-- WAITING_QUEUE_CONFLICT_RECOVERY_20260801_003 -->
Waiting Queue conflict-recovery rule: Firebase is authoritative when local pending state is stale.

A terminal remote queue state must never be replaced by an older local call, defer, cancel, or create operation. The ordered outbox may discard an operation only after reading the matching remote queue and proving that the operation is already applied, superseded, or invalid because the remote queue is final. A delayed create operation must read the existing queue document before any write and must never reset an existing queue to its initial state.

Waiting Queue contention rule: transactions retain read-before-write ordering and use a bounded retry budget. Background public/board snapshot refreshes must be coalesced and skipped when their nonvolatile payload is unchanged, so presentation mirrors do not continuously contend with staff status or seating transactions.

Waiting Queue local-cache rule: snapshot merges may show an optimistic local row only while a matching outbox operation exists, the remote queue is not final, and the optimistic version is newer. Remote rows otherwise replace conflict/error cache state. Cache writes must not recursively dispatch unchanged local snapshots.


<!-- WAITING_QUEUE_UI_20260801_002 -->
Waiting Queue canonical UI rule: `/waiting-queue/` is the only staff-management surface for table waiting queues. `/cashier/waiting-queue` may redirect to it, but must not maintain a second independent queue workflow. Legacy `/queue?token=...` links may retain their original data source and receive presentation-only compatibility until migration is explicitly approved.

Waiting Queue navigation rule: the home page must show a normal dashboard card or header action. A fixed bottom-right shortcut is prohibited. The staff waiting-queue page must not load the Retail POS navigation drawer.

Waiting Queue dialog rule: add-queue and open-table workflows use centered, responsive dialogs with explicit labels and selectable table cards. The open-table action must continue to use the existing tenant-scoped read-before-write transaction and must not create a second order or seat the same queue twice.

Waiting Queue display audio rule: audio starts only after an operator gesture. Enabled mode means chime plus spoken Thai queue number when supported, and the UI must explicitly identify a chime-only fallback. No customer personal data may appear on the public display.

Milestone: Waiting Queue Runtime Repair

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Waiting queue architecture rule: table waiting queues are a distinct domain from food/order queues. Each record uses a stable `waitingQueueId`, an immutable customer tracking token, a daily W-number, `tenantId`, explicit status, version, applied operation IDs, and audit history. Queue records must never be physically deleted. Staff intake is local-first and reserves blocks of daily W-numbers while online. During a temporary outage, unused leased numbers remain stable; if the lease is exhausted, intake stops with a clear warning rather than issuing or later changing the customer’s queue number.

Waiting queue fairness rule: table recommendations first enforce capacity and special-needs compatibility, then favor the longest effective wait. Priority groups may move ahead only within the configured near-time window. Any manual table mismatch or fair-order bypass requires a reason and records the actor, device, recommended queue, skipped queues, table, and linked order in `waitingQueueAudits`.

Waiting queue seating transaction rule: opening a table must be online and use one Firestore transaction. The transaction reads the waiting queue, table, deterministic order, public snapshot, and dedupe record before any write; confirms the queue remains active and the table remains free; then atomically marks the queue seated, occupies the table, creates/reuses the linked order, updates the privacy-safe public snapshot, closes dedupe, and appends the audit record. The relation `tenantId + waitingQueueId + tableId + orderId` remains stable.

Waiting queue privacy and notification rule: customer-facing and public-display documents contain no customer name, phone, phone hash, or free-text note. Customer control tokens remain only in non-listable `waitingQueuePublic` documents; the listable `waitingQueueBoard` contains no token or customer-response controls. The public display shows W-numbers only. Browser notification is an optional secondary channel while the tracking page is open; in-store display/sound and staff controls remain authoritative.

POS product management dialog rule: `/pos/products` must not use browser-native `alert`, `confirm`, or `prompt` for product deletion, category deletion, stock-history clearing, or permission-denied feedback. These flows use the shared styled Sweet Dialog, and destructive actions execute only after an explicit asynchronous confirmation. This UI rule must not change tenant scope, product stock, sale stock movements, stable IDs, duplicate protection, or offline sync.

Retail catalog import readiness rule: `/pos/catalog` may compute client-side readiness counts from the master catalog and tenant product list so staff can see selected rows, verified ready rows, importable rows after the duplicate skip filter, rows skipped because SKU/barcode already exists, and draft rows waiting for verification. These counts and messages are UI guidance only. The actual import path must still import only published catalog items, keep imported stock at 0, keep products hidden from POS until staff review them, and avoid changing VAT, stock movements, sales, offline sync, duplicate protection, or tax invoice data.

Retail catalog preview filter rule: `/pos/catalog` may provide client-side search and status filters for the preview table across master product ID, SKU, barcode, product name, brand, category, and keywords. Preview filters must not alter selected categories, import rows, duplicate skip behavior, tenant product writes, stock values, stock movements, sales, offline sync, VAT, or tax invoice data.

Retail catalog import confirmation rule: before `/pos/catalog` writes imported products, the confirmation dialog may show client-side summary counts for importable rows, duplicate-skipped rows, and draft rows waiting for verification. This summary must be derived from the same selected category and duplicate skip logic used by the import button and must not create a separate import path, stock mutation, sale mutation, VAT mutation, offline sync mutation, duplicate-protection bypass, or tax invoice mutation.

Retail catalog review reason rule: `/pos/catalog` may show display-only reason text below each preview status badge so owners understand why a catalog row is ready, skipped as already existing, or waiting for verification. Reason text must be derived from already-loaded catalog fields and tenant product keys only and must not write catalog data, product data, stock, sales, VAT, offline sync, duplicate-protection state, or tax invoice data.

Retail catalog category shortcut rule: `/pos/catalog` may provide client-side category selection shortcuts such as select all, select categories with ready rows, and clear selection. These shortcuts may update selected category IDs, readiness counts, preview rows, and the import button state, but must not bypass the published-only import rule, duplicate skip rule, tenant product write path, stock values, stock movements, sales, offline sync, VAT, or tax invoice data.

Retail catalog preview count rule: `/pos/catalog` may show live row counts inside the preview status dropdown for all selected rows, importable rows, ready rows, existing rows, and draft/review rows. These counts must be derived from the selected categories, loaded tenant product keys, catalog row status, and the duplicate skip toggle only. They may guide filtering and preview review, but must not create a separate import path, bypass published-only import, mutate duplicate skip behavior, write tenant products, or alter stock, sales, VAT, payments, offline sync, duplicate protection, or tax invoice data.

Retail catalog import result rule: after `/pos/catalog` successfully imports published catalog rows, the page may show a client-side success panel with imported counts, imported SKU/name examples, a link to the product management page, and a copy-SKU helper. This panel must be derived only from the rows already passed to the existing import save path. It must not write extra product data, change imported stock defaults, show products on POS automatically, create stock movements, alter duplicate skip behavior, or mutate sales, VAT, payments, offline sync, duplicate protection, or tax invoice data.

Retail catalog post-import checklist rule: the `/pos/catalog` success panel may display guidance-only checklist steps such as verifying prices, setting stock, and enabling POS visibility after import. These steps are operator reminders only and must not toggle `showOnPos`, change stock, create stock movements, update product prices, write product metadata, or mutate sales, VAT, payments, offline sync, duplicate protection, or tax invoice data.

POS printed receipt privacy rule: any Retail POS receipt or short tax invoice surface that can be printed must mask customer/member personal data through the shared receipt privacy helper. Printed customer names show the first 3-4 first-name characters and mask the rest, while surnames mask all but the final 3 characters. Printed phone numbers use `098-xxx-xx81`. Cashier-facing screen rows may show full customer data, but paper print output must use the masked format consistently across `/pos/receipt`, `/pos/sales` receipt detail, and customer sale receipts.

POS receipt VAT mode persistence rule: receipt print surfaces must display VAT from the saved sale row, not from the current default setting when the sale already has VAT fields. If a sale was saved with `vatMode: "include"`, the receipt must show `โหมด VAT` = `ราคารวม VAT`; if saved with `vatMode: "exclude"`, it must show `ราคาไม่รวม VAT`. The VAT mode row is informational and must not be rendered as an amount or dash placeholder.

POS offline sync remote reconcile rule: before retrying queued local POS sales, the offline sync worker should read `tenants/{tenantId}/sales/{saleId}` for each local queued sale that still lacks a valid synced flag. If the remote sale exists for the current tenant, the local row must be marked `syncStatus: "synced"` with `firebaseSyncedAt`, `offlineSyncHash`, `syncHashVersion`, and clean queue metadata, and the worker must not rewrite the sale, sale items, stock movements, product stock, or daily summary. This protects duplicate bills and duplicate stock cuts when a previous sync wrote Firestore successfully but the browser did not finish marking localStorage.

POS receipt reliability rule: receipt display code must not depend on a single sale-row timing path for customer/member and loyalty data. `/pos/receipt` and `/pos/sales` receipt reprint may recover customer name, customer code, phone, and loyalty point rows from the local customer cache and loyalty ledger using saleId, sale number, customerId, customerCode, or phone, while still masking printed personal data through the shared receipt privacy helper. Sale-history receipt reprints must fill store address, phone, tax ID, and branch from store settings when those receipt placeholders exist. These recovery steps are read-only presentation repair and must not create duplicate sales, stock movements, payments, or tax invoices.

POS local-first checkout rule: normal Retail POS checkout must persist the completed sale to localStorage first, open/print the short receipt from that local sale, and let the existing offline sync worker write the sale to Firestore in the background. The local sale must keep the same stable saleId that will be used remotely, include tenantId, customer/member fields, saved VAT fields, payment fields, and pending sync metadata, and locally deduct stock only once per stable saleId. A repeated local save with the same saleId must preserve the existing sale and must not add duplicate stock movement rows. Loyalty updates must patch local sale/customer/ledger data and notify receipt windows before waiting for any remote loyalty/customer write, and checkout may wait briefly for that local patch before opening the receipt, so printed receipts can show masked customer data and point rows even while Firebase sync is still pending.

Full tax invoice A4 pagination rule: `/pos/tax-invoice/` must render printable full tax invoices as fixed A4 pages. Each page repeats the invoice header, seller block, buyer block, and document metadata box; item tables must contain no more than 20 rows per page; each page displays a page counter such as `หน้า 1/2`; totals and signature lines render only on the final page and must not spill to a separate blank page. Seller and buyer tax ID rows append the relevant `สำนักงานใหญ่` or branch label on the same row. The print window must not depend on external icon CSS, and printable invoice headers stay text-only.

POS sale-history receipt reprint rule: `/pos/sales/` receipt detail and `/pos/receipt/` checkout receipts must use the same item-row language: `รายการ`, `ราคา`, and `รวม`, with quantity shown inline in the item name such as `สินค้า x 2`. Historical receipt printing should open the canonical `/pos/receipt/?saleId=...&auto=1` print window instead of printing the scrollable history modal, so shop name, address, phone, tax ID, masked customer/member data, saved VAT mode, loyalty rows, and receipt footer use the same rendering path as the original checkout receipt.

Receipt print readiness rule: `/pos/receipt/` and `/pos/tax-invoice/` should finish rendering and wait briefly for layout/fonts before invoking `window.print()`, especially for `auto=1` popup flows. Manual print buttons may call print synchronously once the page is marked ready. This is presentation timing only and must not mutate sale, VAT, stock, loyalty, or tax invoice data.

POS old sync reconcile rule: before retrying a completed local POS sale that is still marked pending/failed/syncing/conflict locally, the offline sync worker should check Firestore by stable local saleId and by known sale number/final sale number. If any matching remote sale exists under the current tenant, localStorage must be marked synced and the worker must skip the write transaction, sale item writes, stock movement writes, stock updates, and daily summary updates.

POS offline sync marker authority rule: for completed POS sales, local evidence that the sale already synced (`syncStatus: "synced"`, `firebaseSyncedAt`, or `syncedAt`) is authoritative for queue exclusion. `offlineSyncHash` is diagnostic metadata and may be refreshed if later local metadata changes make it differ, but a hash mismatch alone must not move an already-synced sale back to pending or re-enter the stock-deduction sync path. Queue counts and automatic scheduling should include only completed sales whose sync status is still eligible for processing; when that eligible queue is empty, the worker should remain idle instead of scheduling a page-load sync timer.

POS offline sync batch drain rule: the offline sale sync worker may limit each run to a small batch, currently 5 sales, but if more eligible queue rows remain after a successful run it must schedule another short drain cycle automatically. Staff should not need to reload or refocus `/pos` repeatedly to clear a large local pending queue.

POS safe-confirm fallback rule: `retail-pos-safe-confirm.js` is an explicit emergency fallback for stuck checkout UI only. It must not intercept normal `#confirmPaymentBtn` clicks, stop event propagation, or save every sale as local pending unless the button has `data-safe-confirm-fallback="1"` or `document.documentElement.dataset.retailPosSafeConfirm` is set to `enabled`. The normal `retail-pos.js` online checkout path remains the primary flow for Firestore transaction writes, duplicate protection, and stock deduction.

Form validation text-only rule: shared web form entry points should import `/assets/js/form-validation-ui.js` so inputs, selects, and textareas show consistent inline validation copy across Order/Delivery, Admin, Register, and Retail POS. Required or native-invalid fields show only red feedback text directly under the field after touch or submit, valid fields hide feedback without adding green success styling, and optional blank fields stay neutral. The validation layer must suppress native browser validation bubbles and must not change field shape, border, background, shadow, label color, icons, or emoji. Printable receipt/tax document surfaces remain skipped. This presentation layer must not change tenant data, order data, VAT, payments, stock, offline sync, duplicate protection, or tax invoice transactions.

Compound input validation rule: when shared validation is attached to compound controls such as barcode scanner rows, tax ID lookup rows, loyalty controls, payment customer controls, or input-with-action wrappers, the red feedback text must be inserted after the whole wrapper instead of inside the row. This keeps scanner/action buttons aligned and prevents validation text from changing the input layout.

Unified green UI icon rule: Order/Delivery and Retail POS web UI surfaces should use the shared green, black, and white visual language for app headers, panels, cards, inputs, and primary actions. Main headings and actionable buttons may include one appropriate Bootstrap Icon, but the UI must not render adjacent duplicate icons in a button/card, must not use emoji, and must not inject or display icons inside printable bill, receipt, return receipt, or tax invoice headers. This rule is presentation-only and must not change tenant data, order data, VAT, payments, stock, offline sync, duplicate protection, or tax invoice transactions.

Central dashboard icon rule: the signed-in `/` staff dashboard may use color-coded Bootstrap Icon chips for Order/Delivery and Retail POS entry cards plus the user menu to improve recognition. Icon color is presentation-only and must stay within the green/black/white layout system, must not add adjacent duplicate icons, must not use emoji, and must not affect role permissions, routing, tenant data, order data, VAT, payments, stock, offline sync, duplicate protection, or tax invoice transactions.

Shared icon color rule: authenticated user menus and Admin heading icons must use the shared color token mapping from `/assets/css/icons.css` and `admin-icon-polish.js` instead of page-local all-green or black-only overrides. The visual treatment is presentation-only, must keep one icon per menu row/button, must not add emoji, and must not alter role permissions, routing, tenant data, order data, VAT, payments, stock, offline sync, duplicate protection, or printable document headers.

Delivery fee options rule: store settings may include `deliveryFeeOptions`, an ordered list of tenant-scoped delivery choices with stable `id`, display `label`, and non-negative `fee`. Admin users can add, remove, rename, and price these options from `/admin`; the editor keeps the plus-icon add action in the card header, uses placeholder examples instead of a visible option-name caption, aligns row number badges with inputs, and uses red X icon buttons for row removal. The public `/delivery` page must render these labels and fees in the customer dropdown, apply the selected fee to totals, and persist `deliveryZone`, `deliveryZoneLabel`, and `deliveryFee` on the order. Legacy `deliveryFeeNearby`, `deliveryFeeGeneral`, and `deliveryFeeFar` values remain fallback-compatible when no custom option list exists.

Admin staff mobile table rule: `/admin/users` keeps the desktop employee table structure on small screens by wrapping it in a horizontal scroll container with a stable minimum width. Mobile layout must not stack table cells into narrow cards that hide role, active status, or save controls.

Delivery payment lock rule: `/delivery` should lock cart editing only for PromptPay / transfer checkout after the customer asks to review/pay, because the QR amount and attached slip must match the locked total. Cash-on-delivery (`cod`) does not need a QR/slip amount lock and must remain editable until the customer presses the final `ยืนยันคำสั่งซื้อ`: adding items, quantity changes, item notes, delivery fee option changes, and payment method changes stay enabled. If a restored session draft contains an old locked state but the selected method is COD, the lock must be discarded before the customer continues.

Font rule: all web UI screens, including standalone POS pages, buttons, forms, dialogs, and Customer Display, use the shared `--app-ui-font` Thai sans/no-head stack with `Kanit Local` loaded from `/assets/fonts/` as the primary UI font. The shared UI weight scale is regular 400, controls/secondary emphasis 500, and prominent UI headings/card labels 600; `Kanit Local` should map 700-900 UI requests to the SemiBold face or reduce runtime CSS/JS hardcoded weights to 500-600 so legacy heavy UI text does not render as ExtraBold/Black. Avoid reintroducing 700-900 weights for normal web UI text unless there is a specific accessibility or legal-document reason. POS UI button text must stay at font-weight 500 or lighter, and form labels/inputs should use normal weight. Printable paper documents such as receipts, tax invoices, QR tickets, invoices, quotations, and print pages use `--paper-font-local` / `--print-font`, with `TH Sarabun PSK Local` loaded from `/assets/fonts/` as the primary paper font and are excluded from the web UI weight cap.

Retail POS navigation rule: submenu expand/collapse controls must render exactly one Bootstrap Icons chevron, not text carets such as `^`, `v`, `⌃`, or `⌄`, not CSS pseudo chevrons, and not an additional context icon. Menu group buttons with `data-menu-group` must be skipped by the context icon injector, while menu links may still receive one context icon. The drawer title `เมนู POS` must not receive an injected context icon, and the icon system/CSS must also clean or hide the legacy injected icon if an older cached navigation module renders `<h2 data-pos-icon="list">เมนู POS</h2>`.

Current Customer Display rule: POS machines publish Customer Display snapshots to `customerDisplays/{displayId}`. Each POS has local `retail_pos_register_config` with `registerId` and `displayId`, and each display snapshot includes `tenantId`, `registerId`, `displayId`, `sessionId`, `status`, `items`, totals, and `updatedAt`.

Full Tax Invoice rule: full tax invoices are stored separately from sales in `taxInvoices/{taxInvoiceId}` and include `tenantId`, source sale reference, seller tax profile, buyer tax profile, line items, VAT summary, total, status, issued timestamp, and TAX running number metadata. The receipt popup can create/reuse one full tax invoice per sale and opens `/pos/tax-invoice/?invoiceId=...` for A4 printing. Buyer tax data is captured through a receipt-popup modal, prefilled from the sale or saved tax buyer profile, and saved locally for future reuse. When Firebase is online, issuing a full tax invoice must use a Firestore transaction that reads the existing invoice, counter, and running number reservation before writing the invoice and counter reservation.

Full Tax Invoice duplicate protection rule: before creating a full tax invoice, the app checks local tax invoices and Firestore for any invoice matching the sale ID or sale number, including deterministic IDs such as `tax-{saleId}` and `tax-{saleNumber}`. Existing remote matches must be cached locally and reused. If the transaction path cannot complete online, fallback invoices may remain local/pending but must not be written to Firestore outside the transaction path.

Full Tax Invoice pending sync rule: local full tax invoices marked `pending_create` or `local_only` must retry through the same transaction-safe Firestore issue path before tax invoice history/receipt workflows create another invoice. The sync must first recheck Firestore for an existing invoice that matches the sale, cache that remote match when found, and only reserve/write TAX running numbers through the transaction path. Local void states marked `pending_void` or `local_void` may retry through the void transaction path and must not modify the source sale, payment, VAT summary, or stock data.

Full Tax Invoice offline void sync rule: when a local full tax invoice is voided before the original issue reaches Firestore, pending void sync must create the official invoice through the normal TAX running-number transaction path first, then void that invoice through the Firestore void transaction. This preserves one official document trail for the sale and prevents local void states from retrying forever when the remote invoice does not yet exist.

Full Tax Invoice sync visibility rule: online create/reuse calls should retry pending full tax invoices before returning local fallback documents for the same sale. Tax invoice history must expose local fallback state with readable badges for pending sync, local-only invoices, local voids, and temporary local running numbers so staff can validate whether an invoice has reached Firestore without opening browser storage.

Full Tax Invoice sync error visibility rule: pending local full tax invoice sync attempts must preserve retryable local state and record concise sync diagnostics when automatic create/void sync is skipped or fails. Tax invoice history must surface sync errors with a clear badge and searchable message without writing failed documents to Firestore outside the transaction path.

Full Tax Invoice A4 print rule: `/pos/tax-invoice/` renders the printed title as `ใบกำกับภาษี` and the buyer box as `ผู้ซื้อ / ลูกค้า`. Seller and buyer tax ID lines append `สำนักงานใหญ่` or branch text in the same row. Document metadata rows must keep labels and values in separate columns so long sale references wrap only inside the value area. Printed A4 tax invoices must paginate item rows at 10 rows per page; continuation pages repeat the invoice header and buyer block, continue item numbering, and render totals/signatures only on the final page.

Tax Invoice label rule: POS receipt and tax invoice history user-facing Thai labels should use `ใบกำกับภาษี` consistently. Avoid reintroducing the longer `ใบกำกับภาษีเต็มรูปแบบ` wording in visible buttons, dialog titles, empty states, or error fallback messages unless a legal/business requirement explicitly needs it.

Tax Invoice History rule: `/pos/tax-invoices/` merges local `retail_pos_tax_invoices_v1` data with Firestore `taxInvoices`, supports search by invoice number, sale number, buyer name, buyer tax ID, address, and status, and opens `/pos/tax-invoice/?invoiceId=...` for reprint. The same page can search an original POS sale number from an existing short tax invoice/receipt, open a buyer tax profile modal, and issue or reopen the one full tax invoice allowed for that sale. The POS navigation menu must include a direct `ใบกำกับภาษี` entry for this history page.

Later full tax invoice rule: staff can issue a full tax invoice later when a customer brings an existing short tax invoice/receipt back to the shop. The workflow searches the original POS sale by sale number, opens a buyer tax profile modal, reuses the existing full-tax-invoice creation path, keeps one full tax invoice per sale, and shows the existing invoice instead of creating a duplicate when one already exists.

Tax buyer profile management rule: saved full-tax buyer profiles are stored locally under the current tenant, include `tenantId`, and can be created, edited, or deleted from `/pos/tax-invoices/`. Profiles may prefill future full tax invoice dialogs but must not alter historical sales, VAT totals, payments, stock movements, or issued invoice totals.

Tax buyer profile sync rule: saved full-tax buyer profiles must remain available locally for offline issuing and also sync to `tenants/{tenantId}/taxBuyerProfiles` when Firebase is online. The sync must merge local and remote profiles by stable profile ID, preserve tenant boundaries, and never mutate issued invoices, source sales, VAT totals, payments, stock movements, or existing `taxInvoices`.

Tax buyer profile sync badge rule: buyer tax profile rows may store display-only sync metadata such as `syncStatus: "pending_sync"`, `syncStatus: "synced"`, and `firebaseSyncedAt` so `/pos/tax-invoices/` can show `รอ Sync`, `Sync แล้ว`, or `เครื่องนี้` badges in the profile dialog. These badges must not drive tax invoice duplicate protection, create transactions, void transactions, source sale mutations, VAT totals, payments, stock movements, or Firestore write paths outside the existing profile sync flow.

Tax buyer profile direct sync rule: when a buyer tax profile is saved while Firebase is online, the direct profile write may mark the remote payload and matching local row as `syncStatus: "synced"` with `firebaseSyncedAt` after the Firestore save succeeds. If the direct write fails or the browser is offline, the local row must remain `pending_sync` for the existing profile sync flow. This metadata must not create a new tax invoice write path, alter duplicate protection, void/create transactions, source sales, VAT totals, payments, or stock movements.

Tax buyer profile sync diagnostics rule: direct buyer profile save failures may record local-only diagnostics such as `syncError`, `syncAttemptedAt`, and `syncAttemptCount` while preserving `syncStatus: "pending_sync"`. Successful direct saves or profile sync worker writes should clear the error and update `firebaseSyncedAt`. These diagnostics are operator visibility metadata only and must not drive tax invoice duplicate protection, create/void transactions, source sale mutations, VAT totals, payments, stock movements, or new Firestore write paths outside the existing buyer profile sync flow.

Tax buyer profile delete sync rule: deleting a full-tax buyer profile must hide it locally immediately and preserve a tenant-scoped local tombstone if Firestore is unavailable. The next online sync must delete the matching `tenants/{tenantId}/taxBuyerProfiles/{profileId}` document and must not allow an older remote profile to reappear after the local delete. Tombstones must remain isolated from issued `taxInvoices`, source sales, VAT totals, payments, and stock data.

Tax buyer profile dialog visual rule: the tax buyer profile dialog on `/pos/tax-invoices/` may use a wider two-column layout with saved profiles in a left sidebar and grouped editable buyer tax fields on the right. This is presentation-only and must not change the local tax buyer profile data shape, tenant isolation, offline availability, Firestore sync, issued invoices, source sales, VAT totals, payments, or stock data.

Tax invoice void rule: canceling a full tax invoice changes only the separate `taxInvoices/{taxInvoiceId}` document/status and local tax invoice cache. It must not create a replacement bill, must not reopen or duplicate the source sale, and must not deduct or restore stock. When Firebase is online, voiding must use a Firestore transaction that reads the invoice before writing `status: "void"`, void metadata, and updated timestamps. If sync is unavailable, the local invoice may be marked `pending_void`/`local_void` until a later hardening pass.

Tax invoice void diagnostics rule: if an online void transaction fails and the app falls back to a local `local_void` or `pending_void` state, the local invoice should record concise sync diagnostics (`syncError`, `syncErrorAt`, `syncAttemptedAt`, and `syncAttemptCount`) so `/pos/tax-invoices/` can show a `Sync Error` badge and searchable message. Diagnostics must not modify source sales, VAT totals, payments, stock movements, or issued invoice totals.

Tax invoice sync diagnostic visibility rule: `/pos/tax-invoices/` may display sync diagnostics from local or remote invoice rows when `syncError` exists, including the concise error, retry count, and latest attempted time. This UI is display-only and must not mutate `taxInvoices`, source sales, VAT totals, payments, stock movements, or retry state.

Tax invoice sync retry action rule: `/pos/tax-invoices/` may show a manual `ลอง Sync` action for invoices with `syncError`, `pending_create`, `pending_void`, `local_only`, or `local_void`. The action must reuse the existing pending tax invoice sync and tax buyer profile sync flow, and must not create a separate Firestore write path or mutate source sales, VAT totals, payments, or stock movements.

Tax invoice sync retry button state rule: the manual `ลอง Sync` action should disable itself and show `กำลัง Sync...` while the existing tax invoice history refresh/sync flow runs. This UI state must not create a separate sync worker, Firestore write path, or mutation of source sales, VAT totals, payments, stock movements, or retry state.

Tax invoice sync single-flight rule: `syncPendingTaxInvoices()` must allow only one pending full tax invoice sync run per browser tab at a time. Overlapping calls from tax invoice history page load, online reconnect, receipt popup flows, or manual `ลอง Sync` should share the same in-flight promise rather than starting duplicate create/void retry loops. This guard must not bypass duplicate checks, Firestore read-before-write transactions, tenant isolation, or source sale, VAT, payment, and stock immutability rules.

Tax invoice void transaction validation rule: online full tax invoice void transactions must read the target `taxInvoices/{taxInvoiceId}` document before writing and validate that the remote document belongs to the current tenant. When both local/requested and remote values are present, invoice number and source sale identity must also match before writing void metadata. Validation failures must stop the void and must not fall back to a local pending/local void state, preventing the browser from recording a void for the wrong official document.

Tax invoice void retry diagnostics rule: pending create and pending void sync errors may add diagnostic-only fields such as `syncAction`, `syncPhase`, and `syncTargetId` to the local invoice cache. Tax invoice history may display and search these fields to help staff identify whether a retry failed during create or void processing. These fields must not drive stock, VAT, payment, source sale, invoice total, duplicate-protection, or Firestore transaction mutations.

Tax invoice sync recovery copy rule: tax invoice history may provide a `คัดลอก Sync` action for invoices with `syncError`. The copied text may include local/remote identifiers and diagnostic metadata needed for support handoff, but the action must remain client-side only and must not mutate tax invoices, source sales, VAT totals, payments, stock movements, retry counters, or Firestore documents.

Tax invoice sync escalation hint rule: tax invoice history may label unresolved sync errors with `ส่ง Support` after repeated failed attempts, currently `syncAttemptCount >= 3`. Escalation hints and copied escalation text are operator guidance only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice sync filter rule: tax invoice history may provide UI-only filters for all invoices, sync errors, pending/local sync states, and support escalation cases. Filter counts and list filtering must be derived from loaded local/remote invoice rows only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice pending sync copy rule: tax invoice history may provide `คัดลอก Sync` for retryable pending/local states before a sync error exists. The copied recovery package must remain client-side support metadata only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice stale sync hint rule: tax invoice history may label retryable pending/local sync states as `ค้าง Sync` when their sync reference time is older than the UI threshold, currently 24 hours. The stale age, search text, badge, and copied stale/reference text are operator guidance only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice stale sync filter rule: tax invoice history may provide a `ค้าง Sync` filter chip derived from the stale sync hint rule. Filter counts and list filtering must be computed from loaded local/remote invoice rows only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice source receipt recovery rule: tax invoice history may provide a `ดูบิลต้นทาง` action and include a `Source Receipt` URL in copied sync recovery text when an invoice has a source sale reference. The action must open the existing POS receipt page for read-only comparison only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice buyer recovery rule: tax invoice history may provide `แก้ผู้ซื้อ` only for local/pending create invoices such as `pending_create` and `local_only`. Saving buyer recovery data must update only the local tax invoice buyer payload and diagnostic timestamp, must not reset retry counters, must not create a new Firestore write path, and must not mutate source sales, VAT totals, payments, stock movements, duplicate protection, or official remote tax invoice documents. Retrying after buyer recovery must use the existing pending tax invoice sync flow.

Tax invoice quality hint rule: tax invoice history may provide `ตรวจข้อมูล` hints and a filter for retryable sync states that are missing buyer name, buyer tax ID, or source sale reference. Quality hints, copied `Quality Check` text, search text, badges, and filter counts must be computed from loaded local/remote invoice rows only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice recovery action rule: tax invoice history may derive a display-only `คำแนะนำ` / `Recommended Action` from loaded retryable sync state, quality hints, stale age, and escalation count. Recommendations may guide staff to edit buyer data, retry sync, inspect the source receipt, copy diagnostics, or send support handoff, but must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice source visibility rule: tax invoice history may tag merged in-memory rows with display-only local/remote source flags so operators can see `แหล่งข้อมูล` as `Firestore`, `เครื่องนี้`, or `Firestore + เครื่องนี้`. These labels, search text, and copied `Data Source` diagnostics must be derived only from the loaded local cache and Firestore list results and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice source filter rule: tax invoice history may provide UI-only source filters for all rows, remote-only Firestore rows (`Firestore เท่านั้น`), local-only machine rows (`เครื่องนี้เท่านั้น`), and rows found in both sources (`ทั้งสอง`). Filter counts and combined sync/source/search filtering must be derived from loaded local cache and Firestore list results only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice clear filter rule: tax invoice history may show a UI-only `ล้างตัวกรอง` action when active search/status/source filters produce an empty result set. The action may clear the search box and reset UI filter state to all rows, but must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice copy view link rule: tax invoice history may accept valid `q`, `sync`, and `source` query parameters to preload the existing client-side search box plus sync/source filter chips, and may update those query parameters with `history.replaceState` as staff type or click filters. The page may provide a `คัดลอกลิงก์มุมมอง` action that copies the current history URL, and copied sync recovery text may include a filtered `Tax History` URL for that invoice. These links are navigation/support metadata only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice copy clipboard fallback rule: tax invoice history copy actions should try `navigator.clipboard.writeText` first and then retry through the legacy hidden textarea copy path when the browser blocks the Clipboard API. Clipboard fallback behavior is client-side support metadata only and must not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax invoice history action icon rule: `/pos/tax-invoices/` action buttons must use explicit, semantically correct Bootstrap icons. `เปิด/พิมพ์` uses a print icon, source receipt uses a receipt icon, edit buyer uses an edit icon, sync copy uses a clipboard icon, retry sync uses a repeat icon, and cancel uses an X/cancel icon. Temporary loading/success/error button states must restore the intended original icon and label after completion.

DBD Lookup rule: the buyer tax ID field is the first input in the full tax invoice modal and includes an inline `DBD` button. The browser can fetch a configured DBD lookup proxy from `window.RETAIL_POS_DBD_LOOKUP_URL` or localStorage key `retail_pos_dbd_lookup_url`; the expected JSON can include `buyerName`, `buyerTaxId`, `buyerAddress`, `buyerBranchName`, or DBD-style aliases such as `juristicNameTH`, `juristicId`, `addressTh`, and `branchName`. If no proxy is configured or lookup fails, the flow opens the official DBD DataWarehouse+ juristic search page for manual verification. This flow does not change POS sale totals, VAT calculation, stock deduction, offline sale sync, or existing short tax invoice receipt behavior.

Theme rule: Retail POS UI screens should stay visually aligned with Order/Delivery by using the shared green/neutral palette, panel borders from `--line`, soft shadows comparable to `app.css`, and UI text/button weights of 500 or lighter. Printable paper documents remain excluded from this UI weight rule and continue to use `TH Sarabun PSK Local`.

Product card overlay rule: Retail POS image product cards show only product images by default on both desktop and mobile. Desktop may reveal the overlay on hover/focus. Touch devices must keep name, stock, and price hidden by default and only reveal the overlay during active touch, focus, or an explicit `show-info` state. Overlay prices use dark green text while preserving readable contrast on the dark green product overlay.

Product image fallback rule: Retail POS product cards may load images from local IndexedDB (`imageKey`) or product URL fields, but the visible tile must not retain a broken browser image icon when an image fails to load. If no usable string URL exists, or an image load errors, the card must fall back to the green initial tile while preserving the same product selection, stock, VAT, payment, offline sale sync, and duplicate-protection behavior.

Product image upload fallback rule: `/pos/products/` must not block product data saves solely because Firebase Storage is over quota or an image upload fails. The selected image may be compressed and stored in the local IndexedDB product-image fallback for the current POS machine, while the existing or entered `imageUrl` remains the cross-device source when present. The UI should show a concise Thai warning instead of raw Firebase Storage quota text, and this fallback must not mutate stock movements, sales, VAT, payments, offline sale sync, duplicate protection, or tax invoice data.

Mobile button layout rule: on small Retail POS screens, header actions should stay compact and predictable. The menu button may keep a short label, sync status should not expose a long status string in the header, and icon-only actions such as Customer Display should remain fixed-size. Receipt/tax print toolbars should avoid cramped wrapping by placing long actions on their own row and keeping secondary actions evenly sized.

Payment modal visual rule: Retail POS payment modal numbers and numeric pad buttons should not exceed font-weight 500 in the web UI. The payment total should use the shared green accent softly, the change amount may use a restrained amber/red emphasis, and the layout must keep the same payment, VAT, stock, and offline sync behavior.

POS PromptPay payment modal compact rule: on PC viewports, the payment modal must keep the member picker, loyalty controls, payment method, PromptPay QR panel, received amount field, and change row visible without requiring vertical scrolling where practical. PromptPay modal verification copy should be concise and show only the receiver line; shop name and source URL remain available in Customer Display verification context but should not be repeated inside the cashier modal.

POS VAT/payment totals rule: when `vatRegistered` is enabled, a blank or zero stored VAT rate should fall back to the default 7% rate before POS totals, sale persistence, and Customer Display snapshots are calculated. Received-cash parsing must strip formatting consistently across the visible payment UI and the safe-confirm guard so the displayed change amount and saved sale change amount match.

POS local stock idempotency rule: local POS sale persistence must be idempotent by stable saleId. If a local sale with the same saleId already exists, checkout must not deduct product stock again and must not append duplicate local stock movement rows; Firestore offline sync remains responsible for transaction-safe remote sale creation and remote stock deduction.

POS offline sync module rule: the POS sync status UI must import the same versioned offline sale sync worker URL as `/pos` loads directly. This keeps manual Sync/Retry actions, background retry timers, worker snapshots, and queue events on one module instance instead of creating duplicate workers through mismatched cache-busted import URLs.

POS offline sync synced flag rule: local POS sales that have reached Firestore may store `offlineSyncHash` and `syncHashVersion` alongside `syncStatus: "synced"` / `firebaseSyncedAt`. The hash must be derived from stable sale payload fields that affect sync and must exclude volatile sync metadata and official sale-number changes. Offline queue and status badge logic should skip rows with a synced marker first, then refresh diagnostic hash metadata as needed, because preventing duplicate bill writes and duplicate stock cuts is more important than re-queuing an immutable completed sale from local metadata drift.

Tax invoice sync health panel rule: `/pos/tax-invoices/` may display a diagnostic-only sync health panel derived from the already-loaded local/remote invoice rows and existing sync/list error handling. The panel may summarize Sync Error, pending/local sync, stale sync, quality review, and local/Firestore source counts, plus the latest check time and concise load/sync errors. It must not create a new Firestore write path, reset retry counters, mutate buyer profiles, alter source sales, or change VAT, payment, stock, issued invoice totals, create transactions, or void transactions.

Tax invoice sync health shortcut rule: health panel chips on `/pos/tax-invoices/` may act as shortcuts that update only the existing client-side sync/source filter state. Status shortcuts must set the sync filter, source shortcuts must set the source filter, and the all shortcut may reset both. These shortcut buttons must not mutate tax invoice rows, buyer profiles, source sales, VAT totals, payments, stock movements, retry counters, Firestore documents, create transactions, or void transactions.

POS Developer Panel app-info rule: shared POS pages that load `retail-toast-status.js` must receive the current `app-info.js` metadata through a bumped cache chain whenever version/build/milestone metadata changes. The Developer Panel should not show stale version, build, milestone, or commit labels after a hosting deploy and hard refresh.

POS Developer Panel tax sync build rule: after tax invoice sync hardening changes, the shared POS Developer Panel metadata must be bumped with the same hosting deploy so operators can confirm the deployed browser cache includes the latest tax sync behavior.

POS receipt VAT mode rule: `/pos/receipt/` must render VAT mode as an informational label/value row: `โหมด VAT` with `ราคารวม VAT` for include mode or `ราคาไม่รวม VAT` for exclude mode. It must not render the VAT mode text as the row label with `-` as a fake amount.

PromptPay payment QR rule: PromptPay / transfer account data belongs in Retail POS settings under `settings/payment` and local `retail_pos_store_settings_v1` fallback. The POS payment modal may render a PromptPay QR only when the method is `promptpay`, the store has enabled PromptPay, a valid PromptPay ID exists, and the payable amount is greater than zero. Customer Display snapshots may include `paymentQr` with `tenantId`, `registerId`, `displayId`, `shopName`, `accountName`, masked PromptPay ID, amount, source origin, QR payload, QR image URL, and verification state. The Customer Display must show the QR amount and source/shop verification context so customers can confirm the QR came from the shop's web app and tenant before scanning.

Payment customer picker rule: the optional member/customer field in the POS payment modal must clear selected customer state completely when its X button is clicked. Clearing must remove the input value, reset `paymentDialog.dataset.customerId`, reset the selected customer note to the general-customer label, dispatch `pos:customer-change` with an empty customer, focus the customer input, and immediately reopen the customer result list for the next selection.

Customer Display PC layout rule: on PC widths, `/pos/customer-display/` keeps the customer card and total/payment QR card stacked in the left column, while the cart card remains a separate right column. The combined left column height must match the cart card height, the action/header area should stay compact, and the total card must not overflow when PromptPay QR details are visible. Short PC screens such as 1912x870 must still show the totals, compact PromptPay QR panel, and thank-you message inside the left total card.

Customer Display PromptPay visual rule: when PromptPay / transfer QR data is present, the Customer Display total card stacks the payment heading, baht amount, QR image, and account owner name vertically and centered. The QR should be as large as possible while preserving the total rows and thank-you badge on short PC screens. The thank-you badge stays pinned to the bottom edge of the total card, centered on one line, and must use font-weight 500 or lighter.

Customer Display classic green theme rule: Customer Display styling uses a white page background, solid green action bar, white cards, green text, green borders, and simple shadows only. Avoid gradient, glass, blur, and tinted overlay treatments for the cart, PromptPay QR panel, and pairing QR panel. QR image surfaces must remain white/clean for scan readability, and the cart count badge must remain high contrast.

Customer Display pairing QR layer rule: the `เชื่อมอุปกรณ์` hover/focus QR panel must render above the main display content on desktop and mobile widths. Keep the header and pairing panel in a higher stacking layer than the cart, total, and footer cards so the pairing QR is never hidden behind page content.

Customer Display pairing QR polish rule: the `เชื่อมอุปกรณ์` hover/focus QR panel should use a wider two-column layout on PC, extend left from the button, stay readable, and remain within the white/green Customer Display visual language. Its text and action button must remain visible against the panel background.

Customer Display pairing QR gradient rule: the device-pairing QR hover panel may use a vertical green fade treatment, with the top background and border opaque/darker green and the lower background and border transparent enough for underlying page content to remain visible. Panel copy may use small translucent backplates but should stay solid green, while the POS action button stays green. This styling applies only to the device-pairing panel; PromptPay payment QR surfaces must stay white/clean for scan reliability.

Customer Display classic layout rule: on PC, the customer card should not leave excessive empty space before the payment total card. Total amount numbers should be large enough to read at a distance, and the `ยอดสุทธิ` label must remain fully visible without clipping.

Customer Display cart list rule: cart item separators use dashed green lines in the classic green Customer Display theme. The `รายการในบิล` header count badge must remain legible on classic white/green backgrounds with high-contrast green text, a defined chip shape, and enough separation from the header title so counts such as `11 รายการ` do not blend into the badge.

Completed in this build: Customer Display classic layout tuning with reduced customer-card empty space, larger total amount numbers, full `ยอดสุทธิ` label visibility, and the wider two-column pairing QR hover panel while preserving dashed cart separators, centered stacked QR, account-name-only receiver text, and bottom-pinned one-line thank-you badge.

Next task: deploy hosting and test the classic green Customer Display layout tuning, wider pairing QR hover layer, cart count badge contrast, and PromptPay presentation on real POS payment data, then continue validating tax profile and void workflow with synced Firestore data.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
