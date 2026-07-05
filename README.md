# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P10-B003 Receipt as Short Tax Invoice
Version: 0.12.85
Build: 2026.07.06.005

Change: updated Retail POS receipts to support short tax invoice display for VAT sales. Receipt preview/print now shows short tax invoice title, tax branch, VAT mode, before-VAT amount, VAT amount, point discount when available, and final total using the VAT fields saved with the sale. The helper is loaded on the POS page and sales history receipt dialog. VAT sales reports are planned for the next milestone.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
