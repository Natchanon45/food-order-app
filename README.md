# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Sales Receipt Customer Rows
Version: 0.12.98
Build: 2026.07.06.018

Change: fixed the Sales History receipt customer section by removing the duplicated dashed line and rendering customer, member code, and phone as separate vertical rows with left labels and right-aligned values. Bumped the /pos/sales receipt enhancer cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
