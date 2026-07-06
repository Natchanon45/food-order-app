# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-16 Customer Display Pairing Panel Fix
Version: 0.13.61
Build: 2026.07.07.005

Change: fixed the Customer Display header layout after the font rollback. The pairing QR panel is now styled by the Customer Display CSS itself: the header shows a compact connection button, and the QR panel is hidden until hover/focus. The customer display CSS asset version was bumped to load the fix.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, customer display data sync, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
