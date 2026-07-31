# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.97
Build: 2026.07.31.079
Milestone: Firebase UI Presentation Parity

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

Next Task: deploy hosting and verify build `20260723-001` with an active Super Admin account, including direct login redirect, platform rendering, retry, and re-login recovery.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
