# Final Phase 10 — Global refund evidence anti-replay (Emulator only)

**Date:** 2026-10-24  
**Scope:** private server code + Firestore Rules + unit/Emulator regression.  
**Release status:** OFF. No Production callable, bank disbursement, settlement or Wallet mutation.

## Why this exists

The finance approval of a refund request is *not* a bank transfer. A matching
outgoing instruction and posted bank statement is only a comparison until the
source and provenance are independently authenticated. The earlier pure
`planHybridRefundReconciliation` cannot serially protect the same bank reference
against two concurrent shop requests.

The new **private** `recordDemoHybridRefundCandidate` writes only an immutable
`awaiting_independent_bank_attestation` candidate with a global reference
reservation. The name and output deliberately do not say `paid`, `settled` or
`refunded`. Real bank ingestion, verification and settlement are not implemented.

## New Firestore records

- `hybridRefundReferenceClaims/{sha256BankReference}`: globally unique
  server-private reservation. Its existence blocks another candidate in any
  tenant. No client can read, enumerate, create or update it.
- `tenants/{tenantId}/hybridBillingRefundCandidates/{adjustmentId}`: immutable
  bank matching *candidate*, whose `settlementConfirmed` is always `false`,
  `sourceIntegrationReady` is `false`, and state is
  `awaiting_independent_bank_attestation`. Active Super Admin may read it
  for internal review; client writes are always forbidden. It contains hashed
  reference and destination, never bank account numbers, slips, transfer tokens
  or raw bank statements.

Both are created inside one Firestore Admin transaction after reading actor,
tenant, immutable paid invoice, approved adjustment, independent review event,
existing candidate and global claim. The actor must be an *active third Super
Admin*, distinct from proposer and reviewer. The private policy again compares
amount in satang, THB, recipient fingerprint, bank reference hash, time order and
bank posting status. Duplicate claims are rejected atomically, including across
tenants.

## Hard gates

- `HYBRID_REFUND_CANDIDATE_PRODUCTION_READY = false` remains locked.
- The private writer rejects anything but
  `demo-penguin-hybrid` with a loopback Firestore Emulator host.
- The module is **not imported/exported** by `functions/index.js` or
  `functions/bootstrap.js`. Production billing flags remain disabled.
- **Do not** allow a Web Callable, server-only static token, or a user-supplied
  JSON record to assert bank provenance. Fields such as
  `source: trusted_bank_statement` are *synthetic test labels*, not proof of
  authenticity.
- There is **no final attestation**, no `settled` transition and no bank
  receipt writer. Browser UI must continue to say **No confirmed payout**.

## Mac test commands

After inspecting `git status --short`, fast-forwarding the feature branch
without overwriting local generated files, run:

```bash
npm run test:hybrid-refund-candidate
npm run test:hybrid-refund-reconciliation
npm run test:hybrid-billing
npm run test:firebase-hybrid-emulator
npm run test:react-parity
npm run build:react
```

The new unit cases cover matching candidate, replay, cross-adjustment
duplicate, wrong project/host, actor revocation, three-person separation,
tampered bank evidence and Production safeguards. The Firebase Emulator adds
true concurrent cross-tenant reference claiming and Browser rule denials.
This turn verified **8/8 unit behaviors in a V8 mocked environment**, not
native Node, React build or Firebase Emulator; the user confirmed the
**previous commit's** Mac suite passed.

## Remaining to Production

1. Obtain trustworthy, authenticated bank/provider statement and outgoing
   transfer sources; compare to the true platform beneficiary, not synthetic
   hashes from client input.
2. Account for legacy refunds and cross-channel reuse in one global claim
   namespace. A new empty claim collection does not prove no historical reuse.
3. Build controlled independent finance final approval, hashed bank receipt,
   idempotent settlement transaction and reversal/chargeback procedures,
   respecting accounting and tax requirements.
4. Complete App Check, Slip2Go receiver, full Browser/UAT and owner-approved
   Production gating. No main merge or Firebase Production deployment yet.

Final Phase 10 only; no new subphase or phase.


## 24 October 2026 — Dual anti-replay and read-only Super Admin candidate history

The private Demo candidate writer now claims two DIFFERENT global identifiers in the
same Firestore transaction:

- `hybridRefundReferenceClaims/{bankReferenceHash}` blocks reusing a posted
  bank reference on different refunds.
- `hybridRefundInstructionClaims/{sha256(domain + instructionId)}` blocks
  reusing an outgoing instruction ID under a different bank reference.
  The domain string is `hybrid-refund-instruction-v1:`; the raw ID is not
  stored in claims or Browser-readable candidate records.

A collision in EITHER namespace rejects the ENTIRE transaction before any
candidate/audit or claim writes. Firestore Rules deny read/list/write on both
global namespaces for EVERY Browser role, including Super Admin. Tests cover
the two tenants using a shared instruction ID but different bank references.

The Super Admin finance page now lists `hybridBillingRefundCandidates` by
`createdAt`, tenant scoped, cursor paginated. It displays ONLY sanitized
adjustment ID, invoice ID, amount, timestamp, observer and:
**"Bank attestation pending / Payout not confirmed"**. Sensitive raw transfer
identifiers, hashes, account data, bank statements and any stored
`settlementConfirmed` field are not forwarded to the UI. Invoice IDs that
include dates must remain intact; redact bank-account-like digit sequences
in NOTES, not document IDs.

### Historical and cross-channel completeness: still a release blocker

The global claim tables are new. Their absence of a row does not prove that
an incoming slip, older refund or third-party payout has never used that bank
transaction/instruction. The existing `financeSlipClaims` documents are
based on normalized raw reference values in a different domain and track
incoming payments (Wallet, Revenue Share, Hybrid). Do NOT conflate incoming
payments with outgoing refund instructions, or assume hashing an already
hashed bank reference yields a comparable identifier.

Before actual refunds: independently authenticate the bank statement and
the original outgoing instruction, scope reference uniqueness by bank/account
and money-flow direction as agreed with finance, reconcile legacy settlement
records and cross-channel payouts, and implement an approved final
idempotent settlement/receipt writer. **No Production candidate writer or
true settled state exists in this phase.**

Latest testing: `npm run test:hybrid-refund-candidate` (9 new unit scenarios
in the candidate spec), `npm run test:hybrid-refund-ui` (4 new UI scenarios),
`npm run test:firebase-hybrid-emulator` (two race types plus Browser denial),
`npm run test:hybrid-billing`, `npm run test:react-parity`,
`npm run build:react`. Source-level V8 candidate tests 9/9 and source/UI
tests 15/15 passed; native Mac/Emulator still pending for these new changes.
