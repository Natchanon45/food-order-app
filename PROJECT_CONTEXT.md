# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.31
Build: 2026.07.06.051
Milestone: P9-B005 Repository Layer / POS UX Hotfix

Change: added a local TH Sarabun PSK font override for Retail POS and Customer Display. Both PC and Mobile now load `/assets/fonts/THSarabun.ttf` and `/assets/fonts/THSarabun-Bold.ttf` through `retail-pos-font-local.css`.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Service, P9-B003 Counter, P9-B004 Offline Queue Worker + Retry + Conflict Resolver, Sync Timeout Hotfix, Firestore Rules Hotfix, Pending Number Helper Hotfix, Loyalty + Receipt Privacy Hotfix, P9-B005 Repository Layer foundation, POS UX Hotfix for product hover and bill reset, receipt privacy + simplified hover label hotfix, PC cart density hotfix, receipt phone mask hotfix, product card unified overlay hotfix, customer display icon button hotfix, Bootstrap display icon hotfix, and local TH Sarabun PSK font hotfix.

Next Task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
