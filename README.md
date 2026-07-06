# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.25
Build: 2026.07.06.045

Change: refined Retail POS receipt privacy and product-card hover behavior. Receipt customer names now mask first name as the first up to 5 characters plus `*****`, and last name as `*****` plus the last 3 characters. Product-card hover no longer shows the browser tooltip; it now displays a half-card bottom overlay with only product name and price for faster cashier reading.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
