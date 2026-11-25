# P3.4.6 — Synthetic bank evidence preflight

Source read-only cosmatch/lukkhaja feature/react-golang-vite-tailwind-axios@7e47e85f; Target Natchanon45/food-order-app feature/react-firebase-port from 5c570c16. Source Go supports signed cashier attestation of a real bank receipt separately from unverified Android notice. This slice adds an independent synthetic bank-credit signature preflight rather than claiming real bank acceptance or paid-state parity.

New managed Callable recordDeliveryDemoBankEvidencePreflight reuses the same active Owner/Admin/Cashier tenant-scoped demo authorization; request contains only orderId and evidenceId. Transaction re-reads original pending order, current store receiver revision, receiver opt-in, matched notice/device, immutable observation review and both claims. Server-only demo evidence and independently pinned synthetic Ed25519 registry are required; exact order, tenant, notification, amount, full receiving-account fingerprint, currency THB, posted credit, posting time and key validity are checked. Browser cannot supply evidence payload, keys or authority. Global demo reference claim prevents repeat use across fixture tenants and checks the existing legacy reference index without writing to it. Per-order receipt and reference claim are created together, replay must match the same evidence and existing claim. No order write, payment settlement, Kitchen release, invoice posting or delivery dispatch. Private rules explicitly deny all browser access to demo evidence/keys/reference claims.

QA: targeted 26/26 PASS (7 new evidence/transaction/contract tests; 50 managed modules/157 Callables). Firebase Emulator 4/4 PASS, Exit 0, including actual concurrent Admin SDK Firestore transactions with synthetic evidence: one receipt/reference claim, one idempotent replay, unchanged unpaid order, no legacy reference mutation. An initial test import-path failure was corrected and rerun. Full serial React Parity 901/901 PASS, Exit 0. Web build not rerun because no frontend inputs changed. Signed matcher and signed reconciliation end-to-end acceptance are still pending. Synthetic signature does not establish real bank provenance or transaction validity. The demo reference hash cannot guarantee operational cross-provider duplicate protection until actual bank reference semantics are verified. No new production key/provider or live payment enabled.

Next: complete signed matcher and evidence review transport acceptance; implement Source-equivalent real bank receipt attestation/reconciliation under explicit authorized Staging controls, then Checkout UI integration and full Delivery acceptance. Both Delivery JSX pages remain pending. Master 15/65=23.1% accepted/dispositioned; 50/65=76.9% remaining. No Source edits, main merge, deployment or mobile builds.

## Pseudocode

    authenticate same-tenant active merchant staff in demo only
    read order and immutable observation review/claims in transaction
    revalidate receiver revision, exact amount and notice provenance
    read server-only demo credit envelope and pinned key registry
    verify exact scope, posted credit and Ed25519 signature
    check global demo reference and existing legacy reference index
    create immutable preflight receipt and demo reference claim together
    return unverified flags; do not write operational order/payment state

## Pending acceptance

Real signed role/tenant transport and true provider origin, actual transaction ID and bank receipt semantics, authorized Staging lifecycle, customer and cashier UI, and operational duplicate reference policy remain outstanding.
