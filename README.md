# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Sticky Payment Footer
Version: 0.13.66
Build: 2026.07.07.010

Change: changed the `/pos` cart layout so the payment button remains visible as a fixed cart footer, the cart item list scrolls at roughly 4-5 visible rows depending on screen height, and the desktop product grid fits 12 images per row on 1920px-wide screens.

Previous build note: POS sales barcode scanner continuous scanning from P9-B006-18 remains unchanged. After deploy, hard refresh `/pos` if the browser still uses a cached scanner script.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
