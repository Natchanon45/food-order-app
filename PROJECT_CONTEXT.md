# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.69
Build: 2026.07.07.013
Milestone: Full Tax Invoice Running Number

Change: full tax invoices now reserve the TAX running number through the existing Firestore counter transaction when Firebase is online, reusing an existing invoice for the same sale before reserving a number. Offline/local fallback remains available and marks the invoice as local-only.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus full tax invoice running number reservation.

Usage: open a saved POS receipt, click full tax invoice, enter buyer data, and verify the issued invoice gets a TAX running number from `tenants/{tenantId}/counters` and `runningNumbers` when online. Reopening the same sale must reuse the existing invoice and not reserve another number.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
