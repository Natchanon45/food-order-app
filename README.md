# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-08 Buyer Lookup Normalization
Version: 0.13.50
Build: 2026.07.06.070

Change: improved the tax buyer lookup function to support nested and array-based OpenAPI responses. The function now scans the payload for the best juristic record, supports more field aliases for tax ID, buyer name, address, and branch, and adds a debug mode at `/api/tax-buyer/lookup?taxId=...&debug=1` to inspect response status, content type, keys, and a safe preview.

Existing full tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
