# PENGUIN Hybrid Billing — Phase 10: Evidence Upload & Payment Security

Date: 24 October 2026  
Branch: `feature/react-firebase-port`  
Scope: **demo-only Callable + private trusted grant service**. No Production deploy, bank transfer, invoice issuance or UI submission enabled.

## Implementation

1. New private `functions/hybrid-billing-upload-grant.js` accepts **only** authenticated tenant ID, immutable invoice ID, supported MIME and integral 1–10 MiB size. No browser amount, status, bank account, verifier code, attempt ID or Storage path is accepted.
2. Reads trusted active owner/admin profile. Inside a Firestore transaction rechecks that profile and issued/rejected immutable invoice `id/version/signature/amount`; a paid/pending/nonexistent invoice rejects. Generates a cryptographic 24-byte random (base64url) attempt ID and deterministic invoice-scoped `evidence.jpg/png/webp/pdf` path. Creates a server-only `hybridBillingUploadGrants/{attemptId}` record with UID, MIME, max size, immutable invoice signature and a 10-minute expiration.
3. A new `demoHybridPrepareUpload` in the isolated Functions Emulator exercises real Firebase Authentication and Firestore transactions. It has sanitized errors and `enforceAppCheck:false` **only** for demo Auth tests. It is NOT imported/exported by production `functions/index.js` or `bootstrap.js`.
4. Firestore Rules explicitly deny any browser read/write of upload grants. Existing Storage Rules remain unchanged this round: **grants are not authorization for uploading yet**. Production client submit button remains hard-disabled. `uploadEnabled:false` is returned.
5. Immutable invoice amount/status, cross-channel `financeSlipClaims`, manual Super Admin review, delivery prepaid wallet and legacy Revenue Share behavior are unchanged.

## Verification / caveats

- New `npm run test:hybrid-upload-grant` exercises allowlists, authorized roles, immutable transaction preconditions, grants with no payment mutations, expiry and account revocation simulation.
- Integrated into `npm run test:hybrid-billing`. Existing `npm run test:hybrid-functions-emulator` now includes one prepare-transport test with real Auth roles and server-only grant persistence, using `demo-penguin-hybrid` only.
- Mac mini was OFFLINE when editing. Do NOT report this as full Emulator UAT. GitHub-only source checks do not replace React Build, Security Rules Emulator or actual browser screenshot review.
- The old Phase 8 Demo Submit accepts client-chosen attempt IDs; this must not be treated as the final authorized upload protocol. A future coordinated Phase 10B release must close that hole **before connecting browser uploads**.

## Next phase (10B)

- Storage Rules: require exact unexpired grant, requester UID, invoice/signature, expected MIME, max size and immutable/no-overwrite object. Reject direct forged paths and cross-tenant/role uploads.
- Server Submit: require the same grant/owner, uploaded object bytes/MIME and exact invoice snapshot, consume grants transactionally and prevent replay. Keep bank/OCR matching as **pending_review only** and shared Wallet/Revenue/Hybrid dedupe atomic.
- Extend Auth/Firestore/Storage/Functions Emulator negative and positive tests to cover grant theft, replay, expiration, concurrent submit, changed invoice, and role revocation.
- UI should stay disabled until App Check verification, beneficiary bank configuration, finance audit/refund/credit-note requirements and explicit Production release approval.

## Safe Mac commands

```bash
set -e
cd ~/Desktop/Sites/food-order-app
git status --short
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
npm run test:hybrid-upload-grant
npm run test:hybrid-functions-safety
npm run test:hybrid-functions-emulator
npm run test:hybrid-billing
npm run test:react-parity
npm run build:react
git status --short
```

Do not reset, clean, merge to main or deploy Production. `build:react` can regenerate local public HTML; preserve any intentional Mac-only changes.

## Follow-up verification notes

- A separate **real Firestore Emulator** test now creates one Admin-only grant and checks that Owner/Admin/Cashier/other store/Super Admin/anonymous browser identities cannot get, list, create, update or delete it.
- A source-level JavaScript V8 execution check directly exercised the private grant implementation with deterministic fake Firestore transactions: **18/18 passed** for input allowlists, rejection paths, ID/path issuance, 10-minute expiry, role denial, no invoice mutation and reservation replay collision. This is NOT the Node test suite and does NOT simulate real Emulator Rules/SDK behavior.
- The new Emulator permission test, actual demo Callable request, Node regression suite and React build remain **unrun on the offline Mac**. Do not state they passed until Mac result logs are available.

## 24 October 2026 — Phase 10 continuation (same FINAL phase, not a new phase)

- Server-issued grants are now **required** in the private submit service before any Storage download/bank-verifier work. Nonexistent, foreign-owned, consumed or expired grants fail closed.
- `stageHybridInvoiceProof` requires grants **by default**, reads the trusted actor profile and grant **inside** its Firestore transaction, checks UID/tenant/invoice/signature/MIME/exact byte size/expiry/role, and marks the grant `consumed` atomically with pending invoice, payment attempt and global SHA256/bank-reference claims. Historical unit-only bare-stage fixtures explicitly opt out of grant validation; no production handler opts out.
- Storage Rules `validHybridEvidenceGrant` now requires a server-only Firestore grant with matching authenticated active owner/admin, invoice, UID, exact object path, MIME/size, status `reserved` and unexpired timestamp; `resource == null` prevents overwriting even when Storage classifies it as CREATE. No other Storage paths broadened.
- Real Auth/Functions Emulator transport suite revised to issue `demoHybridPrepareUpload` before each upload, then submit/review, including cross-shop SHA256 reuse, unauthorized stolen grant, expired grant, non-issued invoice and consumed-grant replay.
- Real Storage Emulator suite revised to seed server-owned grants and reject direct forged paths, expired grants and owner/admin grant theft.
- ***Status: source committed to branch; full native Mac tests and Firebase Emulator runs remain PENDING because Mac mini was offline.*** No Production App Check/Slip2Go end-to-end proof, no React Upload enabled, no Firebase deploy/merge.
- The user explicitly requested Phase 10 be the FINAL phase: do not add further subphase names. Remaining final acceptance includes App Check, receiver-bank config, manual finance audit, refund/credit controls, suspension/recovery logic, and complete native mobile/desktop UAT.
