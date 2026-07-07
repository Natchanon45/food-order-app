# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Payment Modal Visual Tuning
Version: 0.13.82
Build: 2026.07.07.026

Change: refined the Retail POS payment modal by reducing numeric font weight, softening payment total/change emphasis, and adding subtle green and amber visual accents while keeping button text at font-weight 500 or lighter.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, offline sale sync, POS theme alignment, mobile product card overlay behavior, mobile button layout, and printable document fonts are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
