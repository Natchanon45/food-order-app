# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Save Freeze Guard
Version: 0.13.10
Build: 2026.07.06.030

Change: removed the legacy after-sale localStorage hook that could repeatedly restore product cards during payment save and freeze the POS page.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
