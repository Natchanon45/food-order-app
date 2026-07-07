# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.83
Build: 2026.07.07.027
Milestone: POS Later Tax Invoice Workflow

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Font rule: all web UI screens, including standalone POS pages, buttons, forms, dialogs, and Customer Display, use the shared `--app-ui-font` Thai sans/no-head stack with `Kanit Local` loaded from `/assets/fonts/` as the primary UI font. POS UI button text must stay at font-weight 500 or lighter, and form labels/inputs should use normal weight. Printable paper documents such as receipts, tax invoices, QR tickets, invoices, quotations, and print pages use `--paper-font-local` / `--print-font`, with `TH Sarabun PSK Local` loaded from `/assets/fonts/` as the primary paper font.

Retail POS navigation rule: submenu expand/collapse controls must render exactly one Bootstrap Icons chevron, not text carets such as `^`, `v`, `⌃`, or `⌄`, not CSS pseudo chevrons, and not an additional context icon. Menu group buttons with `data-menu-group` must be skipped by the context icon injector, while menu links may still receive one context icon. The drawer title `เมนู POS` must not receive an injected context icon, and the icon system/CSS must also clean or hide the legacy injected icon if an older cached navigation module renders `<h2 data-pos-icon="list">เมนู POS</h2>`.

Current Customer Display rule: POS machines publish Customer Display snapshots to `customerDisplays/{displayId}`. Each POS has local `retail_pos_register_config` with `registerId` and `displayId`, and each display snapshot includes `tenantId`, `registerId`, `displayId`, `sessionId`, `status`, `items`, totals, and `updatedAt`.

Full Tax Invoice rule: full tax invoices are stored separately from sales in `taxInvoices/{taxInvoiceId}` and include `tenantId`, source sale reference, seller tax profile, buyer tax profile, line items, VAT summary, total, status, issued timestamp, and TAX running number metadata. The receipt popup can create/reuse one full tax invoice per sale and opens `/pos/tax-invoice/?invoiceId=...` for A4 printing. Buyer tax data is captured through a receipt-popup modal, prefilled from the sale or saved tax buyer profile, and saved locally for future reuse. When Firebase is online, issuing a full tax invoice must use a Firestore transaction that reads the existing invoice, counter, and running number reservation before writing the invoice and counter reservation.

Tax Invoice History rule: `/pos/tax-invoices/` merges local `retail_pos_tax_invoices_v1` data with Firestore `taxInvoices`, supports search by invoice number, sale number, buyer name, buyer tax ID, address, and status, and opens `/pos/tax-invoice/?invoiceId=...` for reprint. The same page can search an original POS sale number from an existing short tax invoice/receipt, open a buyer tax profile modal, and issue or reopen the one full tax invoice allowed for that sale. The POS navigation menu must include a direct `ใบกำกับภาษี` entry for this history page.

Later full tax invoice rule: staff can issue a full tax invoice later when a customer brings an existing short tax invoice/receipt back to the shop. The workflow searches the original POS sale by sale number, opens a buyer tax profile modal, reuses the existing full-tax-invoice creation path, keeps one full tax invoice per sale, and shows the existing invoice instead of creating a duplicate when one already exists.

DBD Lookup rule: the buyer tax ID field is the first input in the full tax invoice modal and includes an inline `DBD` button. The browser can fetch a configured DBD lookup proxy from `window.RETAIL_POS_DBD_LOOKUP_URL` or localStorage key `retail_pos_dbd_lookup_url`; the expected JSON can include `buyerName`, `buyerTaxId`, `buyerAddress`, `buyerBranchName`, or DBD-style aliases such as `juristicNameTH`, `juristicId`, `addressTh`, and `branchName`. If no proxy is configured or lookup fails, the flow opens the official DBD DataWarehouse+ juristic search page for manual verification. This flow does not change POS sale totals, VAT calculation, stock deduction, offline sale sync, or existing short tax invoice receipt behavior.

Theme rule: Retail POS UI screens should stay visually aligned with Order/Delivery by using the shared green/neutral palette, panel borders from `--line`, soft shadows comparable to `app.css`, and UI text/button weights of 500 or lighter. Printable paper documents remain excluded from this UI weight rule and continue to use `TH Sarabun PSK Local`.

Product card overlay rule: Retail POS image product cards show only product images by default on both desktop and mobile. Desktop may reveal the overlay on hover/focus. Touch devices must keep name, stock, and price hidden by default and only reveal the overlay during active touch, focus, or an explicit `show-info` state. Overlay prices use dark green text while preserving readable contrast on the dark green product overlay.

Mobile button layout rule: on small Retail POS screens, header actions should stay compact and predictable. The menu button may keep a short label, sync status should not expose a long status string in the header, and icon-only actions such as Customer Display should remain fixed-size. Receipt/tax print toolbars should avoid cramped wrapping by placing long actions on their own row and keeping secondary actions evenly sized.

Payment modal visual rule: Retail POS payment modal numbers and numeric pad buttons should not exceed font-weight 500 in the web UI. The payment total should use the shared green accent softly, the change amount may use a restrained amber/red emphasis, and the layout must keep the same payment, VAT, stock, and offline sync behavior.

Completed in this build: later full tax invoice issuing from an existing short tax invoice/receipt through `/pos/tax-invoices/`, with JS cache bumps for changed assets.

Next task: improve P9-B006 with editable customer tax profile management and void/cancel tax invoice support.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
