# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.49
Build: 2026.07.06.069
Milestone: P9-B006-07 Buyer Lookup OpenAPI

Change: updated the tax buyer lookup function to call the official buyer lookup OpenAPI by tax ID. The receipt modal still calls `/api/tax-buyer/lookup`, and the function normalizes the response into buyer tax ID, buyer name, address, and branch fields for automatic form filling. Draft persistence and modal-safe fallback remain in place.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, P9-B005 Customer Display work, and P9-B006 Full Tax Invoice through buyer lookup OpenAPI.

Usage: open a receipt after sale, click `ใบกำกับภาษีเต็มรูปแบบ`, enter tax ID, then press `DBD`. The form will fill automatically when the OpenAPI returns buyer data.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
