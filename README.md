# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B002 Running Number — Receipt Freeze Hotfix
Version: 0.13.14
Build: 2026.07.06.034

Change: fixed the POS save freeze after successful payment by disabling the receipt modal auto-save hook that patched `localStorage.setItem` and opened an extra receipt/auto-print flow when local sales were saved. Safe Confirm is now the single path that opens the receipt after saving, preventing duplicate print dialogs and stuck UI while keeping the stable saleId/offline sync flow intact.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
