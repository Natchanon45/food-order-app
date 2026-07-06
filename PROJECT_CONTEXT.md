# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.16
Build: 2026.07.06.036
Milestone: P9-B002 Receipt Service

Change: added a separate receipt page after POS sale save. The POS screen is unlocked first, then a receipt page shows sale items, customer data, and loyalty point summary from the saved sale. Loyalty code still updates customer points, sale loyalty data, and the loyalty ledger.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Save Screen Hotfix, and Receipt Service.

Next Task: P9-B003 Counter

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
