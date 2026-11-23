# LK Shop — PENGUIN Firebase Native Client

**Code Port Module:** Flutter iOS + Android notification inbox from read-only
LUKKAJA Source `apps/lk-shop` to PENGUIN Firebase Target. This is a new,
isolated package, **NOT** the LUKKAJA native app and **NOT** the PENGUIN POS
mobile app. Android application ID is `com.natchanon45.penguin.lkshop`,
iOS bundle ID is `com.natchanon45.penguin.lkShop`.

Version: **1.0.0+1**. Native Flutter SDK: 3.47.7 / Dart 3.13.5
(verified on development Mac mini, 2026-11-23).

## Roles and capabilities

- `superadmin_slip_manual`: Platform Superadmin financial inbox
- `admin_store`: Tenant admin inbox
- `cashier_delivery`: Tenant cashier inbox
- `kitchen_delivery`: Tenant kitchen inbox

The authenticated PENGUIN web Admin/Superadmin selects exactly one room
before issuing a 256-bit single-use QR, good for five minutes.
The device **does not choose tenant or role**, only posts
`code/name/platform/fcmToken` to `/api/lk-shop/enroll`.
Server returns a one-time 256-bit bearer stored in native secure storage;
all subsequent requests check server-side revocation and read only the
assigned role inbox.

The client accepts ONLY `https://penguin-food.web.app` for release
QRs, REST, and approved role navigation. It does not accept old LUKKAJA
QR codes, redirects, external websites, forged role links or bank proof.
Debug mode may accept an explicit local emulator code with a local host;
this is disallowed from the actual release build.

Notification `id` is a **monotonic per-device sequence** assigned in
the same transaction as each notice (not the old random SHA-256 prefix).
The OS notification displays generic text, then the app retrieves its
private messages using the bearer; tapping a push can open a message
only after matching the sequence from the authenticated inbox. This
covers foreground, background and cold-start flows in app code.

### API

```
POST /api/lk-shop/enroll
GET  /api/lk-shop/device
GET  /api/lk-shop/inbox
PUT  /api/lk-shop/device/push-token
POST /api/lk-shop/device/unpair
```

All routes are served by Firebase Hosting's `/api/lk-shop/**`
rewrite. Do **not** use the old Go port 8000 or the old Source domain.

## Local tests

```bash
cd apps/lk-shop
flutter pub get
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug
```

The native debug APK compilation verifies the application can build
without production native Firebase credentials. It does **not**
demonstrate that FCM push is configured or delivered. It is **not** a
release/distribution APK. Never add that debug binary to Git or link
it as an installable production app.

## Real FCM provisioning (external prerequisite)

The repo deliberately **does not ship** Source's native
`google-services.json`, any `GoogleService-Info.plist`, keystore,
signing keys, APNs settings or native Firebase app identity. Both native
bundle IDs must be registered **separately** in Firebase project
`chat-45754` by the project owner. The old Source app registration
`com.lukkaja.lk_shop` must not be reused for this package.

After registration, fill an ignored
`apps/lk-shop/firebase-app-defines.json` from
`firebase-app-defines.example.json` with the *platform's registered*
Firebase API key, App ID and FCM sender ID (the Firebase project must
remain `chat-45754`). Build separately for each platform:

```bash
cd apps/lk-shop
flutter build apk --release \
  --dart-define-from-file=firebase-app-defines.json
# iOS APNs entitlement/capability/certificates must also be provisioned
# by the authorized Apple development team before an IPA build.
```

Firebase init fails closed if the separate native app configuration
is not supplied; polling the role-private inbox remains functional,
but it will not claim FCM readiness. Android FCM and iOS APNs actual
device delivery are not yet certified. For Play Store/App Store,
use the owner's authorized signing identities; the current debug key
configuration is for UAT **only**.

The Firebase backend gates also default to OFF:
`PENGUIN_LK_SHOP_PILOT_ENABLED` and
`PENGUIN_LK_SHOP_FCM_ENABLED`.
Neither is changed, no production deployment occurs in this module.
Native testing on real devices requires separately authorized UAT
enablement and registered native app identities.

## Acceptance status

- Copied the original Flutter UI, native icons and permitted fonts into
  a separate Target app while keeping Source read-only.
- Replaced all release host restrictions and manual QR fallback with the
  PENGUIN origin; new native package/application ID and Version/Build.
- Authenticated room inbox, secure credential storage, notification
  settings, local polling fallback, FCM token update/cold-start and
  role-safe browser links.
- Emulator validates single-use QR, scope, revocation, 10 devices,
  chronological sequences and inbox privacy.
- Native mocked HTTP + Flutter widget/unit tests pass; Android
  development APK compiles, no official release distributed.
- Remaining: externally registered native Firebase config, iOS
  APNs/entitlements, real-device FCM/URL UAT, user-approved rollout.

Read full acceptance criteria in
`docs/LUKKAJA_P1_LK_SHOP_NATIVE_FIREBASE_MODULE_20261123.md`.
