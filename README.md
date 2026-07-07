# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Mobile Product Card Overlay
Version: 0.13.80
Build: 2026.07.07.024

Change: updated Retail POS product image cards so mobile defaults to image-only like desktop, reveals product details only during touch/focus/explicit overlay states, and shows product prices with dark green text in the hover/touch overlay.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, offline sale sync, POS theme alignment, and printable document fonts are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
