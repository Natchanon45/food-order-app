# P2.4 — Merchant Sales Report / Verified Firebase Historical Sales

**Date:** 2026-11-25, Asia/Bangkok
**Source (read-only):** cosmatch/lukkhaja / feature/react-golang-vite-tailwind-axios / 7bf9d15934f387cd887b46d1b17ca1f2924ffab0
**Target:** Natchanon45/food-order-app / feature/react-firebase-port (starting HEAD 5b7551882b29729363995d91c3f02a2ec8d92910)
**Scope:** P2.4 local feature completion; no real provider, Staging, Production, main merge or mobile release.

## Source and Firebase differences

Latest Source AdminSalesReportPage (591 lines) requires a complete historical read, an independent receipt-history filter and a fail-closed state for incomplete financial reads. The Source Go adapter uses a paginated historical endpoint, distinct from operational latest-250. The Target originally subscribed to Tenant Firestore orders but could display cache or incomplete financial data without explicit verification, and used local-browser calendar boundaries.

We reused Firebase Auth/Tenant guards, existing route and branding, Firestore data, payment methods and the existing cancellation ledger, instead of copying Laravel/Go network providers. Historical void/partly cancelled receipt details are visible but never create a sale, adjustment, refund or payment write.

## Completed action families (11)

1. Rebased complete latest Source Sales Report JSX; retained PENGUIN/Firebase-only behavior and cancellation styling.
2. Full same-Tenant orders collection snapshot instead of a last-250 operational feed, using includeMetadataChanges and verifying server freshness. Cache-only/pending writes are not authoritative revenue.
3. Exact Tenant scope, unique order identifiers, item arrays and numeric finite nonnegative totals; over 20,000 orders is explicitly blocked rather than assumed complete. Shops beyond the limit need separately authorized server report pagination.
4. Loading waits for a confirmed snapshot; malformed data or Firestore read failure shows a standalone nonfinancial error instead of 0 or stale revenue.
5. Paid/voided history separated: old net and per-item cancellation actor remain visible in modal, but voided receipt totals do not flow to KPI, charts, payment subtotals or top menu.
6. Receipt status, order type, payment channel, text, date and page filters preserve receipt inspection; receipt status never changes financial KPI.
7. Day, hour, month and year always computed in Asia/Bangkok regardless of browser timezone (00:00 Thai = previous 17:00 UTC).
8. Reversed, invalid or excessively wide custom date spans remain editable and hide financial KPI instead of displaying false zero.
9. Signed Tenant Owner report can read all 261 seeded orders and recover after an invalid live amount is corrected; another Owner sees only their own Tenant, Cashier is blocked.
10. 320/390/768/1440 Chrome viewports; responsive breakdown and independent chart/table scrolling without document-level sideways scroll.
11. No direct Firestore payment mutation, provider secrets, bank-authority inference, or production deployment.

## Pseudocode contracts (7)

READ: Authenticate and resolve active Tenant, subscribe to complete same-Tenant orders, require server-confirmed metadata, validate all rows and publish only one verified snapshot.

VERIFY: Reject cache, pending local edits, wrong Tenant, duplicate IDs, malformed items, amount strings/NaN/negative/overlimit, or more than 20k rows. A failed read invalidates KPI until the next verified snapshot.

RECEIPTS: Build normal and void receipt groups separately; preserve original paid amount and cancellation source for history and print detail only. Summaries and charts include normal paid groups only.

DATE: Convert timestamps to explicit Bangkok day/hour/month/year; enforce Thai calendar range boundaries for daily, monthly, yearly and bounded custom intervals.

FILTER: Apply period, type, method and keyword to matching receipts; filter status only for receipt table; keep financial KPI independent of cancelled history.

RENDER: Display Source KPI, charts, top items, receipts, modal, read failure and invalid-range warning with internal horizontal scrolling for charts/tables.

AUDIT: Seed 260 paid THB 5 orders plus one cancelled THB 200, assert net THB 1300; corrupt one server total and ensure KPI disappears; restore and confirm; test foreign Owner, Cashier and four widths.

## Scenarios checked (14)

- Read 261 records, not a 250-record operational window.
- Do not publish cache-only or pending-write totals.
- Reject wrong Tenant, duplicate IDs and malformed total.
- Reject an unproven history over 20,000.
- Accumulate all THB 5 paid rows to THB 1,300.
- Show the cancelled THB 200 historical receipt without counting it.
- Cancelled-history filter does not alter KPI.
- Receipt cancellation modal displays actor and cancelled items.
- Daily boundaries match Asia/Bangkok on non-Thailand browser timezones.
- Month/year/custom calendar filters preserve accounting dates.
- Invalid or reversed date range hides financial KPI but remains editable.
- Corrupt a live record to -25: show read error, never old revenue.
- Restore the valid server record: resume THB 1,300 KPI automatically.
- Signed Owner and foreign Owner/Cashier role isolation; 320/390/768/1440 layout.

## Final QA results

- Pure Source/current Firebase report contracts: **5/5 PASS**.
- Real signed Firebase Auth+Firestore Emulator and Chrome with 261 receipts, role isolation, corruption/recovery and four widths: **1/1 PASS**.
- Existing historical cancellation and previous visual parity regressions: **7/7 PASS**.
- Entire npm run test:react-parity serial regression: **PASS, exit 0**.
- npm run build:react and generated Hosting Contract: **PASS, exit 0**. Build 2026.11.09.535 /react/assets/index-B5mvD6gD.js; generated public files restored/deleted.
- No real emails, actual payment settlement, bank provider calls, Production, main branch merge or APK/IPA.

## Project progress measuring rule

The reproducible Master Checklist tracks **65 pinned Source JSX pages**. Conservative local accepted changed-feature page audits 8 plus 1 Source-only verified non-routed Store Master extract = **9/65 (13.8%) coverage**, versus **56/65 (86.2%) still pending formal latest-Source review**. Target has 52/65 matching JSX filenames (80.0% file presence), which must **not** be mistaken for complete features. The percentages describe stringent latest-Source review coverage, **not** how much code exists, how many module-days remain, or readiness for live-money Production. Real Staging and payment-provider acceptance remain separate.
