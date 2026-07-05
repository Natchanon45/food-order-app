# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.92
Build: 2026.07.06.012
Milestone: POS Loyalty Placement

Change: moved the POS loyalty points box inside the payment dialog to appear directly below the member/customer selector and above the payment method field. This keeps member selection and point redemption together without changing the existing loyalty calculation or ledger behavior. Bumped the POS loyalty script cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
