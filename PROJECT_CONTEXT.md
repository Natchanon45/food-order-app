# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.37
Build: 2026.07.06.057
Milestone: P9-B005 CustomerDisplay Compact QR Pairing

Change: moved the Customer Display QR Pairing UI into a compact top-header control. The PC customer display now shows a small QR/iPhone button near the top of the page; clicking it expands a QR panel similar to streaming-device pairing patterns such as WeTV/Viu. Scanning the expanded QR on iPhone opens POS with the matching displayId.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, Customer Display Multi Register support, Customer Display QR Pairing support, and compact expandable QR Pairing UI.

Usage: open the PC Customer Display with `/pos/customer-display?displayId=display-pc-01`, click the small top QR/iPhone control to expand QR, then scan it with iPhone. The iPhone opens POS and publishes sales to that PC display.

Next Task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
