# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-07 Buyer Lookup OpenAPI
Version: 0.13.49
Build: 2026.07.06.069

Change: updated the tax buyer lookup function to call the official buyer lookup OpenAPI by tax ID. The receipt modal continues calling `/api/tax-buyer/lookup`, and the function normalizes the response into buyer tax ID, buyer name, address, and branch fields for automatic form filling. Draft persistence and modal-safe fallback remain in place.

Existing full tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
