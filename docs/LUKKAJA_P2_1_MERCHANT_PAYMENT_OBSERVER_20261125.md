# P2.1 — Merchant Owner Payment Observer (latest Source JSX)

**Date:** 2026-11-25 (Asia/Bangkok)
**Source, read-only:** `cosmatch/lukkhaja` branch `feature/react-golang-vite-tailwind-axios@7bf9d15934f387cd887b46d1b17ca1f2924ffab0`
**Target:** `Natchanon45/food-order-app` branch `feature/react-firebase-port`, base `c56d6d3dfe27b7b5e45c6a23ba8f354ea3ecff6a`.
**Scope:** **P2.1**, an independently complete *read-only Owner Payment Observer* submodule of the larger ten-page P2 Merchant Admin/onboarding phase. **Not P2 10/10.**

## Source inspection and safe adaptation

The latest selected Source `AdminPage.jsx` adds:
1. a collapsed **Owner-only** `paymentCompanionObserverCard` after Sales Report and before Store/QR, with responsive full/compact heading and Source `PaymentCompanionObserverCard` (309 lines),
2. `PlatformLineWalletTopup`, a Go/SQL authoritative bank/LINE payment request/appeal flow with QR, expiry, refund/retry and wallet credit following verified payment,
3. non-functional Lalamove Sandbox UAT help-copy adjustments.

The Target already has `getPaymentCompanionDashboard` (Firebase Callable), `PaymentCompanionPairingCard`, `groupCompanionObservations`, and tenant Firestore `paymentCompanionTenants/{tenantId}`. Target has **no Go/SQL wallet payment request API and no trusted LK Shop Outbox read-equivalent**. Blindly copying Source Go fetches would be wrong; this module ports the supported observer without adding banking authority or pretending unsupported data exists. Payment provider/appeal is a separately gated module.

### Completed UI / action families (8)

1. Added Source-aligned, owner-only, **default collapsed** `PaymentCompanionObserverCard` in `AdminPage.jsx` after Sales Report and before Delivery QR. Retained PENGUIN branding, original routing and default collapsed CSS/behavior.
2. Read through existing `getPaymentCompanionDashboard` Callable, which requires an active native Firebase Owner and active Tenant. No direct Browser Firestore read or new broad permission; neither cashier, admin, another Tenant, anonymous nor inactive Owner may access this read.
3. Strict projection `projectMerchantObserver` fails closed unless all flags `paymentVerified:false`, `bankConfirmed:false`, `canSettleInvoice:false`, `canReleaseKitchen:false` and bounded arrays are present. Each notification requires integer nonnegative satang and unverified flags; duplicate notification IDs are rejected.
4. Source metrics: notifications (up to 50), grouped alerts, possible duplicate groups, activated device slots, last receipt in Bangkok time. Grouping is **visual only**, not bank transaction dedupe or proof of settlement.
5. Source-derived scrollable activity with amount, date, device, masked suffix, possible duplicate warning; status always `รอตรวจสอบ`, never bank-approved. Error/empty/disabled states and explicit Refresh.
6. Source `รายการจับคู่เพื่อประกอบการตรวจสอบ` presents only backend-sourced candidate summaries; no order Paid, release Kitchen, accept false UAT or Lalamove charges. Backend incomplete/unavailable → explicit unavailable UI.
7. Source LK Shop comparison panel is visible but shows a **clear unavailable notice** because Firebase lacks the Source Go Outbox contract; no dummy messages, no invented send counts, no copied raw message. This does not imply LK Shop failed to send.
8. Moved inline metrics/history out of `PaymentCompanionPairingCard` to avoid duplication, keeping actual Android device pairing, receiver confirmation, key revoke and UAT guard/cashier evidence in its original settings card. Scoped CSS for 320/390/768/1440 responsive widths, no emoji.

### Pseudocode (5)

```text
ON ADMIN PAGE:
  check signed session, profile role and Tenant (existing Firebase guards)
  render observer card only for Owner, collapsed, after Sales Report
  render device settings separately in the original Store settings card

OWNER OBSERVE:
  getPaymentCompanionDashboard() uses Firebase Auth and Tenant-bound server
  reject if ANY paid/bank/settlement flag is not explicitly false
  reject forged amount, duplicate event IDs, missing/oversized arrays
  display grouped notifications and candidate matches as UNSUPPORTED proof
  never create/approve invoices, release Kitchen or mutate wallet

GROUP:
  group by existing presentation key: device + amount + receiver suffix + bank UTC
  preserve individual notifications in source; flag possibly duplicate
  never count grouped messages as bank-verified transactions

REFRESH:
  initial read, explicit button, 15-second poll only while expanded & visible
  never send a financial mutation; stale request IDs do not overwrite newer data

UNSUPPORTED PROVIDER:
  Source PlatformLineWalletTopup Go route + LK Shop outbox are not ported
  display unsupported outbox truthfully and do not enable live topup/appeal
  await dedicated Firebase webhook/bank evidence acceptance and approval
```

### Scenarios and acceptance

- Owner sees collapsed observer after Sales Report; non-Owner never sees it.
- 320/390/768/1440 Chrome, status/long labels and duplicate rows do not overflow.
- Duplicated Android messages form one **display group only**, not one settled transfer.
- Explicit Refresh performs only a read, no provider or settlement call.
- Owner can see own authorized Tenant data; other Tenant sees no data.
- Anonymous/cashier/inactive Owner/inactive Tenant denied by existing Callable.
- Missing/forged money flags and malformed notice fields cause **unconfirmed error**, not Paid.
- No fake LK Shop Outbox or Line Wallet topup; no raw payment confirmation fabricated.
- Original Android pairing, receiver confirmation, device revoke, and UAT controls remain and pass legacy regressions.
- No source repository writes, real provider calls, Production deployment, main merge, email or mobile build.

**Final QA receipts (2026-11-25):**
- `npm run test:p21-merchant-observer`: **4/4 PASS**, Source page placement, Owner-only visibility, strict notification/paid flags, unsupported provider gate.
- `npm run test:p21-merchant-observer-local`: **exit 0**, Firebase Emulator Owner/Tenant policy **1/1 PASS** and isolated Chrome **1/1 PASS** across 320,390,768,1440 widths, default collapsed, duplicate grouping and manual refresh. Browser is a **Chrome fixture using mocked read-only Callable**; Owner/tenant server policy is independently exercised against the real Firestore Emulator. This is not a live bank/Android deployment.
- Existing full Android Pairing + Cashier UAT/browser regression `node --test --test-concurrency=1 tests/react-parity/p1-payment-companion-policy.spec.mjs tests/react-parity/p1-payment-companion-browser.spec.mjs`: **4/4 PASS**, including pairing token, receiver confirmation, UAT guard, device revoke.
- `npm run test:react-parity`: **complete serial suite PASS, exit 0** (includes the new P2.1 Source contract and prior P1.5 wallet/security).
- `npm run build:react` + generated Hosting Contract: **PASS exit 0**, `2026.11.09.535`, `/react/assets/index-DTLfIgLI.js`. All build-generated `public/**` changes restored/removed, no Hosting deployment.
- `git diff --check`: PASS; temporary `.p21-local-acceptance-emulator.json` cleaned, original Source unchanged.

### Remaining P2 modules, do not claim complete

Merchant Admin source `PlatformLineWalletTopup` (Go-based bank/QR request, expiry, appeal and provider reconciliation), `AdminStoreMasterPage` (Source-only extract, no router entry), Store Settings/master / image uploads, onboarding/Auth, QR and Admin Sales Report deeper action parity. Source `PlatformLineWalletTopup` must be ported ONLY with bank-authoritative webhook/receipt idempotency, Tenant-scoped storage and bank evidence; otherwise show disabled/unavailable rail, never synthetic money. Recommended next: **P2.2 Merchant Store Master / QR / Image crop and Firebase persistence**; provider payment rails receive their own separate finance acceptance gate.
