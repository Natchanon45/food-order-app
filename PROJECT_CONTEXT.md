# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.43
Build: 2026.07.06.063
Milestone: P9-B006 Full Tax Invoice

Change: improved Full Tax Invoice phase 2. The receipt popup now uses a proper buyer tax information modal instead of browser prompts. The modal pre-fills buyer data from the sale or saved tax buyer profile, saves/reuses buyer tax profile data locally, creates/reuses one `taxInvoices` record per sale, and opens the A4 `/pos/tax-invoice/` print page.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, Customer Display Multi Register support, Customer Display QR Pairing support, Customer Display mobile header polish, P9-B006 Full Tax Invoice phase 1, and P9-B006 Full Tax Invoice buyer modal/profile reuse phase.

Usage: open a receipt after sale and click `ใบกำกับภาษีเต็มรูปแบบ`; confirm/edit buyer tax details in the modal; the system creates/reuses a `taxInvoices` record and opens `/pos/tax-invoice/?invoiceId=...` for A4 printing.

Next Task: Improve P9-B006 with tax invoice history/reprint UI, editable customer tax profile management, and optional tax invoice running number counter before moving to P9-B007.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
