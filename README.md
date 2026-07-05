# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Customer Display Layout Refinement
Version: 0.12.90
Build: 2026.07.06.010

Change: refined the Customer Display layout to a clearer two-column design, with the customer card fitting the customer name/phone and the totals card directly below it. The product list stays on the right and now shows the latest added item at the top. Added a receipt logo cleanup helper and loaded it on POS and Sales receipt pages to remove icons/logos from receipt shop headers.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
