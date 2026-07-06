# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.52
Build: 2026.07.06.072
Milestone: P9-B006-10 DBD Address Full Mapping

Change: updated the tax buyer lookup function to support the flattened DBD OpenAPI schema. The function now reads `data.address.full` first and falls back to composing the address from `addressNo`, `road`, `subDistrict`, `district`, `province`, and postcode fields when available. It also avoids treating nested address/name objects as string values.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through DBD address full mapping.

Usage: open a receipt after sale, click `ใบกำกับภาษีเต็มรูปแบบ`, enter tax ID, then press `DBD`. For troubleshooting, open `/api/tax-buyer/lookup?taxId=0105528025574&debug=1` after deploying the function.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
