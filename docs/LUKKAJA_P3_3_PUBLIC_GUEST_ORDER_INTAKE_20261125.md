# P3.3 Public guest Table / Takeaway / QR-route intake

Date: 25 Nov 2026, Asia/Bangkok.

Source READ ONLY: cosmatch/lukkhaja feature/react-golang-vite-tailwind-axios @ 7bf9d15934f387cd887b46d1b17ca1f2924ffab0.
Target: Natchanon45/food-order-app feature/react-firebase-port, initial 27b90bbe.

## Scope and Source audit

Four Source JSX pages accepted locally: PublicOrderPage, TakeawayPage, PublicRouteMissingPage, StorefrontCompatibilityEntry. Public Table fails closed when QR token changes, Takeaway shows suspended-store state, missing routes retain PENGUIN branding and compatibility redirects allow only validated Tenant slugs and Firebase routes.

Two other Source pages, DeliveryPage and DeliverySuccessPage, received partial safety and display changes but **remain pending**. Source Delivery includes staged slip, payment-review and provider-specific checkout behavior not yet backed by equivalent trusted Firebase bank/payment capabilities. Do not claim customer correction, real Stripe or Lalamove provider confirmation.

## Completed action families (13)

1. Public Table active QR Tenant/session display.
2. Revoked or reassigned Table token clears stale active session and orders immediately.
3. Table pre-submit current session readback.
4. Safe Source public error labels rather than raw provider/SQL errors.
5. Live suspended Tenant gate on Takeaway UI.
6. Validated stored Tenant slug, target allowlist and canonical Firebase redirect.
7. Public Table signed Callable and current Tenant/Table/menu verification.
8. Public Takeaway signed Callable and Tenant/menu/customer verification.
9. Server-owned exact satang menu prices and totals, pending/unpaid status.
10. Stable ID/fingerprint idempotency, modified cart conflict, immutable existing order.
11. Denied unauthenticated direct Firestore Table/Takeaway creation.
12. Globally disabled COD in Delivery browser and trusted delivery intake.
13. Delivery Success history and discount display, cancelled actor, explicit unverified-bank warning without unsupported correction UI.

## Pseudocode (8)

    TENANT: read live Tenant; if suspended stop guest submission; signed backend checks again
    TABLE: read occupied Table + exact token; canonical price; increment round once
    TAKEAWAY: validate name/phone; canonical menu; create pending unpaid order with queue
    MENU: fetch active Tenant menu documents inside transaction; compute exact satang
    REPLAY: match stable order ID and SHA256 request fingerprint; same retry returns prior result
    CONFLICT: changed cart with reused ID rejects; never overwrite a previous bill
    DELIVERY: COD disabled globally; PromptPay pending_verification is not bank-paid
    RECEIPT: show revisions, discount, cancellation actor, and explicit unpaid review notice

## Acceptance scenarios (18)

1. Public Takeaway opens without managed login.
2. Guest UI renders at 320/390/768/1440 widths.
3. Valid Takeaway creates one pending/unpaid order.
4. Client-forged paid status, item price and total are ignored.
5. Same Takeaway request/id returns existing queue, not duplicate sale.
6. Changed cart and reused ID conflicts.
7. Valid occupied Table token creates one numbered pending/unpaid round.
8. Repeated same Table request/id does not increment round.
9. Changed Table cart with reused ID conflicts.
10. Direct guest Firestore create denied.
11. Suspended Tenant cannot receive a new guest order.
12. Revoked Table token removes old active session.
13. Stale Table token is rejected by backend.
14. Public errors omit private/provider/SQL messages.
15. Compatibility redirect validates stored slug and target.
16. Invalid route retains PENGUIN missing-route page.
17. Legacy store setting cannot re-enable COD.
18. Delivery receipt history and pending bank warning never claim payment.

## Verified local QA and external gates

- P3.3 pure Source/guest policy: 9/9 PASS.
- Real unauthenticated Chrome + Firebase Auth/Firestore/Functions/Storage Emulator: 1/1 PASS, canonical price, tamper/replay, store suspension, table token, four responsive widths.
- Delivery server guard 9/9 PASS. Managed Callable pre-handler 47 modules / 152 definitions PASS.
- Full serial React Parity **PASS Exit 0**; final React Build and generated Hosting Contract **PASS Exit 0** (2026.11.09.535, /react/assets/index-DrFGa8qY.js). Generated-only public assets and temporary Firebase Emulator config cleaned.
- LIVE bank, Stripe, LINE payment observation, Lalamove provider job, customer slip correction, and Production deployment have NOT been validated.

## Master review coverage

Pinned Source: 65 JSX pages. Local accepted/dispositioned: 15/65 = 23.1%. Remaining formal Source review: 50/65 = 76.9%, including DeliveryPage and DeliverySuccessPage. This measures audit acceptance, not existing filename overlap (52/65) or Production readiness.
