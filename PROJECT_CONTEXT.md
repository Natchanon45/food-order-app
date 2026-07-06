# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.54
Build: 2026.07.06.074
Milestone: P9-B006-12 Deep DBD Address Lookup

Change: fixed the tax buyer lookup address mapping by reading DBD locality fields recursively inside the address object. The function now uses `cd:Address` as the base and deep-searches for city subdivision, city, province, and postcode fields before returning `buyerAddress`. Debug mode now includes `addressKeys` and `addressProbe` to show which address parts were detected.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through deep DBD address lookup.

Usage: open a receipt after sale, click `ใบกำกับภาษีเต็มรูปแบบ`, enter tax ID, then press `DBD`. For troubleshooting, open `/api/tax-buyer/lookup?taxId=0105528025574&debug=1` after deploying the function.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
