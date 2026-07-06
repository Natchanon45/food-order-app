# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-15 Customer Display Font Rollback
Version: 0.13.60
Build: 2026.07.07.004

Change: rolled back the unintended Customer Display font/layout override from the local print font CSS. Customer Display no longer loads `retail-pos-font-local.css`, and that shared CSS no longer targets `.display-shell` or related customer display elements. TH Sarabun PSK Local remains scoped to printable paper surfaces only: `.receipt` and `.tax-paper`.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
