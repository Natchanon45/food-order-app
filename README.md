# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Save Freeze Cleanup
Version: 0.13.11
Build: 2026.07.06.031

Change: simplified the POS receipt guard and product card restore scripts so they no longer hook sale localStorage writes or close the payment dialog during save. This prevents the browser from freezing while confirming a sale.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
