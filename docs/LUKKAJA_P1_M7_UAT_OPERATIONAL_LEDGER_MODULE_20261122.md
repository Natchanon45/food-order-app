# M7 Operational Financial Ledger — UAT Shadow Accounting Module

**Date:** 22 November 2026 (Thailand)
**Source:** `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe` @ `03d2aaee`, read-only
**Target:** `Natchanon45/food-order-app` / `feature/react-firebase-port`
**Module completion boundary:** Full isolated **financial UAT shadow engine** with evidence-gated staging, balanced journal, immutable/global claims, hold simulation, Superadmin controls, and acceptance tests. **Not a production paid/credit/hold writer.**
**Deployment:** No Firebase deployment, no real Stripe charge, no bank connection.

## Why this isolation is mandatory

The M7 Source MySQL operational ledger is more than one Firebase
`hybridBillingInvoices.status` field. Source Go transactions require:
- A genuine **signed immutable Invoice Snapshot** from the original
  issuance (tenant, kind, amount, cycle, pricing, beneficiary SHA).
- Independently authenticated bank/provider settlement
  and global uniqueness of payment references.
- An **append-only Service Credit account** with strict sequence,
  verified monthly conversions and daily/monthly offsets.
- One serializable transaction for invoice Paid/credit/hold transitions.
- Signed Hold Policy approvals and checks for **all** concurrent
  security/manual/subscription/revenue-share restrictions.
- Historical refund, void, correction and chargeback coverage.

The previous Source Migration Preflight accepts only **sanitized
self-reported exports**, and explicitly states:
`sourceProvenanceAuthenticated = false` and
`bankCashApproved = false`. These flags cannot be promoted into
real money by comparing dates/amounts or by a Superadmin clicking
Approve. Stripe TEST Shadow records cannot be an alternative bank
statement.

This module therefore implements and tests all deterministic accounting
and Firestore transaction invariants **in a separate UAT financial
shadow namespace**. No operational Firestore invoice, tenant,
Service Credit, bank or wallet document may be modified by it.
This is a functional accounting-engine UAT module, **not** a completed
live Operational Settlement module.

## Source parity

Source references:
```text
goapi/cmd/web/merchant_service_credit_policy.go
goapi/cmd/web/merchant_service_credit_reclassification.go
goapi/cmd/web/m7_operational_service_credit.go
goapi/cmd/web/m7_operational_hold_approval.go
goapi/cmd/web/merchant_payment_access_policy.go
goapi/cmd/web/bankalert_stripe_m7_settlement.go
goapi/development/production_lukkaja_m7_additive_SCHEMA_UP_20261107.sql
goapi/development/M7_BATCH2_SIGNED_HOLD_POLICY_UP_20261105.sql
```

Ledger invariants:
1. Each Invoice is unique by **global immutable Source invoice SHA-256**.
2. All money uses **integer satang** bounded by
   `Number.MAX_SAFE_INTEGER`; no float rounding or overdraw.
3. Source Gross = Source-applied Service Credit +
   Source-reported Bank Cash + Arithmetic Residual.
   **Reported Bank Cash is not independently bank verified.**
4. Waved/voided/corrected Invoice state is never interpreted as
   income, active-access approval or a reason to forget other holds.
5. Source Credit event sequence and verified original conversion
   provenance are structurally checked using the previous pinned
   ten-table migration validator. This is NOT a bank certification.
6. Every Invoice produces a synthetic balanced journal:
   - Debit: `export_gross_invoice_advisory_dr`
   - Credit: `export_applied_credit_unverified_cr`
   - Credit: `export_bank_cash_reported_unverified_cr`
   - Credit: `export_remaining_receivable_uncertified_cr`
   Its debit total must equal its credit total. Every invoice's journal
   legs carry an immutable SHA-256 **hash chain**, with a full summary
   digest. All journal legs are explicitly `operationalPosting:false`.
7. Source Hold Approval HMAC is **not independently verified**.
   Even if cutoff has passed or a status says Paid, the shadow reports
   only a possible review state; it never suppresses other
   manual/security/subscription restrictions or touches order gates.
   A cutoff date alone does not certify the source's 00:20 Bangkok
   grace behavior.
8. Audit replay accepts the **exact same** source manifest only.
   Change a Source snapshot or bank reference -> separate manual
   investigation, no automatic revision/double charge.

### Main functions

```text
functions/m7-uat-operational-ledger-policy.js
  Pure source invoice + balance arithmetic, duplicate/overflow
  detection, sanitized per-invoice shadow and SHA summary digest

functions/m7-uat-financial-journal-policy.js
  Balanced double-entry SOURCE EXPORT PROJECTION, deterministic
  4-account journal, source-scope SHA hash chain, integrity check

functions/m7-uat-financial-hold-policy.js
  Asia/Bangkok day-based review candidates, signed-approval-not-proven
  flags, independent legacy/security hold always preserved

functions/m7-uat-operational-ledger.js
  Superadmin UAT-only preview, transactional shadow staging,
  global bank/invoice claims, private sanitized history

react-app/src/components/M7UatFinancialShadow.jsx
  Inline continuation after Source Preflight confirm:
  Preview -> separate explicit consent -> private UAT shadow -> history
```

## Firestore transaction and data boundary

This is the only newly written data:
```text
tenants/{tenantId}/m7UatFinancialShadowRuns/{sourceManifestDigest}
  Shadow totals, synthetic journal legs, hashed invoice IDs, Source
  hold review candidates, immutable summary hash; all operational flags
  FALSE, no original Source raw rows, slip or bank account numbers

m7UatFinancialTenantLocks/{tenantId}
  One immutable snapshot digest per tenant for UAT shadow, no overwrite

m7UatFinancialBankClaims/{sha256(type+sourceBankRefHash)}
  GLOBAL UAT-only claim, tenant + source snapshot digest,
  operationalBankVerified=false

m7UatFinancialInvoiceClaims/{sha256(type+sourceInvoiceKeyHash)}
  GLOBAL UAT-only claim, tenant + source snapshot digest,
  financialPostingAllowed=false
```

All four namespaces deny browser reads and writes in
`firestore.rules`. The server reads/writes with the Admin SDK after
authenticating the active Superadmin and exact project/tenant UAT gate.

**Transaction protocol:**
1. Client provides only the same sanitized `{manifest}` used
   in the Source Migration Preflight module. No paid flag, bank amount,
   release status, correction amount or invoice ID is separately
   accepted from the browser.
2. Server validates the complete pinned source schema contract and
   checks structural issue count = 0. Each source value remains
   UNTRUSTED even after this.
3. Server creates a deterministic journal, tests arithmetic,
   calculates hold review candidates and computes account digest.
4. Server reads current Firebase Invoice candidates for diagnostic
   comparison. This scan is **non-atomic and never an approval**.
5. In ONE Firestore transaction, server re-checks active Superadmin,
   scoped tenant, matching **previously staged** Source Preflight Audit,
   exact Source digest and comparison outcome, existing tenant lock,
   existing shadow run and all global bank/invoice claims.
6. If ANY global claim belongs to a different tenant or Source digest,
   reject everything. Eight concurrent identical requests create
   exactly one shadow, one tenant lock and one copy of each claim.
7. Replayed requests must match the immutable journal and summary
   digest; altered data is `needs_review`, not silently repaired.
8. No transaction ever reads/writes a real operational Source/Hybrid
   invoice, operational credit account, actual bank reference, delivery
   order, tenant status, Stripe TEST settlement, Lalamove Wallet or
   outside access gate.

To keep Firestore transactions within sane bounds, the UAT shadow
supports at most **60 Source invoice rows** and **60 Bank Reference
claims** per tenant/snapshot. Larger snapshots require an explicitly
designed batched reconciliation with an independently audited, atomic
coverage witness; partial tables must not be mistaken for complete
financial history.

### Default-off runtime gate

```text
PENGUIN_M7_UAT_FINANCIAL_LEDGER_ENABLED=1
PENGUIN_M7_UAT_FINANCIAL_LEDGER_PROJECT_ID=<exact isolated UAT/test project>
PENGUIN_M7_UAT_FINANCIAL_LEDGER_TENANT_ID=<exact isolated tenant>
```

The active project must match the allowlisted UAT/test project and
must not be `penguin-food`, contain `prod`, `production`, `demo`,
or be an emulator. All live Callables remain disabled by default.
Emulator unit/integration tests use an explicit **injected**
allowlist and synthetic fixtures (never real credentials).

Callables:
- `previewPlatformM7UatFinancialShadow({manifest})` — verifies
  structural preflight evidence and returns an **untrusted-source**
  accounting simulation; does not write.
- `stagePlatformM7UatFinancialShadow({manifest})` — requires
  separate Superadmin consent in UI and writes a *private UAT*
  shadow + global claims in one Firestore transaction.
- `getPlatformM7UatFinancialShadowHistory({tenantId})` — reads
  up to 20 private shadow summaries; downgrades tampered hashes.

### Source-provided funds are NEVER claimable

The following always remain false in shadow/API/UI:
```text
sourceIdentityNotAttested = true
bankStatementSourceAuthenticated = false
bankCashOperationallyVerified = false
serviceCreditOperationallyAvailable = false
testStripeShadowCountedAsBankCash = false
billingInvoicesMutated = false
tenantAccessMutated = false
payoutOrRefundPerformed = false
financialPostingAuthorized = false
operationalReleaseAuthorized = false
```

**This module does not establish or use a real "Paid" status.**
If the source export says Bank Paid 500 THB, UI shows
"เงินธนาคารตาม Export (ยังไม่ยืนยัน) 500.00 บาท".
If the source export says remaining cash 152.20 THB, this is labeled
"หนี้คงเหลือตาม Export (รอตรวจ)", not a collectible invoice
automatically charged.

## Test coverage

```text
tests/react-parity/p1-m7-uat-operational-ledger-policy.spec.mjs
tests/react-parity/p1-m7-uat-financial-journal-policy.spec.mjs
tests/react-parity/p1-m7-uat-financial-hold-policy.spec.mjs
tests/react-parity/p1-m7-uat-financial-shadow-browser.spec.mjs
tests/firebase-emulator/p1-m7-uat-operational-ledger.spec.mjs
```

- Three Source invoices balance exactly at 115,220 satang:
  Gross 115,220, credit 50,000, Source bank 50,000,
  outstanding Source 15,220 and Source ending credit 0.
- Seven journal legs balance exactly at 115,220/115,220 satang;
  tampered hash chain, fake bank/credit flag or negative amount
  invalidate the shadow.
- Hold status changes cannot authorize tenant access, even when
  source says resolved, waived, disputed or pending slip.
- Bangkok cutoff **day** ambiguity is preserved; never guesses
  actual policy-approved time.
- Missing Source Preflight Audit refuses financial shadow staging.
- Exact preflight snapshot and current UAT tenant + operator
  role are re-checked within the Firestore transaction.
- Eight concurrent same-digest commits lead to exactly one
  shadow; changed original snapshots block replay.
- Cross-tenant identical Bank Ref refused even when all Source
  Invoice Keys differ; no partial transaction/claims left behind.
- Corrupted private shadow digest shown as `needs_review`.
- Browser across 320/390/768/1440 widths, separate review and
  confirm, no operational paid/credit/hold buttons.

## Explicit next MODULE blockers

**Operational source-certified cash and Service Credit posting are
not activated here.** Before a LIVE financial ledger can be
implemented and safely deployed, the following external proofs and
decisions are prerequisites:

1. A trusted, consistent original Source SQL exporter and original
   signed invoice authenticity verification (not operator-uploaded
   booleans or SHA strings).
2. Independent bank statement/provider source authentication and
   global cross-tenant reference uniqueness against **all** historical
   orders, refunds and bank receipts, with reconciliation covering
   events before migration. The UAT claim index is separate from
   actual bank cash.
3. Original beneficiary/pricing SHA and tax/credit-note corrections
   for each immutable invoice; no retroactive charges for test shops.
4. Operational shared Firestore debit/credit posting that updates
   invoice+Service Credit+bank-ref+approved hold in ONE transaction,
   with signed source evidence and independent idempotency.
5. Signed tenant hold approval and all non-financial/security holds,
   including tested 00:00/00:20 policy schedule.
6. Real provider UAT before any Production rollout. Explicit user
   approval required for deploy.

No Source repository edits and no Firebase deployment.

## Final local module acceptance (2026-11-22)

| Check | Result |
|---|---|
| `npm run test:m7-uat-operational-ledger` | **16/16 PASS**, includes four-browser-width UI |
| Firestore Emulator joint M7 / BankAlert / Telegram / Finance regression | **75/75 PASS** |
| Firestore Rules direct-client denial of shadow, tenant lock and global claims | **PASS**, read AND write refused |
| `npm run test:react-parity` entire existing project | **PASS** |
| `npm run test:react-callables` | **112 client Callable references, 0 missing exports** |
| `npm run build:react` | **PASS** with generated bundle contract |
| `git diff --check` and repo separation | Checked before commit |
| Actual Stripe TEST provider / independent bank statement | **NOT CONNECTED** |
| Production Firebase deployment | **NOT PERFORMED** |

### Current JSX baseline, for module-to-module continuation

- Source `resources/js/react-port`: **154 JSX files / 48,500 lines**.
- Target `react-app/src`: **103 JSX files / 36,750 lines**.

File and line counts describe physical code, not feature-completion
percentage. This UAT financial shadow module is fully tested within its
specified safety boundary. Any live operational finance posting
requires independent Source/bank evidence and a separate module.
