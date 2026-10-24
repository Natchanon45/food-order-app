# FINAL Phase 10 — Bank evidence signature contract (not yet a real bank integration)

**Date:** 24 October 2026  
**Branch:** `feature/react-firebase-port`  
**State:** PRIVATE source-level preflight. NO live bank credentials or keys; no
Cloud Function export, Firebase transaction, money movement or settlement.

## Why this is needed

The earlier `planHybridRefundReconciliation` compares amount, transfer reference
and beneficiary hashes from synthetic `trusted_bank_statement` and
`trusted_finance_disbursement` objects. These source labels are plain strings
and **do not authenticate an actual bank**. A tampered record that uses that
string can satisfy structural comparison alone. It must never authorize payout.

The new `functions/hybrid-billing-bank-evidence-contract.js` defines a
**detached Ed25519 verification contract** for future server/provider
integration. It verifies the signature mathematically and compares all
critical values to a separate expected record. It intentionally **does not**
make statements about real bank provenance because no bank-issued key or
provider connection has been onboarded.

## Exact canonical record

A signed envelope contains ONLY:

- `version: "hybrid_bank_posting_ed25519_v1"`
- `providerId`, `keyId`, `payload`
- `signatureBase64` (64-byte Ed25519 signature, strict padded base64)

The payload has exactly these fields, in this **canonical order**:

```
tenantId, invoiceId, adjustmentId, instructionHash,
bankReferenceHash, destinationFingerprint, amountCents,
currency, direction, postingStatus, submittedAt, postedAt
```

The signature covers the fixed domain prefix
`PENGUIN-HYBRID-BANK-EVIDENCE-TEST-CONTRACT-V1\\n`
plus the UTF-8 canonical JSON of the version, provider ID, key ID and ordered
payload. Dates must be canonical ISO UTC milliseconds; `currency:THB`,
`direction:debit`, `postingStatus:posted`, positive integer satang and
SHA-256-shaped hashes are required. A posting cannot predate its outgoing
instruction or be later than the independently supplied observation time.

The preflight also requires a separate server-derived expected record for
tenant, original invoice, adjustment, amount, outgoing instruction hash,
bank reference hash and destination fingerprint. **All must match exactly.**

## Trust boundaries

1. The public key registry must come from independently approved SERVER
   configuration, not the envelope, request body, upload, QR slip or Browser.
   Keys can be disabled; unknown and non-Ed25519 keys fail. The repository
   includes **no private keys, real bank keys or bank credentials**.
2. **A test-generated Ed25519 signature is not a bank signature.** Even a
   successful cryptographic check leaves
   `bankProviderIdentityIndependentlyAuthenticated:false`,
   `realBankStatementSourceIntegrated:false`,
   `historicalPayoutsVerified:false`,
   `settlementAllowed:false`, `releaseReady:false` and
   `writesPerformed:false`. The result exposes only a safe content hash,
   not the signed bank reference or raw account.
3. These helper functions are PRIVATE and NOT called from the existing
   synthetic refund candidate writer or Production Cloud Functions.
   They cannot mark `paid`, `refunded` or `settled`. Do not connect them
   to a payable endpoint without independent provider onboarding,
   trustworthy bank keys, live statement ingestion, anti-replay ledger,
   historical coverage and separate final finance authorization.
4. Signing the existing **Finance Review Packet** with a local key would
   only certify the local reviewer or file, not the bank posting. Do not
   conflate report checksum/signature with external banking provenance.

## Tests

```bash
npm run test:hybrid-bank-evidence
npm run test:hybrid-billing
npm run test:firebase-hybrid-emulator
npm run test:react-parity
npm run build:react
```

`tests/react-parity/hybrid-bank-evidence-contract.spec.mjs` generates
synthetic Ed25519 keys at **test runtime** and verifies valid/mismatched
amounts, recipient, tenant and invoice identities, tampering, unknown and
disabled key IDs, an invalid key algorithm, strict dates, bank direction,
THB currency, signature format, impossible source fields and Production
safety. No real provider private key is stored in Git.

Preliminary checks in a mocked V8 crypto environment: **6/6** format/safety
smoke checks passed. These are NOT native Ed25519 cryptographic tests.
Mac Node 22 native suite and Emulator run are still required for this commit.

## Remaining production acceptance

Obtain bank/provider protocol, approved signer's public keys and certificate
chain from the actual bank or payment provider, independently attest key
ownership and rotation/revocation, implement server-side import with
credentials in Secret Manager, reconcile all older outgoing payments across
bank accounts/providers, and implement a separate idempotent settlement
writer with bank receipts and finance dual control. Finish Slip2Go/App Check
UAT and seek explicit owner authorization before any Production release,
`main` merge or deploy. Continue inside **Final Phase 10**.


## 24 October 2026 — Dual-control pinned verification key policy

The synthetic Ed25519 preflight now uses the PRIVATE
`functions/hybrid-billing-bank-key-policy.js` instead of accepting any
`enabled: true` PEM from an arbitrary registry entry.

Each bank/provider key entry MUST supply exactly:

```
enabled: true
publicKeyPem: "-----BEGIN PUBLIC KEY----- ..."
fingerprintSha256: SHA256(SPKI DER public key), lower-case hex
validFrom: strict UTC ISO date with milliseconds
validUntil: strict UTC ISO date with milliseconds
revokedAt: null
registeredBy: independently verified internal administrator UID
reviewedBy: separate internal reviewer UID
```

The checker requires explicit own-property pinning of provider/key IDs (no
inherited `constructor` or prototype entries), rejects all extra flags,
checks an Ed25519 SPKI fingerprint rather than comparing PEM whitespace,
rejects registration by one's own reviewer, and requires BOTH the posting
time and verification time to be inside the active key window. A revoked
or disabled key always fails closed, including for older bank postings;
historical trust decisions would need independently authenticated revocation
timeline evidence. Rotated keys have separate IDs/pins and old keys can be
disabled without affecting another valid key.

**Critical:** These checks validate only the SHAPE and INTERNAL dual-review
fields of a server-supplied trust roster. They do NOT check that the bank
issued the public key or that the two internal UIDs represent verified real
human approvals. The actual trusted roster loader/onboarding protocol is
**NOT implemented**. A valid test key/registry is not bank provenance.
The verifier still always reports:

- `bankProviderIdentityIndependentlyAuthenticated: false`
- `realBankStatementSourceIntegrated: false`
- `settlementAllowed: false`, `releaseReady: false`
- `writesPerformed: false`

No Production endpoint or banker key is registered. Do NOT use an uploaded
public key, a property inside signed bank evidence, a client-supplied
registry or an ordinary Firestore document to establish trust.

Native Mac tests:

```bash
npm run test:hybrid-bank-key-policy
npm run test:hybrid-bank-evidence
npm run test:hybrid-billing
npm run test:firebase-hybrid-emulator
npm run test:react-parity
npm run build:react
```

11 new unit tests validate SPKI fingerprint pinning, disabled/revoked
signers, expired/not-yet-active keys, UTC validation, two-person approval,
prototype-inherited registry attacks, malicious extra flags and rotation
with test-generated keys. The existing Ed25519 signature tests were updated
to require a complete pinned key. The 11 new key-policy cases passed in a
mocked V8 environment; this does **not** constitute genuine Node Ed25519
cryptographic validation. User Mac must run the native test suite on this
new commit before further work.
