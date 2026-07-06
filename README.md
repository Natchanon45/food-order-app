# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-12 Deep DBD Address Lookup
Version: 0.13.54
Build: 2026.07.06.074

Change: fixed the tax buyer lookup address mapping by reading DBD locality fields recursively inside the address object. The function now uses `cd:Address` as the base and deep-searches for city subdivision, city, province, and postcode fields before returning `buyerAddress`. Debug mode now includes `addressKeys` and `addressProbe` to show which address parts were detected.

Existing full tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
