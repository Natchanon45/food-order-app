# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Font Coverage and Menu Icons
Version: 0.13.72
Build: 2026.07.07.016

Change: expanded the Thai sans/no-head UI font standard to standalone POS buttons/forms and replaced Retail POS submenu expand/collapse text carets with Bootstrap Icons.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
