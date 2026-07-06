# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.22
Build: 2026.07.06.042
Milestone: P9-B004 Loyalty + Receipt Privacy Hotfix

Change: improved POS loyalty saving and receipt privacy. Loyalty points now save from the sale-saved event instead of timing guesses, with customerId fallback from the saved sale. Receipt output and sales receipt dialog now show the correct tax title, VAT rows, loyalty point summary, and masked customer name/phone.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, and Loyalty + Receipt Privacy Hotfix.

Next Task: P9-B005 Repository Layer

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only firestore:rules,hosting
