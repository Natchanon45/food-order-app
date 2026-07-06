# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Receipt Modal Display Reset
Version: 0.13.01
Build: 2026.07.06.021

Change: fixed the receipt modal guard so it no longer leaves inline display:none after closing the print-bill modal. When a receipt modal is opened, the guard now restores display:grid, pointer events, z-index, and button enabled states while closing the native payment dialog and clearing stuck overlay state. Bumped the POS receipt modal guard cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
