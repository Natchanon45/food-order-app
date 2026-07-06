# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Modern Panel Polish
Version: 0.13.58
Build: 2026.07.07.002

Change: polished the `/pos` modern panel layout by removing the extra cart title marker, tightening the product panel width around the image grid, and keeping the cart list sized for at least five sale rows.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
