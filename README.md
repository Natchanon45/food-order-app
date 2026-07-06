# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-03 DBD Tax Buyer Lookup
Version: 0.13.45
Build: 2026.07.06.065

Change: improved the Full Tax Invoice buyer modal. The buyer tax ID field is now the first field, includes an inline `DBD` button, and prepares a DBD lookup flow. When a DBD lookup proxy endpoint is configured through `window.RETAIL_POS_DBD_LOOKUP_URL` or localStorage key `retail_pos_dbd_lookup_url`, the modal fetches buyer company data by tax ID and fills buyer name, address, branch, and tax ID. Without a proxy, the button opens the official DBD DataWarehouse+ juristic search page as a safe fallback.

Existing full tax invoice creation, tax invoice history/reprint, short tax invoice / receipt behavior, POS sale totals, VAT calculation, stock deduction, offline sale sync, and receipt printing logic are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
