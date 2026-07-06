# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.20
Build: 2026.07.06.040
Milestone: P9-B004 Firestore Rules Hotfix

Change: updated Firestore Security Rules for Retail POS sync. Added tenant-scoped `runningNumbers` access, relaxed POS sale sync validation for offline sales without `cashierId`, allowed POS stock update with `shopId`, and added `customerDisplays` tenant rules. This fixes permission-denied errors during running number reservation and POS sync transactions.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, and Firestore Rules Hotfix.

Next Task: P9-B005 Repository Layer

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only firestore:rules,hosting
