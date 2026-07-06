# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Safe Confirm Payment
Version: 0.13.12
Build: 2026.07.06.032

Change: added a safe POS confirm-payment flow that intercepts the save button before the older online transaction flow, saves the sale locally first, deducts local stock, closes the payment dialog, and opens the receipt dialog immediately. This prevents the browser from freezing while still leaving the pending sale for offline sync.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
