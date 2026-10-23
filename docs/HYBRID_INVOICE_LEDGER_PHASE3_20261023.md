# PENGUIN Hybrid invoice ledger — Phase 3 (2026-10-23)

## Scope and launch status

**Implementation candidate; NOT enabled for production.** The owner's prelaunch decision is universal activation-anniversary billing for all stores. The new ledger supports reliable day-close invoice planning and a private Firestore Admin transaction writer, but is deliberately **not exported as a callable/HTTP function, not scheduled**, and has `HYBRID_INVOICE_ISSUANCE_READY = false`. It does not charge money, approve slips, debit Lalamove Wallet, or change tenant access.

The current read-only Hybrid report is not a receipt or a payable invoice. Do not allow payment of projected rows until trusted verification and billing collection have been completed.

## Authoritative data and price snapshot

- Backend source: paid Delivery only from `tenants/{tenantId}/orders`, queried using server Firestore `paidAt` Timestamp (paginated, bounded). Exclude POS, other fulfillment methods, unpaid, cancelled, refunded, shipping, malformed monetary fields and missing trusted payment timestamps.
- Original tenant activation day determines the cycle; Bangkok midnight defines day-close. A completed day is strictly earlier than the server's current Bangkok date, not a timestamp supplied by the client.
- On the first reconciliation of a cycle, read the centrally administered Hybrid pricing. Once a period has a `configSnapshot`, its settings are **immutable for that period**; later Super Admin price edits cannot rewrite an already-issued invoice.
- Deterministic IDs: `{cycleStartDate}:delivery:trigger`, `{cycleStartDate}:delivery:{YYYY-MM-DD}`, `{cycleStartDate}:monthly:fixed`. The original daily trigger-and-later-sales rules from `hybrid-billing-core` remain intact.
- Fixed monthly fee only becomes eligible after the full cycle ends. The initial activation cycle's flat fee is waived when below threshold; eligible paid Delivery can still generate share invoices.

## Firestore schema (server-only writes)

`tenants/{tenantId}/hybridBillingPeriods/{cycleStartDate}`:

- `version`, `cycleStartDate`, `cycleEndDate`, `cycleEndExclusiveDate`
- `configSnapshot`, `sealedBeforeDate`, `sealedSalesDigest` (SHA-256 checksum of completed-day paid merchandise totals)
- `invoiceIds`, `createdAt`, `lastEvaluatedAt`

`tenants/{tenantId}/hybridBillingInvoices/{invoiceId}`:

- Immutable financial identity: cycle start/end, kind, billed date, due date, suspension-from date, calculation base and amount in THB, signature, ledger version
- Mutable **only by a future trusted server payment workflow**: `status` (`issued`, `pending_review`, `paid`, `rejected`), verification/review metadata
- New invoice defaults to `issued`. Uploading a slip is NOT equivalent to server-confirmed `paid`.

The pure planner `functions/hybrid-billing-ledger.js` checks sealed historical sales for any late/backdated changes or refunds and stops on changed amounts instead of silently amending historical invoices. Historical corrections require a separately audited adjustment/credit-note workflow.

Private `functions/hybrid-billing-persistence.js` reads the period and all invoice references inside a Firestore transaction, verifies the period revision and immutable invoice signature, creates only missing records, and is idempotent on replays. Concurrency conflicts stop and require the complete plan to be recomputed from fresh data. It never deletes invoices or overwrites paid statuses.

`functions/hybrid-billing-reconciler.js` is the private server-only coordinator that resolves the activation month, reads all authoritative orders and prior invoices, and generates a complete no-write plan. Its issuance function is **hard-disabled**. Neither this module nor the writer is imported by `functions/bootstrap.js`.

## Security

`firestore.rules` explicitly allows only Tenant Admin/Super Admin read access for these two billing subcollections and **denies all browser create/update/delete**, including owner-side modification of invoice amounts and paid statuses. Firebase Admin operations bypass client rules, so the trusted writer and payment-review service must remain server-only.

Firestore Rules have NOT been deployed or verified in the Firebase Emulator in this coding session; no production access behavior has been changed.

## Tests

Run from the feature branch:

```bash
npm run test:hybrid-invoice-ledger
npm run test:hybrid-billing
npm run test:universal-billing
npm run test:react-parity
npm run build:react
```

Covered: prior unpaid/paid invoice, threshold crossing, day-close, initial fee waiver, late refunds, SHA-256 day seals, stable central-price snapshot, duplicate issuance, concurrent stale period revisions, fraudulent payment status, Firestore rules and disabled issuer. These tests use in-memory Admin mocks; real emulator integration remains a release gate.

## Next development milestones

1. Add immutable issuance-event ledger and credit/adjustment notes for genuinely late payments/refunds; prevent duplicate trigger on reruns across adjusted days.
2. Build Slip2Go verification with trusted transaction reference, matching amount, tenant ID and invoice ID, and manual Super Admin review fallback; never mark paid on upload alone.
3. Add restricted invoice list/period detail UI for tenant owner/admin and Super Admin, showing due, under-review, confirmed, rejected and historic payments, with Thai/English localization.
4. Implement day-close scheduled issuance with idempotent retries, exact timezone boundaries and the guard only turned on after emulator/UAT plus owner approval.
5. Implement next-day suspension and verified-payment access recovery without accidentally unlocking manually suspended stores; owner/admin must retain billing-recovery access.
6. Implement server-enforced monthly Slip2Go verification quota and unlimited quota transition at threshold.
7. Run Firestore Emulator security/transaction tests and separate staging/UAT for 29–31 dates, no sales, refunds, concurrency, wallet independence and all three anonymized tenant configurations.

**No Firestore documents, master data, billing transactions or production hosting were changed in this session.**
