# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.39
Build: 2026.07.06.059
Milestone: P9-B005 CustomerDisplay QR Icon Exact Markup

Change: updated the Customer Display compact QR Pairing trigger to use the exact Bootstrap icon markup `<i class="bi bi-qr-code"></i>`. The customer display page now loads the local Bootstrap Icons stylesheet directly, removes the fallback symbol from the trigger, and keeps the full QR panel hover/focus-only.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, Customer Display Multi Register support, Customer Display QR Pairing support, compact expandable QR Pairing UI, hover-only QR Pairing refinement, and exact Bootstrap QR icon markup support.

Usage: open the PC Customer Display with `/pos/customer-display?displayId=display-pc-01`, hover or focus the small top `เชื่อมอุปกรณ์` control using the Bootstrap QR icon to show the full QR, then scan it with the selling device.

Next Task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
