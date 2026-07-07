# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Full Tax Invoice Running Number
Version: 0.13.69
Build: 2026.07.07.013

Change: full tax invoices now reserve the TAX running number through the existing Firestore counter transaction when Firebase is online, reusing an existing invoice for the same sale before reserving a number. Offline/local fallback remains available and marks the invoice as local-only.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
