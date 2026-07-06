# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-02 Tax Invoice History / Reprint UI
Version: 0.13.44
Build: 2026.07.06.064

Change: added a Full Tax Invoice history and reprint page at `/pos/tax-invoices/`. The page merges locally cached full tax invoices with Firestore `taxInvoices`, supports search by invoice number, sale number, buyer name, buyer tax ID, address, and status, and opens `/pos/tax-invoice/?invoiceId=...` for A4 reprint.

Existing full tax invoice creation, short tax invoice / receipt behavior, POS sale totals, VAT calculation, stock deduction, offline sale sync, and receipt printing logic are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
