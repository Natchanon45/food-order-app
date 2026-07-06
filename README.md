# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-11 DBD Address Append Fix
Version: 0.13.53
Build: 2026.07.06.073

Change: fixed the tax buyer lookup address mapping after verifying the GitHub code. The function no longer returns early from the partial DBD `cd:Address` value. For namespaced DBD payloads it now uses `cd:Address` as the base and appends city subdivision, city, province, and postcode fields when available. Flattened `data.address.full` remains the first priority when present.

Existing full tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
