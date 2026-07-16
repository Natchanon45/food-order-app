# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.89
Build: 2026.07.16.014
Milestone: Retail POS Settings Offline Sync

Change: Retail POS store settings now use tenant-scoped local-first persistence for every form section: store identity, receipt, tax, PromptPay/payment, and loyalty. Saves write to LocalStorage and a tenant-specific pending queue before attempting Firebase, then sync to `tenants/{tenantId}/settings` immediately when online or automatically after connectivity returns.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/settings/`, edit values in every section, and save. Verify the toast reads `บันทึกข้อมูลการตั้งค่าร้านค้าสำเร็จ`. Test once online and once with browser network set to Offline; the offline save must remain in tenant-scoped LocalStorage, and after restoring connectivity the queued `store`, `receipt`, `tax`, `payment`, and `loyalty` documents must sync under the current tenant.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Previous build note: Login Validation Layout Polish from build `2026.07.16.011` remains unchanged for login validation feedback below the full input group and stable email/password icons.

Previous build note: Tax Buyer DBD And Validation Layout Polish from build `2026.07.16.010` remains unchanged for tax invoice history open/print button contrast, DBD lookup with manual-copy fallback in the tax buyer edit dialog, and product form validation that does not stretch product code/barcode inputs or move scanner icons.

Previous build note: Retail POS Action Bar Text Only from build `2026.07.16.013` remains unchanged across the main POS page and submenus.

Previous build note: Admin Hero Title Icon Cleanup from build `2026.07.16.012` remains unchanged for the text-only `/admin` hero heading `จัดการร้าน`.

Next Task: deploy hosting and verify online/offline store-settings saves plus automatic Firebase recovery sync with build `20260716-014`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
