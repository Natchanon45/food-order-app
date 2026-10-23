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
