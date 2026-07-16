# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.90
Build: 2026.07.16.015
Milestone: Retail POS Settings Nonblocking Sync

Change: Fixed a settings-page hang after deploy by moving all Firestore settings sync work out of the page-load and submit critical paths. Local saves complete immediately, while the tenant-scoped queue syncs after a delay with per-document timeout protection and no immediate failure retry loop.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/settings/` and verify the page remains responsive during slow, disconnected, or restored network states. Saving must immediately show `บันทึกข้อมูลการตั้งค่าร้านค้าสำเร็จ`, retain all data locally, and let the background queue sync `store`, `receipt`, `tax`, `payment`, and `loyalty` under the current tenant without blocking the UI.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Previous build note: Login Validation Layout Polish from build `2026.07.16.011` remains unchanged for login validation feedback below the full input group and stable email/password icons.

Previous build note: Tax Buyer DBD And Validation Layout Polish from build `2026.07.16.010` remains unchanged for tax invoice history open/print button contrast, DBD lookup with manual-copy fallback in the tax buyer edit dialog, and product form validation that does not stretch product code/barcode inputs or move scanner icons.

Previous build note: Retail POS Settings Offline Sync from build `2026.07.16.014` remains unchanged for tenant-scoped local-first settings persistence.

Previous build note: Retail POS Action Bar Text Only from build `2026.07.16.013` remains unchanged across the main POS page and submenus.

Previous build note: Admin Hero Title Icon Cleanup from build `2026.07.16.012` remains unchanged for the text-only `/admin` hero heading `จัดการร้าน`.

Next Task: deploy hosting and verify `/pos/settings/` stays responsive while the `20260716-015` background settings queue handles online, offline, timeout, and reconnect cases.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
