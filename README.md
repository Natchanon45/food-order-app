# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.34
Build: 2026.07.06.054

Change: updated Customer Display ordering so the most recently added or updated cart item is always shown at the top, even when the item already exists in the cart and only its quantity changes. This affects display ordering only and does not change sale totals, stock deduction, or cart calculation logic.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
