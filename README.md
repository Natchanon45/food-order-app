# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.28
Build: 2026.07.06.048

Change: updated Retail POS product cards so PC overlays include remaining stock like Mobile. Mobile product cards now use the same dark gradient overlay style as PC and keep product images full-card, showing name, stock, and price on top of the image instead of using a separate white text area.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
