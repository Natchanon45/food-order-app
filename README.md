# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B002 Receipt Service
Version: 0.13.16
Build: 2026.07.06.036

Change: added a separate receipt page after POS sale save. The POS screen is unlocked first, then a receipt page shows sale items, customer data, and loyalty point summary from the saved sale. Loyalty code still updates customer points, sale loyalty data, and the loyalty ledger.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
