# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-10 DBD Address Full Mapping
Version: 0.13.52
Build: 2026.07.06.072

Change: updated the tax buyer lookup function to support the flattened DBD OpenAPI schema. The function now reads `data.address.full` first and falls back to composing the address from `addressNo`, `road`, `subDistrict`, `district`, `province`, and postcode fields when available. It also avoids treating nested address/name objects as string values.

Existing full tax invoice creation, tax invoice history/reprint, receipt behavior, POS totals, VAT calculation, stock deduction, and offline sale sync are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
