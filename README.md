# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P10-B004 Sales Report VAT Columns
Version: 0.12.86
Build: 2026.07.06.006

Change: added VAT reporting foundation for Retail POS sales history. Sales report now has VAT summary cards, VAT table columns for mode, before-VAT amount, and VAT amount, and CSV export with VAT fields. The sales receipt VAT module now loads the VAT report helper and preserves receipt VAT rendering through a core helper. Customer Display is planned for the next major milestone.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
