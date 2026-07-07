# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Cart Footer Safe Area
Version: 0.13.65
Build: 2026.07.07.009

Change: added a stronger `/pos` cart footer safe area so the payment button stays fully visible on desktop browser viewports, while keeping line totals aligned with the quantity +/-/remove controls.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
