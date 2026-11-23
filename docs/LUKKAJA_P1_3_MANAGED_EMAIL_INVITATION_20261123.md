# P1.3d — Managed Account Email Verification and Invitation

**Development date:** 2026-11-23 (Asia/Bangkok)
**Target:** `Natchanon45/food-order-app` / `feature/react-firebase-port`.
**Source of JSX, strictly read-only:** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe@8b108f1`.
**Status:** Local Firebase provider path, React browser UX and Auth/Firestore/Storage Emulator tests implemented. **Live invitation delivery, real provider email template/domain validation, cross-service Cloud Functions audit and signed-in staging/Production UAT OPEN.** No Production deployment, no real external email.

## Purpose and change boundary

P1.3b creates Staff identities and P1.3c attaches Owner identities safely using deterministic native Firebase Auth UIDs. Those accounts were initially `emailVerified:false`, but could proceed directly to restaurant screens after knowing the password. The existing public self-signup flow already used Firebase email verification. This module adds **opt-in** first-login verification for newly Superadmin/Owner-provisioned identities without revoking legacy accounts or modifying old Tenant billing.

No SMTP service, API key, webhook, live inbox address, secret one-time action code, bank field or paid status is imported from LUKKAJA. The platform uses Firebase Authentication SDK's own verification and password-reset templates, **only upon an explicit recipient or authorized operator UI click**. An SDK acknowledgement is only proof that the provider accepted a request, never that a human received, opened or verified the message.

## New account lifecycle (6 pseudocode steps)

1. A privileged Owner/Staff create Callable completes its existing UUID/Auth/Firestore receipt. The new `users/{uid}` profile has `emailVerificationRequired:true`; one-call new Tenant+Owner provisioning also adds the marker. The underlying native Auth account remains `emailVerified:false`; no invitation or verification email is automatically sent.
2. A Superadmin on Platform Owners, or an Owner on Admin Users, can explicitly select **ส่งคำเชิญตั้งรหัสผ่าน** only for an existing canonical account with an email and no outstanding identity operation. The client calls Firebase Auth `sendPasswordResetEmail` with same-origin `/login` return URL; no password, Action Code or reset link returns to the operator. A visible toast reports **accepted request, delivery unconfirmed**, not “mail delivered.”
3. Recipient follows the provider-managed reset action and chooses their own password. The Firebase Auth Emulator marks `emailVerified:true` once that email action is successfully redeemed; this represents proof of control of the email inbox, **not a client-controlled bypass**. The application trusts only the actual native Auth verification state and a fresh Firebase ID token. Exact Production provider behavior remains part of the authorized external UAT.
4. Login reads the current user's own Firestore profile. For `emailVerificationRequired:true` and native `emailVerified:false`, it redirects to `/verify-account` without reading protected Tenant membership or preparing POS credentials. The nested TenantProvider deliberately avoids privileged Tenant listeners until verified. Unknown legacy profiles without this marker continue their historical flow.
5. The new `/verify-account` page displays the signed-in address, **user-click** “ส่งลิงก์ยืนยันอีเมล,” “ตรวจสอบสถานะอีกครั้ง,” and logout. Only the signed-in Firebase user can request their own `sendEmailVerification` link. `reload(user)` plus `getIdToken(user,true)` are required before unlocking and routing to the role-appropriate home. The page never calls either email sender on mount.
6. Firestore Rules gate business `signedIn()` access on the native ID token claim `email_verified` for **marked** users; unverified users may still read their own `/users/{uid}` profile for the verification page. Storage Rules use the same opt-in native-email gate. Existing public storefront Tenant/menus/settings reads and unauthenticated customer pathways remain intentionally public. Staff owner-management Callables additionally inspect actual native Auth `emailVerified` for managed Owner accounts.

## Important scope distinctions

- **Private evidence vs. public storefront data:** `tenants/{tenantId}` root and some public storefront assets are readable without an account by pre-existing policy. The new rule denies managed-unverified business membership reads and protected Storage writes, not all public Tenant reads.
- **Not a full service-wide Cloud Functions certification:** Most Cloud Function entrypoints are separate native Admin SDK handlers. This module applies native Auth email verification to Staff management authority, but other privileged Callables have not all been proven to inspect `email_verified`. This is a **release-blocking cross-service authorization audit**. Do not describe this change as universal protected-API enforcement.
- **No automatic password email:** Owner/Staff creation still initially accepts the operator-supplied setup password per P1.3b/c Source-shaped UI. An explicit Firebase password-reset invitation lets the recipient set a private new password. Until live provider delivery works, first-login onboarding cannot be considered end-to-end proven.
- **No live provider results:** The only emails generated in this module are isolated Firebase Authentication Emulator out-of-band action codes, consumed by tests. No SMTP send, webhook, real mailbox delivery or authorized domain/template validation was attempted against Production.
- **Never backdate membership:** Email verification and password reset affect native Auth state only. They do not alter Tenant firstActivatedAt, trialStartsAt/trialEndsAt, subscription expiry, existing bills, outstanding balances, revenue-share or Stripe claims.
- **Release coordination:** The new profile flag + Firestore/Storage Rules gate and React route must be released **together** with Functions and the `public/verify-account/index.html` Hosting entrypoint. Releasing Rules first can lock out newly provisioned accounts. Do not deploy a new Callable set against an old Browser bundle that still uses unversioned Owner commands.

## Evidence matrix

| Scenario | Current evidence |
| --- | --- |
| Managed first sign-in cannot read protected Tenant membership; own profile readable | Auth + Firestore Emulator PASS |
| Managed Owner/staff can only access protected membership after native verification and ID token refresh | Auth + Firestore Emulator PASS |
| Legacy account without marker can continue before verification | Auth + Firestore Emulator PASS |
| User-click verification generates exact Firebase `VERIFY_EMAIL` action; action code applied and native Auth verified | Auth Emulator PASS |
| Operator-click invitation generates Firebase `PASSWORD_RESET` action with no automatic send on creation | Auth Emulator PASS |
| Recipient completes Firebase reset and signs in with new password; Emulator sets native emailVerified after valid OOB redemption, fresh token permits protected read | Auth Emulator PASS |
| Managed unverified Owner cannot upload protected menu-image; verified account can | Auth + Firestore + Storage Emulator PASS |
| Existing P1 onboarding/Owner/Staff regression remains intact | Combined Firebase Emulator 31/31 PASS |
| Managed email verification React UI (320, 390, 768, 1440), no on-mount send | Node + Chrome 3/3 PASS |
| Owner/Staff React list invitation buttons only send on deliberate operator click, lost-response recovery remains intact | Node + Chrome 2/2 PASS |
| Full-project React Parity and Vite Build contract | PASS; generated Hosting build contract 2026.11.09.535, build-only assets discarded |
| Real inbox delivery, domain allowlist, email action link, locale/template and SPF/DKIM, Firebase provider quotas | **NOT TESTED** |
| Authenticated staging/Production Superadmin + Owner + Staff browser and provider UAT | **NOT PERFORMED** |
| All native Cloud Functions paths enforce the new managed-unverified restriction | **NOT CERTIFIED** |
| Firebase Functions, Firestore Rules, Storage Rules, Hosting Production deploy / merge main | **NOT PERFORMED** |

## External provider UAT checklist (required before release)

1. On an approved nonproduction Firebase project, verify `/login` and `/verify-account` domains are authorized in Firebase Auth and Hosting rewrites/static entrypoints resolve without a 404 on desktop and iOS Safari.
2. Inspect verification and password-reset email templates in the actual Firebase Auth project and confirm sender, localization, deliverability, SPF/DKIM alignment and rate-limit policy. Use only approved QA mailboxes; do not send to real users without authorization.
3. As Superadmin, create one pristine Tenant/Owner and explicitly invite its address. Follow actual email reset link, log in with the new password, prove private Tenant reads/actions blocked before email verification; request verification, open link, force-refresh token and prove the correct permitted role home.
4. As Owner, create an Admin/Cashier/Kitchen staff account and explicitly invite it; verify independent permissions, active/suspended access and role/scope separation. Confirm no duplicate Auth UID, no invitation on creation/reload, and no bank/financial mutations.
5. Validate old accounts without `emailVerificationRequired` retain access, and public delivery/takeaway/customer contexts remain unaffected.
6. **Audit native Cloud Functions separately** for paths still trusting only role/UID/tenant without the managed email flag and add a verified-email server gate where appropriate before claiming a fully enforced production rollout.

## Next step and release status

**P1.3d implementation complete locally and in Auth/Firestore/Storage Emulator; P1.3 remains NOT production-signed-off.** The next task is staging-provider configuration, Cloud Functions-wide authorization audit and actual signed-browser UAT; only after explicit approval should a synchronized Firebase Functions + Firestore Rules + Storage Rules + React Hosting release be planned. No live mail, Production deploy or `main` merge was authorized here.
