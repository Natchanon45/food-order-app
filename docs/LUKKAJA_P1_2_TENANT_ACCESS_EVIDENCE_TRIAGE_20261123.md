# P1.2e — Superadmin Tenant Access / Independent Hold Evidence Triage

**Local full-module delivery · 23 November 2026**

## Repository and scope

| Field | Pin |
|---|---|
| Source | `cosmatch/lukkhaja`, branch `feature/lukkaja_bankalert_stripe` |
| Source commit | `e60858c1` (strictly **read-only**, no local edits) |
| Firebase target | `Natchanon45/food-order-app`, branch `feature/react-firebase-port` |
| Module | **P1.2e — read-only Superadmin access/hold evidence triage** |
| Writes to Source / Firebase Production | **NONE** |
| Money movement / credit / debt / invoice / sales permission writes | **NONE** |
| Privileged actors | Authenticated, active `super_admin` from Firestore user profile |

This module follows **P1.2c atomic tenant+Owner provisioning** and
**P1.2d legacy membership mutation + safe stale-write recovery**.

### Source behavior and the existing migration gap

Source (Go/SQL) has separate policy/ledger mechanisms:

- `goapi/cmd/web/merchant_payment_access_policy.go` computes
  manual/security, legacy membership, historic Delivery Revenue Share
  and independent monthly/yearly/Delivery Daily invoice restrictions.
  Its Go comment explicitly requires **nil operational invoices**
  in production until the independent signed hold ledger exists.
- `goapi/cmd/web/m7_operational_hold_approval.go` checks an approved,
  original immutable invoice **HMAC-SHA256 signature using the Go secret**
  and an approved Bangkok cutoff; approval alone does not prove bank
  payment or authorize a tenant release.
- `goapi/cmd/web/merchant_m7_isolated_three_way_holds.go` models
  hold transitions for **isolated UAT only**, with
  `CanReleaseTenant: false`, separate correction/waiver
  authorization, disputes and legacy/security holds.
- `goapi/cmd/web/main.go` exposes historical M7 status/reason and
  a localhost-only Superadmin TEST override. The TEST override is
  not independent permission to open a real shop.

The Firebase target already has candidate `m7FinanceAccessStatus`,
`m7FinanceAccessReason`, `revenueShareSuspended`, legacy
subscription and TEST override metadata. Those fields can describe
a suspected restriction but **cannot certify** an original Go HMAC,
Source invoice journal, bank statement, Source Credit, signed cutoff
or that someone may resume sales. A tenant-level flag, Stripe TEST
shadow, slip picture or SHA digest is not proof of payment.

The last module safely handles the **legacy** subscription command.
This module makes the **independent financial/restriction evidence
gap visible** in a compact per-shop Superadmin read-only card,
without letting a missing or forged result open a shop.

## Implemented artifacts

### 1. Pure Source-aligned, immutable triage contract

`functions/tenant-access-evidence-policy.js`

- Normalizes *only* bounded, non-sensitive tenant/access fields.
- Compares Tenant against its exact canonical public
  `tenantSlugs/{slug}` for owner, active/status/grace and expiry
  consistency (never scans the whole tenant collection).
- Classifies **three independent categories**:
  `recorded_restriction`, `review_required`, and
  `no_recorded_restriction_unverified`.
- Preserves distinct reason codes for:
  active/inactive, manual/security, membership suspended or past
  grace, historical Delivery Revenue Share, Hybrid hold,
  suspected M7 invoice hold, M7 manual review, TEST override,
  unknown status, absent original activation/expiry and
  missing/mismatched public Slug.
- Calendar expiry uses UTC timestamps/strict integer 0–30-day
  grace with the source Bangkok +7 accounting day. A missing
  owner/activation/expiry does not invent a trial or permission.
- Deliberately treats `m7FinanceAccessStatus=suspended` as
  **M7_RECORDED_HOLD_UNVERIFIED** and never converts
  `m7InvoiceUnpaidCents` or
  `m7MaturedInvoiceHolds` into a financial obligation.
- Generates a deterministic SHA-256 **snapshot fingerprint** only
  for detecting metadata drift. It is **not** a signature or
  proof of Go HMAC, bank cash or ownership.
- Does not include names, email, bank account numbers, payment
  receipts, Stripe keys, contact details or owner IDs in output.

All projected responses have *hardcoded safety invariants*:

```json
{
  "mode": "p12e_source_access_evidence_triage",
  "ok": true,
  "readOnly": true,
  "canSell": null,
  "certifiedOpenInvoiceCount": null,
  "certifiedOutstandingCents": null,
  "sourceOriginalHoldSignatureVerified": false,
  "independentBankCashVerified": false,
  "originalInvoiceJournalCertified": false,
  "sourceCreditLedgerCertified": false,
  "financialBalanceKnown": false,
  "canReleaseTenant": false,
  "canSettleMoney": false,
  "canIssueInvoice": false,
  "canApplyCredit": false,
  "writesPerformed": false
}
```

*The real Callable also returns a tenant ID, scoped Superadmin proof,
state, reason codes, source gaps, slug consistency and a diagnostic
digest; these cannot change the safety invariants above.*

### 2. One transactional read-only Callable

`functions/tenant-access-evidence.js`

`getPlatformTenantAccessEvidence({tenantId})`

- Refuses unknown/request-extra fields and unauthenticated callers.
- Checks actual active `super_admin` profile inside a Firestore
  transaction, not solely browser state or a client-supplied role.
- Reads one Tenant and its exact public Slug in a **single
  consistent Firestore transaction**.
- Returns a fixed, safe projection, not raw tenant data,
  invoices, bank details or passwords.
- Does not use `tx.update()`, `tx.set()`,
  `tx.create()` or `tx.delete()`; does not write
  an audit document or set a tenant access bit.
- A cross-shop read is allowed *only* for real Superadmin and
  only ever returns evidence for that exact selected tenant ID.
- This read is not gated on Stripe TEST env because it has no
  ability to pay, change finance state, or release a shop.

### 3. Strict Browser contract and responsive Superadmin UI

`react-app/src/data/tenantAccessEvidenceContract.mjs`
`react-app/src/components/TenantAccessEvidencePanel.jsx`
`react-app/src/ui/tenant-access-evidence.css`
`react-app/src/components/TenantControlPanel.jsx`

- The new panel appears **only when expanding one Tenant
  card** in Superadmin's existing `Module Access Status`.
  Closed cards trigger no network request.
- It identifies which **metadata restrictions** were recorded
  and lists all five original Source proof gaps.
- It never shows `0 บาท` or `Invoice ชำระแล้ว` from
  absent/missing financial evidence; no invoice, credit
  or bank claim is inferred.
- Labels existing module access rows as **"ตามข้อมูลร้าน"**
  or **"ระงับตามข้อมูล"**, rather than describing heuristic
  metadata as permission that was verified in an operational
  cashier/kitchen/selling path.
- A TEST `allow` override no longer outranks independent
  recorded restrictions in the store card's displayed status.
- Old suspicious M7 invoice-hold count/amount metadata no
  longer generates a fake overdue balance or claims automatic
  release on the Superadmin card.
- Only **read-only refresh** is interactive; no suspend,
  activate, waive, payment, Service Credit or override
  actions are created in this panel.
- Client validates a strict response with `canSell:null`,
  certified amount fields `null`, all financial/write
  authority flags `false`, known reasons, fixed source
  gaps and matching tenant ID before rendering any claim.
- Stale results from a previously selected tenant are
  discarded. API errors, invalid receipts or missing response
  **fail closed to unavailable** without showing a success.
- Existing Source/PENGUIN Tenant UI, Admin modal, billing
  card, other existing actions and dashboard layout remain
  intact; no emoji are used in the web implementation.

### 4. Firestore Rules defense in depth

The Superadmin browser cannot directly alter the guarded
Tenant `m7FinanceAccessStatus`, `m7FinanceAccessReason`,
`m7AdminTestOverrideMode`, `m7AdminTestOverrideExpiresAt`,
`m7AdminTestOverrideAvailable`, `m7MaturedInvoiceHolds`
or `m7InvoiceUnpaidCents` fields. This extends P1.2d's
pre-existing client-write denial to those source metadata
fields; the new Callable uses **no Admin SDK writes**.

The rules intentionally still allow documented non-financial
Superadmin profile edits. No new public access is granted.

## Safe interpretation

| Condition in Firebase | Triage display | Operational action allowed |
|---|---|---|
| Manual/security suspension | Recorded restriction | **No** automatic release |
| Membership expired/suspended | Recorded restriction | **No** invoice action |
| Delivery Revenue Share hold | Recorded restriction | **No** automatic release |
| Hybrid Billing hold | Recorded restriction | **No** automatic release |
| M7 `suspended` / `m7_overdue_invoice` metadata | Recorded, **NOT certified** | **No** real M7 hold enforcement or debt claim |
| Source proof missing, no flags | No recorded restriction, **unverified** | **No** permission grant |
| M7 review-required or unknown flag | Manual review | **No** permission grant |
| TEST override `allow` | TEST metadata only | **No** security/financial bypass |
| Public slug missing/different | Review required | **No** silent fallback |
| Source signed hold+bank proof missing | Explicit Source gap | **No** Paid/Credit/Release |

## Acceptance gates / test references

- `tests/react-parity/p1-tenant-access-evidence-policy.spec.mjs`:
  pure deterministic projection, strict grace, all separate hold
  classes, missing original membership, unknown statuses,
  signed-proof absence, Source bank-account redaction and
  SHA snapshot drift.
- `tests/firebase-emulator/p1-tenant-access-evidence.spec.mjs`:
  Auth+Firestore isolated demo, active Superadmin only,
  wrong-role/disabled/anonymous denial, extra-field rejection,
  consistent cross-shop snapshot, missing/foreign public Slug,
  TEST allow with manual/M7 hold, old membership, other hold
  types, eight simultaneous **read-only** calls, PII/money
  redaction, and direct browser denial of forged M7 access
  fields even while logged in as Superadmin.
- `tests/react-parity/p1-tenant-access-evidence-ui.spec.mjs`:
  strict client response safety invariant, component and
  Callable wiring, absence of mutation actions, Chrome
  responsive widths **320/390/768/1440**, lazy expansion,
  stale tenant response isolation, wrong-proof rejection and
  failure that does not expose financial access.

Regression: combined P1.2c/d/e Auth+Firestore Emulator, full
`npm run test:react-parity`, Callable reference audit,
React generated build and GitHub SHA are verified at
module close.

## Deferred — explicit hard blockers

This module **does not** move Source Go/SQL approved hold
journals, verify HMAC using the real Go secret, authenticate
independent bank statements, migrate global bank-reference
claims, post Service Credit, handle real signed adjustment
approval, or perform atomic M7 source-authoritative
financial suspension or release in Firebase.

Therefore it is not a production-ready operational financial
settlement or new permission enforcement engine. It **must
not** be used as authority to set `active=true`,
`m7FinanceAccessStatus=not_suspended`,
`invoice.status=paid` or to create a real invoice.

The next financial module, if commissioned, requires trusted
source exporter/signatures, provider bank evidence, global
reference claims, original invoice HMAC verification and
separately reviewed authorized settlement. No shortcut
using this diagnostic digest or TEST Stripe data is allowed.

## Final local acceptance (before JSX audit refresh)

| Check | Observed result |
|---|---|
| Combined P1.2c + P1.2d + P1.2e Firebase Auth/Firestore Emulator | **39/39 PASS** |
| New pure P1.2e evidence policy unit tests | **14/14 PASS** |
| New React contract + Chrome browser interaction tests | **3/3 PASS** |
| New P1.2e module combined pure/browser test command | **17/17 PASS** |
| Four responsive widths | **320 / 390 / 768 / 1440 px PASS** |
| Existing full project `npm run test:react-parity` | **PASS** |
| React Callable Contract | **117 references, 0 missing exports** |
| `npm run build:react` and generated hosting contract | **PASS** |
| Original LUKKAJA Source modifications | **NONE** |
| Real operational banking / M7 Go HMAC / Production deployment | **NOT ATTEMPTED** |

**This is a complete diagnostic Module, not real M7 settlement.** The
absence of matching records means *unverified*, never a zero debt or
permission grant. TEST local override fields are metadata only.
