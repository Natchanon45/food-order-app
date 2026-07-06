# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.45
Build: 2026.07.06.065
Milestone: P9-B006-03 DBD Tax Buyer Lookup

Change: improved the Full Tax Invoice buyer modal. The buyer tax ID field is now the first field, includes an inline `DBD` button, and prepares a DBD lookup flow. When a DBD lookup proxy endpoint is configured through `window.RETAIL_POS_DBD_LOOKUP_URL` or localStorage key `retail_pos_dbd_lookup_url`, the modal fetches buyer company data by tax ID and fills buyer name, address, branch, and tax ID. Without a proxy, the button opens the official DBD DataWarehouse+ juristic search page as a safe fallback.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, Customer Display Multi Register support, Customer Display QR Pairing support, Customer Display mobile header polish, P9-B006 Full Tax Invoice phase 1, P9-B006 Full Tax Invoice buyer modal/profile reuse phase, P9-B006-02 Tax Invoice History / Reprint UI, and P9-B006-03 DBD Tax Buyer Lookup UI.

Usage: open a receipt after sale and click `ใบกำกับภาษีเต็มรูปแบบ`; enter or paste the buyer tax ID at the top of the modal; press `DBD`; the modal fills buyer data when a DBD proxy is configured or opens DBD DataWarehouse+ as fallback.

Next Task: Add a Firebase Function / configurable backend adapter for DBD lookup, then improve P9-B006 with editable customer tax profile management, optional tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
