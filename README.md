# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Payment Layout + Sales Receipt Rows
Version: 0.12.97
Build: 2026.07.06.017

Change: fixed the PC payment dialog layout by preserving the keypad grid and placing the loyalty box directly below the member/customer field inside the grid. Improved /pos/sales receipt rendering by pulling shop name from local settings and displaying customer/member/phone, VAT, and loyalty rows as proper left-label/right-value receipt rows.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
