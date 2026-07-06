# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.44
Build: 2026.07.06.064
Milestone: P9-B006-02 Tax Invoice History / Reprint UI

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Current Customer Display rule: POS machines publish Customer Display snapshots to `customerDisplays/{displayId}`. Each POS has local `retail_pos_register_config` with `registerId` and `displayId`, and each display snapshot includes `tenantId`, `registerId`, `displayId`, `sessionId`, `status`, `items`, totals, and `updatedAt`.

Full Tax Invoice rule: full tax invoices are stored separately from sales in `taxInvoices/{taxInvoiceId}` and include `tenantId`, source sale reference, seller tax profile, buyer tax profile, line items, VAT summary, total, status, and issued timestamp. The receipt popup can create/reuse one full tax invoice per sale and opens `/pos/tax-invoice/?invoiceId=...` for A4 printing. Buyer tax data is captured through a receipt-popup modal, prefilled from the sale or saved tax buyer profile, and saved locally for future reuse.

Tax Invoice History rule: `/pos/tax-invoices/` merges local `retail_pos_tax_invoices_v1` data with Firestore `taxInvoices`, supports search by invoice number, sale number, buyer name, buyer tax ID, address, and status, and opens `/pos/tax-invoice/?invoiceId=...` for reprint. This flow does not change POS sale totals, VAT calculation, stock deduction, offline sale sync, or existing short tax invoice receipt behavior.

Completed in this build: P9-B006-02 Tax Invoice History / Reprint UI.

Next task: improve P9-B006 with editable customer tax profile management, optional tax invoice running number counter, and void/cancel tax invoice support.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
