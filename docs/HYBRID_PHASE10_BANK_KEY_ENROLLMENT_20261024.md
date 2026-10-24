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

## 24 October 2026 — Review-time reservation integrity hardening

The internal key review no longer trusts a previously submitted request
on its own. Inside the SAME Firestore Admin transaction, the reviewer
re-reads the immutable request, its globally reserved SPKI fingerprint
claim, its hashed provider/key slot claim, both actor records and the
unique review event. The review is denied if any claim is absent, repointed,
or differs in ID, provider, key, fingerprint/slot hash or pending status.

Review now also checks exact stored request fields, canonical metadata,
the validity interval and the claimed review timestamp. Both the staging
and review entry points reject unexpected caller fields: no `publicKeyPem`,
`privateKey`, `bankOriginAuthenticated:true` or
`trustedRegistryPromoted:true` can be passed unnoticed through argument
destructuring. Invalid or expired synthetic requests remain unreviewed.

**Scope:** this strengthens internal audit consistency; it does NOT
authenticate the bank, activate keys or infer externally signed transfers.
All three trust/activation flags remain false, with immutable review
result `internally_acknowledged_untrusted`.

Testing:
- `npm run test:hybrid-bank-enrollment` now includes **11 scenarios**
  (previously 6), including missing/tampered claims, forged request data,
  unexpected caller fields, expired request and competing reviewers.
- `npm run test:firebase-hybrid-emulator` adds real Admin Firestore
  concurrent reviewers on one request and a tampered/deleted global claim,
  while continuing Browser-denied GET/LIST/SET for four collections.
- V8 mocked unit source tests **11/11 passed**. The new native Node and
  real Emulator tests are awaiting the user's Mac run on this commit.
- Finance operations MUST NOT treat a complete internal enrollment review
  as independent bank ownership verification. Real provider onboarding,
  authenticated trust roots and source checks remain blocked.

## 24 October 2026 — Read-only four-collection historical signer audit

A separate PRIVATE module `functions/hybrid-billing-bank-key-history-audit.js`
inspects the four DEMO-only bank key enrollment collections and emits
**aggregate counts and allowlisted error codes only**. It never returns
provider IDs, signer key IDs, fingerprints, request IDs, raw PEM, accounts or
the Super Admin user IDs. It is not imported by any Production Cloud Function.

The inventory looks for:
- Requests with invalid scope, forged key activation/bank-authentication flags,
  changed fields, invalid UTC validity windows and missing identity.
- Missing/mismatched SHA256 fingerprint reservations and hashed
  provider/key-slot reservations.
- Orphaned fingerprint/slot claims with no matching source request, or
  references whose request/provider/key does not match.
- Missing/orphaned review events, forged decision/result status, review
  outside the request's window, self-review and changed trust flags.
  A **pending** request without a review is normal and is counted separately
  as `pendingInternalReviews`, with a release blocker.

All four collections use bounded reads (`maxPerSource` 1–500, request
`limit(max+1)`). Overflow or malformed Firestore document references throw
instead of issuing a falsely complete history result. The four collection
reads are **not an atomic Firestore snapshot**. An empty or internally
consistent inventory is not proof of bank-origin public key ownership or
historical signer completeness.

Every report contains:
`bankOriginAuthenticated:false`,
`trustedRegistryPromoted:false`,
`anyKeyActivated:false`,
`historicalKeyCoverageVerified:false`,
`settlementAllowed:false`,
`releaseReady:false`, `writesPerformed:false`, and explicit
bank-ownership, legacy-key and non-atomic-scan release blockers.

Tests: `npm run test:hybrid-bank-key-history` has 14 mocked-source unit
scenarios (14/14 V8 pass) and is included in `test:hybrid-billing`.
Real Firestore Emulator integration was added under
`test:firebase-hybrid-emulator`, including an orphan claim and overflow
case; native Mac test for the new commit remains pending.

Next: real bank/provider public key attestation, safe signer rotation and
revocation policy using verified origins, historic provider and bank
reconciliation, final independent settlement authorization and receipts,
and explicit owner UAT approval. No financial operations or Production
gates have been enabled.
