# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.42
Build: 2026.07.06.062
Milestone: P9-B006 Full Tax Invoice

Change: started Full Tax Invoice support. Added a full tax invoice service, local/Firebase `taxInvoices` record creation, duplicate-by-sale reuse, a dedicated `/pos/tax-invoice/` print page, and a new `ใบกำกับภาษีเต็มรูปแบบ` action in the receipt popup. The first phase collects buyer name, tax ID, address, and branch via prompts and prints an A4 full tax invoice linked to the original sale.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, Customer Display Multi Register support, Customer Display QR Pairing support, Customer Display mobile header polish, and P9-B006 Full Tax Invoice phase 1.

Usage: open a receipt after sale and click `ใบกำกับภาษีเต็มรูปแบบ`; enter buyer tax details; the system creates/reuses a `taxInvoices` record and opens `/pos/tax-invoice/?invoiceId=...` for A4 printing.

Next Task: Improve P9-B006 with a proper buyer tax information form/modal, customer tax profile reuse, tax invoice history/reprint UI, and optional tax invoice running number counter before moving to P9-B007.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
