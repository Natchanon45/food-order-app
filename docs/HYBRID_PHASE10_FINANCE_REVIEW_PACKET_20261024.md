# FINAL Phase 10 — Finance Review Packet (checksum only)

**Date:** 24 October 2026  
**Branch:** `feature/react-firebase-port`  
**Environment:** isolated LOCAL `demo-penguin-hybrid` Firestore Emulator only.  
**State:** read-only handoff artefact. **NOT a bank statement, signed approval, refund, or financial settlement.**

## Goal

Provide the finance reviewer a portable, privacy-preserving copy of the
12-source audit's known exception list and action items, with an SHA-256
checksum that can detect accidental edits or changed content **when checked
against an independently retained original checksum**.

A SHA-256 checksum **is not a digital signature**. Anybody who controls both
the JSON and its checksum can recalculate both. This does not authenticate
the author's identity, the database snapshot or real bank transactions.
Accordingly, packet fields always say:

- `bankPaymentConfirmed: false`
- `bankSourceAuthenticated: false`
- `historicalBankCoverageVerified: false`
- `settlementAllowed: false` and `releaseReady: false`
- `digitallySigned: false`
- `checksumIsBankAttestation: false`
- `nonAtomicSources: true`

The packet includes ONLY a canonical finance worklist, whitelisted aggregate
document counts, immutable demo label and generation timestamp. It never
includes raw bank account, statement, PDF, slip, provider key, bank reference,
instruction ID, tenant ID, invoice ID, customer ID, or reviewer UID.

The validator independently regenerates allowed finance tasks, rejects
unknown inserted fields and altered task messages, checks the mandatory
four release blockers, and recomputes the checksum. Even an otherwise valid
packet is explicitly **NOT safe for cash movement**.

## Export in DEV only

Start the local Firestore emulator in one terminal:

```bash
cd ~/Desktop/Sites/food-order-app
npx firebase emulators:start --project demo-penguin-hybrid \
  --config firebase.hybrid-emulator.json --only firestore
```

Run in a separate terminal:

```bash
cd ~/Desktop/Sites/food-order-app
HYBRID_FINANCE_AUDIT_DEMO_ACK=1 \
GCLOUD_PROJECT=demo-penguin-hybrid \
GCP_PROJECT=demo-penguin-hybrid \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
node tools/audit-hybrid-finance-demo.mjs --format=packet --max=100 \
  > /tmp/hybrid-finance-demo-review-packet.json
```

The CLI exits with status **2 even on successful report export** because actual
settlement is blocked. A status other than 2 or an empty/invalid JSON file
means something else failed; investigate before sharing.

## Verify offline (no Firestore / internet required)

```bash
node tools/verify-hybrid-finance-packet.mjs \
  /tmp/hybrid-finance-demo-review-packet.json
```

The tool validates file size (max 128 KiB), JSON shape, allowed worklist,
canonical task descriptions and SHA-256. On a consistent packet, it prints
ONLY a small response with `status: "checksum_consistent_only"`,
`independentlyAuthenticated:false`, `bankPaymentConfirmed:false`,
`settlementAllowed:false` and `releaseReady:false`. It still exits **2**.
On corruption, it rejects the packet (normally exit 1). Do not confuse
the integrity result with bank provenance.

To make later modification detection meaningful, retain the original
checksum **independently** of the JSON file (e.g. an approved secure audit
channel). This does not imply that a finance reviewer has approved a refund.

## Source and tests

- `functions/hybrid-billing-finance-review-packet.js` — pure packet create/verify.
- `tools/audit-hybrid-finance-demo.mjs` — `--format=packet` extension,
  locked to local Firestore Emulator before loading Admin SDK.
- `tools/verify-hybrid-finance-packet.mjs` — offline checksum checker.
- `tests/react-parity/hybrid-finance-review-packet.spec.mjs` — 11 unit and
  CLI tests (tampered amounts, timestamps, notes, status and bogus signatures).
- `tests/firebase-emulator/hybrid-finance-security.spec.mjs` — genuine
  emulator inventory to worklist to packet integration.

```bash
npm run test:hybrid-finance-packet
npm run test:hybrid-finance-worklist
npm run test:hybrid-refund-history
npm run test:hybrid-billing
npm run test:firebase-hybrid-emulator
npm run test:react-parity
npm run build:react
```

Source-level V8 packet tests **10/10** passed excluding the test requiring
native Node child-process file I/O. Native Mac Emulator and build tests are
pending for the changes in this turn.

## Remaining BLOCKERS before any real refund

Real source-authenticated bank statement import; platform bank account and
recipient ownership checks; full historical and cross-channel payout
reconciliation; independently authorized final settlement with real provider
receipt and durable global replay guard; App Check / Slip2Go UAT; and explicit
owner approval to enable Production flags, merge `main` or deploy.

Do not remove these release blockers because a packet passes its checksum.
This work does not create another Phase or subphase.
