# P1.5 — Superadmin Tenant Wallet unified history (latest Source JSX)

**Date:** 2026-11-25, Asia/Bangkok.
**Source (READ ONLY):** `cosmatch/lukkhaja`, branch `feature/react-golang-vite-tailwind-axios` pinned `7bf9d15934f387cd887b46d1b17ca1f2924ffab0`. **Target:** `Natchanon45/food-order-app` branch `feature/react-firebase-port` base `f5ab9d3cf8a10f9f94a3803d5fb4a39414eb435e`.

## What changed and why

The updated Source `AdminTenantsPage.jsx` switched its Stripe-only `wallet.stripeTopups` list to a single `wallet.topupHistory` showing channel badges, contextual action buttons and focused wallet notification rows. It also introduced manual appeal approval prompting for an 8-character bank transaction reference.

PENGUIN cannot simply clone that backend: its real Lalamove credit is in `tenants/{tenantId}/lalamoveWalletTopups` and `lalamoveWalletTransactions`, while `getPlatformStripeWalletSandboxHistory` reads a **different TEST ledger that does not increase real credits**. The bank-authoritative LINE settlement and Stripe LIVE writer are not deployed in this Firebase port. Arbitrarily showing these Sandbox rows in a single real-wallet ledger would misstate cash received. Similarly, typing a bank reference is not proof of a bank credit or absence of prior posting.

This module completes the **canonical Firebase wallet history presentation and manual-review protections** without manufacturing a payment channel or enabling finance that Source's Go backend controls.

## Completed JSX/action families

1. **Unified history:** `BankalertStripeHistory` uses Source 7bf9 JSX for amount, channel, state, date/reference, collapse and focus. It supports authorized `renderActions` and handles responsive long identifiers. Channel labels `slip_transfer`, `bank_transfer` and an explicitly unknown fallback; it does not infer real Stripe from TEST receipts.
2. **Real credit only:** the backend reads the existing tenant-scoped `lalamoveWalletTopups` and separately reads `lalamoveWalletTransactions`; it emits `topupHistoryOrigin:"firebase_real_wallet_only"`, never touching Stripe Sandbox ledger.
3. **Ledger proof:** display status `approved` only when the top-up references a matching real credit ledger row with the exact ID, amount, type, direction and reference; an old/missing ledger becomes `under_review`, never paid.
4. **Review actions:** only rows `walletTopupManualReviewAllowed` under the original strict technical-outage policy show **Approve**; any pending row may show **Reject**, including mismatches/appeals, with a reason. No approval from LINE notification alone.
5. **Appeals fail-closed:** any `verificationStatus:"appeal_pending"` is rejected server-side by `WALLET_APPEAL_BANK_EVIDENCE_REQUIRED`, including when an operator supplies a string that looks like a bank transaction reference. The UI explicitly explains that a trusted bank-cash proof/reconciliation service does not exist yet. This is a narrower, safer implementation than Source's prompt.
6. **Independent canonical readback:** after an approval/rejection Callable, the Client validates the returned summary then makes a separate authorized `getTenantLalamoveWallet` call and verifies exact terminal topup + credit ledger. Unknown outcomes lock repeat actions per Tenant+topup until a terminal canonical state is observed on explicit refresh. Side notifications refresh via `Promise.allSettled` cannot reclassify confirmed credit as a failed write.
7. **Scoped receipt:** source receipt path must match `tenants/{tenantId}/lalamove-wallet-topups/{topupId}/...`; arbitrary external receipt URLs and cross-Tenant storage paths are not opened directly.
8. **History focus:** backend optional `topupId` checks a fixed ID regex and fetches only from the already Superadmin-authorized Tenant when the requested older record falls beyond the last 50. If a legitimate approved topup's wallet transaction is older than the most recent 50 Ledger rows, the Backend reads the **exact referenced same-Tenant Ledger document** independently before showing `approved`. An absent/mismatching Ledger remains `under_review`, avoiding both false success and false warning for old legitimate credits.
9. **Separate Sandbox:** the existing `PlatformStripeWalletSandboxHistory` remains visible *below* the real unified history, clearly labeled as TEST and excluded from real Lalamove balance.
   The read-only `getPlatformStripeWalletSandboxHistory` Callable no longer binds Stripe secrets when reading TEST history. Active Stripe Checkout/signature verification handlers remain secret-bound and unchanged. Firebase Emulator cannot and must not contact Google Secret Manager merely because Superadmin opens the wallet dialog.

10. **UI layout:** mobile-friendly responsive card/action wrapping, bank evidence warning, status/date/ref wrapping, scrollable list and preserved wallet transaction ledger. An explicit `รีเฟรชสถานะและยอด` button makes recovery possible without submitting another financial write, and a supplied exact topup ID sets the Source history focus state.

## Canonical pseudocode (7)

```text
1. GET topup history (active Superadmin):
    resolve canonical Tenant ID / Topup query; read 50 topups and real transactions
    optional authorized same-tenant topup ID lookup
    project each topup to explicit status/channel/amount/path/permission
    only show posted=true when amount+ledger transaction ID/reference/type match
    return origin="firebase_real_wallet_only" with live wallet balance

2. List/read client:
    require exact origin, nonnegative satang, all canonical IDs and unique records
    require no item with APPROVED status but missing independent Ledger proof
    reject missing or partial data; never silently substitute Sandbox

3. Approve technical-only exception:
    require active Superadmin + eligible original outage policy
    reject "appeal_pending" even with manually typed bank reference
    use original Firestore transaction to atomically record Wallet credit
    and one ledger entry; duplicate status cannot credit a second time

4. Reject pending:
    require Superadmin and nonempty reason
    update topup status but no wallet balance change / ledger credit

5. UI confirmation:
    show actual canonical pending row only
    Approve only for technical-eligible; Reject for pending; no forgery
    keep one write busy, then independently reread canonical server state
    require terminal status plus matching credit ledger when approving

6. Lost HTTP reply:
    mark Tenant+topup ambiguous and disable all repeat review controls
    re-read on explicit refresh; unlock only when terminal status confirmed
    do not retry a financial mutation automatically

7. Stripe TEST:
    show separate test balance/history clearly labeled Sandbox
    never include in canonical topupHistory or Lalamove spendable credit
```

## Acceptance and release boundary

- `npm run test:p16-wallet-contract`: **7/7 PASS** — canonical aggregation, invalid history, protected Stripe TEST, missing/mismatched Ledger and action controls.
- `npm run test:p16-wallet-local`: **10/10 Firebase Firestore Emulator** + **1/1 signed real Chrome Browser PASS**, includes 320/390/768/1440 widths, canonical review/reload, disabled appeal approval, exact same-Tenant older Ledger proof, independent Sandbox status, and explicit manual Refresh. **No external Secret Manager contact after read-only Stripe Sandbox handler fix.**
- `npm run build:react` and generated Hosting Contract: **PASS exit 0**, version `2026.11.09.535`, `/react/assets/index-Be4BbLtz.js`. Generated `public/**` outputs restored/removed; nothing deployed.
- `npm run test:react-parity` entire serial suite: **PASS, exit 0** after all previous module/finance/UI security gates, including newly added P1.5 React Contract.

Testing uses `demo-penguin-hybrid` local Auth/Firestore/Functions/Storage emulators, Firestore 8189, JDK21. All project IDs and provider secrets are blocked from real Production payment calls. Report actual PASS/FAIL results from receipts; do not assume.

**Final QA note:** The first browser attempt correctly identified a missing Firebase Functions import after copying the Source unified history component; the preserved PENGUIN Sandbox renderer now imports its own Callable. The second attempt confirmed UI correctness but detected outbound Secret Manager access from a read-only Stripe Sandbox history Callable; the final handler no longer binds secrets and the signed Chrome Browser passed with zero external Secret Manager attempts. **The original Stripe TEST Checkout, webhook, and secret-bound write handlers remain unchanged.**

**Outstanding independent provider module:** Stripe LIVE + bank/LINE/LK Connect authoritative settlement, signed webhook and duplicate claim verification, and actual `appeal_pending` approval with trusted bank transaction evidence are **not implemented or enabled**. They require a separate financial provider acceptance module and authorized Staging QA before any real automatic wallet credit. No Production deploy, no `main` merge, no Source writes, no APK/IPA.
