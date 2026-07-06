# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Payment Button Viewport Fit
Version: 0.13.59
Build: 2026.07.07.003

Change: fixed the `/pos` cart panel viewport fit so the payment button stays visible on desktop-height screens, while the cart list scrolls and still reserves five sale rows on taller screens.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
