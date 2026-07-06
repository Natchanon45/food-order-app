# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.41
Build: 2026.07.06.061
Milestone: P9-B005 CustomerDisplay Mobile Header Polish

Change: polished the Customer Display mobile header layout. On narrow screens, the header now uses a two-column responsive grid so the FOD badge/title, connection status, and compact QR pairing trigger no longer crowd each other. The QR trigger remains compact with the exact Bootstrap QR icon and the full QR panel remains hover/focus-only.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, Customer Display Multi Register support, Customer Display QR Pairing support, compact expandable QR Pairing UI, hover-only QR Pairing refinement, exact Bootstrap QR icon markup support, QR helper text removal, and Customer Display mobile header polish.

Usage: open the PC Customer Display with `/pos/customer-display?displayId=display-pc-01`, hover or focus the small top `เชื่อมอุปกรณ์` control to show the full QR, then scan it with the selling device.

Next Task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
