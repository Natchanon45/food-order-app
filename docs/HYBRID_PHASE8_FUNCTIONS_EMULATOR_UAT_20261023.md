# PENGUIN Hybrid Billing — Phase 8: Actual HTTPS Callable Emulator UAT

**Status: Implementation completed in feature branch; REAL FUNCTIONS EMULATOR UAT NOT YET RUN.**

Date: 2026-10-23. Branch: `feature/react-firebase-port`. The owner has confirmed the previous Phase 7 native Mac regression and React build passed. This phase does not change any deployed production functions, Firestore document, tenant Master data or stored financial balances.

## Objective

Verify authenticated request transport across the actual `firebase/functions` Web SDK, Firebase Auth Emulator, Functions Emulator, Storage Emulator and Firestore Emulator. Reuse the existing private trusted `prepareHybridInvoiceProof`, `stageHybridInvoiceProof`, and `reviewHybridInvoiceProof` implementations instead of reimplementing money transitions.

**Production remains locked:** `HYBRID_PAYMENT_CALLABLE_READY=false`, `HYBRID_PAYMENT_UI_READY=false`, `HYBRID_INVOICE_ISSUANCE_READY=false`. `functions/index.js` and `functions/bootstrap.js` do not expose any new payment Callable. The Super Admin Approve/Reject buttons remain disabled.

## Emulator architecture

The new **separate** config `firebase.hybrid-functions-emulator.json` uses:

- `functions.source = functions/emulator-hybrid` (**not** production `functions` source/main).
- `functions/emulator-hybrid/index.cjs` with two deliberately different names: `demoHybridSubmitProof` and `demoHybridReviewProof`.
- Explicit `demo-penguin-hybrid` project, `HYBRID_DEMO_FUNCTIONS_ONLY=1`, and loopback-only Auth/Firestore/Storage SDK destinations. The test entrypoint throws before Firebase Admin initialization if any guard fails.
- Functions 127.0.0.1:5001; Auth :9099; Firestore :8080; Storage :9199. No Hosting Emulator or production deploy.
- The entrypoint imports the **same private trusted business handlers** using `makeHybridPaymentHandlersForTest(..., enabled:true)`. This flag is in the test-only guarded entrypoint and does not change the hard-disabled production function definitions.
- The fake verifier deterministically returns a Slip2Go-shaped success *only for synthetic test data*. It never contacts Slip2Go, Google Vision, Lalamove or a bank, and no secrets/real bank accounts are loaded.

The test-only callable options explicitly use `enforceAppCheck:false` so the local test isolates **Firebase Auth and server authorization**. Real production definitions retain `enforceAppCheck:true`. This phase does **not** validate production App Check token issuance or App Check Enforcement in live Cloud Functions; that remains an independent release gate.

## Integration cases in `tests/firebase-emulator/hybrid-callable-transport.spec.mjs`

1. An anonymous caller is rejected; cashier, inactive store admin and another store owner cannot submit proof for the target shop.
2. Owner-supplied paid status, amount, verifier success flag, malformed invoice ID and cross-tenant Storage paths are rejected as invalid arguments.
3. Owner uploads synthetic immutable evidence through actual Storage Rules and invokes the demo HTTPS Callable using a **real Auth Emulator identity token**. The result is `pending_review`, never automatically paid. Attempt record and invoice remain unchanged in amount.
4. Owner, store Admin and anonymous users cannot approve/reject; only real Super Admin Auth role can mark a matching pending invoice `paid` once.
5. Already-paid invoices cannot receive a second payment, and repeated review cannot create another event.
6. Admin may upload/submit their own store's evidence but is forbidden to review; Super Admin can reject. The rejected invoice may accept a **different** proof, but not the original claimed evidence.
7. A global SHA-256 slip claim makes the same synthetic file unusable across another shop's Invoice, even with an independent upload.
8. Confirm tenant `active=false`, `subscriptionStatus=suspended`, and manual suspension reason remain unchanged after finance approval.

The actual Functions Emulator results are unknown until the user's Mac executes the script. Existing Phase 6 Auth/Firestore/Storage Emulator 8/8 and the Phase 7 React parity/build are independent earlier successful tests.

## Fast and demo UAT tests

```bash
set -e
cd ~/Desktop/Sites/food-order-app
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port

export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"

# Ensure installed dependencies exist. Do NOT use git reset/clean.
test -d functions/node_modules/firebase-functions || npm --prefix functions install --no-package-lock

npm run test:hybrid-functions-safety
npm run test:hybrid-payment-callables
npm run test:hybrid-functions-emulator

# Follow only after Emulator integration succeeds:
npm run test:hybrid-billing
npm run test:react-parity
npm run build:react
```

`test:hybrid-functions-emulator` performs JDK 21 preflight, demo source safety preflight and then runs:

`HYBRID_DEMO_FUNCTIONS_ONLY=1 firebase emulators:exec --project demo-penguin-hybrid --config firebase.hybrid-functions-emulator.json --only auth,firestore,storage,functions "node --test tests/firebase-emulator/hybrid-callable-transport.spec.mjs"`

Mac mini Desktop Commander was offline at the time of coding; a JS static safety harness passed **7/7** and checked both source files' JavaScript syntax, but no native Firebase CLI/Functions Emulator was invoked. If Functions emulator reports an unexpected worker environment variable or module-resolution issue, inspect the log rather than relaxing demo/prod safety guards.

## Important remaining steps

- Run real Functions Emulator, inspect each Auth denial and full submit/review transaction, and fix any verified SDK/Rules issues.
- Create test-only App Check validation (or a separate controlled staging App Check end-to-end plan) before production payment activation. The Auth-only demo does not cover App Check.
- Add real tenant payment upload UI, finance role approval audit UX, actual bank receiver configuration checks, receipts, credit notes/refunds, quota, and safe debt-only suspension/recovery workflows.
- Deploy Wallet, Revenue Share, Hybrid and global `financeSlipClaims` together in a reviewed rollout after test record inventory/cleanup; keep all tenant/menu/product/brand Master data unchanged.
- Never expose demo-only Functions on production, bypass the release gates via dynamic callable names, or enable automatic invoice issuance in this phase.


## 24 October 2026 — First Mac Functions Emulator run: startup blocked, fixed in source

The user provided the first real Mac log, synced at Git commit `d9f57258`. `npm run test:hybrid-functions-safety` passed **8/8**, JDK preflight saw Java 21, and the CLI started the demo Auth/Firestore/Storage/Functions emulators. **The Functions definition could not be analyzed** because the demo guard raised `HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS` at module import. The Firebase CLI's function-discovery stage does not reliably inject all emulator-host/project env values into the entrypoint.

The integration test process also halted at its before hook with `REFUSE_NONLOCAL_EMULATOR_FIREBASE_FUNCTIONS_EMULATOR_HOST`; its eight tests all failed without reaching the financial scenarios (**0/8**, NOT evidence that eight application workflows were wrong).

### Source fix

- `test:hybrid-functions-emulator` now supplies **before CLI discovery**: `GCLOUD_PROJECT=demo-penguin-hybrid`, `GCP_PROJECT=demo-penguin-hybrid`, `HYBRID_DEMO_FUNCTIONS_ONLY=1`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`, `FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001`.
- The test-only entrypoint now requires **all four** loopback emulator hosts and rejects any conflicting project ID across `GCLOUD_PROJECT`, `GCP_PROJECT` and `FIREBASE_CONFIG.projectId`. It still fails before loading Admin SDK/real bank code if any guard fails. There is no flag change in Production.
- The transport test's Super Admin approval/rejection payload inadvertently included `slipPath` because it reused the submit request body. This would fail the server's strict review allowlist *after the environment problem was fixed*. A `reviewData()` helper now sends **only** `tenantId`, `invoiceId`, `attemptId`, `action`, `note`, `verifiedExternally`; a negative test deliberately includes extra amount/status to prove request rejection.
- Safety suite now covers the explicit host environment, conflicting real-project IDs, malformed hosts, the actual demo guard in JavaScript, and review-body schema. **9/9 isolated checks pass**, and both new test files pass JavaScript syntax parsing. **Real Functions Emulator UAT has NOT been rerun after this fix**.

The Mac log also showed warnings for `firebase-functions` version and host Node 26 vs requested Node 22; these are not the errors that caused the observed 0/8 tests. If they become runtime blockers once definitions load, investigate separately. The emulator also warned that ADC credentials exist; keep all four services directed at localhost and never test financial functions against the real project.

### Safe Mac retest

```bash
set -e
cd ~/Desktop/Sites/food-order-app
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
npm run test:hybrid-functions-safety
npm run test:hybrid-functions-emulator
```

If and only if the actual demo transport Emulator test completes without failures, continue to `npm run test:hybrid-billing`, `npm run test:react-parity` and `npm run build:react`. Avoid all deploy and reset/clean operations. Production receipt issuance, collection, Callable exports, and shop Master data are unchanged.

## 24 October 2026 — Second Mac rerun: diagnose Firebase CLI function discovery

The user's second Mac run after commit `40a4f8b6` passed **9/9 static safety checks**, then failed again while Firebase CLI was analyzing `functions/emulator-hybrid/index.cjs` with `HYBRID_DEMO_FUNCTIONS_FORBIDDEN_OUTSIDE_LOCAL_EMULATORS` (line 27). Although the npm script explicitly supplied the demo project and all four loopback host values, the Firebase CLI's child discovery process did not pass the module's import-time guard. Thus it registered **zero** demo Callable endpoints; all 8 transport tests failed with `functions/not-found` (0/8). **No payment transaction reached the backend.** The test host process itself advanced through fixture setup, showing at least its emulator variables were present.

To safely isolate the precise missing or conflicting condition, the test-only entrypoint now computes `demoConditions` and throws the SAME fail-closed error followed by **failed condition names only**: `demoProject`, `noConflictingProject`, `explicitDemoFlag`, `localFirestore`, `localAuth`, `localStorage`, `localFunctions`. It does not print project identifiers, hostnames, environment values, secrets, or credentials. No production code, release flag, or deployed project is changed.

The Firebase documentation supports `.env.local` for emulator variables, but specifically reserves ALL environment variable names beginning with `FIREBASE_` and `GCLOUD_PROJECT`/`GCP_PROJECT`; therefore do **not** use `.env.local` to set those names. A brief unverified attempt to add such a file was reverted in GitHub before requesting another Mac run. Keep all emulator hosts in the local-only npm runner and retain the guard until its failing condition is identified.

**Current result:** Phase 8 Functions Emulator real UAT remains **0/8 due to Functions Discovery**. This is not a Billing functional failure; a further Mac run is required to see the safely redacted failed-check name.

Safe rerun:

```bash
set -e
cd ~/Desktop/Sites/food-order-app
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
npm run test:hybrid-functions-safety
npm run test:hybrid-functions-emulator
```

If the next run still fails during definition discovery, use the exact `[failed checks: ...]` phrase to correct the CLI child environment, **without bypassing the demo-only guard**. No need to run the large React suite until the real Callable transport starts and passes.
