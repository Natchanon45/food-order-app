# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.15.14
Build: 2026.08.01.096

Change: Improved mobile payment and validation presentation. The received-cash value is right-aligned on mobile, the empty sales export flow uses the shared left/right action Dialog with spaced icons, and invalid controls retain a red border and focus ring instead of inheriting green or dark focus styling.

Firebase boundary: Product and category writes remain tenant-scoped through `tenants/{tenantId}`. Clearing stock history still affects only the local movement-history list and never changes product stock. Sales, sale stock movements, stable sale/order/queue IDs, duplicate protection, local-first checkout, offline sale sync, VAT, payments, returns, and tax invoices remain authoritative and unchanged.

Deploy rules: Hosting only. Load cache build `20260801-096` with a hard refresh after deployment.
Milestone: Mobile Payment Dialog and Validation

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
