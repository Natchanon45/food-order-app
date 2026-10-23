# PENGUIN Hybrid Billing — Phase 6: Firebase Emulator Integration Tests

Date: 23 October 2026

## Scope and safety

The project's universal activation-anniversary calendar, revenue-share/Wallet payment flows, and Phase 5 shared financial proof claims remain unchanged. This phase adds **tests and local-only emulator configuration**: no production functions, rules, hosting, data or shop Master records were changed or deployed.

The Mac mini Remote Desktop Commander was **offline** during implementation, so native Firebase Emulator tests have **not been run**. The new integration test code passes a JavaScript parser check, and its no-production preflight passed 5/5 isolated checks; these are not a substitute for actual Emulator results.

## New files

- `firebase.hybrid-emulator.json`: isolated Auth/Firestore/Storage emulators bound to `127.0.0.1`, on ports 9099, 8080 and 9199. It loads the project's real `firestore.rules`, `storage.rules` and indexes; it does not start Functions or Hosting.
- `tests/firebase-emulator/hybrid-finance-security.spec.mjs`: actual Firebase Auth, Firestore client, Storage client and Firestore Admin SDK integration tests. Its project ID is hard-coded to `demo-penguin-hybrid` and it **refuses to execute** unless all 3 `*_EMULATOR_HOST` environment variables point to loopback.
- `tests/react-parity/hybrid-emulator-safety.spec.mjs`: fast offline Node test verifying the demo project, loopback hosts, disabled invoice issuance and critical security-test coverage. This preflight is included in `npm run test:hybrid-billing`.
- Package scripts: `test:hybrid-emulator-safety` and `test:firebase-hybrid-emulator`.

## Emulated scenarios

1. Seed demo shops, demo employee profiles and demo billing documents with Firestore Admin SDK, bypassing rules only for fixture setup.
2. Authenticate distinct tenant owner, tenant admin, cashier, inactive tenant admin, another store owner, and Super Admin through the Auth Emulator; retain an anonymous browser.
3. **Firestore Rules:** own store owner/admin and Super Admin may read/list invoice, period, attempt and review-event documents. Cashier, inactive admin, other-tenant user and guest must not read or list them.
4. **Firestore write denials:** all browser roles, including Super Admin, cannot forge paid status, overwrite amount, delete an issued invoice, or create forged invoice/payment-attempt documents.
5. **Global financeSlipClaims privacy:** all browsers are denied get/create/delete, including Super Admin. Bank-reference uniqueness is enforced only through Admin transactions.
6. **Storage Rules:** owner/admin can create an invoice-scoped slip; they can read it but cannot replace or delete. Another store, cashier, inactive admin and guest cannot upload a competing slip. Invalid MIME/path and oversized uploads must fail.
7. **Real Firestore Admin concurrency:** concurrent Wallet/Revenue Share/Hybrid reservations against the same shared SHA-256/transfer reference produce exactly one winner, and the rest fail without overwriting claims.
8. **Real invoice transactions:** replay does not duplicate the invoice or change a server-confirmed `paid` state.
9. **Real payment state transaction:** stage one existing invoice as `pending_review`, approve once as `paid`, reject a replay, and verify shop subscription/access state is unchanged.

No test creates an invoice, slip or authorization inside project `chat-45754`.

## Running on Mac

From the feature branch:

```bash
set -e
cd ~/Desktop/Sites/food-order-app

git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port

# Run the fast suite without Java / Firestore / Auth emulators
npm run test:hybrid-emulator-safety

# The integration runner requires a local Firebase CLI, JDK and the
# existing functions dependencies, including firebase-admin.
java -version
firebase --version
test -d functions/node_modules/firebase-admin || npm --prefix functions install --no-package-lock

# Starts only local demo Auth, Firestore and Storage, runs the test and
# automatically stops the emulators. No firebase deploy command occurs.
npm run test:firebase-hybrid-emulator

# Full regression/build only after the emulator passes
npm run test:react-parity
npm run build:react
```

**Keep the existing locally modified `public/**/index.html` files.** Do not run `git reset --hard` or `git clean -fd`. `build:react` may regenerate files under `public`; review those changes normally.

## Release gates

- This suite has **not yet passed natively on Mac**; Emulator compilation and actual permission results are unknown until that run.
- Confirm both Firestore and Storage security logs show no unexpected allows or denies. Update tests/rules only in response to confirmed failures.
- Verify all deployed Wallet and Revenue Share functions use the same `financeSlipClaims` scheme before releasing the ledger, and inventory/clean up old *test* transaction records or backfill their references; old records currently lack shared claims.
- Invoice issuance and Hybrid payment APIs are still **private and disabled**. Do not enable or deploy separately. Slip2Go bank confirmation, authenticated approval endpoints, quota, refunds/credit notes, invoicing receipts, suspension/recovery, and rollout plan remain incomplete.
- Explicit Firebase Hosting/Cloud Functions/Firestore/Storage Rules deploy is a separate future step after the owner's go-ahead.
