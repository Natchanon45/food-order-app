# Phase 10 — React Owner / Super Admin browser emulator UAT

Date: 24 October 2026. Branch: `feature/react-firebase-port`. This remains the **FINAL Phase 10**, not a new numbered phase.

## Important isolation

- Owner confirmed the previous native security/Functions/React tests passed at commit `7fd22aa` (user confirmation; no log attached this turn).
- The **new browser UI changes have NOT been run in a real browser or on the Mac yet**. The Mac mini remote connector was offline. Do not claim they pass until these latest code changes are verified.
- Vite must be DEV (production `build:react` has `import.meta.env.DEV === false`) AND both `VITE_USE_FIREBASE_EMULATORS=true` AND `VITE_HYBRID_DEMO_PAYMENT_E2E=true`. Only then does the React Firebase App use project `demo-penguin-hybrid` with Auth/Firestore/Storage/Functions on loopback ports. A mismatched Firebase App project **throws**.
- `functions/emulator-hybrid/index.cjs` requires the guarded demo project and fake bank verifier; ONLY this entrypoint exports `demoHybridPrepareUpload`, `demoHybridSubmitProof`, `demoHybridReviewProof`. Production `functions/index.js` and `functions/bootstrap.js` still do not export payment writes.
- **Never upload an actual personal bank-transfer slip.** Use an invented PNG/PDF (e.g. harmless synthetic sample). The emulator verifier intentionally pretends a bank match and does not prove any real payment. Demo `paid` records exist only in the disposable emulator.
- Production release gates `HYBRID_PAYMENT_UI_READY`, `HYBRID_PAYMENT_CALLABLE_READY`, `HYBRID_TENANT_PROOF_SUBMISSION_READY`, `HYBRID_INVOICE_ISSUANCE_READY` are **false**. No Production deploy or merge.

## Mac instructions: two separate terminals

Before starting, `git status --short` and preserve any intentional dirty `public/**/index.html`. Do not `reset --hard` or `clean -fd`.

**Terminal A — start local demo Auth/Firestore/Storage/Functions:**

```bash
cd ~/Desktop/Sites/food-order-app
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
export HYBRID_DEMO_FUNCTIONS_ONLY=1
export HYBRID_DEMO_FUNCTIONS_HOST=127.0.0.1:5001
export GCLOUD_PROJECT=demo-penguin-hybrid
export GCP_PROJECT=demo-penguin-hybrid
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
export FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001
firebase emulators:start --project demo-penguin-hybrid --config firebase.hybrid-functions-emulator.json --only auth,firestore,storage,functions
```

**Terminal B — same loopback variables, seed only demo identities/ledger, launch DEV React:**

```bash
cd ~/Desktop/Sites/food-order-app
export HYBRID_DEMO_FUNCTIONS_ONLY=1
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
export FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001
export GCLOUD_PROJECT=demo-penguin-hybrid
export GCP_PROJECT=demo-penguin-hybrid
npm run seed:hybrid-demo-browser
npm run test:hybrid-demo-browser
npm run test:hybrid-billing
npm run test:react-callables
VITE_USE_FIREBASE_EMULATORS=true VITE_HYBRID_DEMO_PAYMENT_E2E=true npm run dev:react
```

The seed script refuses nonlocal service hosts, inconsistent project values and missing demo flag **before importing firebase-admin**. It makes only synthetic data:
- Owner: `hybrid-owner@demo.invalid`
- Reviewer: `hybrid-reviewer@demo.invalid` (Super Admin)
- Password for both: `EmulatorOnly123!`
- Store: `demo-hybrid-browser`
- Immutable demo invoice: `2026-10-24:monthly:fixed` / 590 THB synthetic
- Re-running the seed preserves an existing invoice and its payment status; restart the disposable emulator without persistence to reset the demo.

## Browser walkthrough

1. Open `http://localhost:5174/react/login?next=%2Freports%2Fhybrid-billing`, log in as demo Owner. Navigate to `/react/reports/hybrid-billing` if not redirected. A blue **Emulator-only** banner must be visible; actual issued invoices are read directly from the demo Firestore.
2. Select the synthetic invoice, choose a **synthetic** JPG/PNG/WebP/PDF (1 byte to 10 MiB), click **Submit to Emulator**. UI displays grant/upload/submit steps and refreshes. The invoice must now be `pending_review`. There must be an immutable Storage object, consumed grant, pending attempt and shared proof claim; verify in Emulator UI.
3. Sign out; sign in as `hybrid-reviewer@demo.invalid`. Open `/react/platform/hybrid-invoices`, choose `demo-hybrid-browser`, review the pending attempt and press **Approve in Emulator** or **Reject in Emulator** (provide required rejection note). The invoice must update to `paid` or `rejected` **only inside the emulator**. A second decision on the same attempt must be rejected.
4. Sign out; sign in as Owner again. Verify the refreshed invoice status. A paid invoice must not present the Upload option. For an alternate rejection workflow, restart the disposable emulator (fresh data) or use a new synthetic invoice.
5. Browser negative tests: direct unreserved path upload, other user's grant, expired grant, mismatched MIME/size, duplicate content, upload overwrite, double submit and role revocation. Server-side tests already cover these cases, but confirm latest revision in real Emulator.
6. Repeat `npm run test:hybrid-functions-emulator`, `npm run test:firebase-hybrid-emulator`, `npm run test:react-parity` and `npm run build:react` after stopping conflicting emulator ports where required. Production build must **never** enable the demo.

## Remaining work before completion

Real App Check validation, real bank receiving account configuration/confirmation (without exposing secrets), actual Slip2Go provider and failure/duplicate coverage (not fake verifier), finance audit and credit/refund/suspension-recovery acceptance, responsive browser UAT, approval of release gating, and then separate owner-authorized Production deployment. Do not mistake a synthetic `paid` for a verified transfer.

## 24 October 2026 — Uploaded Mac log follow-up

The owner uploaded a Mac terminal log reporting `Missing script: "test:hybrid-demo-browser"` and `test:hybrid-billing` at **144/145** with one safety assertion failure. The Mac checkout is older than the GitHub feature branch (its package hybrid test arguments did not include the new demo browser spec). Pull the branch latest safely and rerun. The failing test matched a forbidden-operation keyword in a *comment*, not a real mutation; source-only guard was repaired and remains fail-closed. The Mac log did show an older React Production build and build-contract PASS, not latest React demo validation.

## 24 October 2026 — Finance reviewer revocation and immutable audit UAT

After pulling the most recent `feature/react-firebase-port` commit:

1. Verify a synthetic Owner invoice goes from `issued` to `pending_review`; neither a missing/expired grant nor an inactive uploader may submit.
2. As Super Admin, visit `/react/platform/hybrid-invoices`. The new **Finance review audit trail** initially shows no events on fresh Emulator data.
3. From the demo Callable tests, revoke the reviewer `users/{uid}` by setting `active:false` or `role:cashier`. A review attempt must reject; the invoice remains `pending_review` and **no review event** is written. Restore the demo reviewer profile after testing.
4. The real demo Reviewer can approve or reject once after restoring Super Admin permissions. The audit table must show the immutable review time, decision, reviewer UID and simulated confirmation label. The issuer must **not** auto-unlock a store suspended for a separate reason.
5. Verify switching selected stores or refreshing while a page is still loading never displays prior shop invoices/attempts/audit events. Repeated clicks on Load More should not append duplicate audit IDs. Review notes containing long account-like digit patterns must display a redaction marker.
6. Production mode must still show disabled submit/review controls and no demo finance endpoint. The demo does not prove a real bank transfer or App Check integration.

The new code has source-level checks but has **not** been run on the Mac in this turn; all older owner-confirmed test results apply only to preceding commits. Do not deploy Production until real receiving-bank/App Check/Slip2Go, credit/refund/reversal and suspension/recovery policy UAT is complete.

## 24 October 2026 — Receiver verification and HTTP fail-closed tests

1. Ensure `platformPrivateSettings/slipVerification` is configured via the existing trusted Super Admin channel with a genuine account number **and** the correct beneficiary account name, plus real Slip2Go API credentials. Do not paste bank credentials into logs/PRs, and do not import an actual banking record into demo storage.
2. Run `npm run test:hybrid-receiver-verification`; this mocks provider HTTP responses and must never call Slip2Go or any real endpoint. The whole `npm run test:hybrid-billing` suite now includes it.
3. For an actual UAT environment (not demo), validate provider account ownership with the platform finance team, successful `200200` under receiver and amount/date/duplicate checks, and negative `200000`, `200401`, duplicate, invalid beneficiary, and HTTP error responses. `200200` alone on an HTTP failure must never become bankVerified.
4. The DEV-only demo uses synthetic verification with receiverValidated=true to simulate the success case; a synthetic record or code does NOT prove a bank transfer. Do not enable Production until real integration and independent finance review are signed off.
5. Every Production release gate remains false. If a recipient configuration is missing, Hybrid proof submission should fail closed instead of choosing a different, legacy bank account.

## 24 October 2026 — Full-history recovery and credit/refund/chargeback DRY RUN

New private read-only finance policy and historical recovery collector are in `functions/hybrid-billing-finance-policy.js` and `functions/hybrid-billing-recovery-reader.js`. Run:

```bash
npm run test:hybrid-finance-policy
npm run test:hybrid-recovery-reader
npm run test:hybrid-billing
npm run test:react-parity
npm run build:react
```

Critical scenarios: (1) unpaid invoice D makes hold eligible only on D+1 Bangkok date; (2) one unpaid older-anniversary invoice keeps hold even if the newest invoice is PAID; (3) absent period index (including a zero-invoice trial) or unindexed Invoice causes a review-required error rather than recovery; (4) completed verified history permits a **proposal** to clear only `hybridBillingSuspended`; (5) separate manual/security/legacy suspension still blocks account access; (6) credit note for unpaid invoice, refund and chargeback for paid invoice only, reject duplicate/cross-tenant/over-amount/untrusted bank destination inputs; (7) no credit/refund proposal ever mutates Wallet, old Invoice, account status or real payment.

The reader intentionally **fails closed on missing historical billing periods**, including pre-cutover legacy periods. Historical migration or an independently reviewed finance reconciliation will be required before enabling automatic recovery. No writer exists and none should be exposed to the browser until those controls are approved. Previous Mac test confirmation applies to the earlier HEAD only.

## 24 October 2026 — Internal finance adjustment transaction UAT

1. In an isolated Emulator project `demo-penguin-hybrid`, verify two simultaneously submitted refund proposals of 350 THB on one PAID 500 THB invoice result in exactly one proposed reservation, not 700 THB. Original PAID invoice and store suspension must remain unchanged.
2. Try to approve the proposed refund using the same Super Admin who created it; reject with `HYBRID_ADJUSTMENT_SELF_REVIEW_FORBIDDEN`.
3. Revoke or demote the second Super Admin; reviewer transaction must fail and create **no audit event**. Restore the identity. A second reviewer may approve (an internal decision, not payout) or reject.
4. Rejecting releases only the invoice's reserved adjustment cap, without deleting the proposal/audit or issuing money; replaying review must fail. Approving keeps cap reserved until independently verified settlement logic is designed.
5. Browser SDK attempts by owner/admin/cashier, cross-tenant user and Super Admin must fail for create/update/delete of adjustment, balance and event docs. Balance docs are fully unreadable through Browser SDK.
6. Under NO circumstances should `approved` be displayed as `refunded` or `money sent`. No current UI/Callable exposes these private methods; Finance must still manually verify refund destination and actual bank settlement outside this feature.

New `npm run test:hybrid-finance-records` is included in `test:hybrid-billing`. All changes here are **local source/isolated demo work**, no Production deploy.

## 24 October 2026 — Internal approval ≠ actual cash refund

- As an active Super Admin on `/react/platform/hybrid-invoices`, select a demo tenant. View two new **read-only** sections for adjustment proposals and their immutable approval/rejection events. The selected tenant + refresh generation must scope each list; repeatedly clicking Load more cannot duplicate IDs.
- A proposed record displays `Awaiting internal review`; an approved record displays `Internally approved only`; a rejected record displays `Rejected`. The separate actual payout column must always show `No confirmed payout` until real bank integration is independently delivered. Credit note proposal must show `Credit note (not applied)`.
- Inject fake bank account numbers into a sandbox note; only the masked note should render. No bank account, raw OCR, Storage path or transfer reference should surface in React. `externallySettled:true` injected into the proposal must NOT cause the UI to display Paid/Refunded.
- Reconciliation pure policy requires exact two-side evidence comparison: approved refund + immutable PAID invoice + separate Super Admin decision + outgoing disbursement + actual posted outgoing bank statement. Mismatched amount, beneficiary fingerprint, hashed bank reference, bank status/direction, actor or posting date must fail. Reusing a claimed bank reference must fail.
- **No bank API is wired yet**. Even a dry-run `candidate_for_independent_finance_attestation` is not proof of money sent or received. Any actual refund requires verified provider-origin data, anti-replay transaction, separate final finance confirmation and explicit Production authorization.

Native Mac run:
```bash
npm run test:hybrid-adjustment-ui
npm run test:hybrid-refund-reconciliation
npm run test:hybrid-billing
npm run test:react-parity
npm run build:react
```

## 24 October 2026 — Refund evidence candidate cross-tenant replay UAT

- Read `docs/HYBRID_PHASE10_REFUND_CANDIDATE_20261024.md` and run
  `npm run test:hybrid-refund-candidate`,
  `npm run test:firebase-hybrid-emulator`,
  `npm run test:hybrid-billing` and `npm run build:react`.
- The new real Emulator test submits two different shops' synthetic refund
  reconciliations with the **same bank reference hash simultaneously**. Exactly
  one private Admin transaction must create the candidate+claim; the other
  must fail. Both shops' PAID invoices and access state remain unchanged.
- Browser owner/admin/cashier/other shop/Super Admin cannot read global claims
  or forge `settlementConfirmed:true`. Only active Super Admin may read a
  candidate, which must still say `awaiting_independent_bank_attestation`
  and `settlementConfirmed:false`.
- This is **NOT confirmation of a real refund**. No bank importer, final
  settlement writer or Production callable exists. The user must approve
  any future release explicitly.


## 24 October 2026 — Refund instruction collision and pending-only UI

- Under isolated `demo-penguin-hybrid` Emulator, request a synthetic refund
  candidate using one instruction ID and bank reference. Another candidate
  (same tenant OR another tenant) using the same instruction ID but an alternate
  bank reference **must** fail atomically. Another with same bank reference
  but alternate instruction ID must also fail.
- All Browser roles, including active Super Admin, must receive permission
  denied on GET/LIST/SET for `hybridRefundReferenceClaims` and
  `hybridRefundInstructionClaims`.
- Super Admin `/react/platform/hybrid-invoices` shows an additional
  **Unverified refund evidence** read-only table. Confirm a date-containing
  invoice ID is not masked, notes still redact account numbers, and
  `settlementConfirmed:true` injected into demo candidate source NEVER
  appears as a completed payout. Switching store or refreshing discards stale
  pages. Rapid Load More clicks do not duplicate rows.
- Native tests after pulling safely:
  `npm run test:hybrid-refund-candidate`,
  `npm run test:hybrid-refund-ui`,
  `npm run test:hybrid-billing`,
  `npm run test:firebase-hybrid-emulator`,
  `npm run test:react-parity`,
  `npm run build:react`.
- Historical/cross-channel reconciliation and real bank import are REQUIRED
  before any Production settlement or release. A demo claim is only an
  unverified candidate, NEVER evidence of completed refund.

## 24 October 2026 — Read-only historical bank coverage check

1. Run `npm run test:hybrid-refund-history` and `npm run test:firebase-hybrid-emulator` on the latest feature branch.
2. The audit must scan bounded collections (incoming slip claims, wallet topups, revenue share, hybrid invoices, outgoing refund candidate/reference/instruction claims, internal Wallet transactions), report only aggregate counts and issue codes, and NEVER leak raw payment refs.
3. Missing bank-reference or instruction claim, orphaned claim, forged candidate `settlementConfirmed:true`, cross-tenant candidate and scan overflow must not authorize settlement.
4. An empty Emulator and a fully matched synthetic candidate index must both say `releaseReady:false` and `historicalBankCoverageVerified:false`. The audit is non-atomic across independent collection queries, and no bank/provider records are fetched.
5. Real external bank statement provenance, old refunds across providers, separate Wallet credit flows, final finance approval and settlement idempotency are still required before releasing any Production flags.

## 24 October 2026 — 12-source finance integrity and reserve reconciliation UAT

- Run `npm run test:hybrid-refund-history` and the real
  `npm run test:firebase-hybrid-emulator` after pulling latest feature branch.
- Historical audit should now report `sourcesScanned.length === 12`,
  `settlementAllowed === false`, and an array of sanitized
  `integrityIssueCodes`; never return original bank/reference IDs or user IDs.
- An existing `approved` refund Adjustment without
  `hybridBillingAdjustmentBalances/{invoiceId}`, or with an incorrect
  `reservedCents`/`count`, must report
  `ADJUSTMENT_RESERVED_BALANCE_MISMATCH`.
- A Candidate without the corresponding PAID Invoice, independent review
  event or three different finance actors must be flagged; orphaned Review
  Events and reserved Balance docs also create blockers.
- The audit is a read-only non-atomic historical DIAGNOSTIC. Even when
  `integrityIssueCodes` is empty, unknown external bank/legacy payouts
  prevent final settlement. No credentials, real bank calls, automatic
  repair, Wallet changes, tenant access changes or Production release.


## 24 October 2026 — Sanitized finance exception worklist UAT

1. Run `npm run test:hybrid-finance-worklist` on the Mac. A forged
   `settlementAllowed:true`, malformed source counts, duplicate/unrecognized
   codes or wrong project must fail closed.
2. Start the isolated Firestore Emulator and run the CLI as documented in
   `docs/HYBRID_PHASE10_FINANCE_HISTORY_AUDIT_20261024.md`. It should output
   Thai action items and *no* invoice/bank/tenant/user identity.
3. Even an empty sandbox database prints the four unconditional finance
   review blockers. The CLI returns exit code 2 intentionally, and its
   `releaseReady` and `settlementAllowed` fields remain false.
4. Verify the `--format=json` output stays valid JSON when generated with
   the direct Node command (not a verbose `npm run` wrapper). Do not include
   stderr, stack traces or Firebase credentials in the exported finance
   worklist.
5. `npm run test:firebase-hybrid-emulator` checks that missing reserved
   balances become sanitized Worklist exception codes rather than settlement.
6. This remains a demo-only triage feature; authenticated bank statements,
   historical/legacy payout manifests, separate Final Settlement approval,
   Slip2Go and App Check UAT are still required.

## 24 October 2026 — Review Packet UAT (no bank/payment writes)

- Run `npm run test:hybrid-finance-packet`, `npm run test:hybrid-billing`
  and `npm run test:firebase-hybrid-emulator` after safe fast-forward pull.
- Generate the redacted `--format=packet` with local
  `demo-penguin-hybrid` Firestore. Exporter exits 2 as **expected**.
- Run `node tools/verify-hybrid-finance-packet.mjs file.json`: checksum
  consistency only; verifier also exits 2, never reports bank payment confirmed.
- Edit one item amount, UTC time, blocker or action text: offline verification
  must refuse the packet. Trying to set `settlementAllowed:true` or
  `digitallySigned:true` must fail even after recomputing checksum.
- This is not a digital signature. Protect a baseline checksum independently;
  never treat an unsigned report as authoritative bank data.
- No main merge, release gate, bank transfer, wallet modification or Firebase
  Production deploy.

## 24 October 2026 — Signed bank posting verification acceptance

- Run `npm run test:hybrid-bank-evidence` with Node 22 on the latest feature
  branch; it uses test-generated Ed25519 keys (never committed to the repo).
- A changed bank reference, instruction, recipient, amount, tenant, original
  invoice, transfer timestamp or signed payload must be rejected. Wrong
  provider or revoked/unknown key, RSA public key and attempted unsigned
  `settlementAllowed:true` must fail.
- A correct synthetic Ed25519 signature may report
  `signatureCryptographicallyValid:true`, but MUST keep
  `realBankStatementSourceIntegrated:false`,
  `bankProviderIdentityIndependentlyAuthenticated:false`,
  `settlementAllowed:false`, `writesPerformed:false`.
- No live bank connection/credentials or Production bank enrolment exists.
  Do not treat the existing synthetic source label as trusted provenance.
  Bank onboarding, historical reconciliation and independent finance
  release are unresolved prerequisites.
