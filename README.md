# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.27
Build: 2026.07.06.047

Change: updated Retail POS receipt phone privacy mask. Customer phone numbers on receipt output now display in the format `098-***-**81` instead of showing the last four digits.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
