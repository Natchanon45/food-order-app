# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-14 Print Font Scope Polish
Version: 0.13.56
Build: 2026.07.06.076

Change: standardized local Thai font loading. TH Sarabun PSK Local is now defined in one shared CSS file and scoped to printed paper surfaces (`.receipt`, `.tax-paper`) plus the customer display shell. Receipt/tax invoice toolbars, headers, buttons, and tax buyer modal keep the normal app UI font so the popup controls look consistent.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy rules: use `firebase deploy --only hosting` for changes under `public/` only. Use `firebase deploy --only functions:<functionName>` when files under `functions/` change. Use `firebase deploy --only functions:<functionName>,hosting` only when both function code/routes and hosting assets change.

Deploy for this build: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
