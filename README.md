# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-09 DBD Namespaced Payload Mapping
Version: 0.13.51
Build: 2026.07.06.071

Change: updated the tax buyer lookup function to map the actual DBD OpenAPI namespaced payload shown in production. The function now extracts buyer tax ID, Thai company name, branch name, and address from the DBD `cd`, `cr`, and `td` namespace-style fields and keeps debug mode available at `/api/tax-buyer/lookup?taxId=...&debug=1`.

Existing full tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
