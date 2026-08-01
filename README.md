# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Waiting Queue Usability And Permission Repair
Version: 0.16.3
Build: 2026.08.01.004

<!-- WAITING_QUEUE_USABILITY_PERMISSION_20260801_004 -->
Change: Repaired Waiting Queue permissions and completed the reported usability polish.

Permissions: Waiting Queue Security Rules now recognize the canonical tenant membership and role helper used by the rest of the application, while retaining the existing fallback tenant mappings. Existing pending queue operations can resume after deploying the updated rules.

Staff UI: The dashboard card now includes a purpose description. Waiting Queue staff text, filters, queue rows, table recommendations, statuses, and actions are larger and easier to read. The add-queue footer uses equal-width cancel/save actions with appropriate icons, and required-field validation reserves feedback space so controls do not stretch or jump.

Customer/Public UI: The customer tracking card is larger on PC and mobile, the waiting-person icon has explicit white contrast, and the public-display megaphone is centered in its badge.

Audio: Queue numbers are spoken as separated Thai words, for example `ดับเบิ้ลยู ศูนย์ ศูนย์ หนึ่ง`, at a slightly slower natural rate, ending with `กรุณามาที่จุดรับโต๊ะค่ะ`.

Firebase safety: Collection paths, stable W-numbers, waitingQueueId, customer token, table/order transaction, duplicate protection, audit history, payment, stock, VAT, and food queue behavior are unchanged.

Deploy: Firestore Rules and Hosting. Load cache `20260801-004` with a hard refresh.


<!-- WAITING_QUEUE_CONFLICT_RECOVERY_20260801_003 -->
Change: Hardened Waiting Queue conflict recovery after production acceptance testing.

Stale local create/transition operations are now reconciled against the latest Firebase queue instead of blocking the ordered outbox. Terminal remote states always win, obsolete transitions are discarded without regressing queue status, and an existing remote queue cannot be overwritten by a delayed create operation.

Reliability: Queue transactions use a bounded ten-attempt Firebase retry budget plus one guarded retry for transient contention. Public/customer snapshot writes are coalesced and skipped when their meaningful payload is unchanged, reducing version churn while staff call, cancel, or open a table.

UI: The home dashboard now owns one static `คิวรอโต๊ะ` card with the correct label and icon. Sync results report recovered stale operations in Thai instead of showing raw Firestore base-version errors.

Firebase safety: No collection path, Security Rule, Composite Index, stable W-number, waitingQueueId, table/order link, audit payload, payment, stock, VAT, or food-queue behavior changed.

Deploy: Firebase Hosting only. Hard refresh after deployment to load `20260801-003`.


<!-- WAITING_QUEUE_UI_20260801_002 -->
Change: Consolidated the table waiting queue into the canonical `/waiting-queue/` staff workspace. The old `/cashier/waiting-queue` entry now forwards to the canonical page, the home shortcut is rendered as a normal dashboard card instead of a floating bottom-right button, and the Retail POS drawer is no longer loaded on the waiting-queue page.

UI: Rebalanced search/status/party filters, queue cards, table recommendations, add-queue dialog, and the transaction-safe open-table dialog. The customer tracker is now a structured queue card. The public display clearly separates the currently called queue from upcoming queues.

Audio: Public display audio is user-armed to satisfy browser autoplay rules. When enabled it plays a chime and reads the queue number in Thai when speech synthesis is available; otherwise it labels itself as chime-only.

Compatibility: Existing legacy `/queue?token=...` customer links keep their original data source and receive a compatibility presentation layer. No legacy queue record is deleted.

Firebase safety: No collection path, rule, index, stable waitingQueueId, table transaction, order link, duplicate protection, offline outbox, stock, payment, VAT, or food-queue behavior changed.

Deploy: Firebase Hosting only. Hard refresh after deployment to load cache build `20260801-002`.


Change: Added the first production-ready table waiting queue module, separate from food/order queue numbers. Staff can create stable W-numbers, call/recall, acknowledge, prepare, defer, cancel, mark no-show, match queues to suitable tables, and open a table through a Firestore transaction. Customer tracking and a privacy-safe public queue display are included.

Firebase safety: Every waiting queue, audit, counter, number claim, dedupe record, table link, and created order carries `tenantId`. Staff queue intake is local-first with a stable `waitingQueueId`, a preleased immutable W-number, and an ordered outbox; online sync is idempotent. Queue records are never deleted. Seating reads the queue, table, order, public snapshot, and dedupe record before writes, preventing two devices from seating the same queue or occupying the same table.

Deploy: This build changes Hosting, Firestore Rules, and Composite Indexes. Deploy with `firebase deploy --only firestore:rules,firestore:indexes,hosting`, then hard refresh build `20260801-001`.

Next Task: verify W-number allocation, offline intake/sync, duplicate rejection, fair table recommendations, call countdown, customer response, public display sound, and transaction-safe table opening with two staff devices.

Previous build — Waiting Queue Full Number (`2026.08.01.106`):

Change: Expanded the Waiting Queue number badge to show the complete 8-character queue number without ellipsis. Desktop uses a 116 px queue column and mobile uses 104 px with responsive text sizing, taking advantage of the available row space while keeping customer and action content readable.

Firebase safety: Presentation only. The stored queue number, stable queue/table IDs, tenant scoping, duplicate seating guard, public tracking payload, real-time updates, and online/offline behavior are unchanged.

Deploy: Firebase Hosting only. Hard refresh after deployment to load cache build `20260801-106`.

Change: Renamed the profile-menu action from `ออกโต๊ะ` to `เปิดโต๊ะ`, replaced the Waiting Queue fallback circle with a customer-waiting icon, unified the Waiting Queue table action with the same room-service icon, fine-tuned the add button alignment, and contained long queue numbers within a wider responsive badge.

Firebase safety: UI text, icons, and layout only. Stored queue numbers and stable queue/table IDs are not truncated or changed; tenant scoping, duplicate seating protection, real-time tracking, and online/offline behavior remain unchanged.

Deploy: Firebase Hosting only. Hard refresh after deployment to load cache build `20260801-105`.

Change: Anchored the Waiting Queue `เพิ่มคิว` action to the desktop input-control row so validation feedback below the customer-name field no longer pushes the button downward. The mobile action remains full-width on its own row.

Firebase safety: This is a CSS-only alignment correction. Queue creation, tenant scoping, stable queue/table identifiers, duplicate seating protection, real-time tracking, and online/offline behavior are unchanged.

Deploy: Firebase Hosting only. Hard refresh after deployment to load cache build `20260801-104`.

Change: Added the first Waiting Table Queue release. Authorized staff can add a walk-in party, preserve arrival order, see party size and suitable free tables, call or pause a queue, and atomically seat the queue into the existing table session. Customers receive a privacy-safe token link that updates waiting, called, and seated status in real time without exposing their name or phone number.

Firebase safety: Private queue records are tenant-scoped under `tenants/{tenantId}/waitingQueues`; public tracking mirrors contain no customer PII and permit direct reads by unguessable token only. Seating verifies both queue and table state in one Firestore transaction, creates the existing stable table token once, and blocks duplicate seating. Queue mutations intentionally require connectivity to prevent split-brain numbering; all existing order, sale, stock, and offline workflows remain unchanged.

Deploy: Firebase Hosting and Firestore rules. Hard refresh after deployment to load cache build `20260801-103`.

Change: Kept all three Take Away tool buttons right-aligned on the same row as the `เครื่องมือสั่งกลับบ้าน` title on mobile. Mobile actions use compact 38 px icon buttons, a 6 px gap, and tighter bar padding to reclaim vertical workspace while retaining accessible labels and tooltips.

Firebase safety: This is a responsive CSS-only operational-toolbar adjustment. Take Away links, QR behavior, orders, tenant scoping, stable identifiers, duplicate protection, notifications, and online/offline behavior are unchanged.

Deploy: Firebase Hosting only. Hard refresh after deployment to load cache build `20260801-102`.

Change: Grouped the Push Notification bell and signed-in user profile inside the same right-aligned header action area on both Kitchen and Cashier. The profile menu is moved beside the bell even when authentication finishes after the notification control is mounted, keeping an 8 px gap on desktop and mobile.

Firebase safety: This is a presentation-only header change. Notification enrollment/delivery, tenant scoping, order/sale/queue identifiers, duplicate protection, order states, and online/offline behavior are unchanged.

Deploy: Firebase Hosting only. Hard refresh after deployment to load cache build `20260801-101`.

Change: Added Take Away orders to the enabled foreground kitchen alert, corrected Take Away Push titles and queue details, applied red invalid styling to both pickup-contact inputs when neither name nor phone is supplied, and renamed the accepted-order action from `กำลังทำ` to `เริ่มทำ` while keeping the resulting cooking status unchanged.

Firebase safety: The existing tenant-scoped order trigger and notification token collection remain authoritative. No order/sale/queue ID generation, duplicate protection, stock, payment, or offline workflow changed.

Deploy: Firebase Hosting, Functions, and Firestore rules. Hard refresh after deployment to load cache build `20260801-100`.

Change: Enabled Firebase Web Push registration for signed-in tenant members. Firestore now permits each user to create or update only their own tenant-scoped notification token, validates the token owner, tenant, role, document ID, and allowed fields, and keeps token listing/deletion closed to browser clients. Push setup errors now distinguish permission, profile, Service Worker, FCM token, and Firestore-rule failures.

Firebase safety: Notification tokens remain under `tenants/{tenantId}/notificationTokens`; Cloud Functions continue reading them through the Admin SDK. Order/sale/queue identifiers, duplicate protection, offline behavior, stock, payments, and existing notification triggers are unchanged.

Deploy: Firebase Hosting and Firestore rules. Hard refresh after deployment to load cache build `20260801-099`.

Change: Corrected the Retail POS settings read order so tenant Firestore documents are authoritative for VAT registration and PromptPay enablement, ID, and account name. Explicit remote `no` and empty values are preserved, while stale browser data can no longer overwrite the settings form; the resolved configuration refreshes the local cache used by POS and customer-display flows.

Firebase safety: This is a tenant-scoped settings-read correction. It does not change Firestore paths, settings writes, sales, stock movements, stable identifiers, duplicate protection, local-first checkout, offline sale queues, payments, returns, or tax-invoice records.

Deploy: Firebase Hosting only. Hard refresh after deployment to load cache build `20260801-098`.

Previous build — Product Pagination and Sort Save (`2026.08.01.097`): Added arrow-only product pagination and optimized catalog-order persistence to save only changed records.

Previous build — Mobile Payment Dialog and Validation (`2026.08.01.096`): Right-aligned received cash on mobile, replaced the sales-export browser message with the shared Dialog, and standardized invalid controls in red.

Previous build — Shared Dialog Action Layout (`2026.07.31.095`): Kept cancel/confirm actions side by side, added icon-label spacing, and fixed hidden alert actions.

Previous build — Retail Native Dialog Replacement (`2026.07.31.094`): Replaced native Retail POS alerts and confirmations with shared styled dialogs and clarified permission-group select-all icons.

Previous build — Tax Issue Title Icon Spacing (`2026.07.31.093`): Separated the receipt icon and late tax-invoice title with explicit elements and consistent spacing.

Previous build — Sales Net Card Contrast (`2026.07.31.092`): Restored the net-sales summary card to a green gradient with high-contrast white text.

Previous build — Global Green Checkbox Theme (`2026.07.31.091`): Standardized native checkboxes across Order/Delivery and Retail POS with the green theme and a 20 × 20 px control.

Previous build — Admin Users Laravel Parity (`2026.07.31.090`): Ported the Laravel employee-management presentation to Firebase `/admin/users` with a staff Hero, compact employee list, and responsive create-user modal while preserving Firebase staff workflows.

Previous build — Category Pagination Number Cleanup (`2026.07.31.087`): Category pagination on `/pos/products` renders page buttons as plain numbers only while previous/next controls, search, filters, sorting, page-size selection, and navigation behavior remain unchanged.

Previous build — Retail Product Category Manager Usability (`2026.07.31.086`): Reworked `/pos/products` category management from a long card grid into a compact searchable, filterable, sortable, and paginated list. Add/edit uses a focused dialog, category counts and status are visible, derived categories can be promoted to stable records, and renaming a category updates affected product metadata while preserving the Stable Category ID and saved POS display position.

Previous build — Cart Quantity Icon Polish (`2026.07.31.085`): Replaced the text minus and plus controls in Retail POS cart rows with Bootstrap Icons while preserving the circular buttons, accessible Thai labels, quantity behavior, and compact Laravel-aligned cart layout. Category selection remains tenant-scoped; sales, stock transactions, stable identifiers, duplicate protection, local-first checkout, and offline synchronization are unchanged.

Change: Completed the Retail POS parity corrections from the Laravel edition. The profile password action now uses the original key treatment, the POS category strip mounts once, VAT mode is fixed without an include/exclude selector, the menu button includes its hamburger icon, and product management now includes pagination, a dedicated Firestore-backed category manager, and visible category/product sorting.

Firebase safety: Category records are tenant-scoped under `tenants/{tenantId}/categories`, with owner/admin write rules. Product and sorting writes continue through the existing tenant-aware data service; sale IDs, stock transactions, duplicate protection, offline sale queues, and synchronization behavior are unchanged.

Deploy: Firebase Hosting and Firestore rules. Hard refresh after deployment to load cache build `20260731-082`.

Change: Corrected the Sales Report parity gap shown after the first Firebase deployment. The page now combines paid restaurant orders with Retail POS sales from the active tenant's Firestore `sales` collection, normalizes them into the same receipt model, and prevents duplicated receipts when a transaction appears in both sources. The report now opens in monthly mode and enforces the same green application header as the Laravel screen.

Firebase safety: Report reads remain tenant-scoped. No Firestore rules, indexes, Cloud Functions, transaction handlers, stable IDs, duplicate-sale protection, or offline synchronization behavior changed.

Deploy: hosting only. Hard refresh after deployment to load cache build `20260731-081`.

Change: Extended the Laravel parity work from presentation-only to browser workflow parity while retaining Firebase Auth, Firestore, and Storage. Kitchen now groups table rounds and applies stable queue ordering, Cashier uses the same queue ordering, Take Away toolbar, empty state, and receipt fallback, Delivery supports staff logout, and Admin restores verified store settings plus add-menu/add-table modal actions. Shared POS presentation, dialogs, toast behavior, remembered receipt choices, and responsive action styling are aligned with the Laravel edition.

Firebase safety: All writes continue through the existing tenant-scoped Firebase services. Firestore order/table documents, stable IDs, transactions, duplicate protection, offline queues, and synchronization remain the source of truth. No Firebase rules, indexes, or Cloud Functions changed.

Deploy: hosting only. Hard refresh after deployment to load cache build `20260731-080`.

Change: Ported the current presentation layer from the Laravel/MySQL edition back to this Firebase branch. The green Order/Delivery workspace theme, staff dashboard, Flaticon dashboard icons, modern sales report, queue badges, Take Away confirmation dialogs, cashier/kitchen confirmation icons, kitchen action animation/label, and blue `ส่งมอบแล้ว` action now match while Firebase data transport remains unchanged.

Safety: Firebase Auth, Firestore/Storage transport, tenant scope, stable order/sale/queue IDs, duplicate sale/stock protection, and online/offline synchronization are preserved. No Firestore rules, Storage rules, Cloud Functions, or transaction handlers changed.

Deploy: hosting only. Hard refresh after deployment to load cache build `20260731-079`.

Change: Repaired the Super Admin login route and blank `/platform` failure mode. Shared login now loads the authenticated profile before resolving `ROLE_HOME`, sending `super_admin` directly to `/platform`. The role guard restores document visibility and presents retry/re-login actions when authentication or profile loading fails. Login and platform cache chains are bumped to `20260723-001`.

Previous build note: POS Catalog Single Renderer from build `2026.07.17.002` remains unchanged for stable large-catalog rendering, 96-item paging, and consistent image/fallback cards.

Previous build note: Tax Sync Permission And Cross Tab Lock from build `2026.07.16.017` remains unchanged for tenant tax permissions, TAX running numbers, explicit retry, and cross-tab sync protection.

Previous build note: Tax Buyer Tax ID First from build `2026.07.16.016` remains unchanged for the buyer tax ID and DBD lookup above the buyer/company name.

Previous build note: Retail POS Settings Nonblocking Sync from build `2026.07.16.015` remains unchanged for responsive local-first settings saves and timeout-protected background Firebase sync.

Previous build note: Retail POS Settings Offline Sync from build `2026.07.16.014` remains unchanged for tenant-scoped local-first persistence of store, receipt, tax, payment, and loyalty settings.

Previous build note: Retail POS Action Bar Text Only from build `2026.07.16.013` remains unchanged across the main POS page, submenu pages, tax invoice history, and Customer Display.

Previous build note: Admin Hero Title Icon Cleanup from build `2026.07.16.012` remains unchanged for the text-only `/admin` hero heading `จัดการร้าน`.

Previous build note: Login Validation Layout Polish from build `2026.07.16.011` remains unchanged for login validation feedback below the full input group and stable email/password icons.

Previous build note: Tax Buyer DBD And Validation Layout Polish from build `2026.07.16.010` remains unchanged for POS tax invoice history open/print button contrast, DBD lookup with manual-copy fallback in the tax buyer edit dialog, and product form validation that does not stretch product code/barcode inputs or move scanner icons.

Previous build note: Print Icon And Mobile Validation Polish from build `2026.07.16.009` remains unchanged for POS tax invoice history and receipt print action icons, prewarmed print windows, validation feedback under compound scanner controls, and `/admin/users` horizontal table scrolling on mobile.

Previous build note: Tax Invoice Page Count And Receipt Reprint from build `2026.07.16.008` remains unchanged for 20-row full-tax invoice pages, `หน้า n/m` page numbers, reduced print-window dependencies, and sale-history receipt reprint consistency.

Previous build note: Tax Invoice A4 Pagination Polish from build `2026.07.16.007` remains unchanged for seller/buyer branch text, compact metadata box wrapping, repeated invoice headers, and final-page-only totals/signatures.

Previous build note: POS Local First Receipt Data from build `2026.07.16.005` remains unchanged for saving Retail POS bills locally first, using stable saleId background sync, and avoiding duplicate stock deduction.

Previous build note: Delivery COD Edit Unlock from build `2026.07.16.004` remains unchanged for cash-on-delivery cart editing before final order confirmation.

Previous build note: POS Receipt Reliability Repair from build `2026.07.16.003` remains unchanged for POS checkout speed, old sync row reconcile, receipt customer/member recovery, loyalty rows, sale-history shop details, and late full-tax invoice DBD lookup.

Previous build note: POS Receipt Privacy Masking from build `2026.07.16.002` remains unchanged for printed customer/member privacy masking and saved VAT mode rows.

Previous build note: Catalog Post Import Checklist from build `2026.07.16.001` remains unchanged for post-import owner reminders after Retail Master Catalog import.

Previous build note: Catalog Import Result Actions from build `2026.07.15.018` remains unchanged for imported count, SKU/name examples, product-review link, and copy-SKU action after import.

Previous build note: Catalog Preview Filter Counts from build `2026.07.15.017` remains unchanged for live counts in the preview status dropdown.

Previous build note: Catalog Import Category Shortcuts from build `2026.07.15.016` remains unchanged for selecting all categories, ready categories only, clearing the selection, and refreshing importable counts from the skip-existing toggle.

Previous build note: Catalog Import Review Reasons from build `2026.07.15.015` remains unchanged for preview status explanations.

Previous build note: Catalog Import Confirmation Summary from build `2026.07.15.014` remains unchanged for final import dialog counts.

Previous build note: Catalog Import Filters from build `2026.07.15.013` remains unchanged for preview search and status filters.

Previous build note: Catalog Import Readiness UI from build `2026.07.15.012` remains unchanged for import readiness counts and skipped-existing explanations.

Previous build note: Unified Icon Color System from build `2026.07.15.011` remains unchanged across Order/Delivery, Admin, table QR, staff user menus, and Retail POS entry surfaces.

Previous build note: Colorful Home Menu Icons from build `2026.07.15.010` remains unchanged for the central `/` staff dashboard cards.

Previous build note: Colorful Menu Icons from build `2026.07.15.009` remains unchanged for Retail POS drawer menu groups/menu links and primary Order/Delivery heading icons.

Previous build note: Product Image Storage Fallback from build `2026.07.15.008` remains unchanged. If cloud image upload fails while a staff member saves a product, the selected image is compressed and stored in the local IndexedDB product-image fallback, any existing/product image URL remains intact when available, and the product can still be saved with a readable Thai warning instead of a raw Firebase Storage error.

Previous build note: POS sync queue persistence from build `2026.07.15.007` remains unchanged. Normal online checkout uses the canonical Firestore transaction flow, while the safe-confirm fallback stays explicit-only.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing PromptPay QR display, tax buyer DBD lookup, tax invoice history/reprint, later full tax invoice issuing from existing receipts, receipt behavior, stock deduction, offline sale sync, POS theme alignment, mobile product card overlay behavior, mobile button layout, payment modal visual tuning, and printable document fonts are unchanged.

Validation text-only workflow: shared web form entry points import `/assets/js/form-validation-ui.js`. The module binds current and dynamically added inputs, selects, and textareas, suppresses native browser validation bubbles, and validates required fields plus native format rules such as email, pattern, min, max, and minlength after a field is touched or a form is submitted. Invalid fields show red feedback text directly under the field only; the input/select/textarea styling, shape, border, background, shadow, and label color must remain unchanged, and optional blank fields remain neutral so forms stay calm before the user edits them.

System UI font-weight workflow: `/delivery`, `/order`, and Retail POS pages use the shared Thai UI font stack with lighter weights after the local `Kanit Local` font change. Normal copy stays 400, most controls use 500, prominent UI labels/headings should generally stay at 600, and legacy 700-900 UI requests resolve to SemiBold or are reduced in runtime CSS/JS. Printable paper documents remain excluded from this web UI weight rule.

POS product image fallback workflow: `/pos/` product cards can use local IndexedDB images or product image URLs, but the UI must never leave browser broken-image icons visible on product tiles. If a URL fails or a product image field is not a usable string URL, the card should restore the green initial fallback while keeping product selection, stock, VAT, payment, and offline sync behavior unchanged.

POS product image upload fallback workflow: `/pos/products/` saves product data even when Firebase Storage is over quota or an image upload fails. The selected image is stored locally in IndexedDB for the current POS machine, the previous or entered `imageUrl` remains the cross-device image source when present, and staff see a concise Thai warning instead of the raw Firebase Storage quota message. This fallback must not mutate stock movements, sales, VAT, payments, offline sale sync, duplicate protection, or tax invoice data.

Unified green UI icon workflow: `/delivery`, `/order`, and Retail POS pages use the green/black/white visual system for app headers, hero panels, cards, focused inputs, and primary actions. Main headings and action buttons may show one Bootstrap Icon, but buttons/cards must not render adjacent duplicate icons, printable bill headers must stay text-only, and emoji must not be used in the UI.

POS offline sync synced-flag workflow: `/pos` computes a diagnostic `offlineSyncHash` from the local sale payload fields that matter for sync, excluding volatile sync metadata and official sale-number changes. Sales with `syncStatus: "synced"`, `firebaseSyncedAt`, or `syncedAt` are treated as already synced and are backfilled with `offlineSyncHash`, `syncHashVersion`, and clean sync metadata. If later local metadata changes make the hash differ, the worker refreshes the local diagnostic hash while keeping the synced marker authoritative, so already-written sales do not return to the sync badge or duplicate stock-cut path.

POS offline sync remote reconcile workflow: before retrying local queued sales, `/pos` reads the matching Firestore sale document by stable `saleId`. If the remote sale already exists for the current tenant, the local row is marked `synced` and removed from the offline queue without writing the sale, sale items, stock movements, product stock, or daily summary again. This handles cases where a previous sync reached Firestore but the browser refreshed or timed out before localStorage was marked.

POS offline sync idle workflow: `/pos` counts and schedules offline sale sync work only for local rows whose sale status is `completed` and whose sync status is still eligible for queue processing. Draft, incomplete, or already-synced rows do not make the header show `รอ Sync`, and when the eligible queue is empty the worker records an idle snapshot without starting another page-load sync timer.

POS offline sync batch drain workflow: `/pos` syncs queued offline sales in small batches to avoid long-running checkout sessions. If one run processes the current batch but more eligible rows remain, the worker schedules the next short drain cycle automatically instead of waiting for staff to reload or refocus the page.

POS safe-confirm fallback workflow: `/pos` keeps `retail-pos-safe-confirm.js` as an emergency fallback only. It must not intercept the normal `#confirmPaymentBtn` click unless `data-safe-confirm-fallback="1"` is placed on the button or `document.documentElement.dataset.retailPosSafeConfirm` is set to `enabled`; the canonical `retail-pos.js` online transaction flow remains responsible for normal checkout.

Tax sync health panel workflow: `/pos/tax-invoices/` displays a diagnostic-only sync health panel after loading and refreshing tax invoices. It summarizes total invoices, Sync Error, pending sync, stale sync, quality review, Firestore-only, local-only, and both-source counts from the merged in-memory invoice list, plus concise load/sync errors from the existing pending invoice sync, tax buyer profile sync, or Firestore list calls. This does not add a Firestore write path and does not mutate retry counters, source sales, VAT totals, payments, stock movements, or issued invoice totals.

Tax sync health shortcut workflow: the health panel chips on `/pos/tax-invoices/` are buttons that set the existing sync and source filters. `ทั้งหมด` resets both filter groups, status chips set only the sync filter, and source chips set only the source filter. This remains client-side filter state only and does not mutate tax invoices, buyer profiles, source sales, VAT totals, payments, stock movements, or retry counters.

Admin QR/collapse workflow: `/admin` Delivery and Takeaway QR copy buttons show a single `คัดลอกลิงก์` label with the clipboard icon. All collapsible admin cards are initialized as collapsed on every page load, and the legacy `admin_collapsed_cards_v1` browser state is cleared/ignored so old expanded sessions do not reopen cards automatically.

Admin sales report card workflow: the `รายงานยอดขาย` card is not collapsible and should not render a chevron toggle. Staff open the sales report only through the eye/report button on that card.

Custom Delivery fee workflow: `/admin` lets staff add, remove, rename, and price Delivery fee options such as `รับที่ร้าน` or `ระยะทาง 0-2 กิโลเมตร`. The options are saved to store settings as `deliveryFeeOptions` with tenant-scoped settings data, while the legacy `deliveryFeeNearby`, `deliveryFeeGeneral`, and `deliveryFeeFar` values remain populated for fallback compatibility. `/delivery` shows these custom options in the delivery-zone dropdown and saves the selected option ID, label, fee, subtotal, and total on the order.

Custom Delivery fee UI workflow: the `เพิ่มตัวเลือกค่าส่ง` action sits in the upper-right of the Delivery fee card as a green primary button with a plus icon. Delivery fee rows use clearer spacing, input-aligned row number badges, placeholder examples for option names, fee inputs, and red X icon remove buttons while preserving the saved `deliveryFeeOptions` data shape.

Tax invoice label workflow: POS receipt and tax invoice history user-facing Thai labels use `ใบกำกับภาษี` consistently across the receipt action button, buyer data dialogs, tax invoice history title, late-issue panel, empty state, profile helper copy, and void dialog. This wording polish does not change `taxInvoices` data, duplicate protection, sync, or void transaction behavior.

Tax buyer profile sync workflow: saved buyer tax profiles from `/pos/tax-invoices/` are stored locally first for offline use and sync to `tenants/{tenantId}/taxBuyerProfiles` when Firebase is online. Opening the profile dialog or tax invoice history merges local and remote profiles by stable profile ID, keeps tenant boundaries intact, and does not alter issued invoices, source sales, VAT totals, payments, or stock data.

Tax buyer profile sync badge workflow: `/pos/tax-invoices/` marks saved buyer tax profiles with `syncStatus: "pending_sync"` and updates successful Firestore profile sync rows to `syncStatus: "synced"` with `firebaseSyncedAt`. The profile dialog displays `รอ Sync`, `Sync แล้ว`, or `เครื่องนี้` badges for operator visibility only and does not alter issued invoices, source sales, VAT totals, payments, stock movements, duplicate protection, or tax invoice create/void transactions.

Tax buyer profile direct sync workflow: when `saveTaxBuyerProfile()` writes a profile while Firebase is online, the direct Firestore save sends the row as `syncStatus: "synced"` and updates the local row with the same `firebaseSyncedAt` after the write succeeds. If the direct save fails, the local row stays `pending_sync` for the normal profile sync worker. This is badge metadata only and does not alter issued invoices, source sales, VAT totals, payments, stock movements, duplicate protection, or tax invoice create/void transactions.

Tax buyer profile sync diagnostics workflow: direct buyer profile save failures record `syncError`, `syncAttemptedAt`, and `syncAttemptCount` on the local buyer profile row while keeping `syncStatus: "pending_sync"`. Successful direct saves and profile sync worker saves clear `syncError`, update `syncAttemptedAt`, and record `firebaseSyncedAt`. The profile dialog shows the concise error and attempt count as operator guidance only and does not alter issued invoices, source sales, VAT totals, payments, stock movements, duplicate protection, or tax invoice create/void transactions.

Tax buyer profile delete sync workflow: deleting a buyer tax profile hides it from the local profile list immediately and stores a tenant-scoped delete tombstone when the browser is offline. The next online tax profile sync deletes the matching Firestore document from `tenants/{tenantId}/taxBuyerProfiles` and keeps older remote copies from being merged back into the local profile list.

Tax profile dialog visual workflow: `/pos/tax-invoices/` uses a refreshed white/green POS layout and the `โปรไฟล์ภาษีลูกค้า` dialog renders wider on desktop with saved profiles in a left sidebar and grouped buyer tax fields on the right. The dialog action bar is visually separated from the form, and the layout collapses to one column on small screens. This is visual-only and preserves the existing local/offline tax buyer profile storage and Firestore sync behavior.

Tax void sync diagnostics workflow: if an online full tax invoice void transaction cannot complete and the app falls back to a local `local_void`/`pending_void` state, the invoice records `syncError`, `syncErrorAt`, `syncAttemptedAt`, and `syncAttemptCount`. `/pos/tax-invoices/` surfaces those diagnostics through the existing `Sync Error` badge and search text while preserving retry behavior and never mutating the source sale, VAT, payment, or stock data.

Tax sync diagnostic visibility workflow: `/pos/tax-invoices/` renders sync diagnostics as readable card text when `syncError` exists, including the concise error, retry attempt count, and latest sync attempt time when available. This is display-only and does not change full tax invoice create, void, retry, VAT, payment, or stock behavior.

Tax sync retry action workflow: `/pos/tax-invoices/` shows `ลอง Sync` on invoice cards that have `syncError`, `pending_create`, `pending_void`, `local_only`, or `local_void`. The action calls the same page refresh flow that runs pending tax invoice sync and tax buyer profile sync, and does not introduce a separate Firestore write path.

Tax sync retry button state workflow: when staff click `ลอง Sync`, the button is disabled and changes to `กำลัง Sync...` until the existing tax invoice history refresh/sync flow finishes rendering. This prevents accidental duplicate clicks without adding a separate sync worker or Firestore write path.

Tax sync single-flight workflow: `syncPendingTaxInvoices()` keeps one in-flight pending tax invoice sync promise per browser tab. If page load, online reconnect, receipt popup, or `ลอง Sync` calls it while a sync is already running, the later caller waits for the same create/void retry cycle instead of starting a second overlapping run. The create and void paths still use the existing duplicate checks and Firestore read-before-write transactions.

Tax void transaction validation workflow: online full tax invoice voiding reads the target `taxInvoices/{taxInvoiceId}` document in a Firestore transaction, validates tenant ownership plus invoice number and source sale identity when present, then writes only the void status metadata. If validation detects a mismatched tenant, invoice number, or source sale, the operation fails and does not create a local pending-void fallback.

Tax void retry diagnostics workflow: pending full tax invoice sync errors record `syncAction`, `syncPhase`, and `syncTargetId` in the local invoice cache. `/pos/tax-invoices/` shows the action/phase beside the existing sync error, attempt count, and latest attempt time, and the search box can find invoices by those diagnostic fields. This is display/diagnostic metadata only and does not change source sales, VAT totals, payments, stock movements, or issued invoice totals.

Tax sync recovery copy workflow: `/pos/tax-invoices/` shows `คัดลอก Sync` on cards with `Sync Error`. The action copies a plain-text support package containing invoice ID/number, source sale, buyer, status, sync status, sync action, phase, target document, error, attempt count, and latest attempt time. It is client-side recovery metadata only and does not mutate tax invoices, source sales, VAT totals, payments, stock movements, or retry state.

Tax sync escalation hint workflow: `/pos/tax-invoices/` shows a `ส่ง Support` badge and recommendation when a `Sync Error` invoice has `syncAttemptCount >= 3`. The copied Sync support package includes `Escalation: ส่ง Support`, and search can match the escalation text. This remains display-only recovery guidance and does not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax sync filter workflow: `/pos/tax-invoices/` provides filter chips for `ทั้งหมด`, `Sync Error`, `รอ Sync`, and `ส่ง Support` with live counts. Filtering combines with the existing search box and is UI-only, so it does not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax pending sync copy workflow: `/pos/tax-invoices/` shows `คัดลอก Sync` for retryable pending/local states such as `pending_create`, `pending_void`, `local_only`, and `local_void`, even when no `Sync Error` has been recorded yet. The copied recovery package includes invoice, sale, buyer, sync status/action/phase/target, error if any, attempt count, escalation state, and latest attempt time. This remains client-side recovery metadata only and does not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax stale sync hint workflow: `/pos/tax-invoices/` shows `ค้าง Sync` when a retryable pending/local tax invoice sync state is older than 24 hours based on sync attempt, sync error, updated, or issued time. Diagnostics show approximate stale hours, search can match stale sync text, and `คัดลอก Sync` includes `Stale Sync` plus `Sync Reference`. This is display-only recovery guidance and does not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax stale sync filter workflow: `/pos/tax-invoices/` provides a dedicated `ค้าง Sync` filter chip with a live count. The filter shows only retryable pending/local tax invoice sync states that match the stale sync hint rule and combines with the existing search box. This filtering remains UI-only and does not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax source receipt recovery workflow: `/pos/tax-invoices/` shows `ดูบิลต้นทาง` on invoice cards that have a source sale reference. The action opens `/pos/receipt/?saleId=...&auto=0` for read-only comparison, and `คัดลอก Sync` includes `Source Receipt` in the support package. This is operator recovery context only and does not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax buyer recovery workflow: `/pos/tax-invoices/` shows `แก้ผู้ซื้อ` on local/pending create invoices (`pending_create` or `local_only`). The dialog updates only the local tax invoice buyer payload and records `buyerRecoveryUpdatedAt`; it does not reset retry counters, create a Firestore write, change source sales, VAT totals, payments, or stock movements. Staff use the existing `ลอง Sync` action after saving to retry the normal transaction-safe tax invoice sync path.

Tax sync quality hint workflow: `/pos/tax-invoices/` shows `ตรวจข้อมูล` on retryable invoice sync states that are missing buyer name, buyer tax ID, or source sale reference. The `ตรวจข้อมูล` filter chip has a live count, search can match the warning text, and `คัดลอก Sync` includes `Quality Check`. These hints are display-only and do not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax sync recovery action workflow: `/pos/tax-invoices/` adds `คำแนะนำ` recovery guidance to retryable invoice cards and includes `Recommended Action` in `คัดลอก Sync`. Recommendations may point staff to `แก้ผู้ซื้อ`, `ลอง Sync`, `ดูบิลต้นทาง`, or `ส่ง Support`, and remain display-only support guidance without mutating retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax sync source visibility workflow: `/pos/tax-invoices/` shows `แหล่งข้อมูล` on each invoice card to identify whether the merged row came from `Firestore`, `เครื่องนี้`, or `Firestore + เครื่องนี้`. Search can match that source text, and `คัดลอก Sync` includes `Data Source`. The source labels are derived only from the loaded local/remote lists and do not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax sync source filter workflow: `/pos/tax-invoices/` provides source filter chips for `ทุกแหล่ง`, `Firestore เท่านั้น`, `เครื่องนี้เท่านั้น`, and `ทั้งสอง`, each with live counts derived from loaded local/remote rows. `Firestore เท่านั้น` means remote-only rows, `เครื่องนี้เท่านั้น` means local-only rows, and `ทั้งสอง` means rows found in both sources. Source filtering combines with the existing sync status filter and search box and remains UI-only, without mutating retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax sync clear filter workflow: `/pos/tax-invoices/` shows `ล้างตัวกรอง` in the empty state only when search text, a sync status filter, or a source filter is active and the filtered list has no rows. Clicking it clears the search box and resets sync/source filters to `ทั้งหมด` / `ทุกแหล่ง`. This remains UI-only and does not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax sync copy view link workflow: `/pos/tax-invoices/?q=...&sync=...&source=...` preloads the tax invoice history search box plus sync/source filters when values are valid, and the page updates the address bar with the current search/filter state using `history.replaceState` when staff type or click filters. Staff can click `คัดลอกลิงก์มุมมอง` to copy the current view URL, while `คัดลอก Sync` still includes a filtered `Tax History` URL for that row. This remains client-side navigation/support metadata only and does not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

Tax copy link clipboard fallback workflow: `/pos/tax-invoices/` first attempts `navigator.clipboard.writeText` for `คัดลอกลิงก์มุมมอง` and `คัดลอก Sync`. If the browser blocks that API, the page retries the same text through the legacy hidden textarea copy path before showing a failure state. This remains client-side support metadata only and does not mutate retry counters, tax invoices, source sales, VAT totals, payments, stock movements, or Firestore documents.

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
