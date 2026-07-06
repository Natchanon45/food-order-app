# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.00
Build: 2026.07.06.020
Milestone: POS Receipt Overlay Unlock

Change: strengthened the POS receipt modal guard to fix the stuck overlay after a successful sale. The guard now proactively closes the native payment dialog when the custom receipt modal is visible, restores pointer events, clears inert/modal-open state, raises the receipt modal above other layers, and keeps close/print buttons clickable. Bumped the POS receipt modal guard cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
