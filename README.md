# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B006-04 Tax Buyer Adapter
Version: 0.13.46
Build: 2026.07.06.066

Change: added a Firebase Function adapter for buyer tax data. Hosting now routes `/api/tax-buyer/lookup` to `lookupTaxBuyer`, and the receipt tax invoice modal calls that route by default when pressing `DBD`. The function can connect to a configured upstream service through the Cloud Functions environment variable `TAX_BUYER_LOOKUP_URL` and normalizes JSON into buyer tax ID, buyer name, address, and branch. If the adapter is not configured or the request fails, the existing manual fallback still opens.

Existing full tax invoice creation, tax invoice history/reprint, short tax invoice / receipt behavior, POS sale totals, VAT calculation, stock deduction, offline sale sync, and receipt printing logic are unchanged.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only functions:lookupTaxBuyer,hosting
