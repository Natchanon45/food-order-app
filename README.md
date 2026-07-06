# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Sale Save Unlock
Version: 0.13.02
Build: 2026.07.06.022

Change: changed the POS receipt modal guard to unlock the screen at the reliable sale-save event. The guard now wraps localStorage.setItem, detects writes to retail_pos_sales_v1, immediately closes the native payment dialog, clears stuck inert/modal state several times after the save, and keeps the receipt modal printable without leaving inline display:none behind. Bumped the POS receipt modal guard cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
