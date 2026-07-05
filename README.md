# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Stock Movement Toast Fix
Version: 0.12.81
Build: 2026.07.06.001

Change: fixed missing toast on the stock movements page by creating the Retail POS toast element when a page does not include one and bumped the stock movements toast cache version. UI-only change.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
