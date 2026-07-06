# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.29
Build: 2026.07.06.049

Change: updated the Retail POS customer display shortcut in the header. The button is now icon-only with a screen-style icon, black background, and dark-green icon color while keeping the link target `/pos/customer-display`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
