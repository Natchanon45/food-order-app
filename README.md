# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006 Full Tax Invoice
Version: 0.13.42
Build: 2026.07.06.062

Change: started Full Tax Invoice support. Added a full tax invoice service, local/Firebase `taxInvoices` record creation, duplicate-by-sale reuse, a dedicated `/pos/tax-invoice/` print page, and a new `ใบกำกับภาษีเต็มรูปแบบ` action in the receipt popup. The first phase collects buyer name, tax ID, address, and branch via prompts and prints an A4 full tax invoice linked to the original sale.

Existing short tax invoice / receipt behavior remains supported. POS sale totals, VAT calculation, stock deduction, offline sale sync, and receipt printing logic are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
