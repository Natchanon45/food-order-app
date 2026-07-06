# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Modern Panel Layout
Version: 0.13.57
Build: 2026.07.07.001

Change: modernized the `/pos` working layout with cleaner product and cart panels, refreshed desktop card/list spacing, and reserved cart-list height for at least five sale rows.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
