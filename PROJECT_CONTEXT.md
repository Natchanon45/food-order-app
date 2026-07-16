# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.14.92
Build: 2026.07.16.017
Milestone: Tax Sync Permission And Cross Tab Lock

Change: Fixed endless tax invoice sync attempts by adding tenant-scoped Firestore permissions for tax invoices, buyer profiles, TAX counters, and TAX running numbers; blocking automatic retries after permission errors; serializing sync across browser tabs; and preventing LocalStorage events from initiating another sync.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, later full tax invoice issuing from an existing short tax invoice/receipt, PromptPay QR payment display for POS/customer screens, payment customer clear hardening, Customer Display PC stacked-left layout tuning, compact PC Customer Display tuning, editable full-tax buyer profiles, full-tax invoice void/cancel workflow, Customer Display PromptPay visual refresh, and Customer Display liquid-glass theme tuning.

Usage: open `/pos/tax-invoices/` in one or two tabs. Pending documents should sync once under the current tenant without repeated attempt growth. A `permission-denied` row must stop automatic retries and remain available for explicit `ลอง Sync`; LocalStorage updates from another tab should refresh the list only.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Previous build note: Login Validation Layout Polish from build `2026.07.16.011` remains unchanged for login validation feedback below the full input group and stable email/password icons.

Previous build note: Tax Buyer DBD And Validation Layout Polish from build `2026.07.16.010` remains unchanged for tax invoice history open/print button contrast, DBD lookup with manual-copy fallback in the tax buyer edit dialog, and product form validation that does not stretch product code/barcode inputs or move scanner icons.

Previous build note: Tax Buyer Tax ID First from build `2026.07.16.016` remains unchanged for the buyer tax ID field order.

Previous build note: Retail POS Settings Nonblocking Sync from build `2026.07.16.015` remains unchanged for responsive settings saves and background Firebase sync.

Previous build note: Retail POS Settings Offline Sync from build `2026.07.16.014` remains unchanged for tenant-scoped local-first settings persistence.

Previous build note: Retail POS Action Bar Text Only from build `2026.07.16.013` remains unchanged across the main POS page and submenus.

Previous build note: Admin Hero Title Icon Cleanup from build `2026.07.16.012` remains unchanged for the text-only `/admin` hero heading `จัดการร้าน`.

Next Task: deploy Firestore rules and hosting, then verify build `20260716-017` drains existing pending tax invoices once without cross-tab retry loops.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
