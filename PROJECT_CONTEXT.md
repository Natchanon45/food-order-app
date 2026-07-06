# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.53
Build: 2026.07.06.073
Milestone: P9-B006-11 DBD Address Append Fix

Change: fixed the tax buyer lookup address mapping after verifying the GitHub code. The function no longer returns early from the partial DBD `cd:Address` value. For namespaced DBD payloads it now uses `cd:Address` as the base and appends city subdivision, city, province, and postcode fields when available. Flattened `data.address.full` remains the first priority when present.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through DBD address append fix.

Usage: open a receipt after sale, click `ใบกำกับภาษีเต็มรูปแบบ`, enter tax ID, then press `DBD`. For troubleshooting, open `/api/tax-buyer/lookup?taxId=0105528025574&debug=1` after deploying the function.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
