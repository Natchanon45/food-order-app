# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.85
Build: 2026.07.06.005
Milestone: P10-B003 Receipt as Short Tax Invoice

Change: updated Retail POS receipts to support short tax invoice display for VAT sales. Receipt preview and print now show short tax invoice title, tax branch, VAT mode, before-VAT amount, VAT amount, point discount when available, and final total using the VAT fields saved with the sale. The helper is loaded on the POS page and sales history receipt dialog. VAT sales reports are planned for the next milestone.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
