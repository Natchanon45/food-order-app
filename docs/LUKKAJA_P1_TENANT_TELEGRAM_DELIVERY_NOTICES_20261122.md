# PENGUIN Firebase — Tenant Telegram Channels + Payment-Review Notification Parity
**Date:** 2026-11-22
**Source:** cosmatch/lukkhaja @ feature/lukkaja_bankalert_stripe (read-only at commit 03d2aaee)
**Destination:** Natchanon45/food-order-app @ feature/react-firebase-port
**Deployment status:** NOT DEPLOYED; changes committed only after isolated tests.

## Scope and source comparison

The source Go/MySQL application supports a separate tenant-scoped Telegram
`admin_store`, `cashier_delivery` and `kitchen_delivery` configuration;
notifications are pointers to orders and financial reviews, **not proof of a
bank transfer**. The Firebase port had a Superadmin-only encrypted Telegram
configuration and finance outbox, but the existing shared
`TelegramSettingsPanel` intentionally refused the tenant endpoint, so tenant
administrators could not save or test their channels.

This port reuses the source panel layout and central toast styling, adapts the
tenant endpoint to Firebase callable permissions and encrypted Firestore data,
and adds separate server-side, at-most-once message delivery.

## Implementation

```text
functions/
  tenant-telegram.js             authenticated owner/admin channel config, encryption
  tenant-telegram-events.js      delivery & finance state transitions → durable outbox
  delivery-qr-notify-policy.js   no premature QR-create push; review-only unlock
  index.js                       tenant Telegram callable/trigger exports and FCM transition
firestore.rules                  tenant channels and outbox explicitly server-only
react-app/src/
  components/TelegramSettingsPanel.jsx  use tenant callables; preserve platform callables
  pages/AdminPage.jsx                   tenant three-channel settings card
tests/
  firebase-emulator/p1-tenant-telegram.spec.mjs
  react-parity/p1-tenant-telegram-browser.spec.mjs
  react-parity/p1-delivery-qr-notification-policy.spec.mjs
```

## Configuration and authorization

- Tenant resolution is strictly from `users/{authenticated uid}.tenantId`,
  `active:true`, role `owner` or `admin`, and the tenant must be active.
  Never trust a tenant ID supplied by the browser.
- Three allowed purposes: `admin_store`, `cashier_delivery`,
  `kitchen_delivery`. A staff cashier or kitchen member cannot read or rotate
  tokens.
- Bot token is validated, encrypted using **AES-256-GCM** and the existing
  `PENGUIN_TELEGRAM_ENCRYPTION_KEY` Firebase Secret Manager secret.
  Firestore stores ciphertext and a masked suffix, while responses to the
  browser contain **no token**. Token clear disables that channel.
- Each save requires the latest server revision from the read response.
  Concurrent updates fail rather than overwriting a channel. A missing
  encryption key fails closed, and test sending always uses the persisted
  server-side token + Chat ID, not fields the browser has not saved.
- Explicit `firestore.rules` denies client access to
  `tenants/{tenantId}/telegramChannels/{purpose}` and
  `tenants/{tenantId}/telegramOutbox/{eventId}`. All other tenant and
  Superadmin finance rules remain unchanged.

## Delivery notification matrix

| State change | Admin ร้าน | Cashier | Kitchen |
|---|---:|---:|---:|
| COD order created | Notice: money not confirmed | Same | Same |
| PromptPay + original pay-first manual slip review | Review notice | Review notice | No |
| Confirmed-order QR created, no bank evidence | No | No | No |
| QR expired/receiver-changed, original slip submitted | Review notice | Review notice | No |
| Unique BankAlert admitted into kitchen *in isolated UAT* | Marked unverified | Marked unverified | Marked unverified |
| Backend commits paymentStatus Paid | Paid status notice | Paid status notice | Paid status notice |
| Wallet top-up: intake / reviewed outcome | Admin notice | No | No |
| Delivery revenue share: intake / reviewed outcome | Admin notice | No | No |
| Hybrid platform/membership fee proof: pending review / paid / rejected | Admin notice | No | No |

All messages include a bounded tenant ID, order/bill reference, exact amount
and deep link to the correct Firebase route. Messages never contain private
recipient details, raw bank notification, slip image, account number or Bot
Token. Pending/unverified wording never implies bank settlement. The old
platform Superadmin Telegram channel is not rewired.

## Queue / delivery semantics

1. Firestore onDocumentWritten watches committed tenant orders, wallet
   top-ups, revenue-share payments and hybrid-billing payment attempts.
2. Strict status transitions yield a deterministic SHA-256 outbox ID unique
   to tenant + record + outcome + destination purpose. A retried Firestore
   trigger cannot create another notification for the same transition.
3. Only enabled, stored tenant channels receive an event. The persisted
   message explicitly describes the payment-review status.
4. onDocumentCreated delivery atomically moves `pending → dispatching`,
   then sends Telegram with the **server-persisted** token.
5. On verified Telegram `ok:true`, mark `sent`. On HTTP failure or
   ambiguous network timeout, mark `unconfirmed` and **do not retry
   automatically**; this avoids duplicate messages. Failure does not alter
   an order, payment, wallet or kitchen state.

## FCM parity correction

The old Delivery `notifyDeliveryOrderCreated` push now suppresses the
new `confirmed_order_5m` pending PromptPay orders at creation; this prevents
early cashier notifications while the customer has not transferred money.
A separate `notifyCompanionQrCashierReview` trigger informs owner/admin/
cashier when (a) the isolated UAT admission is recorded explicitly as
unverified, or (b) the original slip fallback is uploaded and marked for
review. Paid-only Lalamove dispatch remains unchanged.

## Acceptance results

| Test | Result |
|---|---|
| Firestore Emulator: cross-tenant/role denial | PASS |
| Firestore Emulator: encrypted token, no plaintext in read/write response | PASS |
| Firestore Emulator: same revision concurrent saves allow only one | PASS |
| Firestore Emulator: cleared token revokes channel | PASS |
| Firestore Emulator: original saved credentials used for test send | PASS (synthetic transport) |
| Firestore Emulator: full Delivery transition matrix | PASS |
| Firestore Emulator: finance intake, hybrid platform proof, review outcomes | PASS |
| Firestore Emulator: same event + concurrent queue attempt creates one per channel | PASS |
| Firestore Emulator: concurrent sender and ambiguous HTTP failure are at-most-once | PASS |
| Browser: 320/390/768/1440 px, 3 channels, save/test/clear | PASS (mocked Firebase) |
| QR premature notification prevention + subsequent review status | PASS |
| Original platform finance Telegram regression | PASS |
| Live Telegram Bot delivery / real owner credentials | **NOT TESTED** |
| Actual authenticated UAT across end-user devices | **NOT TESTED** |
| Firebase Functions + Hosting deployment | **NOT DONE** |

## Still outstanding

- Provision exact Firebase Secret Manager key **in the appropriate UAT project**
  if not already configured; do not transmit the secret in chat or commit it.
- Owner configures BotFather tokens + Chat IDs privately, tests messages on
  actual Telegram chat. No real bot request or credentials were used here.
- Authenticated end-to-end tests on a dedicated UAT project. Preserve separate
  project-only unverified BankAlert kitchen authorization.
- Complete full JSX parity, real companion Android signed notice UAT, M7
  Stripe accounting/payment histories, receipt slips and Superadmin finance
  workflows. Production enablement requires explicit approval and actual
  payment-provider verification; local green tests do not suffice.
