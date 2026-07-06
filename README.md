# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.24
Build: 2026.07.06.044

Change: improved Retail POS PC product cards and after-payment cleanup. Product cards now show hover/tooltip details with product name, stock, price, and code, grey out sold-out items, and display a sold-out badge. After payment or receipt close, the POS now force-clears the active bill, discount, payment fields, selected customer/loyalty UI, totals, and focuses the barcode input for the next sale.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
