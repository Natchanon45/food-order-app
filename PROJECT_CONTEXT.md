# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.17
Build: 2026.07.06.037
Milestone: P9-B003 Counter

Change: implemented idempotent POS counter reservation. `reserveRunningNumber()` now reads counter and running-number reservation before writing. Each saleId gets one reservation row in `runningNumbers`, so retry/sync with the same stable saleId returns the same document number and does not increment the counter again.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Save Screen Hotfix, Receipt Service, and P9-B003 Counter.

Next Task: P9-B004 Offline Queue Worker + Retry + Conflict Resolver

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
