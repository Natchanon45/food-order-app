# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.81
Build: 2026.07.06.001
Milestone: Stock Movement Toast Fix

Change: fixed missing toast on the stock movements page by creating the Retail POS toast element when a page does not include one and bumped the stock movements toast cache version. UI-only change.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
