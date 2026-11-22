# PENGUIN Firebase — LUKKAJA BankAlert Confirmed-Order QR / Kitchen UAT
**Date:** 2026-11-22 · **Source:** cosmatch/lukkhaja, feature/lukkaja_bankalert_stripe, 03d2aaee (read only)
**Target:** Natchanon45/food-order-app, feature/react-firebase-port · **Deployment:** NOT performed

## Purpose and acceptance boundary

Port the source's **customer confirms delivery order → server issues exactly one five-minute PromptPay QR → BankAlert notification is considered → restaurant may optionally admit a ticket to kitchen in a separate UAT**. This is a **partial, isolated UAT implementation**, not bank-confirmed automatic settlement, a certified bank interface, a released production checkout, or completed Source JSX parity.

The existing pay-first Firebase PromptPay + Slip2Go / Superadmin manual technical-fallback workflow remains intact for everyone outside the explicitly opted-in single test tenant. The source Go/MySQL logic is not copied blindly over Firebase trust boundaries. No Android APK was built or modified and the source worktree was left untouched.

## Implementation tree

```
functions/
  public-delivery-submit.js           # Existing guarded delivery creation + strictly isolated QR branch
  payment-companion-qr-policy.js      # Exact satang/menus/quote/store revision/5-minute window + capability
  payment-companion-qr.js             # Availability, QR state, original-slip fallback with unique hash/audit
  payment-companion-policy.js         # Legacy notice candidates + source after-confirm window + SCB review
  payment-companion.js                # Owner receiver revision opt-in, cashier review, kitchen-UAT opt-in
  payment-companion-kitchen-policy.js # Explicit project/tenant isolation and narrow UAT admission checks
  payment-companion-kitchen.js        # Notice-created transactional admission, one claim per notice/order
  delivery-slip-policy.js             # Explicit admitted_unverified kitchen gate; does not mark paid
  delivery-slip.js                    # FCM labels UAT admission as not paid
  index.js                            # Public/server-only function exports
react-app/src/
  pages/DeliveryPage.jsx              # Source confirm-before-QR flow only when server allows
  pages/DeliverySuccessPage.jsx       # Tracking/receipt withheld until appropriate state
  pages/KitchenPage.jsx               # Explicit unverified status, not a Paid banner
  pages/CashierPage.jsx               # Unverified UAT warning; existing payment review unaffected
  components/CompanionConfirmedQr.jsx # Server state + countdown + signed original-slip fallback
  components/PaymentCompanionPairingCard.jsx # Explicit owner UAT risk acceptance
  data/publicStorefrontData.js        # Pass one-time order capability from original create response
  data/deliveryKitchenGate.js         # Strict kitchen-only admission, no dispatch
  ui/companion-qr.css                 # Responsive mobile/desktop QR presentation
firestore.rules                       # Deny client write to authoritative QR/admission/proof fields
tests/
  firebase-emulator/p1-payment-companion-confirmed-qr.spec.mjs
  firebase-emulator/p1-payment-companion.spec.mjs
  react-parity/p1-payment-companion-confirmed-qr-browser.spec.mjs
  react-parity/p1-payment-companion-browser.spec.mjs
  react-parity/p1-payment-companion-policy.spec.mjs
  react-parity/p1-payment-companion-kitchen-uat.spec.mjs
```

## Phase gates and invariants

### G1. Opt-in owner and current payee
- Owner confirms the merchant's current stored bank account and **separate** PromptPay payee; no duplicate editable bank account field.
- Saving any merchant payment setting changes Firestore update revision and requires new owner confirmation; **the callable also requires the revision the owner actually saw**, preventing a same-last-four race during consent.
- The original QR feature is off by default. It requires the single configured tenant and all flags below. No backdating, implicit tenant opt-in, or arbitrary demo-project activation.
- QR branch currently supports **Lalamove + PromptPay, 1–60 non-gift items, positive exact prices, valid server-side quotation, no discounts/free gifts**. Anything unsupported stays in original pay-first flow, not a weakened QR mode.

### G2. Server-authored checkout/QR
- Public client cannot author trusted payment, QR duration, payee, or settlement fields.
- Firestore transaction re-checks active tenant, store opening hours, saved receiver revision, menu prices/quantities, quotation ID/fee/location/expiration, exact THB satang and single order reference.
- Server creates `paymentQrMode=confirmed_order_5m`, original started/expires UTC pair separated by 300 seconds, trusted recipient snapshot and 256-bit order-scoped capability hash, while keeping `paymentStatus=pending_verification`.
- Unhashed capability is returned **once to the original create call only**, stored in tab-scoped sessionStorage; it is never put in the URL or public order document.
- Customer page displays QR only after checking live server QR state. Reloads cannot extend expiry. A store/payee change hides stale QR and demands review. The original payment-lock QR is never shown simultaneously with confirmed-order QR. The existing pay-first checkout remains the fallback for promotions, when a checkout was already locked, or if QR is not server-enabled.

### G3. Notification matching (still unverified)
- Incoming structured notifications are from paired, active device credentials and scoped per tenant, with replay and conflict guards; raw messages/OTP excluded.
- Source-like after-confirm matching requires exact satang, bank + last-four-digit suffix, bank timestamp inside that order's original five-minute window and server receipt within bounded grace.
- SCB whole-minute uncertainty is exposed only as `time_precision_review`, never a unique automatic UAT kitchen admission. Multiple eligible observations or overlapping orders become ambiguous.
- A QR notice does not mark any order Paid, settle an invoice, change wallets, or dispatch Lalamove.
- Cashier preliminary review still requires a linked original slip and records only `cashier_observation_reviewed_unverified`.

### G4. Original slip fallback
- Expired or changed-payee QR presents original-image upload, gated by the order-specific 256-bit capability.
- Storage metadata, <=8MB JPEG/PNG/WebP, exact tenant/order path, immutable SHA-256 content and global unique hash are checked before Firestore commit.
- Creates one server-only audit and global image claim; retries with the same content/path are idempotent. Other orders cannot claim the same image.
- Leaves order Pending with `slipCheckStatus=manual_review` and `paymentReviewRequired=true`. This does **not** create a provider-verified or Superadmin-approvable bank proof; independent bank/technical review still required.

### G5. Kitchen only in a dedicated isolated UAT project
- Needs distinct configured non-production, non-demo Firebase project ID + QR feature/tenant flags, PLUS a separate auto-kitchen flag, PLUS an active owner-bound receiver, PLUS the owner's explicit UAT-risk consent **made before order creation**.
- A notice-created Firestore transaction requires an exactly unique after-confirm candidate, active device, same immutable merchant payee revision, fresh bank+server times, exact amount, no late slip, no prior admission, original five-minute window and no changed order/payment state.
- Transaction creates unique `kitchenClaims` and `kitchenAdmissions`, and adds only `order.companionKitchenRelease.status=admitted_unverified`. **It must NOT set Paid, kitchenReleasedAt paid-proof field, actual bankConfirmed, actual paymentVerified, any wallet balance, or a dispatch state.**
- Kitchen/Cashier/FCM explicitly say *BankAlert UAT — ยังไม่ยืนยันรับเงิน*. Existing Lalamove dispatch remains Paid/COD-only, even after this test admission.
- A second notice or duplicate event cannot admit a second time. Transaction never changes the original payment proof.

## Environment flags (must remain OFF on production)

These are controlled on server, not by client settings. The current turn did not set them and did not install Stripe/Android/Telegram credentials.

```text
PENGUIN_PAYMENT_COMPANION_PILOT_ENABLED=1
PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID=<one dedicated test tenant ID>
PENGUIN_PAYMENT_COMPANION_QR_ENABLED=1

# Additional conditions for isolated project-only unverified kitchen:
PENGUIN_PAYMENT_COMPANION_UAT_PROJECT_ID=<exact dedicated non-production project>
PENGUIN_PAYMENT_COMPANION_AUTO_KITCHEN_ENABLED=1
```

The policy explicitly excludes `penguin-food`, `penguin-food-prod`, `penguin-food-production`, all demo projects and Firebase Emulators from activating the unverified kitchen path. The emulator tests inject a test-only mock gate and real Firestore Emulator; that is **not** evidence of real provider integration. No deployment or production flag updates authorized or performed.

## Acceptance scenarios and status

| # | Test scenario | Status |
|---|---|---|
| 1 | Old non-pilot checkout still requires slip before submit | PASS — regression |
| 2 | Reject QR menu price/quantity and cart-total forgery | PASS — Emulator |
| 3 | Reject unsaved, expired, wrong-coordinate or changed-fee Lalamove quote | PASS — Emulator |
| 4 | Reject unsigned discount/free-gift QR path | PASS — Emulator |
| 5 | QR created only once after successful order, 300-second immutable window | PASS — Emulator |
| 6 | QR never becomes Paid merely due to order creation | PASS — Emulator |
| 7 | Reload customer success page without restarting QR | PASS — Chromium 4 viewports |
| 8 | Expired QR prompts capability-bound original-slip upload | PASS — Emulator + Chromium |
| 9 | Same original slip double-submission is idempotent, reused bytes across orders blocked | PASS — Emulator |
| 10 | Receiver revision changes and reverts invalidating stale QR | PASS — Emulator |
| 11 | Exact after-confirm amount/time and bounded server arrival | PASS — policy tests |
| 12 | SCB minute-only timestamp cannot cause unverified automatic kitchen admission | PASS — policy tests |
| 13 | Shared notice/overlapping order and multiple notices are ambiguous | PASS — policy tests |
| 14 | Explicit UAT owner consent before order; live/demo/emulator auto-kitchen gates refused | PASS — policy tests |
| 15 | One UAT kitchen admission creates one claim, remains unpaid and not dispatchable | PASS — Emulator |
| 16 | Repeated event/second notice does not create second admission | PASS — Emulator |
| 17 | FCM, kitchen and cashier wording distinguishes unverified UAT from paid | PASS — source/UI regression |
| 18 | Existing delivery Slip2Go + Superadmin payment approval unchanged | PASS — regression tests |
| 19 | Real Android APK → HTTPS notice → production-like UAT routing | **NOT TESTED** |
| 20 | Real Stripe test payments, merchant Telegram Admin/Cashier/Kitchen delivery | **NOT TESTED / OUTSTANDING** |
| 21 | Full source-specific late OCR recheck and authenticated bank settlement | **NOT PORTED** |
| 22 | All Superadmin/merchant M7 Stripe invoice and payment history parity | **NOT PORTED** |
| 23 | Dedicated authenticated production-grade browser and payment UAT | **NOT DONE** |
| 24 | Hosting/Functions deployment | **NOT DONE** |

## Remaining implementation priorities

1. Create real dedicated UAT project, isolated tenant/account and synthetic Android notification test harness; never enable unverified kitchen on Production.
2. Validate actual signed app receipt, manual bank confirmation and original evidence under live-like data; preserve consumer order read security.
3. Finish source recipient/POS configuration, late paid slips and cashier review binding; route safe Telegram notifications without using them as payment evidence.
4. Port M7 merchant/Superadmin Stripe invoice settlement and accurate payment history, and production/test separation.
5. Complete full JSX route parity, Firestore Rules, server error handling and pixel/functional authenticated UAT; only then approve deployment.
