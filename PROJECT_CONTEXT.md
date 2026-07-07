# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.83
Build: 2026.07.07.027
Milestone: POS Later Tax Invoice Workflow

Change: added a direct `/pos/tax-invoices/` workflow for issuing a full tax invoice later from an existing short tax invoice/receipt by searching the original POS sale number and reusing the existing one-invoice-per-sale duplicate protection.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, mobile POS button layout tuning, payment modal visual tuning, and later full tax invoice issuing from an existing short tax invoice/receipt.

Usage: open `/pos/tax-invoices/`, enter an existing POS sale number from a short tax invoice/receipt, verify the source sale appears, enter buyer tax details, and issue the full tax invoice or reopen the existing full tax invoice when one already exists. Verify `/pos`, receipt behavior, payment modal visual tuning, tax invoice history/reprint, and printable document fonts remain unchanged.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and add void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
