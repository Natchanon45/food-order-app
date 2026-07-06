# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-13 Tax Invoice VAT Total Display
Version: 0.13.55
Build: 2026.07.06.075

Change: fixed the Full Tax Invoice print view so the VAT summary row no longer displays a dash. The row now shows the calculated VAT-inclusive total from `totalAmount`, falling back to `beforeVat + vatAmount` when needed. The tax invoice page asset version was bumped to load the updated print script.

Existing tax buyer DBD lookup, tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
