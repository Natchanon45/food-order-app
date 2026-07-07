# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.72
Build: 2026.07.07.016
Milestone: POS Font Coverage and Menu Icons

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Font rule: all web UI screens, including standalone POS pages, buttons, forms, dialogs, and Customer Display, use the shared `--app-ui-font` Thai sans/no-head stack. Printable paper documents such as receipts, tax invoices, QR tickets, invoices, quotations, and print pages use `--paper-font-local` / `--print-font`, with `TH Sarabun PSK Local` loaded from `/assets/fonts/` as the primary font.

Retail POS navigation rule: submenu expand/collapse controls must render Bootstrap Icons chevrons, not text carets such as `^`, `v`, `⌃`, or `⌄`.

Current Customer Display rule: POS machines publish Customer Display snapshots to `customerDisplays/{displayId}`. Each POS has local `retail_pos_register_config` with `registerId` and `displayId`, and each display snapshot includes `tenantId`, `registerId`, `displayId`, `sessionId`, `status`, `items`, totals, and `updatedAt`.

Full Tax Invoice rule: full tax invoices are stored separately from sales in `taxInvoices/{taxInvoiceId}` and include `tenantId`, source sale reference, seller tax profile, buyer tax profile, line items, VAT summary, total, status, issued timestamp, and TAX running number metadata. The receipt popup can create/reuse one full tax invoice per sale and opens `/pos/tax-invoice/?invoiceId=...` for A4 printing. Buyer tax data is captured through a receipt-popup modal, prefilled from the sale or saved tax buyer profile, and saved locally for future reuse. When Firebase is online, issuing a full tax invoice must use a Firestore transaction that reads the existing invoice, counter, and running number reservation before writing the invoice and counter reservation.

Tax Invoice History rule: `/pos/tax-invoices/` merges local `retail_pos_tax_invoices_v1` data with Firestore `taxInvoices`, supports search by invoice number, sale number, buyer name, buyer tax ID, address, and status, and opens `/pos/tax-invoice/?invoiceId=...` for reprint. The POS navigation menu must include a direct `ใบกำกับภาษี` entry for this history page.

DBD Lookup rule: the buyer tax ID field is the first input in the full tax invoice modal and includes an inline `DBD` button. The browser can fetch a configured DBD lookup proxy from `window.RETAIL_POS_DBD_LOOKUP_URL` or localStorage key `retail_pos_dbd_lookup_url`; the expected JSON can include `buyerName`, `buyerTaxId`, `buyerAddress`, `buyerBranchName`, or DBD-style aliases such as `juristicNameTH`, `juristicId`, `addressTh`, and `branchName`. If no proxy is configured or lookup fails, the flow opens the official DBD DataWarehouse+ juristic search page for manual verification. This flow does not change POS sale totals, VAT calculation, stock deduction, offline sale sync, or existing short tax invoice receipt behavior.

Completed in this build: POS font coverage for standalone buttons/forms and Bootstrap Icon submenu chevrons.

Next task: improve P9-B006 with editable customer tax profile management and void/cancel tax invoice support.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
