# FINAL Phase 10 — Private bank signing-key enrollment audit (Demo only)

**Date:** 24 October 2026
**Branch:** `feature/react-firebase-port`
**Status:** read-only-to-Browser, Admin-transaction audit in LOCAL
`demo-penguin-hybrid` Firestore Emulator ONLY.

## Why this exists

The earlier Ed25519 key policy checked a supplied registry entry's
fingerprint, validity window, revocation status and two different
`registeredBy` / `reviewedBy` strings. The strings alone could NOT prove
that actual active Super Admins independently verified the claimed signer,
let alone that the BANK issued the signing key.

The new private `functions/hybrid-billing-bank-key-enrollment.js` records
an **untrusted INTERNAL metadata enrollment request** and one independent
Super Admin's review event inside real Firestore Admin transactions. It is
not imported in `functions/bootstrap.js`, `functions/index.js` or any
Production callable. Hard lock: `BANK_KEY_ENROLLMENT_PRODUCTION_READY=false`,
exact project `demo-penguin-hybrid`, and loopback Firestore Emulator host.

## Immutable Firestore records

| Path | Purpose |
|---|---|
| `hybridBankKeyEnrollmentRequests/{requestId}` | Pending request for provider/key ID, SHA256 fingerprint, validity window, active Super Admin proposer |
| `hybridBankKeyEnrollmentReviews/{requestId}` | One immutable second Super Admin acknowledgement or rejection |
| `hybridBankKeyFingerprintClaims/{sha256}` | Global reservation, blocks reusing one fingerprint for another key/provider |
| `hybridBankKeySlotClaims/{sha256(providerId/keyId)}` | Global reservation, blocks overwriting one provider/key slot with different key |

The proposal and both claims are created **atomically**, after reading
the current active actor's role and all existing claims. A second active
Super Admin who is different from the proposer can write ONE immutable
review event; the proposer's current active role is revalidated within
that transaction. The review event does NOT overwrite the proposal.
Repeating or racing for the same fingerprint/key slot/request is blocked.

A successful internal review is named
`internally_acknowledged_untrusted`. Every record/result retains:
`bankOriginAuthenticated:false`,
`trustedRegistryPromoted:false`, `keyActivated:false`.
No public/private signing key bytes, PEM, credentials or bank account
data are persisted. Firestore Rules deny GET/LIST/CREATE/UPDATE/DELETE
for every Browser role, **including Super Admin**, on all four collections.

## Important limitation

These actions are NOT connected to `trustedRegistry` used by the
cryptographic preflight. There is intentionally **no activation API**.
Fingerprint hashes can be calculated from arbitrary sandbox key bytes,
and admin identities in the Emulator are fake. Internal acknowledgement
is not independent proof of BANK key ownership.

Global claims are permanent reservations in this Demo; a rejected
proposal does not release its fingerprint/key slot automatically.
Future real key onboarding requires a reviewed bank/provider key-origin
attestation, verified secure registry storage, key rotation/revocation
protocol, historical signing timelines and secure server-only adapters.
Do not import synthetic requests/claims into Production.

## Native Mac / Emulator UAT

```bash
git status --short
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port
npm run test:hybrid-bank-enrollment
npm run test:hybrid-bank-key-policy
npm run test:hybrid-bank-evidence
npm run test:hybrid-billing
npm run test:firebase-hybrid-emulator
npm run test:react-parity
npm run build:react
git status --short
```

Check the Emulator concurrency test and Browser role denials. An
acknowledgement must remain untrusted, not a key promotion. If Git reports
local conflicts, STOP and preserve files (never reset/clean local generated
`public/**/index.html`).

Source-level V8 mock fixture checks passed **6/6**. New real Firestore
Emulator tests and full native Node tests have not been independently run
by this assistant in the current turn (remote Mac mini offline).

**Production remains blocked** pending authenticated bank/provider
trust anchors and actual bank statement ingestion, historical cross-channel
reconciliation, legally appropriate independent finance authorization,
global idempotent settlement receipts, Slip2Go/App Check UAT and explicit
owner approval before any merge/deploy.
