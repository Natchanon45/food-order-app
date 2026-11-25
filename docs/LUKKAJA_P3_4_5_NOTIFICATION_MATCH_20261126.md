# P3.4.5 — Notification-first advisory matching

Source read-only cosmatch/lukkhaja feature/react-golang-vite-tailwind-axios@7e47e85f; target Natchanon45/food-order-app feature/react-firebase-port from ea885171. Implemented two managed Firebase Callables getDeliveryNotificationMatch and recordDeliveryNotificationObservation, exclusively within existing demo tenant/emulator gate. Authenticated active Owner/Admin/Cashier scope from canonical user + active restaurant Tenant; no arbitrary tenant selector, current managed email check inside transaction.

Dedicated matcher uses canonical order paymentReceiverRevision and PromptPay recipient, current opted-in receiver and paired active device, structured notification ID digest, exact satang, bank code and masked account suffix, monotonic bank/observed/received timestamps. Explicit local policy: 15-minute post-order window and one-minute receipt grace; SCB whole-minute before order is review-only. Rejects stale receiver, invalid device, foreign/paid/cancelled orders, multiple matching notifications or equal-amount competing PromptPay bills including other rails and paid/cancelled bills. Bounded snapshot refuses truncated results (200 orders, 200 notices, 3 devices). This policy is intentionally conservative, not a claim of exact Go timing parity.

Recording requires explicit acknowledgment, freshly recomputed unique candidate in Firestore transaction, shared reviewClaims entry, per-order immutable notificationFirstReviews audit and minute-bucket observation collision claim. Identical request replay returns existing unverified record; different notice conflicts. Minute-bucket key is not a bank transaction ID and cannot guarantee cross-device de-duplication for differently timestamped observations; real bank transaction evidence remains necessary. No order write, no paid flag, no Kitchen release or rider dispatch. Raw bank text and private receiver revision/fingerprint not exposed by read Callable.

QA: targeted 22/22 PASS (6 new policy/contract tests plus 16 existing intake, companion, and managed gate tests; 49 modules/156 managed Callables). Full serial React Parity 894/894 PASS, Exit 0; existing real Firebase Emulator regression 3/3 PASS, Exit 0 (not the new signed matcher). Web build not rerun because no frontend inputs changed. New signed matcher E2E test could not be installed/executed because remote tool rejected that command; signed role enforcement/concurrent claim behavior are therefore implementation and contract-level only, not verified by actual signed requests. Do not claim P3.4.5 fully accepted. No live notification ingestion, bank transaction, Stripe, Lalamove or customer UI switch.

Next: finish signed matcher Emulator acceptance (roles, concurrency, shared claims and owner direct writes), then P3.4.6 independent bank-evidence reconciliation with immutable authority and duplicate transaction reference, followed by P3.4.7 Checkout UI/availability gate. Gift/manual route parity and authorized Staging provider acceptance remain pending. Both Delivery pages pending; master 15/65=23.1% accepted/dispositioned, 50/65=76.9% remaining. No Source changes, Production, main merge or APK/IPA.

## Pseudocode

    require authenticated active merchant cashier/admin/owner
    require demo project, exact local emulator and fixture tenant
    transaction:
      read canonical user, tenant, receiver, paired devices
      read complete bounded recent orders and notices
      require order pending and receiver revision unchanged
      match exact satang, masked receiving account, source bank, valid device
      require bank/observed/received timestamps in defined local window
      if truncated, ambiguous, stale or minute precision uncertain:
        do not permit claim
      if explicitly acknowledged and unique:
        reread shared notice claim, order audit, observation collision claim
        write immutable audit and claims atomically
      return unverified flags, never mutate payment/order state

## Pending QA

- Real signed same-tenant cashier, owner, admin versus anonymous/kitchen/foreign.
- Concurrent submission creates exactly one audit + shared claim + collision claim.
- Replay returns same receipt, competing/revoked claims denied.
- Real owner direct Firestore update/delete denied.
- Live bank/device/provider integration and source timing policy verification.
