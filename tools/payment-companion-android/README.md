# LK Connect — Android pilot

A separate **Android-only** opt-in helper module inside the existing LUKKAJA repository. No extra bank API fee or Mac LINE application is required **for the Android observation path**. However, the owner's Android device must actually have LINE, SCB Connect and Notification Access enabled; if it has no incoming bank notices, this helper cannot discover transactions.

**VERY IMPORTANT:** LINE notification text (even when it appears to come from SCB Connect) is not cryptographically bank authenticated, and can be spoofed. This app stores and sends only **unverified observations**. LUKKAJA cannot mark an invoice or order paid, unlock the store, release funds, or send orders to the kitchen because of a Companion notification. Merchant review or independent bank confirmation is still necessary.

## Architecture / data minimization

1. Owner signs in to LUKKAJA local `/admin` and creates an Android pairing credential (256-bit random secret, displayed once).
2. Owner installs the native Android app, enters LUKKAJA server URL and credential, and taps **เชื่อมต่อและบันทึกรหัส**. It verifies `GET /api/companion/device/status` first, then stores the credential encrypted with an Android Keystore AES-GCM key. No plaintext token is stored on disk, and Android backup/data transfer of app secrets is disabled.
3. Owner explicitly grants **Notification Access** to the LUKKAJA app in Android Settings, then opts in with **เปิดรับและส่งแจ้งเตือนเงินเข้า**. Feature starts disabled, and the app refuses to enable when Notification Access is absent.
4. `IncomingNotificationService` inspects notifications only from package `jp.naver.line.android`, only when the notification title contains `SCB Connect` and its content matches the allowlisted **incoming** amount, masked receiver account and bank transaction timestamp. No sender name, account balance, raw LINE text, contact list, image, or complete bank account is saved or uploaded.
5. A private bounded queue holds at most 100 minimized notices and deduplicates each by a SHA-256 of local notification key, post time and parsed fields. `JobScheduler` uploads to `POST /api/companion/notifications`, using exponential backoff for network errors. An explicit `BOOT_COMPLETED` receiver requeues pending, accepted observations after device restart; it never re-enables owner opt-in or attempts to read historical LINE messages. `200` acknowledges a stored or duplicate observation, `401/403` disables syncing, and invalid 4xx are not retried. Device API authorization is always a per-device `Authorization: Bearer <token>` header.
6. Owner can disable immediately on phone, delete local credentials and queue, **and must revoke the device in `/admin` to invalidate the server-side token**. A phone-side disconnect by itself cannot revoke the remote token while offline.

## Build / test

Requirements: JDK 17, Android SDK with API 36, internet (only for dependencies not already cached), Gradle wrapper (included). On Mac:

```sh
cd tools/payment-companion-android
export ANDROID_HOME="$HOME/Library/Android/sdk"
./parser-tests/run.sh
./gradlew :app:compileDebugJavaWithJavac :app:lintDebug :app:assembleDebug
```

Debug APK output: `app/build/outputs/apk/debug/app-debug.apk` **(development-signed, never use as Production release)**. No separate source repository or external proprietary API dependency.

Gradle runs with `-Duser.language=en -Duser.country=US` in project `gradle.properties`; the Mac's Thai Buddhist system locale otherwise triggers a `MsDosDateTimeUtils.packDate` exception when Android Gradle Plugin writes ZIP/JAR resources. This changes only Gradle process locale; it does not affect app's Thai UI or bank time zone.

To test with an Android device connected via USB, enable USB debugging and run:

```sh
adb devices -l
adb reverse tcp:8000 tcp:8000
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

On the Android device set the server URL to **`http://127.0.0.1:8000`** *for debug + adb reverse only*. `http://<Mac-LAN-IP>:8000` is intentionally rejected. On remote/production-like deployments use an explicitly configured **valid HTTPS endpoint** with an authorized trusted certificate. Do not allow self-signed or arbitrary certificates by disabling TLS validation.

Generate a device pairing token from the owner account on the local `/admin` page. The feature flag `LUKKAJA_PAYMENT_COMPANION_PILOT_ENABLED=1` and companion schema must be set on the local Go runtime. Use **only a TEST shop/device**; do not use the Companion for actual settlement.

## Current test status (12/11/2026)

- Java parser automated cases pass for an anonymized SCB Connect sample (+424.00 THB, 11/11/2026 16:58, masked X-1677) and variants, Thai BE years, rejection of other applications, outgoing and negative values.
- Android Java compilation passed using Android Gradle Plugin 9.1.0; `:app:lintDebug` passed with non-blocking warnings, and `:app:assembleDebug` produced a development APK locally.
- **NO Android device connected to the Mac**. No real LINE Notification callback, Keystore enrollment, USB/HTTPS pairing, queue retry or end-to-end receiving transaction has yet been tested on a physical device. These checks are required before claiming operational readiness.
- LINE for Android may group, truncate or hide Notification contents. If the allowed complete account/amount/date fields are missing, the parser safely skips the event; capture and compare the actual Android notification presentation during manual UAT. Do not loosen provenance requirements to make an ambiguous notification pass.

## Known pilot limitations / security gates

- Android notification access permission is broad at OS level. The app code itself only processes the allowlisted package and incoming SCB Connect message; the owner should grant access only if comfortable with this Android platform permission.
- LINE identity/title is not an authenticated bank event, and no bank account link can be certified solely from Notification or a payment slip. This app is an advisory observer, **never an independent substitute for bank-signed verification**.
- No guaranteed notification delivery: offline devices, notification grouping/truncation, OS battery restrictions, LINE or SCB changes, and enabled Android background limitations can cause gaps. Private queue is bounded (100 events), best-effort; durability and replay gaps require device testing.
- Use official verified bank APIs or merchant review for settlement, and keep existing Slip2Go/manual review rules until a bank-controlled verification source exists.
- Debug development build is not suitable for public distribution. No Release signing/publishing, device screenshots, or Production rollout has been performed.

## Demo v0.2.0 — LINE/bank selection (20 Nov 2026)

The new version supersedes the original SCB-only UI instructions above.

- Select exactly one notification source: LINE or a selected banking app. Banking options: SCB EASY, K PLUS, Krungthai NEXT, Bangkok Bank Mobile Banking. LINE is supported for the tested SCB Connect format only. Other LINE bank chat formats require actual verified templates; they cannot be turned on just by choosing the bank.
- Only exact Android package identifiers and explicit incoming-money expressions are parsed. Amount, masked destination-account suffix and transaction date/time must all exist before a webhook is sent. The bank app is not screen-scraped; there is no access to SMS, contacts or other LINE chats.
- Expanded and grouped Android notification fragments are inspected transiently in RAM. Sanitized incomplete fields from the same group are combined for at most 90 seconds; conflicting amounts or missing critical fields never fabricate a payment observation.
- Events with identical source, amount, masked account and bank timestamp within 8.5 seconds on the same paired device are grouped into one observation via a persisted SHA-256 fingerprint ledger. In this exceptional window separate identical real transactions can also group: a bank-authenticated reconciliation channel is needed to distinguish them. The backend enforces unique device/event IDs.
- Existing owner pairing and Android Keystore AES-GCM token encryption remain. Editable webhook endpoint defaults to the current server's /api/companion/notifications; same-origin restriction prevents leaking device credentials to another host. A paired owner may change the webhook path without pairing again.
- On the Store Admin dashboard, an owner-only matching panel shows candidate matches of exact order amount with bank notification within 15 minutes of the order creation time, and only when a customer slip is attached. Multiple plausible matches are ambiguous. It never changes payment status, sends an order to the kitchen or unlocks an account.

### Two APK builds

Run from tools/payment-companion-android with Android SDK and JDK17:
  ./parser-tests/run.sh
  ./gradlew :app:lintLocalDebug :app:lintProductionDebug :app:assembleLocalDebug :app:assembleProductionDebug

- LocalDebug: app/build/outputs/apk/local/debug/app-local-debug.apk, default http://127.0.0.1:8000, requires adb reverse on an Android phone/emulator. A real phone's 127.0.0.1 is not the Mac.
- ProductionDebug: app/build/outputs/apk/production/debug/app-production-debug.apk, default https://www.lukkaja.com. For the existing UAT/Sandbox service only. Development-signed APK; not a Play Store release or Live bank verifier.
- The owner-only admin download route serves a fixed private APK file per environment, not an arbitrary path or public static artifact.

### Verification and limitations

Passed: parser/group tests; Android lint and builds for both variants; Android Emulator install and UI launch with correct default URLs; Go unit suite; real Local Go webhook + MySQL device-authorized ingestion, duplicate idempotency, invalid bank source denial and anonymous rejection. Temporary test device/token rows were deleted.

Not yet tested on a physical banking phone: actual SCB Connect or bank-app notification format, user-approved Notification Access callback, true bank transfer, Android background persistence, or actual customer receipt upload plus bank-controlled settlement.

Financial warning: notification text and nearby order time plus a customer-uploaded image are not independently authenticated bank settlement. Matching is advisory for owner review, NEVER automatic Paid. Require a bank-verified data source or merchant review before financial completion.


## Demo v0.3.0 (Build 3) — Kanit + non-sensitive delivery diagnostics, 20 Nov 2026

- Original LUKKAJA Kanit Regular and SemiBold font is bundled in Android
  res/font and applied to the whole native UI (including fields/buttons).
- Shows dynamic BuildConfig.VERSION_NAME and VERSION_CODE on the first screen.
  LocalDebug and ProductionDebug package IDs remain unchanged, so install an
  update without removing the previously paired app or deleting its Keystore.
- Adds owner-visible on-device diagnostics, *no raw notification text stored*:
  selected-source notification count, other banking app (not selected) count,
  incomplete/unrecognized count, queued events, HTTP 200 webhook receipts,
  failed delivery and last sanitized diagnostic status/time. Refresh at end of
  app or re-open. Counters remain local to the phone, never sent to the server.
- LINE mode means only LINE room **SCB Connect**. A transfer visible in the
  SCB EASY app will not be read when LINE mode is selected. Select mode 2
  (banking app), choose the bank and press Save, with Notification Access
  granted and the Receive checkbox enabled.
- A successful "Test connection" only checks pairing (HTTP 200); it DOES NOT
  send a money observation and does not update last_seen on the server.
- Actual notification text must explicitly contain incoming funds, amount,
  masked recipient account and bank transaction date/time. If these are
  missing, the app intentionally does not fabricate a payment.
- Demo updates are downloadable using the owner-only Admin APK route in the
  relevant UAT environment. Version 0.3.0-demo is debug-signed, NOT production
  Play Store certified and NOT independent bank confirmation.

Quick troubleshooting sequence:
1. Confirm server https://www.lukkaja.com, webhook path ending
   /api/companion/notifications, pairing connection HTTP 200.
2. Select source that REALLY displayed the notification (LINE SCB Connect or
   the exact bank app); save. Confirm Android Notification Access and receive.
3. After the next actual incoming notification, tap Refresh diagnostics.
4. Selected-source 0 => wrong app / missing Notification Access / Android
   disabled notification; other bank app count indicates wrong selected source.
5. Selected-source >0 and incomplete >0 => format missing fields. Ask for
   a **redacted** notification example (hide sender, account, amount if desired);
   fix only verified per-bank templates. Do not loosen fraud checks blindly.
6. Queued >0 but webhook accepted 0 => network/API failure (see local last
   HTTP status and pending queue); diagnose device token and Go ingestion.
7. Webhook accepted >0 but Admin remains 0 => refresh Admin history, then
   investigate tenant scope/ingestion server without inventing bank settlement.

No database migrations or Go API changes are required by this APK-only update.

## Demo v0.4.0 (Build 4) — eight selected LINE bank alert services

The Android dropdown now uses **separate provider lists per mode**:
- LINE (8): KBank LIVE, SCB Connect, Krungsri Simple, Krungthai Connext,
  GSB NOW, CIMB THAI Connect, BAAC Family (BAAC Connect), LINE BK Alerts.
- Native bank apps (unchanged 4): SCB EASY, K PLUS, Krungthai NEXT,
  Bangkok Bank Mobile Banking.

Existing SCB paired devices retain the stored bank code, encrypted token,
webhook and Notification Access after an in-place Android update. The
selected bank remains explicitly owner controlled. This update removes the
old UI guard that refused to enable non-SCB LINE services.

Strict matching: Android package must be the genuine LINE app and sender
title must match an explicitly configured LINE service name; nonmatching
LINE chats are not processed or counted. LINE sender display names are
*not cryptographic bank identity*. Real transaction observations require
positive incoming language, exact amount, masked receiver last4 and
transaction date/time. Incomplete events are held RAM-only within one
notification group; no invented payment, no automatic settlement, no
inferred timestamps. The Go API source allowlist now recognizes eight
distinct LINE source IDs, in addition to the original four native bank
source IDs. Existing database source varchar(40) is adequate; no
migration, record alteration or schema change is necessary.

IMPORTANT: The user-supplied official bank service pages establish that
the LINE services exist; they do NOT provide a verified Android push
message schema. Only the existing SCB Connect receipt pattern has
real-message fixture coverage. Other services are selectable and
accepted by the server **only when** their notifications contain the
already-validated strict format. Otherwise diagnostics show incomplete.
Do not claim 8/8 actual bank message compatibility without redacted
samples and physical-device tests. CIMB THAI Connect is the bank
transaction-alert service; the generic @cimbthai OA must not be
misrepresented as a verified payment source.

Production release requires BOTH the Android APK and Go allowlist;
shipping APK alone for these new source strings causes HTTP 422 and
could silently discard an event. Do not modify the Production database.


## Demo v0.5.0 (Build 5) — installed banking apps + raw incoming Telegram forwarding

- In **Bank app** mode the owner can choose **one installed bank app** from a
  device-local Android package picker, in addition to the four existing preset
  apps. The picker does not transmit the installed app inventory. The owner
  must select the genuine banking app: a package name is **not** bank-signed
  proof. Source `bank_other_installed` is advisory only. In **LINE** mode the
  existing eight **exact OA sender** allowlist remains mandatory.
- Notifications that explicitly indicate **incoming** money from that chosen
  source are forwarded even when amount / masked recipient / transfer timestamp
  cannot be fully parsed. All available text fields from that *one* Android
  Notification are forwarded to the tenant's **enabled** Telegram `admin_store`
  and `cashier_delivery` channels using the existing outbox, retry and dedupe.
  Unrelated LINE chats, notifications from unselected apps, OTP/PIN/password
  notices, and outgoing transactions are excluded. The raw queue on the phone
  is **AES-GCM encrypted with Android Keystore**; after a Telegram send succeeds
  or permanently fails, the outbox replaces its raw text with a status message.
  Pending outbox entries do contain confidential bank text until dispatch.
- The merchant owner should use **private bot chats**, limit access to the
  Admin and Cashier channel administrators, and inform staff about sensitive
  account numbers and balances appearing in received Telegram text. Telegram
  routing and delivery depend on each channel being enabled and functional.
- **A bank-issued original slip image is NOT exposed by Android's text
  notification API.** If the customer attached a protected payment slip to a
  Delivery order, Telegram's order link opens the authenticated Cashier bill
  preview, which now includes **เปิดสลิปที่ลูกค้าแนบ**. The app never creates a
  fake bank receipt or publishes a private slip URL into a public Telegram chat.
- The APK is a **direct-install UAT demo**, not a Play Store production release.
  Android's `QUERY_ALL_PACKAGES` permission is used only to present installed
  apps in an owner-initiated selector. Google Play restricts this permission
  and requires separate approval for any future store release.
- An incoming notification, even with matching information or a screenshot,
  does **not** certify payment or unlock an invoice/order. Real-bank end-to-end
  verification for each bank app still requires private-device manual UAT.


## Demo v0.6.0 (Build 6) — Thai bank name catalog as the primary selector

- The Bank app dropdown lists **39 named Thai, specialized financial, and foreign
  bank institutions operating in Thailand**, followed by **one final manual
  option**. The source bank catalog is based on the Bank of Thailand institution
  directory; the bank list is broader than the institutions offering personal
  mobile apps.
- **18** bank entries include an identified Android package from their Google
  Play bank application listing (including the four pre-existing presets).
  Selecting one of those entries automatically uses its bank app's package.
- For an institution without a verified Android app package, the owner sees a
  prompt to select its banking app **from the installed apps** before saving.
  The manual chooser is only a fallback, not the primary way to pick a bank.
  An installed app with an unverified package is not authenticated as a genuine
  bank app; the owner must verify it. No notification is captured until the
  chosen app is saved and Notification Access is enabled.
- Preserves existing LINE eight-service titles, old four bank source identifiers,
  tenant pairing keys, AES-GCM encrypted raw notification queue, and both
  Admin/Cashier Telegram routes. New preset apps reuse the supported advisory
  bank_other_installed Go source without changes to its API or database.
- **Not every licensed bank has a retail mobile app**, and not every banking app
  puts transaction details in Android notifications. The list is a selection
  catalog, *not* a certification that real transaction notifications have been
  independently tested for every institution.
- Play Store package IDs can change; in that case, the owner can use the
  fallback selector and re-save the exact installed app.
- BOT directory: https://www.bot.or.th/th/fi-list.html

## Demo v0.6.1 (Build 7) — prevent duplicate Telegram raw income

- Android's notification listener can receive the same bank/LINE event multiple
  times, especially when a message changes from compact to expanded form.
  Within an 8.5 second window, the raw retry queue now fingerprints selected
  source + app package + title + normalized full text, rather than
  mutable Android notification key or its post time.
- The Go Telegram outbox additionally derives a stable event key from tenant,
  device, source, package, normalized notification text and observed second.
  Re-delivery of the same event with a different Android eventId at the same
  observed second cannot create another message for Admin or Cashier.
- Different transaction amounts, destination accounts and bank transaction
  timestamps still produce different fingerprints; equal amounts at a
  different transaction time aren't suppressed. A notification feed without
  a transaction reference cannot prove two byte-identical notifications from
  the same moment are separate transfers, so this protection is deliberately
  a short-window best effort, never a bank payment confirmation.
- The original Admin and Cashier Telegram destinations remain independent.
  No historical financial data, payment state or database schema is changed.


## Demo v0.6.2 (Build 8) — LINE grouped alerts and permission recovery

- Android/LINE may show multiple chats in a grouped Notification. The bank OA
  sender can appear in EXTRA_CONVERSATION_TITLE, EXTRA_SUB_TEXT, or MessagingStyle
  message sender rather than EXTRA_TITLE. The listener now matches **only exact
  selected OA names** from these metadata fields, and extracts only bank-specific
  MessagingStyle messages from mixed group summaries. It never forwards a
  combined LINE group that could contain private conversations or a different
  bank. Unknown sender identities are skipped with privacy-safe diagnostics.
- Android can temporarily unbind Notification Access during updates. Opening
  the app no longer clears the owner's saved opt-in automatically in this case.
  A prominent health banner distinguishes saved pairing credentials from
  Android Notification Access and the separate enable/disable opt-in switch.
  If the previous version already disabled the opt-in, the owner must explicitly
  turn on **เปิดรับและส่งแจ้งเตือนเงินเข้า** again.
- These changes affect Android intake only; Go webhook, Telegram routing, Stripe
  Sandbox, bank catalog and financial status logic are unchanged. The app does
  not automatically replay past LINE messages. Test with a *new* Notification.


## Demo v0.7.0 (Build 9) — streamlined Android UI / conditional workflow

In-place Android UAT update. Existing Android Keystore pairing, saved
source choice, Notification Access opt-in, notification listener, queue, bank
catalog, backend allowlists and Telegram forwarding remain unchanged.

- **Connect**: when paired, show a green connected-server summary, Test
  connection and Change pairing. Hide token and URL fields until requested.
  Re-pair requires confirmation and does not erase the working credential
  or queued observations if the new token fails verification.
- **Select**: after the owner saves LINE or a banking app, show only a concise
  summary and Change source instead of both options and the bank dropdown.
  When editing, LINE hides installed-bank-app fallback. Banking mode hides
  the fallback when the selected app is installed, revealing it when missing.
- **Permission**: hide redundant Android Access settings button after access
  is granted. Receive switch requires a saved pairing, a saved selection and
  Android permission. An opted-in owner can always turn OFF receiving even
  while Android temporarily revoked notification access. Retry appears
  only while enabled with a pending queue.
- **Feedback**: persistent accessible in-page green/red status and native
  Android success/error Toast for pairing, connection test, bank selection,
  webhook editing, permission switch and disconnect. Diagnostics and advanced
  Webhook settings are collapsed by default.
- Existing source filters and financial restrictions are unchanged; an
  incoming notification is not bank-signed payment confirmation.

Run parser-tests/run.sh (includes pure-Java visibility assertions) plus
Gradle build/lint. This build is a debug-signed UAT demo APK, not a Play Store
or real-bank-certified release.


## Platform LINE collection Android provenance (2026-11-24)

Starting in UAT build 0.9.5-demo (versionCode 17), parsed LINE events
include the NotificationListener-reported appPackage field
(jp.naver.line.android). The server refuses to use a Platform-only LINE
notification for Invoice/Lalamove auto-approval without this exact
package value and a currently paired non-revoked device. Existing
merchant Android receipt-observation semantics do not change. This
app-package label is NOT a cryptographic bank proof.

Older UAT APKs did not send this field: install the updated
ProductionDebug APK before testing the new Platform payment mode.
ProductionDebug remains development-signed, defaults to
https://www.lukkaja.com in UAT/Stripe Sandbox, and is NOT a
Play Store or Live banking production release.
