# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.35
Build: 2026.07.06.055
Milestone: P9-B005 CustomerDisplay MultiRegister

Change: added backward-compatible Multi Register support for Customer Display. POS now uses local `retail_pos_register_config` with `registerId`, `displayId`, and `sessionId` and publishes snapshots to `customerDisplays/{displayId}`. `/pos/customer-display?displayId=display-01` now watches only that display document. If no displayId is provided, the system falls back to `main-register` so existing deployments continue working.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, and Customer Display Multi Register support.

Usage examples: open POS with `/pos?registerId=pos-01&displayId=display-01`, then open Customer Display with `/pos/customer-display?displayId=display-01`. To sell on POS A but show on display B, set POS A to `/pos?registerId=pos-01&displayId=display-02` and open `/pos/customer-display?displayId=display-02` on display B.

Next Task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
