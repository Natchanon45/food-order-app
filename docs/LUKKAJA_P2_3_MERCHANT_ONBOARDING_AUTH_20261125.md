# P2.3 — Merchant Registration / Firebase Owner Activation / Login role parity

**Date:** 2026-11-25 (Asia/Bangkok)
**Source (read-only):** cosmatch/lukkhaja branch feature/react-golang-vite-tailwind-axios @ 7bf9d15934f387cd887b46d1b17ca1f2924ffab0.
**Target:** Natchanon45/food-order-app branch feature/react-firebase-port; baseline P2.2 f8cfb7a8a72a2bd164cb7a502006e3e95103dd9a.
**Boundary:** P2.3 **one complete Merchant Onboarding/Auth module locally**. This does **not** mean all P2 Merchant/Sales Report modules, external mail providers, or Production deployment are completed.

## Source comparison and important differences

Source RegisterPage 554 lines uses a Laravel email-verification signup UUID with an automatic activation on server-verified return, interactive business, billing, subscription period, revenue-share scope and MerchantServiceTerms. Source LoginPage 266 lines uses the canonical Laravel role matrix for `next` redirects. Target RegisterPage and LoginPage already use Firebase Auth, Firestore and Callables with strict Premium Subscription only. The target MUST NOT copy any Laravel signup UUID or mark `verified=1` as proof; a native Firebase Auth verified email and trusted activation are required.

The Source offers `revenue_share` signup, while the current Firebase `requestTrialTenantSignup` explicitly rejects billingMode other than `subscription`. **P2.3 leaves the unsupported selection disabled/absent in the UI** and preserves monthly/yearly Premium. Any new revenue-share enrollment needs a separately approved Firebase financial contract, not silently relabeling a subscription.

Source merchant terms claim a calendar-month first trial; the current Firebase activation is a **30-day trial**. The PENGUIN disclosure remains faithful to the currently enforced Firebase 30-day rule, while showing confirmed monthly/yearly and dynamic slip-verification quota from central pricing. Source-only provider or automatic settlement claims are NOT added.

## Completed action families (11)

1. The existing RegisterPage business choices (restaurant/café, Retail POS, both) and monthly/yearly Premium UI are preserved, without adding a duplicate route or project. Source MerchantServiceTerms component + responsive CSS now appears before registration fields.
2. Registration **requires authoritative `getPublicSubscriptionPricing`** (`ok:true`, config) before allowing signup. A client-side pricing fallback remains explanatory only and must not be accepted as a confirmed quote.
3. The Auth account is created/signed in through native Firebase; the Firestore signup request is then **atomically reserved before emailing**. Rejected/duplicate Store slugs never trigger an email claiming a valid reservation. No real outbound email in local QA.
4. An Owner can correct their pending slug: the previous **same-uid, pending-only reservation is released in the same Firestore transaction** as the replacement. Other uid, active or missing old reservations are never deleted.
5. Public Signup refuses an existing Owner/Staff profile **even if inactive/suspended**, preventing public re-enrollment to bypass store suspension, revoked roles or billing.
6. Signup is bound to Firebase signed `uid` and exact Auth email; forged email, retired hybrid mode and unsupported revenue-share are denied by Callable. Canonical price snapshot and Owner/shop fields still come from server.
7. Activation requires **Firebase Admin Auth `emailVerified`**, checks pending email equals current verified Auth email, current unchanged pending slug and the exact **same-uid pending slug reservation inside a transaction**; missing, changed or already provisioned profiles fail closed.
8. Successful activation creates exactly one Tenant, Owner profile, membership, Store/POS/subscription settings and a 30-day Trial starting at activation. Calling activation again after success returns the original Tenant/trial; no second shop or trial cycle.
9. On the email verification return `?verify=1`, the client does not trust the query flag. It reloads Firebase Auth, obtains a fresh verified ID token and calls canonical server activation **once** per user, then navigates to Login.
10. Verification links opened on a different browser get a native Firebase **pending account sign-in form** on the registration verification panel; normal Staff Login cannot resume a pending Owner without a staff profile. After native email verification, the same server activation resumes safely.
11. Login `next` is checked against the **latest Source role matrix** and actual mounted PENGUIN routes. Owner-only `/admin/users`, Superadmin-only Platform, Cashier/Kitchen and retail POS stay separated. Explicit `businessUnits:[]` denies business navigation. Unknown protected targets, invalid paths and `//` redirects are denied; page and Firestore guards remain authoritative.

## Pseudocode (8)

    PRICE:
      call getPublicSubscriptionPricing(); require ok:true + config
      if unavailable, show informative fallback, block Register submission
      display pricing/terms/quota only from confirmed central config

    REQUEST:
      validate business type, Premium subscription, selected cycle and fields
      establish signed native Firebase user, email must match request payload
      transaction: read Tenant slug, pending claim, own pending and user profile
      reject duplicate registered slug or existing staff even when suspended
      release old same-uid pending slug when editing a pending request
      write pending form and current pending slug in ONE transaction
      only after successful request, send email-verification link
      on email delivery failure, keep pending reservation and offer Resend

    VERIFY RETURN:
      ?verify=1 is a UI hint, never email verification proof
      native Auth user must exist and reload with emailVerified=true
      refresh Firebase ID token to carry the current signed verified claim
      once per signed uid, invoke activateTrialTenantSignup
      on success navigate to canonical /login?tenant=<slug>
      on error keep recovery UI, never announce an active Tenant

    CROSS BROWSER:
      if link opened without native Auth session, render Pending Signup sign-in
      signInWithEmailAndPassword directly into original pending Auth identity
      reload / check verified; existing return handler calls server activation
      never grant Admin/Owner rights from local query or stored slug

    ACTIVATE:
      Firebase Admin Auth must assert emailVerified
      fetch pending own uid, require same actual verified Auth email
      if already active, return existing Tenant and immutable trial end
      transaction: re-read current pending, user role, slug registry, reservation
      reject altered email/slug, missing or foreign reservation, pre-existing staff
      atomically create Tenant/Owner/membership/settings/activation metadata
      do not create second Trial or change a previously billed Tenant

    LOGIN:
      authenticate Firebase Staff, require active profile, managed email verified
      require Tenant and subscription guard for all non-Superadmin roles
      normalize ?next URL from same origin and actual app route list
      check Source role allowlist AND explicit authorized business units
      otherwise route to role-safe fallback, not a protected arbitrary path

    FAILURE/RETRY:
      no confirmation of pricing/email/activation => show explicit error
      lost response may be inspected by reloading, not blind duplicate tenant
      expired/suspended Staff cannot use public signup for a fresh Tenant
      existing native Firebase Auth user may remain after rejected slug:
        do not delete or silently reassign it; same email can retry signup

    RELEASE:
      isolated demo Auth/Firestore + mocked UI Chrome only
      no real email, provider webhooks, production Firebase, main merge, APK/IPA
      release needs authorized Staging QA inbox, emails, OAuth and rollback plan

## Acceptance scenarios (18)

1. Anonymous signup rejected; wrong signed email rejected.
2. Hybrid and unsupported revenue-share signup rejected.
3. Owner reserves a unique slug; competitor cannot steal it.
4. Owner changes pending slug; old same-owner pending claim is freed atomically.
5. Freed old slug is available to a different legitimate applicant.
6. Non-verified Firebase Auth cannot activate a store.
7. Verified Owner gets one Tenant, Owner membership, correct business unit and 30-day trial.
8. Repeated activation returns identical Tenant ID and immutable trial expiry.
9. Existing active Staff cannot create a second Tenant by public registration.
10. Revoked/inactive Staff cannot bypass suspension by new public registration.
11. Email changed after pending reservation cannot activate stale signup.
12. Missing or fraudulent slug reservation cannot activate.
13. Owner can navigate to /admin/users; Admin/Cashier cannot.
14. Superadmin can navigate Platform, but does not gain arbitrary Store-page access.
15. Revoked/empty businessUnits cannot target any business module.
16. Login rejects arbitrary/unknown protected pages and // external paths.
17. Remote pricing and registration succeed with reserve-before-email order; stale fallback blocks submission.
18. Native verified return auto-activates; unverified return does not; cross-browser pending login resumes without creating a second request.

## QA receipts / limitations

- `npm run test:p23-merchant-onboarding`: **5/5 PASS** — Source roles, guarded signup, email sequencing, recovery and dynamic pricing terms.
- `npm run test:p23-merchant-onboarding-local`: **EXIT 0** — **6/6** Auth+Firestore Emulator Callables and **2/2** real Chrome render tests (14 login role/redirect cases; Registration across 320/390/768/1440 plus fallback/verified/unverified/cross-browser scenarios). Browser uses an intentionally **mocked Firebase Auth/Callable service** to exercise UI handlers, while canonical Admin Auth/Firestore transactions execute independently on an isolated demo Emulator. This is **not live Staging provider mail or a single signed end-to-end deployed browser run**.
- Existing `npm run test:signup-billing-revenue-share`: **18/18 PASS** after updating one static stale variable-name assertion to the new transaction-local previous pending object.
- `npm run test:react-parity` **complete serial suite PASS, EXIT 0** after this module was added to the project test chain, including previous P1.3–P2.2 and billing/security regressions.
- `npm run test:p13-local-browser-uat` **EXIT 0, 1/1 PASS**: full React app with native signed Auth+Firestore Emulator for Superadmin/Owner/Cashier verification and tenant billing invariants. This is a separate existing signed-emulator regression, NOT a claim that P2.3 Chrome fixtures made actual provider calls.
- `npm run build:react` + generated Hosting Contract **PASS, EXIT 0**, version `2026.11.09.535`, bundle `/react/assets/index-a2pD0bUz.js`. Generated-only `public/**` assets restored/deleted.
- `node --check functions/public-signup.js`, `git diff --check` PASS. `.p23-merchant-local-emulator.json` removed; no live email, Production, provider network request, Source changes, or main merge.
- Production Staging provider email, real Inbox verification link, Google OAuth, device providers and Production deployment NOT performed. P1.3 Staging UAT gate remains open.
