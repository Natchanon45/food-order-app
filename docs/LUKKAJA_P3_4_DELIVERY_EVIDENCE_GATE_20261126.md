# P3.4 — Server-authorized legacy Delivery checkout evidence

Source READ ONLY cosmatch/lukkhaja feature/react-golang-vite-tailwind-axios@7e47e85f; Target Natchanon45/food-order-app feature/react-firebase-port starting 46680b65. Legacy slip-first public checkout now re-reads the protected deliverySlipChecks document in the same Firestore transaction as order creation. A browser status, storage path or review flag alone cannot create an order. Exact tenant/order/slip/cart/fee/total, status and a fresh server receipt (15 minutes) are required; technical fallback must satisfy the existing finance-manual-review policy. Browser-provided payment URL and review flag are discarded; stored review flag is server-derived, payment remains pending_verification. The existing confirmed-order 5m QR pilot and globally disabled COD remain separate. No new paid authority.

QA: 36/36 targeted Node contract and delivery regression cases PASS; 2/2 actual isolated Firebase Auth/Firestore/Functions/Storage Emulator cases PASS, including real anonymous Chrome correction and public callable with synthetic demo-only provider proof. Full serial React Parity **881/881 PASS, Exit 0**. Web build not rerun because this slice changes only Cloud Functions and tests (no React or hosting inputs). Live providers not called. This is an incremental backend hardening, not Notification-first parity; the two Delivery pages remain pending, overall 15/65=23.1% accepted/dispositioned, 50/65=76.9% pending. See docs/LUKKAJA_P3_4_DELIVERY_EVIDENCE_GATE_20261126.md.

Next: implement canonical Firebase notification-first order creation with current server-validated catalog, promotions and fee/receiver binding, signed observation matching, correction/review routing and authorized Staging provider tests. Do not enable Stripe LIVE, COD or real Lalamove dispatch from this slice. No Source changes, main merge, Production deploy or mobile build.

## Root cause and scope

Existing finalization required a trusted server proof before marking a bill paid, but the public create transaction did not require that proof before creating a pending bill. A forged browser request could set matched/manual_review, supply a path for a nonexistent or unrelated slip and create a misleading pending order. This patch rejects it before any order write. It does not claim that the previous code could automatically settle money solely from those fields.

The Source's newer notification-first flow deliberately starts before slip verification and needs a different canonical order-intake contract. Do not weaken this existing slip-first proof gate to simulate that workflow.

## Pseudocode

    require active Tenant, valid store hours and authorized PromptPay rail
    if confirmed five-minute QR:
      keep the existing receiver/quote/catalog pilot checks
    else:
      in order creation transaction, read protected slip check for same bill
      require same tenant, order ID, path, cart signature, fee and total
      require checkedAt within 15 minutes, no future timestamp
      require trusted matched receipt OR eligible technical provider failure
      otherwise reject with DELIVERY_SLIP_PROOF_NOT_CONFIRMED
    persist only server-derived review state and pending_verification
    leave existing separate payment finalizer responsible for settlement

## Scenarios

1. No proof: reject without creating an order.
2. Wrong Tenant, order ID, file path, amount, or cart: reject.
3. Missing transaction reference or stale proof: reject.
4. Browser changes manual_review to matched: reject.
5. Browser sets paymentStatus paid or reviewRequired false: ignore; only server evidence decides.
6. Eligible technical fallback: create pending_verification with review required.
7. Config failure or no attempted provider call: cannot authorize review via this route.
8. Browser supplies a URL: discard it.
9. Existing confirmed-QR path and global COD prohibition remain unchanged.
10. Real demo Callable verifies no-write rejection and pending technical fallback; no external provider transaction.

## Limitations

The 15-minute validity requirement is also applied to eligible manual-review proof at creation (matched proof already used this window); this deliberately prevents stale proof intake. The Emulator test seeds synthetic provider records only under the isolated demo project; it does not validate any actual bank transfer. No Source notification-first rollout, real-provider approval, promotion parity, Stripe live or Lalamove live gate completed here.
