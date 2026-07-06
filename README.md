# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Receipt Overlay Unlock
Version: 0.13.00
Build: 2026.07.06.020

Change: strengthened the POS receipt modal guard to fix the stuck overlay after a successful sale. The guard now proactively closes the native payment dialog when the custom receipt modal is visible, restores pointer events, clears inert/modal-open state, raises the receipt modal above other layers, and keeps close/print buttons clickable. Bumped the POS receipt modal guard cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
