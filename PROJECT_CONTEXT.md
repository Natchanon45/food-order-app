# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.14
Build: 2026.07.06.034
Milestone: P9-B002 Running Number — Receipt Freeze Hotfix

Change: fixed the POS screen freeze after a successful sale by disabling the receipt modal auto-save hook that patched `localStorage.setItem`. Local sale save no longer opens a second receipt/auto-print flow. Safe Confirm remains the single receipt-opening path after saving, preserving stable saleId, offline sync, duplicate protection, and no double stock deduction.

Completed: QR Table Order, Kitchen serving, Delivery Lock, Cashier table move, paid-before-close guard, Retail POS Online/Offline/Sync/Tenant support, POS Firestore Foundation P9-B001, Safe Confirm Payment, P9-B002 Running Number alignment, and Receipt Freeze Hotfix.

Next Task: P9-B003 Counter

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
