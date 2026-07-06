# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.50
Build: 2026.07.06.070
Milestone: P9-B006-08 Buyer Lookup Normalization

Change: improved the tax buyer lookup function to support nested and array-based OpenAPI responses. The function now scans the payload for the best juristic record, supports more field aliases for tax ID, buyer name, address, and branch, and adds a debug mode at `/api/tax-buyer/lookup?taxId=...&debug=1` to inspect response status, content type, keys, and a safe preview.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, P9-B005 Customer Display work, and P9-B006 Full Tax Invoice through buyer lookup normalization.

Usage: open a receipt after sale, click `ใบกำกับภาษีเต็มรูปแบบ`, enter tax ID, then press `DBD`. For troubleshooting, open `/api/tax-buyer/lookup?taxId=0105528025574&debug=1` after deploying the function.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
