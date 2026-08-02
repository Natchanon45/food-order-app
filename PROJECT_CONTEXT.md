# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.16.10
Build: 2026.08.03.002

<!-- ADMIN_RESPONSIVE_PRINT_REFINEMENT_20260803_002 -->
Change: Admin Responsive And Print Refinement.

Visual acceptance: Admin list pagination uses local Bootstrap chevron icons rather than text angle characters. Delivery fee rows use a two-row mobile layout with the delete action aligned beside the price. Menu and table edit modals use inset responsive spacing and stable single-column mobile forms.

Print behavior: Delivery and Take Away QR actions open an isolated single-card 80 mm print document, preventing both QR cards or hidden Admin page layout from producing multiple printed pages.

Data boundary: Presentation and print behavior only. Admin settings, menu/table persistence, tenant scoping, QR destinations, sales reports, stable IDs, duplicate protection, and offline behavior are unchanged.

Deploy: Firebase Hosting only. Hard refresh cache `20260803-002`.


<!-- ADMIN_WORKSPACE_VISUAL_REFRESH_20260803 -->
Change: Admin Workspace Visual Refresh aligns `/admin` and `/admin/sales-report` with Waiting Queue quality.

Current behavior: both Admin surfaces share a responsive visual layer with a green gradient hero, accent-colored cards, readable form controls, report metrics, chart panels, and improved tables. Dynamic report content is presentation-enhanced through an idempotent MutationObserver.

Data boundary: no Admin form submit handler, Firebase collection path, tenant selection, sales-report calculation, order/POS sale de-duplication, or business workflow changes are included.

Deploy rules: Hosting only.

Next Task: verify `/admin` and `/admin/sales-report` at desktop, tablet, and mobile widths with real tenant data.


<!-- FIREBASE_AUTH_UI_PARITY_20260802_104 -->
Change: Firebase Login And Owner Password Dialog UI Parity.

Current behavior: the Login footer consumes the shared application version metadata and no longer presents the retired hard-coded `1.6.17`. The owner-only password dialog uses the current modal hierarchy, visibility toggles, minimum eight-character guidance, inline validation, keyboard dismissal, and responsive action layout while retaining Firebase reauthentication and `updatePassword` behavior.

Deploy rules: Hosting only. No Firestore Rule, Index, Function, Auth account, tenant, or role change.

Acceptance test: open `/login`, confirm version `0.16.8` and build `2026.08.02.104`, sign in as an owner, open `เปลี่ยนรหัสผ่าน`, toggle all three password fields, verify mismatched passwords remain blocked, and confirm a valid change still requires the current password.

<!-- WAITING_QUEUE_SEAMLESS_ORDER_HANDOFF_20260802_020 -->
Change: Waiting Queue Seamless Customer Order Handoff And Recorded Announcement Audio.

Current behavior: after staff open a table, the existing seating transaction publishes the active table order path to the customer's privacy-safe tracking document. The tracking page updates in real time, shows the assigned table, and provides `สั่งอาหารที่โต๊ะ`. The action opens the same tenant storefront table session created during seating and reuses the deterministic Waiting Queue order instead of creating another order.

Audio behavior: the public display defaults to enabled sound, subject to the browser's required first interaction. A four-note service chime and prerecorded Thai phrase play through the same unlocked Web Audio context. Recall replays audio only and preserves the original call time and response deadline. Browser speech synthesis remains a fallback.

Privacy and integrity: the public document contains the same-origin order path only after `seated` and only when tenant slug, table code, and table token are complete. Customer name, phone, phone hash, and notes remain private. Opening a table remains online-only and atomic across queue, table, deterministic order, public/board mirrors, dedupe, and audit records. Stable IDs, tenant scope, fair-order override reasons, and two-device collision protection remain unchanged.

UI behavior: the open-table dialog no longer renders an outer shadow. Customer tracking adds a responsive ready-to-order panel without changing cancellation or notification rules.

Deploy rules: Hosting only. No Firestore Rule, Composite Index, or Function change.

Acceptance test: create and scan a queue ticket, call the queue, open a table, verify that the same tracking page changes to `เข้านั่งแล้ว`, then use `สั่งอาหารที่โต๊ะ` and confirm the URL contains the assigned table code and active table token. Submit an item and confirm it belongs to `order-wq-{waitingQueueId}`. On the public display, click once to unlock audio and verify both first call and recall play the chime followed by the Thai recorded queue number while the original countdown remains unchanged.

<!-- WAITING_QUEUE_TICKET_MODAL_READABILITY_20260802_005 -->
Change: Waiting Queue Ticket Modal Readability.

Current behavior: the ticket modal uses larger operational text, a more compact screen QR, clearer metadata rows, and a concise tracking-link ready state. The long raw URL remains available to the copy action but is no longer rendered as a cramped visible line.

Print, privacy, Firebase, stable IDs, tenant scoping, and table-session behavior are unchanged.

Deploy rules: Hosting only.

<!-- WAITING_QUEUE_TABLE_SESSION_BRIDGE_20260802_004 -->
Change: Waiting Queue Table Session Bridge.

Current behavior: opening a table from Waiting Queue now creates the same active table session contract as the canonical Table QR workflow: `orderToken`, `sessionStartedAt`, `currentRound`, and `orderIds`. Staff navigation uses `/s/{tenantSlug}/order/?table={tableCode}&token={orderToken}`, and customer orders inherit the Waiting Queue link from the active table.

Recovery: seated queues created by the previous build without a table token are repaired automatically from the staff page in the existing read-before-write transaction. Stable queue, table, and deterministic draft order IDs are preserved.

Deploy rules: Firestore Rules and Hosting. No Composite Index or Function change.

Next Task: refresh Waiting Queue, confirm the prior seated table appears under issued Table QR, open its order page, and submit one customer order.

<!-- WAITING_QUEUE_TICKET_PRINT_POLISH_20260802_003 -->
Change: Waiting Queue Ticket Print Polish.

Current behavior: the customer ticket preview has balanced spacing and includes the number of suitable queues ahead. Printed output uses a fixed 80 x 160 mm receipt layout, waits for the QR and local TH Sarabun PSK fonts, and retains the W-number, party size, estimated wait, received time, tracking URL, privacy note, and scan instruction.

Privacy and Firebase boundaries are unchanged. The printed ticket contains no customer name or phone number, QR generation remains local, and queue writes, tenant scoping, stable IDs, outbox behavior, and table transactions are unchanged.

Deploy rules: Hosting only. No Firestore Rules, Indexes, or Functions change.

Next Task: print to an 80 mm receipt printer and scan the QR from the physical ticket.

<!-- WAITING_QUEUE_IMMEDIATE_TICKET_HANDOFF_20260802_002 -->
Change: Waiting Queue Immediate Ticket Handoff.

Current behavior: after staff successfully add a queue, the privacy-safe customer ticket dialog opens immediately with the stable W-number, local QR Code, tracking URL, estimated wait, copy-link action, and 80 mm print action. Staff no longer need to close a separate success prompt and reopen the ticket from the queue row.

Privacy and data boundaries remain unchanged: the QR contains only the existing customer tracking URL, printed tickets contain no customer name or phone number, and queue creation, tenant scoping, outbox sync, stable IDs, and table-opening transactions are unchanged.

Deploy rules: Hosting only. No Firestore Rules, Indexes, or Functions change.

Next Task: add a queue, print its ticket, scan the QR on a customer device, then continue call and open-table acceptance testing.

<!-- WAITING_QUEUE_RUNTIME_REPAIR_20260802_001 -->
Change: Waiting Queue Runtime Repair.

Current behavior: call, recall, cancel, defer, customer response, and seating write the private queue plus clean Public/Board mirrors without retaining unknown legacy fields. Existing failed outbox transitions can retry and drain.

Opening a table remains one transaction and may create only the deterministic Waiting Queue dine-in draft order for the same tenant and stable queue.

The customer-link action displays one QR Code and prints the existing privacy-safe tracking URL.

Deploy rules: Firestore Rules and Hosting. No Index or Function change.

Next Task: drain the existing outbox, call W001, scan/print the QR ticket, and repeat the two-device open-table collision test.


<!-- WAITING_QUEUE_TICKET_QR_CALL_RECOVERY_20260801_006 -->
Change: Waiting Queue Ticket QR And Call Recovery.

Current behavior: staff open a QR ticket from each queue row, copy the tracking link, or print a privacy-safe 80 mm queue ticket for the customer. QR generation is local and does not expose the token to a third-party QR endpoint.

Audio behavior: the operator gesture arms sound with a chime only. The system speaks only actual queue calls and does not announce that sound has been enabled.

Authorization behavior: the page passes the authenticated profile tenant into Waiting Queue resolution. Rules validate active owner/staff membership and support same-tenant legacy identity backfills needed by existing queue mirrors. Permission errors no longer arise from a stale generic browser tenant.

Deploy rules: Firestore Rules and Hosting. Composite Indexes and Functions are unchanged.

Next Task: drain the current outbox, call a queue, scan and print its ticket, then repeat the two-device open-table collision test.


<!-- WAITING_QUEUE_OWNER_ACCESS_DIALOG_20260801_005 -->
Change: Waiting Queue Owner Access And Dialog Spacing.

Current behavior: `resolveTenantId()` reads the authenticated staff profile before legacy tenant keys. When the browser contains a different tenant ID, the system switches to the profile tenant and records a one-time warning; the previous tenant cache is preserved but excluded from the current outbox.

Authorization: top-level Waiting Queue collections remain tenant-scoped. Owner/staff authorization is evaluated from `users/{uid}`, canonical tenant membership, tenant ownership, or validated Auth claims. Rules no longer depend on an unsafe helper evaluation before these checks.

Dialog behavior: both modal footers use inset sticky action containers. Cancel and primary actions have icons, balanced widths, and no edge contact.

Deploy rules: Firestore Rules and Hosting. No Index or Function change.

Next Task: confirm the corrected tenant warning if applicable, drain the current outbox to zero, then repeat call and two-device open-table tests.


<!-- WAITING_QUEUE_USABILITY_PERMISSION_20260801_004 -->
Change: Waiting Queue Usability And Permission Repair closes the production permission and readability gaps.

Current behavior: owner/admin/manager/cashier users recognized through the canonical tenant membership path can create, call, sync, and seat waiting queues. Permission-denied errors are translated into actionable Thai text.

UI behavior: Staff controls use readable operational sizes. Add-queue validation keeps fixed control widths and reserved feedback space. Customer tracking and public display preserve privacy while increasing visibility and icon contrast.

Audio behavior: The display still requires one operator gesture. Its spoken phrase uses individually pronounced Thai digits and a slower natural speech rate.

Deploy rules: deploy Firestore Rules and Hosting. Composite Indexes and Functions are unchanged.

Next Task: verify pending outbox count reaches zero, call W001/W002, confirm the display voice, and repeat the two-device open-table collision test.


<!-- WAITING_QUEUE_CONFLICT_RECOVERY_20260801_003 -->
Change: Waiting Queue Conflict Recovery reconciles the local outbox with authoritative remote queue state.

Current behavior: Remote terminal statuses (`seated`, `no_show`, `cancelled`) override stale optimistic local rows. Outbox transitions that reference an older status/version resolve as superseded and no longer block later operations. Valid current operations remain transaction-safe and preserve stable IDs.

Contention boundary: Firestore transactions still perform reads before writes. The client increases the bounded transaction attempt budget and reduces background public-snapshot writes by signature, preventing repeated public mirror updates from competing with call/open-table transactions.

Dashboard: `คิวรอโต๊ะ` is a static role-controlled dashboard card; the runtime clone remains fallback-only.

Deploy rules: Hosting only. No Rules, Indexes, Functions, or schema migration is required.

Next Task: rerun two-device call/cancel/open-table acceptance tests and verify that the old local outbox drains to zero without manual Local Storage deletion.


<!-- WAITING_QUEUE_UI_20260801_002 -->
Change: Waiting Queue UI Consolidation makes `/waiting-queue/` the single staff workspace. It removes the Retail POS menu from that screen, replaces the floating home shortcut with a normal dashboard card, redirects the legacy cashier staff route, and preserves legacy customer links through a presentation-only compatibility layer.

Current behavior: Staff filters and table selection are aligned on consistent control heights; the open-table dialog uses selectable table cards and keeps the existing read-before-write transaction. Customer tracking uses the canonical responsive card. The public display explains that enabled audio means a chime plus spoken Thai queue number, with a clearly labelled chime-only fallback.

Data boundary: Waiting Queue documents, public snapshots, board rows, audits, leases, dedupe records, tables, and deterministic orders remain tenant-scoped and unchanged. Legacy rows are not deleted or rewritten.

Deploy rules: Hosting only. Load `20260801-002` with a hard refresh.


Change: Implemented Waiting Queue MVP as a table-waiting workflow independent from food queue and order numbers. Stable `waitingQueueId` and W-number records support staff intake, status transitions, fair size/special-needs matching, five-minute call response, customer acknowledgement/cancellation, a public display with sound, and transaction-safe table opening that creates a deterministic linked order.

Firebase boundary: Waiting queue writes use top-level tenant-scoped collections `waitingQueues`, `waitingQueuePublic`, `waitingQueueBoard`, `waitingQueueAudits`, `waitingQueueCounters`, `waitingQueueNumberLeases`, `waitingQueueNumbers`, `waitingQueueDedupe`, and `waitingQueueOperations`. Customer tracking tokens remain in non-listable `waitingQueuePublic` documents, while the listable public display reads token-free `waitingQueueBoard` documents. Neither public surface contains customer name, phone, or note. Local staff intake uses preleased stable W-numbers and an idempotent outbox; queue records are retained for audit and are never physically deleted. Existing order, payment, stock, VAT, Kitchen, Delivery, stable sale/order IDs, and duplicate stock protection remain authoritative.

Deploy rules: deploy Firestore Rules, Indexes, and Hosting. Load cache build `20260801-001` with a hard refresh.
Milestone: Admin Responsive And Print Refinement

Next Task: perform two-device acceptance tests for duplicate intake, call/recall audit, customer response, skip reasons, table collision protection, and order/table linkage.

Previous build (`2026.08.01.106`) — Authoritative Store Settings:

Change: Expanded the Waiting Queue badge instead of truncating the queue label. The full 8-character queue number is now visible within a 116 px desktop badge and a 104 px mobile badge, with a small responsive font adjustment on narrow screens.

Firebase boundary: CSS presentation only. Queue values and stable identifiers remain byte-for-byte unchanged; no Firestore read/write, tenant permission, state transition, duplicate protection, public tracking, or connectivity behavior changed.

Deploy rules: Hosting only. Load cache build `20260801-106` with a hard refresh after deployment.

Change: Polished all five reported Waiting Queue UI points: the table menu now reads `เปิดโต๊ะ`; Waiting Queue uses the mapped `user-time` icon; the add button aligns with its inputs; queue badges safely contain long display values; and queue seating uses the same `room-service` icon as the table menu.

Firebase boundary: No queue value or stable identifier is rewritten. These are display-only changes with no Firestore path, tenant permission, queue/table transaction, duplicate guard, public mirror, or connectivity change.

Deploy rules: Hosting only. Load cache build `20260801-105` with a hard refresh after deployment.

Change: Kept the Waiting Queue add action aligned with the input controls on desktop even when customer-name validation feedback is visible. The responsive stacked action remains unchanged on mobile.

Firebase boundary: Presentation only. No Firestore read/write, queue transition, tenant boundary, stable identifier, duplicate guard, public tracking, or connectivity behavior changed.

Deploy rules: Hosting only. Load cache build `20260801-104` with a hard refresh after deployment.

Change: Implemented Waiting Table Queue MVP for walk-in guests. Staff roles owner/admin/manager/cashier can create tenant-scoped queues, call or pause them, and seat an active queue at an available table. The operation changes the table to `occupied`, creates its stable session token, and marks the queue seated in the same Firestore transaction. `/queue?token=...` provides a PII-free real-time customer view.

Firebase boundary: Staff queue data lives at `tenants/{tenantId}/waitingQueues/{queueId}`. Public status lives at `publicWaitingQueues/{publicToken}` with get-only public access, denied collection listing, validated staff writes, and no customer contact fields. Creating or mutating a queue requires online Firestore so duplicate queue/table transitions cannot be produced; unrelated local-first POS and offline order workflows are unchanged.

Deploy rules: deploy Hosting and Firestore rules. Load cache build `20260801-103` with a hard refresh after deployment.

Change: Compacted the Cashier Take Away toolbar on screens up to 600 px. Its title remains left-aligned while the QR, new Take Away, and copy-link controls stay together on the right of the same row as 38 px icon-only actions, reducing the toolbar to one line where available.

Firebase boundary: Responsive presentation only. No Take Away action, URL, Firebase path, tenant boundary, order/sale/queue identifier, duplicate guard, Push Notification, or offline behavior changed.

Deploy rules: Hosting only. Load cache build `20260801-102` with a hard refresh after deployment.

Change: Moved the Kitchen/Cashier notification bell into the same right-aligned header action group as the authenticated user profile. A short-lived header observer handles the asynchronous profile mount, then disconnects after placing the menu beside the bell with consistent desktop/mobile spacing.

Firebase boundary: No Firebase reads, writes, rules, Functions, token registration, notification delivery, tenant data, order/sale/queue IDs, duplicate protection, or offline workflow changed.

Deploy rules: Hosting only. Load cache build `20260801-101` with a hard refresh after deployment.

Change: Fixed the reported Take Away operational gaps. The Kitchen/Cashier real-time observer now recognizes new Take Away orders and plays the already enabled alert sound; the Firestore order-created notification uses Take Away queue/customer wording instead of a blank table. The public Take Away form marks both contact alternatives red when both are empty, and the accepted-order button reads `เริ่มทำ`.

Firebase boundary: Notification delivery still uses the existing tenant order trigger and validated tenant token documents. Stable order/sale/queue IDs, duplicate protection, online/offline behavior, and existing order state transitions remain unchanged.

Deploy rules: deploy Hosting, Functions, and Firestore rules. Load cache build `20260801-100` with a hard refresh after deployment.

Change: Fixed Push Notification enrollment. Tenant members can now create or refresh only their own validated token document under `tenants/{tenantId}/notificationTokens`, while client listing and deletion remain denied. The UI reports actionable Firebase Messaging, Service Worker, profile, browser-permission, and Firestore authorization errors instead of one generic failure.

Firebase boundary: Existing Cloud Functions still consume active notification tokens with Admin SDK access. No notification trigger, order/sale/queue ID, duplicate protection, online/offline workflow, or other persistence path changed.

Deploy rules: deploy Hosting and Firestore rules. Load cache build `20260801-099` with a hard refresh after deployment.

Change: Fixed the settings-source mismatch. Tenant Firestore `store`, `receipt`, `tax`, and `payment` documents now override stale local cache values on the settings screen, including explicit `no` and empty VAT/PromptPay fields. The resolved authoritative configuration is then copied to the tenant-scoped and compatibility local caches used by POS and customer display.

Firebase boundary: No schema or write path changed. Settings remain under `tenants/{tenantId}/settings`; this update only corrects read precedence and local cache refresh. Sales, stock movements, stable sale/order/queue IDs, duplicate protection, offline sync, payments, returns, and tax invoices remain unchanged.

Deploy rules: Hosting only. Load cache build `20260801-098` with a hard refresh after deployment.

Previous build (`2026.08.01.097`): Added icon-only product pagination and bounded, changed-record-only catalog sorting saves.

Previous build (`2026.08.01.096`): Improved mobile received-cash alignment, shared sales-export Dialog behavior, and global red invalid-control styling.

Previous build (`2026.07.31.095`): Standardized shared Dialog button layout, icon spacing, and hidden alert actions.

Previous build (`2026.07.31.094`): Replaced native Retail POS alerts and confirmations with the shared styled dialog and clarified select-all permission icons.

Previous build (`2026.07.31.093`): Separated the receipt icon and late tax-invoice title using explicit elements, flex alignment, and a 10 px gap.

Previous build (`2026.07.31.092`): Fixed the net-sales summary card contrast with a green gradient and white label, value, and unit.

Previous build (`2026.07.31.091`): Applied the primary green theme and a 20 × 20 px size to native checkboxes across Order/Delivery and Retail POS while preserving native behavior.

Previous build (`2026.07.31.090`): Matched Firebase `/admin/users` to the Laravel employee-management UI with a staff Hero, compact employee list, and responsive create-user modal while retaining Firebase Auth and tenant-scoped Firestore behavior.

Previous build (`2026.07.31.087`): Category pagination on `/pos/products` shows page buttons as plain numbers only while previous/next controls, search, filters, sorting, page-size selection, and page navigation remain unchanged.

Previous build (`2026.07.31.086`): Reworked the `/pos/products` category manager into a compact operational list with search, status filtering, sorting, page-size selection, pagination, category/product counts, and a dedicated add/edit dialog. Existing product-derived categories can be saved as stable category records, and a category rename updates affected product `categoryId`/`category` metadata without changing stock or sales data, while keeping the saved POS category order aligned with the renamed category.

Previous build (`2026.07.31.085`): Retail POS cart decrement and increment controls render Bootstrap dash/plus icons inside the existing circular controls. Accessible labels and all quantity/cart behavior remain unchanged. Category selection remains tenant-scoped, while sales, stock movements, stable sale/order/queue IDs, duplicate protection, local-first operation, and offline sync remain authoritative.

Change: Closed the seven remaining Retail POS parity gaps: correct password key icon, single category strip, fixed VAT mode without the removed selector, hamburger menu icon, product pagination, tenant-scoped Firestore category management, and restored category/product sorting content.

Firebase boundary: New category documents use `tenants/{tenantId}/categories` and tenant admin rules. Existing Auth, products, sales, stock movements, stable sale/order/queue IDs, duplicate protection, local-first behavior, offline sale queue, and synchronization workflows remain authoritative.

Deploy rules: deploy Hosting and Firestore rules. Load cache build `20260731-082` with a hard refresh after deployment.

Change: Closed the Sales Report parity gap. The report now watches both restaurant `orders` and Retail POS `sales` for the active tenant, converts POS sales to the shared receipt structure, and de-duplicates matching order/receipt IDs. Its default period is monthly and its application header is pinned to the Laravel green theme.

Firebase boundary: This is a tenant-scoped read/presentation change only. Existing Auth, Firestore/Storage writes, transactions, stable IDs, duplicate protection, local-first behavior, and offline synchronization remain authoritative.

Deploy rules: hosting-only deploy. Load cache build `20260731-081` with a hard refresh after deployment.

Change: Completed browser workflow parity with the Laravel/MySQL edition while keeping Firebase as the only persistence layer. Kitchen groups table rounds under one queue, Cashier restores stable queue ordering and Take Away tools, Admin restores modal add actions and verified payment/store settings saves, Delivery permits an active Firebase staff session to sign out, and shared POS/dialog/toast presentation follows the current Laravel behavior.

Firebase boundary: Existing tenant-scoped Auth/Firestore/Storage services, order/table transactions, stable order/sale/queue IDs, duplicate protection, local-first persistence, offline queue processing, and sync behavior remain authoritative. No rules, indexes, Functions, or schema paths changed.

Deploy rules: hosting-only deploy. Load cache build `20260731-080` with a hard refresh after deployment.

Change: Ported presentation-only updates from the Laravel/MySQL application into the Firebase-hosted application. This includes the shared green theme, modern dashboard/report workspace, Flaticon dashboard icons, clearer queue badges, Take Away confirmation/success actions, cashier/kitchen confirm icons, smooth kitchen hourglass animation, `กำลังทำ`, and the blue `ส่งมอบแล้ว` action.

Firebase boundary: Firebase Auth, Firestore and Storage services, tenant selection, stable order/sale/queue IDs, duplicate protection, local-first persistence, offline queue processing, and sync behavior remain authoritative and unchanged. No rules, indexes, functions, or Firebase transaction code changed.

Deploy rules: hosting-only deploy. Load cache build `20260731-079` with a hard refresh after deployment.

Change: Fixed the Super Admin login and `/platform` guard flow. Login now resolves the signed-in Firestore profile before selecting `ROLE_HOME`, so `super_admin` goes directly to `/platform`. The shared role guard now restores page visibility and provides retry/re-login actions if profile loading fails, preventing a permanently blank page.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: sign in with an active `super_admin` account and verify the browser opens `/platform` with the Super Admin Control Center visible. If profile loading is blocked or unavailable, verify the page shows recovery actions instead of a white screen.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Previous build note: Login Validation Layout Polish from build `2026.07.16.011` remains unchanged for login validation feedback below the full input group and stable email/password icons.

Previous build note: Tax Buyer DBD And Validation Layout Polish from build `2026.07.16.010` remains unchanged for tax invoice history open/print button contrast, DBD lookup with manual-copy fallback in the tax buyer edit dialog, and product form validation that does not stretch product code/barcode inputs or move scanner icons.

Previous build note: Tax Sync Permission And Cross Tab Lock from build `2026.07.16.017` remains unchanged for tenant tax permissions and retry-loop protection.

Previous build note: Tax Buyer Tax ID First from build `2026.07.16.016` remains unchanged for the buyer tax ID field order.

Previous build note: Retail POS Settings Nonblocking Sync from build `2026.07.16.015` remains unchanged for responsive settings saves and background Firebase sync.

Previous build note: Retail POS Settings Offline Sync from build `2026.07.16.014` remains unchanged for tenant-scoped local-first settings persistence.

Previous build note: Retail POS Action Bar Text Only from build `2026.07.16.013` remains unchanged across the main POS page and submenus.

Previous build note: Admin Hero Title Icon Cleanup from build `2026.07.16.012` remains unchanged for the text-only `/admin` hero heading `จัดการร้าน`.

Previous build note: POS Catalog Single Renderer from build `2026.07.17.002` remains unchanged for stable 96-item catalog rendering and image/fallback cards.

Next Task: deploy Hosting and verify that category pagination page buttons display only `1`, `2`, `3`, and so on, while the previous/next arrow buttons and all category-management behavior remain unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
