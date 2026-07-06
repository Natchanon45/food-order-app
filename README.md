# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-18 POS Continuous Scanner
Version: 0.13.63
Build: 2026.07.07.007

Change: updated the POS sales barcode scanner to support continuous scanning. On the `/pos` sales barcode input, scanning a product now adds it to the bill and keeps the camera open until the user presses the close button. A short duplicate cooldown prevents the same code from firing repeatedly too fast. Other barcode scan flows keep their previous one-scan behavior.

Note: the scanner script was updated, but the POS HTML asset-version bump was blocked by the GitHub connector safety check. After deploy, hard refresh `/pos` if the browser still uses the cached scanner script.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
