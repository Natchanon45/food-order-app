# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.97
Build: 2026.07.06.017
Milestone: POS Payment Layout + Sales Receipt Rows

Change: fixed the PC payment dialog layout by preserving the keypad grid and placing the loyalty box directly below the member/customer field inside the grid. Improved /pos/sales receipt rendering by pulling shop name from local settings and displaying customer/member/phone, VAT, and loyalty rows as proper left-label/right-value receipt rows.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
