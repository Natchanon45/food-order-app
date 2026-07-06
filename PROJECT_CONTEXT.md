# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.48
Build: 2026.07.06.068
Milestone: P9-B006-06 Tax Buyer Draft Persistence

Change: improved the Full Tax Invoice buyer modal fallback. The buyer form now saves a local draft while typing, restores the draft for the same sale, and provides a copy-link action for external juristic lookup instead of navigating away from the receipt popup automatically.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, P9-B005 Customer Display work, and P9-B006 Full Tax Invoice through tax buyer draft persistence.

Usage: open a receipt after sale, click `ใบกำกับภาษีเต็มรูปแบบ`, enter buyer data, then press `DBD`. If automatic lookup is unavailable, copy the external lookup link and keep the modal draft intact.

Next Task: connect an approved buyer tax data provider/upstream service, then improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
