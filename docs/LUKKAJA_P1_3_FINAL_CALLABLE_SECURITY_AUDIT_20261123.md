# P1.3 Final Security Audit — Firebase Callable Email Verification Gate

**Audit date:** 2026-11-23 (Asia/Bangkok)
**Destination repository:** `Natchanon45/food-order-app` / `feature/react-firebase-port`; baseline `b87a944df7cac0814138edbb912afb7807506e4d`.
**Source:** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe@8b108f1278b7c59bd44c02133d659b8e6cd6fd3f` READ ONLY.
**Stage:** **Local static audit + Firebase Auth/Firestore/Storage Emulator + full React regression ACCEPTED. Staging/Production signed UAT and live email are NOT executed or certified.**

## Finding and security boundary

P1.3d added an opt-in Firestore/Storage guard for new Owner/Staff users `emailVerificationRequired:true`. This alone does **not** protect Cloud Functions, because the Firebase Admin SDK bypasses client Security Rules. Source inspection found **144 `onCall` definitions in 45 Function modules**, each previously able to enter its own handler without a common native Firebase email-verification preflight.

This module introduces `functions/managed-email-callable.js` and routes the HTTPS Callable import through that wrapper in **all 45 modules**, including mixed `onRequest`/Callable modules. The wrapper calls `assertManagedEmailVerified(request)` **before** the original handler; it preserves the original Firebase Functions v2 `onCall(options,handler)` implementation, region, memory, secrets, timeout and `.run()` test interface. The native `onRequest` export is forwarded unchanged.

### Decision matrix

| Caller / provider evidence | Outcome before original Callable | Notes |
| --- | --- | --- |
| Unauthenticated / no `request.auth.uid` | Continue to original handler | Public functions keep their individual policy; protected ones still reject authentication failures |
| Native verified Firebase Auth ID token `email_verified:true` | Continue to original handler | Token is validated by Firebase Callable transport. This does **not** replace tenant/role/active checks |
| Unverified ID token + canonical `users/{uid}.emailVerificationRequired:true` | `permission-denied: MANAGED_EMAIL_VERIFICATION_REQUIRED` | No business-handler reads, invoices, bank checks, provisioning or writes may occur |
| Unverified ID token + legacy profile without opt-in marker | Continue to original handler | Avoid locking out existing shops during migration |
| Unverified ID token + no `users/{uid}` document | Continue to original handler | Public signup can operate before its profile exists; downstream Auth checks remain |
| Canonical Firestore profile lookup times out or fails | `unavailable: MANAGED_EMAIL_VERIFICATION_CHECK_UNAVAILABLE` | Fail closed; never assume user was legacy |
| Anonymous storefront / Google customer separate session | Existing original flow | No managed Owner/Staff profile marker is assumed for an anonymous or customer context |

**Performance:** Verified Firebase ID tokens bypass the additional Firestore read. Unverified signed callers incur one canonical `users/{uid}` lookup before their Callable. There is deliberately no client-controlled cache of the verification marker. Quota/latency under real load remain a staging criterion.

### Pseudocode — common pre-handler guard

```text
onCall(options, originalHandler):
  wrapped(request):
    uid = request.auth?.uid
    if uid is absent: return originalHandler(request)
    if request.auth.token.email_verified === true:
      return originalHandler(request)

    profile = await AdminFirestore.get("users/" + uid)
    if profile read failed:
      reject unavailable, WITHOUT running handler
    if profile.emailVerificationRequired === true:
      reject permission-denied, WITHOUT running handler
    return originalHandler(request)
  return FirebaseV2.onCall(options, wrapped)
```

Admin SDK operations in the original handler are never reached for a marked, unverified user. Synthetic tests that call `.run()` must include the corresponding post-verification `token.email_verified:true` claim; live Firebase transport verifies this token cryptographically.

## Full callable inventory and integration evidence

- **Static module inventory:** 45 modules / 144 onCall declarations. A required test fails if any module with `onCall` imports unguarded `firebase-functions/v2/https` instead of the central wrapper, or the number of audited declarations changes without review.
- **Real native guard regression:** 16 representative privileged callables across 14 source modules including Staff, Retail POS, operational walk-in settlement, Revenue Share read/write, Lalamove wallet read/write, Telegram settings, platform branding, subscription pricing, Hybrid payment proof, Stripe sandbox checkout, public signup activation, tenant listing/provisioning and payment companion dashboard are all rejected for a marked unverified owner **before** their own validation and before financial mutation. Read-only comparison confirms original Tenant billing/financial snapshot remains unchanged.
- **Public/legacy verified access:** Public pricing is callable without sign-in; historical users without a marker preserve existing access. A managed user with native Firebase verification and `email_verified:true` token can enter the original handler.
- **Failure semantics:** Missing or invalid proof is not transformed into a new Auth account or a default payment state; unavailable Firestore does not silently enable new managed accounts.

### Non-Callable HTTP and trigger classification

Exactly **7 `onRequest` endpoints** are found in six source files. They cannot be treated as a Firebase ID-token Callable. Their existing independent security contracts remain unchanged:

| HTTP endpoint category | Existing authority boundary | P1.3 decision |
| --- | --- | --- |
| LK Shop device gateway (1) | Issued device credential, one-time QR/room state, issuer/tenant status | Continue existing device credential checks; verify Native FCM pairing separately |
| Android Payment Companion device status / notifications (2) | Paired device bearer and stored device/tenant status | Continue device credential checking; cannot infer a bank deposit is confirmed |
| Lalamove webhook (1) | Central API key and signed payload | Continue provider signature validation |
| Stripe Wallet Sandbox webhook (1) | Stripe signature + independent test-account event lookup | Continue Stripe TEST-only ledger checks |
| M7 Stripe TEST shadow webhook (1) | Signed Stripe event and independent provider confirmation | Continue untrusted-shadow-only proof; not live invoice paid |
| Public tax buyer lookup (1) | Public GET / CORS policy, DBD/adapter business lookup | **Separate privacy, debug/error exposure, abuse throttling and public API security review required** |

Firebase triggers (`onDocumentCreated`, `onDocumentWritten`, `onSchedule`) are background jobs, not end-user Callables, and remain outside the email-verification token gate. They must continue to enforce their own provenance and financial idempotency rules.

## Acceptance evidence (local)

| Test | Evidence |
| --- | --- |
| Global guard unit tests: verified-token fast path; opt-in denied; legacy/public; Firestore failure closed; whole-module coverage; HTTP separation | **6/6 PASS** |
| Native Auth+Firestore Emulator: blocked privileged Callable pre-handler (16 examples), public/legacy/verified path, preserved finance | **3/3 PASS** |
| **Actual signed Firebase Auth ID token via HTTPS Callable to Functions Emulator**, unverified marked Owner blocked, public/legacy and newly verified native token permitted | **1/1 PASS** (isolated `demo-penguin-hybrid` Functions + Auth + Firestore emulators; NOT staging) |
| Combined Auth+Firestore+Storage Emulator: prior P1 onboarding, Owner & Staff lifecycle, P1.3d verification/storage, plus new Callable security tests | **34/34 PASS** |
| Existing isolated financial/Lalamove regression harnesses updated to mock the new dependency, without bypassing native Emulator coverage | **51/51 PASS** |
| Whole React Parity including the new global guard suite and P1.3d Chrome/UI | **EXIT 0** |
| React Vite Build / generated Hosting contract | Refer to final release receipt in Worklog |
| Authenticated real HTTPS Callable token validation against dedicated staging Firebase project | **NOT PERFORMED** |
| Actual email delivery/authorized domain, QA inbox and signed-in Superadmin/Owner/Staff UAT | **NOT PERFORMED** |
| HTTP public tax lookup and external webhook/provider penetration or volume/security audit | **NOT CERTIFIED** |
| Production Firebase Functions/Rules/Storage/Hosting deployment or `main` merge | **NOT PERFORMED** |

## Reproducible signed HTTPS Emulator acceptance (no external service)

The dedicated test `tests/firebase-emulator/p1-managed-callable-signed-https.spec.mjs` uses the **real Firebase Client SDK**, local Auth+Firestore+Functions Emulators, and a demo project to execute `getPublicSubscriptionPricing` through HTTPS `httpsCallable`. It proves anonymous/public allowed, an unverified managed Owner denied with `functions/permission-denied`, legacy unmarked user allowed, and the very same Owner allowed after native Firebase verification plus refreshed ID token. Result **1/1 PASS**. The Functions emulator loaded the whole real Functions `index.js`; no webhook or external provider endpoint was called. All generated emulator config files were removed.

Use `firebase.hybrid-emulator.json` as a **temporary copy** in the repository root and add `functions:{source:"functions"}` plus `emulators.functions:{host:"127.0.0.1",port:5001}`; run with `--project demo-penguin-hybrid --only auth,firestore,functions`, invoking the dedicated Node test via `firebase emulators:exec`. Verify all ports are available before executing. Never point this test to a real project.

## Staging UAT — required acceptance checklist (no live work in this module)

1. Provision a dedicated **nonproduction** Firebase project with Auth, Functions, Firestore, Storage and Hosting; avoid sharing Production Firebase project credentials or real customer records.
2. Approve QA inboxes and sender templates. Configure Firebase authorized domains for `/login` and `/verify-account`. Check real email reset/verification behavior, deliverability, expiry, rate limits and DNS settings. No mail to actual shop users until approval.
3. Sign in as a newly provisioned, **unverified** Owner using a genuine Firebase client token and call representative live staging Functions: Staff creation, POS operational settlement, Wallet/Revenue Share, subscription and owner-tenant management. Require `permission-denied` **before** any Firestore/finance mutation, and ensure the browser is routed to `/verify-account`.
4. Redeem a valid verification email or password-reset action. Refresh Firebase ID token. Re-run only authorized operations. Confirm another Tenant, a suspended role and an inactive account remain forbidden by their **original** RBAC and Tenant policies.
5. Check an existing unmarked legacy Owner, a new Staff role, public self-signup, customer storefront, Retail POS and mobile Safari. Verify public routes and unauthenticated endpoints were not unintentionally converted into internal-only APIs.
6. Validate webhook signatures/retries, LK Shop one-time device pairing, BankAlert device authentication and HTTP tax lookup separately; these are independent of Firebase Callable email-verification gating.
7. Prove Billing invariants: first trial only once, original subscription dates unchanged, unpaid invoices retained, no paid status or cash/bank claims from an Auth/verification action.
8. Quantify additional Firestore lookup latency and availability for legacy `email_verified:false` sessions; evaluate email-provider rate-limit and email action domain configuration against staging only.
9. Document staging test accounts, redacted call logs, authorized signed browser screenshots, rollback plan and an explicit release approval. Never copy real secrets or password-reset codes into Git.

## Release protocol and limits

- Do not deploy Functions independently of the updated React `/verify-account` Hosting entrypoint and Firestore/Storage Rules, because the new opt-in marker is set on user creation; uncoordinated deployment could lock out new accounts.
- Firebase HTTPS Callable transport verifies ID tokens in actual operation; direct `.run()` Emulator tests use **synthetic** auth claims and therefore are not a substitute for a signed HTTPS staging browser test.
- The global email preflight is **not a replacement for business RBAC**, disabled-account checks, Tenant scoping, Stripe/Lalamove signature validation or Billing integrity. These existing checks remain responsible for their original constraints.
- Existing source LUKKAJA/Go and PENGUIN Production are untouched. No real outgoing emails, money, finance migration, APK/IPA, `main` merge, or Production deployment occur in this module.

**Status:** Local Callable pre-handler authorization gap CLOSED with full static coverage, native Admin SDK and **real signed HTTPS Functions Emulator** tests plus React regressions. **P1.3 Production signoff remains BLOCKED** on approved staging email/HTTPS/HTTP audits and signed browser UAT. The next independent feature module is P1.4 Pricing / SaaS Setup once these release gates are accepted or explicitly deferred.
