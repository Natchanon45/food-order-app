# LK Shop native Flutter → PENGUIN Firebase — one-module acceptance

Date: 2026-11-23. Target:
`Natchanon45/food-order-app`, `feature/react-firebase-port`.
Reference Source read-only: `cosmatch/lukkhaja`,
`feature/lukkaja_bankalert_stripe@e60858c1`.

## Outcome: complete code port and local compatibility/UAT suite

This was handled as **one integrated module**, not piecemeal review:
Flutter Source package port, target-specific Android/iOS application IDs,
Firebase REST/QR compatibility, native secure credential storage,
notification permissions, token refresh, foreground/background/cold-start
push navigation, browser role/link checks, Firestore chronological cursor
contract, real Android debug compile, Dart tests and Firebase Emulator.

The complete Target app is in `apps/lk-shop`. Source remains untouched.
This module does **not** make Source APK interchangeable with PENGUIN.

### Native identity and environment

| Item | Target value |
|---|---|
| Flutter package | `lk_shop` |
| Android applicationId | `com.natchanon45.penguin.lkshop` |
| iOS bundleId | `com.natchanon45.penguin.lkShop` |
| App Version/Build | `1.0.0+1` |
| Official QR/REST/role-link origin | `https://penguin-food.web.app` |
| Source original host (denied) | `https://www.lukkaja.com` |
| Firebase project | `chat-45754` |
| Firebase pilot runtime gate | OFF by default |
| Live FCM runtime gate | OFF by default |

The code explicitly requires a *new native Firebase app registration*
matching each native bundle ID. No Source native configuration, private
GoogleService files, APNs credentials or signing keys have been copied or
committed. Firebase init is opt-in via native platform-specific
`LK_FIREBASE_*` Dart defines; absent config, no fake push readiness.
Device-scoped inbox polling can still operate after explicitly authorized
backend UAT activation.

### User-visible flow

1. Web Owner/Admin picks exactly one of Admin/Cashier/Kitchen, or
   Superadmin generates central finance room QR.
2. QR contains `lkshop://pair?v=1&server=...` and a random 64-hex
   code; scanned natively or entered manually. Both are validated
   against **PENGUIN** host. QR expires in 5 minutes or after use.
3. Native client posts `code/name/platform/fcmToken`, never a
   tenant or requested role. Server atomically authorizes issuer,
   one-time claim, tenant and slot count. New bearer goes only
   into native secure storage. No Firebase/Go credentials in the QR.
4. The native client fetches a role-private inbox using bearer,
   displays notifications, supports search, detail view and native
   settings, and opens only its own role-specific PENGUIN page.
5. FCM (when separately configured and runtime-enabled) sends only
   generic notifications + **per-device monotonic sequence**.
   Foreground, resumed or cold-start taps fetch the actual
   item from the device's own inbox before showing detail.
6. Owner/Admin/Superadmin can revoke from web. Native self-unpair
   clears secure credentials. Reusing an old bearer yields HTTP 401
   and resets the local paired state on refresh.

### Important backend bug fixed in this combined module

The earlier Firebase implementation used the first 12 hex characters
of an event hash as the native numeric notification ID. That number
is **randomly ordered** and could make the old Flutter persisted
max-ID cursor silently miss later messages. This module replaced it
with `lastNoticeSequence` per device. The server writes the next
sequence and creates the notice **in a single Firestore transaction**
and reads the inbox ordered by descending `sequence`. Push
`data.eventId` is the same sequence, so the native app can match
it without exposing bank data or direct URLs.

This is an additive contract correction for the UAT-gated, not
deployed backend. It does not change payments, order status,
Telegram, wallet, receipts, service credit or tenant access.

### Tests and evidence

- `cd apps/lk-shop && flutter pub get && flutter analyze && flutter test`.
- Dart native MockClient exercises entire pair/status/inbox/
  push-token/unpair flow, SecureStorage restore and cleanup, 410
  expired code, 401 revoked device, role spoofing and URL
  allowlist. Original Source widget, notification and QR
  tests are carried over and adapted to PENGUIN.
- `flutter build apk --debug` compiles an Android UAT binary
  on the Mac mini with new applicationId, no production
  Firebase config. It is **not** a verified FCM APK and not
  offered publicly.
- `npm run test:lk-shop-native`: native repo/config/role
  agreement and monotonic notification contract.
- `npm run test:lk-shop-firebase`: Browser at
  320/390/768/1440 and web QR/role/disabled app tests.
- Firestore Emulator: one-time QR, issuer/cross-tenant scope,
  8 concurrent redemptions, 10-device room limit, device
  revoke, FCM token uniqueness, global Superadmin inbox,
  sequential device notice ID, client Rules denial.
- Repeat cross-module React Parity, Callable contract and build.

### Unresolved external acceptance blockers — do not claim Production ready

1. An authorized Firebase project administrator must register
   both **new** Android/iOS bundle IDs and provide their respective
   native Firebase App ID, sender ID and API key in ignored
   `firebase-app-defines.json`, without reusing Source
   `com.lukkaja.lk_shop` configuration.
2. iOS APNs credentials/entitlements and App Store signing
   require authorized Apple team. Google Play signing and
   release identity are also out of scope until provisioned.
3. Test push to *physical devices*, foreground/background/
   terminated and revoke/token-rotation, plus iOS permission
   and real-device deep-link browser integration.
4. The Firebase Functions + Hosting + Rules deployment and
   `PENGUIN_LK_SHOP_PILOT_ENABLED=1` /
   `PENGUIN_LK_SHOP_FCM_ENABLED=1` require explicit
   user approval. **Neither gate was changed; no deployment**.
5. Do not offer the debug APK, source APK or an IPA as a
   verified production release without the above acceptance.

The existing public download card remains disabled and truthful
until those external UAT prerequisites are satisfied.

## Verified local acceptance results (single-module run)

| Check | Result |
|---|---|
| Flutter analyzer, SDK 3.47.7 | **PASS, no issues** |
| Flutter Native widget, pairing, secure-restoration and MockClient security tests | **24/24 PASS** |
| Android `flutter build apk --debug` with distinct PENGUIN applicationId | **COMPILED — local debug artifact only** |
| iOS `flutter build ios --simulator` with distinct PENGUIN bundle ID | **COMPILED — simulator Runner.app only** |
| New native-to-Firebase source contract tests | **5/5 PASS** |
| Browser LK Shop role room, QR and mobile widths | **8/8 PASS** |
| Firestore Emulator including LK Shop and previous payment/Telegram/POS adjacent suites | **88/88 PASS** |
| `npm run test:react-parity` full regression | **PASS** |
| Callable link contract | **114 referenced, zero missing Functions exports** |
| React generated Build contract | **PASS** |
| Native registration/FCM/APNs push on a physical phone | **BLOCKED by unprovisioned native Firebase/Apple registration** |
| Firebase Production deployment | **NOT ATTEMPTED** |

The Android debug APK and iOS simulator app were compiled locally
on the Mac mini, not uploaded or published. No Production release
APK, IPA or public download was created.
