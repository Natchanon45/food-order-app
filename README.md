# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Retail POS Toast Layout Repair
Version: 0.12.76
Build: 2026.07.05.006

Change: repaired Retail POS toast layout by replacing the grid toast layout with flex, removing popover top-layer behavior, keeping black card styling, and preserving green success/red error icons. UI-only change.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
