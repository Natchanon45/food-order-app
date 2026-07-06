# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.31
Build: 2026.07.06.051

Change: added a local TH Sarabun PSK font override for Retail POS and Customer Display. Both PC and Mobile now load `/assets/fonts/THSarabun.ttf` and `/assets/fonts/THSarabun-Bold.ttf` through `retail-pos-font-local.css`.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
