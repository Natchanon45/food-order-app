# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.24
Build: 2026.07.06.044
Milestone: P9-B005 Repository Layer / POS UX Hotfix

Change: improved Retail POS PC product cards and after-payment cleanup. Product cards now show hover/tooltip details with product name, stock, price, and code, grey out sold-out items, and display a sold-out badge. After payment or receipt close, the POS now force-clears the active bill, discount, payment fields, selected customer/loyalty UI, totals, and focuses the barcode input for the next sale.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, and POS UX Hotfix for product hover and bill reset.

Next Task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
