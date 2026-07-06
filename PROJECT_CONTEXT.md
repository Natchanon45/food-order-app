# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.25
Build: 2026.07.06.045
Milestone: P9-B005 Repository Layer / POS UX Hotfix

Change: refined Retail POS receipt privacy and product-card hover behavior. Receipt customer names now mask first name as the first up to 5 characters plus `*****`, and last name as `*****` plus the last 3 characters. Product-card hover no longer shows the browser tooltip; it now displays a half-card bottom overlay with only product name and price for faster cashier reading.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfix for product hover and bill reset, and receipt privacy + simplified hover label hotfix.

Next Task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
