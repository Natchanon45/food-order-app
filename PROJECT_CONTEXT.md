# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.13
Build: 2026.07.06.033
Milestone: P9-B002 Running Number

Change: aligned the Retail POS safe-confirm payment path with the shared P9-B002 running-number foundation. The POS creates one stable saleId for online/offline use, assigns a shared pending SALE number locally, stores running-number metadata, and leaves final SALE number reservation to the Firestore transaction during offline sync. This preserves duplicate protection and prevents double stock deduction because sync still writes by the same stable saleId.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, and P9-B002 Running Number alignment.

Next Task: P9-B003 Counter

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
