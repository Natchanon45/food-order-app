# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-06 Tax Buyer Draft Persistence
Version: 0.13.48
Build: 2026.07.06.068

Change: improved the Full Tax Invoice buyer modal fallback. The buyer form now saves a local draft while typing, restores the draft for the same sale, and provides a copy-link action for external juristic lookup instead of navigating away from the receipt popup automatically.

Existing full tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
