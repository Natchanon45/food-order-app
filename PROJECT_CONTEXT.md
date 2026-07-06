# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.23
Build: 2026.07.06.043
Milestone: P9-B005 Repository Layer

Change: extended the Retail POS repository layer as the central access point for tenant document refs and local POS data. Added repository helpers for tenant-scoped collection/doc refs, local value storage for active shift and store settings, local customers/settings repositories, and local product/stock movement helpers while preserving offline sale queue behavior.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, and P9-B005 Repository Layer foundation.

Next Task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
