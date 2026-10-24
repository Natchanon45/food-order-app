# Phase 10 — Historical Finance Inventory (read-only)

**Date:** 24 October 2026  
**Branch:** `feature/react-firebase-port`  
**Status:** DEV-only diagnostic. **Never a bank settlement attestation.**

## Purpose

An empty `hybridRefundReferenceClaims` or `hybridRefundInstructionClaims` collection cannot prove there were no historical refunds. Bank disbursements, third-party providers, manual reversals, archives, and older transaction sources are not represented by the new claim collections. The app has separate flows for incoming slips, Lalamove Wallet credits, revenue share, Hybrid invoices and bank-outgoing refund requests. These categories must not be combined to invent platform liabilities.

The private read-only function `auditDemoHybridRefundHistory` examines the currently supported Firestore collections and produces **only aggregate counts and issue codes**, not raw bank data or user IDs.

| Source | Meaning |
|---|---|
| `hybridRefundReferenceClaims` | New global outgoing refund reference reservations (not a bank reconciliation) |
| `hybridRefundInstructionClaims` | New global outgoing instruction reservations |
| `financeSlipClaims` | Global incoming slip claims (Revenue Share / Wallet top-up / Hybrid) |
| `hybridBillingRefundCandidates` | Synthetic, bank-*unverified* outgoing refund evidence |
| `hybridBillingAdjustments` | Internal credit/refund/chargeback request records |
| `hybridBillingPaymentAttempts` | Incoming Hybrid invoice proof attempts |
| `revenueSharePayments` | Incoming Revenue Share payments |
| `lalamoveWalletTopups` | Incoming prepaid credit additions |
| `lalamoveWalletTransactions` | Internal Wallet movement, including `delivery_refund` credits (NOT outgoing bank refunds) |

The reader checks reference/instruction claims against their candidate's tenant, adjustment and invoice IDs; duplicate, orphan, missing or forged references create integrity blockers. It uses bounded `collectionGroup` and global-collection Admin reads (max 500 documents per source); if a source exceeds its explicit limit, it throws rather than pretending history has been scanned completely.

**This is not an atomic multi-collection snapshot**; concurrent writes can affect diagnostic findings. It cannot authenticate either party's bank or external payout. Therefore **`releaseReady:false`, `historicalBankCoverageVerified:false`, `bankSourceAuthenticated:false`, `settlementAllowed:false`, `writesPerformed:false`** are permanent outcomes of this tool. Even an empty, internally consistent Emulator returns hard blockers.

## Deployment, privacy and safety

- Runs ONLY with exact local `demo-penguin-hybrid` and loopback Firestore Emulator host.
- Is not exposed through a Production Cloud Function, browser API or task scheduler.
- Returns counts, issue codes and source labels only; no raw bank accounts, IDs, references or personal slips.
- Makes no changes to `hybridBillingInvoices`, platform/tenant balances, Wallet, payment statuses or suspension flags.
- Shared incoming-slip SHA256/reference hashes and outgoing refund hashes use different direction/identity rules. Never automatically equate, backfill or promote one from the other.

## Test commands

```bash
npm run test:hybrid-refund-history
npm run test:hybrid-refund-candidate
npm run test:hybrid-billing
npm run test:firebase-hybrid-emulator
npm run test:react-parity
npm run build:react
```

The new unit suite covers missing claims, orphaned global hashes, invalid candidate states, delivery Wallet refunds, bounds overflow, wrong project/host, scope errors, privacy and permanently blocked settlement. **11/11 source-level V8 tests passed**. New real Firestore Emulator test verifies safe inventory behavior and count overflow; native Emulator has not yet run on the current commit.

## Before real refunds

1. Confirm with the platform finance owner the real bank transfer origin, refund destination, which provider owns settlement records and whether incoming/outgoing IDs are comparable at all.
2. Import authenticated external bank statements and outgoing payout instructions through a dedicated server-only integration; do not trust user-submitted source strings.
3. Build a finance-reviewed historical/legacy payout manifest covering every banking channel and archived migration data. Explicitly reconcile dual claims and original finance documents before assigning historical completeness.
4. Design independent final payment authorization, global idempotency and immutable settlement receipts including reversals/chargebacks with legal/accounting signoff.
5. Finish App Check / real Slip2Go receiver UAT and obtain explicit user approval before opening any Production flag, merging `main` or deploying Firebase.

All this remains inside **Final Phase 10**, without adding subphases.

## 24 October 2026 — Full invoice-to-refund accounting integrity chain

The read-only diagnostic now scans **12** sources (previously 9). Newly
included historical document groups:

- `hybridBillingInvoices` — original immutable paid invoice ID, amount and signature
- `hybridBillingAdjustmentEvents` — independent approved/rejected finance review record
- `hybridBillingAdjustmentBalances` — per-invoice reserved amount and proposal count

The stricter audit cross-checks each Refund Candidate against the corresponding
original **PAID** Invoice, `refund_request` Adjustment with `approved` status,
its distinct proposer's and reviewer's decision and a third-party recorder,
exact satang amount, original signature, global bank/reference and instruction
claims. It also checks the sum of non-rejected finance requests and number of
adjustments per invoice against the server-private reserved balance. A missing
invoice, orphaned review, mismatched signature, forged actors, invalid amount,
missing/broken reservation or orphan cap produces a machine-readable issue code
without returning any raw document/reference/user identity.

| Example audit issue | Meaning / next action |
|---|---|
| `CANDIDATE_PAID_INVOICE_PROVENANCE_MISSING` | Independently inspect original immutable invoice/settlement |
| `CANDIDATE_APPROVED_ADJUSTMENT_MISSING` | Missing or invalid internal approved refund request |
| `CANDIDATE_INDEPENDENT_REVIEW_MISSING` | Approval event or reviewer identity does not match |
| `CANDIDATE_SEPARATION_OF_DUTIES_MISSING` | Proposer, reviewer and/or recorder are not distinct |
| `CANDIDATE_AMOUNT_MISMATCH` | Proposed refund and recorded evidence values differ |
| `ADJUSTMENT_RESERVED_BALANCE_MISMATCH` | Sum of active proposals/count differs from per-invoice balance |
| `ADJUSTMENT_REVIEW_EVENT_ORPHAN` | Event references an adjustment not in the trusted scanned set |
| `ADJUSTMENT_BALANCE_ORPHAN` | Reserved balance exists without a corresponding adjustment |

A successful internal-document consistency scan **still does not** authenticate
historical external bank payouts, archived records or third-party provider
sources. It is a bounded, non-atomic diagnostic. The audit never sets
`settlementAllowed:true`, `releaseReady:true` or `bankSourceAuthenticated:true`.
Issue codes are triage signals, **not an automatic repair or permission to
issue refunds**. Do not backfill missing balances from client input.

**Validation:** 16/16 enhanced source-level Node-compatible V8 unit scenarios
passed. Added Firestore Emulator case with a deliberately missing per-invoice
adjustment balance. Native Mac/Emulator test run is pending for the new commits.
Run `npm run test:hybrid-refund-history` and
`npm run test:firebase-hybrid-emulator` before any further work.
