# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.32
Build: 2026.07.06.052

Change: scoped the local TH Sarabun PSK font override to `/pos/customer-display` only. The main POS page no longer loads the font override, and Customer Display text is enlarged to roughly 2x the previous display size.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
