# Final Phase 10 — Unified Finance and Bank Key Readiness (DEMO ONLY)

**Date:** 24 October 2026  
**Branch:** `feature/react-firebase-port`  
**Status:** Read-only, local `demo-penguin-hybrid` Firestore Emulator, NOT Production release approval.

## Purpose

Two separate synthetic safety inventories previously existed:

1. Twelve financial sources: immutable invoices, adjustments, independent review events, reserved balances, refund candidates, incoming slips, revenue sharing, Wallet movements, and the global refund-reference/instruction anti-replay claims.
2. Four global bank signer enrollment collections: proposed keys, independent internal reviews, fingerprint claims, and provider/key slot claims.

Passing either inventory cannot remove the other inventory's blockers. The new `functions/hybrid-billing-phase10-readiness.js` **combines both only to produce a blocked, sanitized triage list** for the finance owner. It never certifies real bank statements, actual outgoing refunds, bank-owned signing keys, historical settlement, or readiness to accept live money.

Both inventories run sequentially, each with bounded reads (max 500 docs per collection; read `max+1` to detect overflow). They are **not** an atomic snapshot across 16 collections. A missing source, invalid counts/flags, forged "ready" field or scan overflow fails closed. The merger uses an allowlisted mapping for financial review actions and known bank-key integrity codes. Raw/unknown issue strings are NEVER echoed; only generic unknown-code tasks are shown.

**Fields that always remain false:**
`bankSignerOwnerAuthenticated`,
`bankStatementSourceAuthenticated`,
`historicalBankSettlementCoverageVerified`,
`independentFinalSettlementAuthorized`,
`allSourcesAtomicSnapshot`,
`bankTransferConfirmed`,
`eligibleForBankSettlement`,
`productionReleaseAllowed`,
`walletCreditIsOutgoingBankRefund`,
`writesPerformed`.

Wallet `delivery_refund` credits are internal prepaid delivery credits, not external bank payouts. A zero-issue 16-source inventory is **still blocked** by real-bank authentication, historical payouts, key origin and independent final settlement requirements.

## View a single sanitized report

First start the local Firestore Emulator:

```bash
cd ~/Desktop/Sites/food-order-app
npx firebase emulators:start --project demo-penguin-hybrid \
  --config firebase.hybrid-emulator.json --only firestore
```

Then, in a separate Mac terminal:

```bash
cd ~/Desktop/Sites/food-order-app
HYBRID_FINANCE_AUDIT_DEMO_ACK=1 \
GCLOUD_PROJECT=demo-penguin-hybrid \
GCP_PROJECT=demo-penguin-hybrid \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
node tools/audit-hybrid-finance-demo.mjs --format=readiness --max=100 \
  > /tmp/hybrid-phase10-readiness-demo.json
```

The CLI uses the preexisting strict local project/host/consent checks **before** loading `firebase-admin`. It returns exit code **2 even on a successful, redacted report**: this code is deliberate to prevent a "green" CI signal from being interpreted as Production clearance. Incorrect project/host or over-limit reads throw instead of generating a partial report. Do not execute in Production.

## Test on the latest feature branch

```bash
npm run test:hybrid-phase10-readiness
npm run test:hybrid-bank-key-history
npm run test:hybrid-refund-history
npm run test:hybrid-finance-worklist
npm run test:hybrid-billing
npm run test:firebase-hybrid-emulator
npm run test:react-parity
npm run build:react
```

The new `hybrid-phase10-readiness.spec.mjs` adds **12 tests**: empty inventory, cross-domain errors, pending bank-key reviews, forged readiness flags, missing blockers, invalid counts, unknown-code redaction, Wallet-vs-bank separation, 16-source reads, emulator-only access, scan overflow and no Production export. All **12/12 tests passed in a mocked V8 source-level harness**, not native Node. Real Firestore Emulator integration was also added but requires local Mac run.

## Remaining live-banking dependencies

Independently authenticate real provider key ownership; integrate signed/validated real bank statements server-side using trusted keys and secure secrets; reconcile all historical bank disbursements and other channels; implement independently approved idempotent settlement receipts and reversals; finish real beneficiary, App Check and Slip2Go acceptance testing; obtain explicit owner go-live approval. No Firebase Production deploy, `main` merge, money movement or release-flag change was performed.

## 24 October 2026 — Portable 16-source Phase 10 Readiness Packet

The original plain `--format=readiness` and 12-source Finance
`--format=packet` remain supported. NEW `--format=readiness-packet`
combines the 16-source, redacted, always-BLOCKED Readiness Report in a
JSON envelope with an SHA-256 content checksum. It supports local/offline
handoff between the owner and finance reviewer.

It is NOT digitally signed, does NOT authenticate a bank/author, and does
NOT prove that the input was a coherent database snapshot. A malicious
party with write access to both the JSON and checksum can recompute both.
Independent safe custody of the original checksum is necessary for
meaningful later tamper detection, but is still not bank attestation.

### Produce packet on local Firestore Emulator ONLY

Terminal A (as above): start the Firestore emulator using the
`demo-penguin-hybrid` project. Terminal B:

```bash
cd ~/Desktop/Sites/food-order-app
HYBRID_FINANCE_AUDIT_DEMO_ACK=1 \
GCLOUD_PROJECT=demo-penguin-hybrid \
GCP_PROJECT=demo-penguin-hybrid \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
node tools/audit-hybrid-finance-demo.mjs --format=readiness-packet --max=100 \
  > /tmp/hybrid-phase10-readiness-packet-demo.json
```

A successful **blocked diagnostic returns exit status 2**, not 0. If
there is a hard validation/read failure, the command must not emit a
report. Protect the file and do not paste original bank docs/secrets into
it.

### Offline integrity check (does not connect to Firebase)

```bash
node tools/verify-hybrid-phase10-packet.mjs \
  /tmp/hybrid-phase10-readiness-packet-demo.json
```

The offline verifier reads only one local JSON file (max 128 KiB),
rebuilds canonical allowlisted finance and key tasks, checks mandatory
release blockers, rejects additional/private fields, and validates its
checksum. It prints a minimal `checksum_consistent_only` result,
`independentlyAuthenticated:false`,
`bankPayoutConfirmed:false`, `settlementAllowed:false`,
`productionReleaseAllowed:false`. It **still exits 2**, even on a valid
checksum. Corrupt files fail with a different nonzero code.

All genuine bank and settlement gates remain locked. Never enable a
payment callable because this local-demo packet passes verification.

### Native tests

```bash
npm run test:hybrid-phase10-packet
npm run test:hybrid-phase10-readiness
npm run test:hybrid-billing
npm run test:firebase-hybrid-emulator
npm run test:react-parity
npm run build:react
```

`tests/react-parity/hybrid-phase10-review-packet.spec.mjs` has
**12 tests** for canonical regeneration, deterministic checksum,
tampering even after checksum recomputation, unknown-code privacy,
Wallet-vs-bank separation, safe CLI, private-only exports and Node
offline-file verification. **11/11 V8 source-level mock cases passed**;
the spawned native Node verification case and Firestore Emulator
integration have been added but not executed by the assistant on Mac
(authorized Remote Desktop Mac mini offline).
