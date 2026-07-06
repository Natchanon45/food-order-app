# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.33
Build: 2026.07.06.053

Change: reduced the `/pos/customer-display` TH Sarabun PSK font sizing by 20% from the previous Customer Display scale. The font override remains scoped to Customer Display only and is not loaded by the main POS page.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
