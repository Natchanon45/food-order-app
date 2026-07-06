# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.38
Build: 2026.07.06.058
Milestone: P9-B005 CustomerDisplay Hover QR Pairing

Change: refined the Customer Display compact QR Pairing UI. The compact top control now uses a Bootstrap `bi-qr-code` icon instead of a miniature QR image, changes iPhone wording to the generic Thai label `อุปกรณ์`, and shows the full QR panel only on hover/focus instead of opening immediately after page load.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfixes, Customer Display latest-item ordering hotfix, Customer Display Multi Register support, Customer Display QR Pairing support, compact expandable QR Pairing UI, and hover-only QR Pairing refinement.

Usage: open the PC Customer Display with `/pos/customer-display?displayId=display-pc-01`, hover or focus the small top `เชื่อมอุปกรณ์` control to show the full QR, then scan it with the selling device. The device opens POS and publishes sales to that PC display.

Next Task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
