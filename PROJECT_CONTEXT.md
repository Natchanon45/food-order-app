# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.46
Build: 2026.07.06.066
Milestone: P9-B006-04 Tax Buyer Adapter

Change: added a Firebase Function adapter for buyer tax data. Hosting now routes `/api/tax-buyer/lookup` to `lookupTaxBuyer`, and the receipt tax invoice modal calls that route by default when pressing `DBD`. The function can connect to a configured upstream service through the Cloud Functions environment variable `TAX_BUYER_LOOKUP_URL` and normalizes JSON into buyer tax ID, buyer name, address, and branch. If the adapter is not configured or the request fails, the existing manual fallback still opens.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, Customer Display Multi Register support, Customer Display QR Pairing support, Customer Display mobile header polish, P9-B006 Full Tax Invoice phase 1, P9-B006 Full Tax Invoice buyer modal/profile reuse phase, P9-B006-02 Tax Invoice History / Reprint UI, P9-B006-03 DBD Tax Buyer Lookup UI, and P9-B006-04 Tax Buyer Adapter.

Usage: deploy functions and hosting, then press `DBD` in the full tax invoice buyer modal. To use automatic data filling, configure the Cloud Functions environment variable `TAX_BUYER_LOOKUP_URL` to a compliant upstream service that returns buyer tax JSON.

Next Task: connect an approved buyer tax data provider/upstream service, then improve P9-B006 with editable customer tax profile management, optional tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
