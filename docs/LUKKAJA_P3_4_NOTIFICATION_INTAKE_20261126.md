# P3.4 — Notification-first canonical intake

Source read-only cosmatch/lukkhaja feature/react-golang-vite-tailwind-axios@7e47e85f; Target Natchanon45/food-order-app feature/react-firebase-port from a75c3024. Implemented a separate notification_first public intake branch, strictly restricted to the demo-penguin-hybrid Functions/Firestore emulator at 127.0.0.1:8189 and p34-notify-* fixture tenants. No live or Staging activation and no customer UI switch in this slice.

Server transaction re-reads active tenant, store/receiver revision, authoritative menu docs and protected route or Lalamove quote cache. Rebuilds items and price, fee/zone, exact route coordinates and TTL, free shipping, amount and recipient. Rejects unsupported gift promotions, manual distance fallback, configured Lalamove distance caps without trusted quote distance, stale/foreign evidence, duplicated/hidden items, invalid receiver and mixed QR/slip/COD. Stores only pending_verification with no slip and first-create 256-bit correction capability (digest only in Firestore). Existing signed correction can accept original slip afterward without settling money. Direct staff browser changes/deletes to this flow are denied by Firestore rules, legacy slip settlement and legacy companion matching exclude the new flow. No automatic payment, Kitchen or dispatch authority.

QA: targeted 43/43 contract/regression tests PASS (7 new cases plus existing 36); real isolated Firebase Emulator 3/3 PASS including no-slip creation, rejection of forged amounts/receiver, original-bill correction rights and duplicate create. Full React parity 888/888 PASS, exit 0. Provider quote cases are synthetic. The 3-case emulator run preceded the final legacy matcher exclusion, which is covered by the final contract tests. Direct Owner write/delete negative test was not executed; rules compiled in the emulator and the final contract verifies the guard. No React build rerun (no frontend code changes). No live bank or provider call. No Source writes, main merge, Production deployment or mobile build.

Next: implement dedicated notification matching/reconciliation (current receiver revision, timing window, ambiguous matches, audit and one-time claims), signed review routing, then connect checkout UI to an explicitly authorized availability gate, support canonical gift promotion/manual distance handling and test actual Staging bank/Stripe/Lalamove. The two Delivery pages are still pending full Source acceptance. Strict master remains 15/65=23.1% accepted/dispositioned; 50/65=76.9% pending.

## Pseudocode

    reject notification_first unless isolated demo project / emulator / fixture tenant
    require PromptPay, exact recipient, no slip and no mixed QR
    in Firestore transaction:
      re-read active tenant, store opening hours and payment receiver
      re-read catalog menu, protected server route or quote evidence
      validate quantity, price, exact zone/coordinates and expiry
      rebuild subtotal, free shipping, final fee and total
      reject unsupported gift promotions or uncertain distance
      create only canonical pending order + receiver revision + capability digest
    return one-time customer correction capability
    never use legacy settlement or advisory matching for this rail
    allow signed original-slip correction but no automatic paid or Kitchen release

## Scope limitations

The Source permits optional slip at checkout. This slice deliberately accepts no slip at intake, followed by the existing signed correction path; no optional pre-create proof attachment or new browser path is wired yet. The route/quote evidence is server-owned, but actual Google/Lalamove API verification is not part of the synthetic tests. Lalamove max-distance enforcement requires authoritative quote distance; manual routing and enabled gift configuration are rejected rather than silently accepted. The receiver revision uses the existing store revision digest and is not bank ownership proof. Do not treat demo acceptance as Staging or Production readiness.
