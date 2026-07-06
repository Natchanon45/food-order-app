# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.51
Build: 2026.07.06.071
Milestone: P9-B006-09 Buyer Lookup Field Mapping

Change: updated the tax buyer lookup function to map the actual OpenAPI payload shape seen in production. The function now extracts buyer tax ID, Thai company name, branch name, and address from the namespaced juristic response fields and keeps debug mode available at `/api/tax-buyer/lookup?taxId=...&debug=1`.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through production buyer lookup field mapping.

Usage: open a receipt after sale, click `ใบกำกับภาษีเต็มรูปแบบ`, enter tax ID, then press `DBD`. For troubleshooting, open `/api/tax-buyer/lookup?taxId=0105528025574&debug=1` after deploying the function.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
