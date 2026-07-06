# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-17 Customer Display Liquid QR
Version: 0.13.62
Build: 2026.07.07.006

Change: restyled the Customer Display pairing QR panel with a black-green linear liquid/glass look. The QR panel remains hidden until hover/focus, while the real QR image is larger for easier scanning. The Customer Display CSS asset version was bumped to load the new style.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
