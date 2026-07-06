# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.21
Build: 2026.07.06.041
Milestone: P9-B004 Pending Number Helper Hotfix

Change: added `pendingDocumentNumber()` export to `retail-pos-firestore-foundation.js` and bumped POS safe-confirm cache. This restores the sale save flow that depends on the shared pending SALE number helper, so the after-sale and loyalty point save path can continue.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, and Pending Number Helper Hotfix.

Next Task: P9-B005 Repository Layer

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only firestore:rules,hosting
