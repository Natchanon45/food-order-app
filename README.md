# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.30
Build: 2026.07.06.050

Change: updated the Retail POS customer display shortcut to render the real Bootstrap icon markup `<i class="bi bi-display"></i>` inside the icon-only header button. The button remains black with a dark-green display icon and still opens `/pos/customer-display`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
