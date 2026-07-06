# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006 Full Tax Invoice
Version: 0.13.43
Build: 2026.07.06.063

Change: improved Full Tax Invoice phase 2. The receipt popup now uses a proper buyer tax information modal instead of browser prompts. The modal pre-fills buyer data from the sale or saved tax buyer profile, saves/reuses buyer tax profile data locally, creates/reuses one `taxInvoices` record per sale, and opens the A4 `/pos/tax-invoice/` print page.

Existing short tax invoice / receipt behavior remains supported. POS sale totals, VAT calculation, stock deduction, offline sale sync, and receipt printing logic are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
