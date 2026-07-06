# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.15
Build: 2026.07.06.035
Milestone: P9-B002 Running Number — Save Screen Hotfix

Change: adjusted the POS after-sale flow so a successful sale save no longer opens the receipt screen automatically. The app closes any old receipt overlay, unlocks the POS page, and focuses the barcode input for the next sale. Sale saving, stable saleId, offline sync, duplicate protection, and stock deduction remain unchanged.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, Receipt Freeze Hotfix, and Save Screen Hotfix.

Next Task: P9-B003 Counter

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
