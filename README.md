# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-05 Modal-Safe DBD Lookup
Version: 0.13.47
Build: 2026.07.06.067

Change: fixed the DBD lookup fallback in the Full Tax Invoice buyer modal. Pressing `DBD` now keeps the receipt popup and tax buyer modal open. If the hosted lookup endpoint cannot return buyer data, the modal shows an inline `เปิด DBD ในแท็บใหม่` link instead of navigating away automatically, so the cashier can keep all typed form data and continue filling the tax invoice.

Existing full tax invoice creation, tax invoice history/reprint, short tax invoice / receipt behavior, POS sale totals, VAT calculation, stock deduction, offline sale sync, and receipt printing logic are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
