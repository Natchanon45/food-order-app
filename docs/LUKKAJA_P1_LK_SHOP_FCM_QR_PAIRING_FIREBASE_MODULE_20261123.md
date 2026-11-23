# P1 — LK Shop role-room QR Pairing & Firebase notification transport (2026-11-23)

**Source (read-only):** `cosmatch/lukkhaja`,
`feature/lukkaja_bankalert_stripe@e60858c1`.
**Target (only changed repository):** `Natchanon45/food-order-app`,
`feature/react-firebase-port`.
**Explicit Production deployment:** **NONE**.

This module ports the **actual server-side LK Shop pairing lifecycle and
role-room web management UI** from Go/MariaDB into Firebase Functions and
Firestore. It is **feature-gated** and not yet a production-usable native
mobile release. Existing Telegram/bank/payment notification flows were not
replaced or used to certify money. No Lalamove, kitchen admission, Stripe,
credit or invoice settlement is changed.

## Source contracts reviewed

- `resources/js/react-port/components/LKShopPairingPanel.jsx`:
  Superadmin global room, three tenant rooms, QR creation/TTL, current device
  list, safe repeat revoke, radio/QR mobile layout.
- `resources/js/react-port/components/PublicAppDownloads.jsx`:
  Android preview install and unavailable official Store listings.
- `goapi/cmd/web/lk_shop_pairing.go`: five-minute random single-use code,
  server-issued scope/purpose, 10 active devices per role room, revoke,
  bearer credential, FCM token registration, role-private inbox.
- `goapi/cmd/web/lk_shop_notifications.go`:
  scope/role-separated notification outbox, event deduplication, safe links.
- `goapi/cmd/web/lk_shop_fcm.go`: generic lockscreen title/body and
  notification `eventId`; no financial payload in push.
- `apps/lk-shop/lib/src/pairing.dart` and
  `apps/lk-shop/lib/src/lk_api.dart`: real Flutter origin restriction
  and REST endpoint names.

## Firebase storage and security

```text
lkShopPairChallenges/{SHA256(code)}
lkShopActivePairings/{SHA256(scope|tenant|purpose|issuerUid)}
lkShopRoomCounters/{scope_room}
lkShopDevices/{deviceId}/notices/{SHA256(eventId)}
lkShopDeviceKeys/{SHA256(bearerCredential)}
lkShopFcmTokenClaims/{SHA256(fcmToken)}
```

All collections, including native-device inbox, are inaccessible through
client Firestore Rules; only Admin SDK Functions may read/write. The
full random pairing code is only returned to the authenticated issuer
for a new QR, never saved in plaintext. Device credential is shown to
the enrolling native app **once**; Firestore stores only its hash.

Issuing a QR requires active Firebase Auth + server `users/{uid}`
profile: Owner/Admin can select only their **own** tenant's Admin/Cashier/
Kitchen room; Superadmin can select only global
`superadmin_slip_manual`. Tenant must be active, actor role is rechecked
inside the issuing transaction, and the payload cannot choose a tenant.
Creating a new QR replaces the previously active unredeemed capability
for the same issuer+room. All other QR codes expire after five minutes.

Enrollment `POST /api/lk-shop/enroll` uses the Go-compatible JSON fields
`code, name, platform, fcmToken`, but the Flutter app must be rebuilt to
accept the PENGUIN domain. Redemption is one atomic Firestore transaction
that checks one-time hash, expiry, active challenge, original issuer role,
tenant state, 10-device room cap, global FCM token uniqueness, and writes
private hashed device bearer+room allocation. Concurrent claims cannot
redeem the same code twice.

An active device uses its private bearer for:
```text
GET  /api/lk-shop/device
GET  /api/lk-shop/inbox
PUT  /api/lk-shop/device/push-token
POST /api/lk-shop/device/unpair
```

All are routed through the HTTPS-only (except isolated local Emulator)
Hosting rewrite `/api/lk-shop/**` to
`lkShopDeviceGateway`; calls with a browser Origin header are refused.
Device unpair or authorized Owner/Superadmin revoke clears credential/FCM,
updates slot accounting and closes subsequent access. Repeating an
authorized revoked-device action is idempotent; other-tenant IDs are
not disclosed.

## Notifications, roles and truth

Tenant order/receipt events reuse existing **server-owned**
`tenant-telegram-events` classifications, but run independently of
Telegram bot configuration. Admin/Cashier/Kitchen see only matching
role-room generic messages. Platform wallet/revenue classifications
reuse existing `platform-telegram-finance-events`, sent only to the
global Superadmin room.

In-app notifications are role-targeted, per-device, hash-key deduplicated
and returned only by the bearer endpoint. Links are generated from the
fixed PENGUIN origin and the device's server scope/role. No external
user-supplied target, bank account, private customer details, token or
free-text settlement instruction enters push. FCM is optional and
a failed provider call does not affect the business transaction.

FCM push sends a **generic** title/body and numeric `eventId` only;
the mobile app must query its own bearer-scoped inbox for details.

## Runtime rollout gates

Two independent environment variables are required:
```text
PENGUIN_LK_SHOP_PILOT_ENABLED=1
PENGUIN_LK_SHOP_FCM_ENABLED=1
```
Both **default off**. The first gates QR/Device REST/UI backend; the
second separately gates actual FCM provider calls. **This module has
not configured either variable or deployed Functions, Rules or Hosting.**
The UI clearly reports a disabled pilot rather than fabricating success.

## React pages and visual parity

- `react-app/src/pages/AdminPage.jsx` embeds the tenant room manager
  after Telegram; one default-collapsed card for Admin/Cashier/Kitchen.
- `react-app/src/pages/PlatformContactPage.jsx` embeds the
  Superadmin-only global-room manager with a collapsed section.
- `react-app/src/pages/HomePage.jsx` renders a public LK Shop app
  download information card (no fake links).
- `LKShopPairingPanel.jsx` has role cards, radio selector, single-use
  QR preview, bounded timer, clipboard fallback, device list/revoke and
  server-owned refresh. Scoped CSS adapts 320/390/768/1440 widths.
- `PublicAppDownloads.jsx` deliberately disables APK download.
  The Source file `LK-Shop-Android-UAT.apk` points at
  `www.lukkaja.com`, **not** the target PENGUIN Firebase backend.

## Tests / integration boundary

```text
tests/react-parity/p1-lk-shop-firebase-policy.spec.mjs
tests/react-parity/p1-lk-shop-pairing-browser.spec.mjs
tests/firebase-emulator/p1-lk-shop-firebase-pairing.spec.mjs
```

Checks include 256-bit one-use code, expiry, replaced QR, revoked
issuer, 8 simultaneous claims, device limit 10, cap release after
revoke, active tenant, cross-tenant and cross-role access, FCM token
claim collisions, server-originated inbox scope, repeat dedupe,
generic FCM payload, and Firestore client read+write denial.

**Not yet complete across the full original Source module:**
- Current Source Flutter app hardcodes `www.lukkaja.com` and manual
  code fallback builds that domain. It must be **ported, re-signed,
  built as a separate PENGUIN LK Shop APK and tested on Android/iOS**.
- Provider FCM sandbox/production delivery, app cold-start deep link,
  APNs/iOS permission handling and real-device push reliability
  remain **unverified**. No claim of successful device push may be
  made from Emulator/mocked FCM tests.
- Platform financial notices are currently mapped only from wallet
  and revenue-share outcomes. Complete Source event coverage for
  other payment channels/technical manual-review results remains open.
- Runtime feature gates and any production backfill require separate
  explicit UAT acceptance and permission to deploy.

No Source write, mobile APK build or Production deploy occurred.

## Local module acceptance

| Test suite | Result |
|---|---|
| `npm run test:lk-shop-firebase` — exact Source role/QR policy and Chrome browser across 320/390/768/1440 | **8/8 PASS** |
| Firestore Emulator — new LK Shop atomic QR, caps, global FCM claims, platform/tenant room isolation and browser access denial | **8/8 PASS** |
| Combined Firestore Emulator regression: M7, Hybrid Finance, Stripe TEST, Payment Companion and Telegram | **88/88 PASS** |
| `npm run test:react-parity` entire prior project and new UI route suite | **PASS** |
| `npm run test:react-callables` existing 114 dynamic/static references | **PASS, 0 missing exports** |
| React generated bundle contract and `npm run build:react` | **PASS** |
| Native Android / iOS apps pointing at PENGUIN | **NOT PORTED / NOT BUILT** |
| Real FCM delivery, APNs, background/cold-start user testing | **NOT VERIFIED** |
| Firebase Functions/Hosting/Rules production deploy | **NOT PERFORMED** |

**Acceptance decision:** close the Firebase **role-room QR issuance /
single-use device enrollment, scoped inbox and web management module**
for Emulator-tested source-control readiness only. Do not mark native
push production-ready. The legacy LUKKAJA APK cannot enroll into a
PENGUIN role-room QR without a separate Flutter application port.
