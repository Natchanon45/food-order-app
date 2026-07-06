# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.47
Build: 2026.07.06.067
Milestone: P9-B006-05 Modal-Safe DBD Lookup

Change: fixed the DBD lookup fallback in the Full Tax Invoice buyer modal. Pressing `DBD` now keeps the receipt popup and tax buyer modal open. If the hosted lookup endpoint cannot return buyer data, the modal shows an inline `เปิด DBD ในแท็บใหม่` link instead of navigating away automatically, so the cashier can keep all typed form data and continue filling the tax invoice.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, Customer Display Multi Register support, Customer Display QR Pairing support, Customer Display mobile header polish, P9-B006 Full Tax Invoice phase 1, P9-B006 Full Tax Invoice buyer modal/profile reuse phase, P9-B006-02 Tax Invoice History / Reprint UI, P9-B006-03 DBD Tax Buyer Lookup UI, P9-B006-04 Tax Buyer Adapter, and P9-B006-05 Modal-Safe DBD Lookup.

Usage: open a receipt after sale, click `ใบกำกับภาษีเต็มรูปแบบ`, enter the buyer tax ID, then press `DBD`. When automatic lookup is not available, use the inline link to open DBD in a new tab while keeping the modal data intact.

Next Task: connect an approved buyer tax data provider/upstream service, then improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
