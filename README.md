# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B002 Running Number — Save Screen Hotfix
Version: 0.13.15
Build: 2026.07.06.035

Change: adjusted the POS after-sale flow so successful sale save no longer opens the receipt screen automatically. The app now closes any old receipt overlay, unlocks the POS page, and focuses the barcode input for the next sale. Sale saving, stable saleId, offline sync, duplicate protection, and stock deduction remain unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
