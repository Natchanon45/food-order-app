# M7 Source-to-Firebase migration preflight module
**Date:** 2026-11-22 (Asia/Bangkok)
**Source read-only:** `cosmatch/lukkhaja`, `feature/lukkaja_bankalert_stripe` @ `03d2aaeeaf56f4c0d63a51d19bf7ebbcc63d62fd`
**Target:** `Natchanon45/food-order-app`, `feature/react-firebase-port`
**Module boundary:** M7 **Migration Preflight, Candidate Reconciliation and UAT Evidence Audit**. This module is complete as a diagnostic, **not** as a live payment/migration runner.
**Deployment:** Not performed.

## Scope and architectural decision

The previous milestone ported pure Go Service Credit calculations and a
read-only Finance Readiness card. This module delivers a **single, end-to-end
preflight workflow** to turn a *sanitized*, operator-supplied export of the
original MariaDB M7 journals into:
1. A structurally validated, repeatable **versioned migration contract**;
2. A row-by-row, cross-table reconciliation of invoices, credit,
   payment evidence, bank-ref claims, finance adjustments and holds;
3. A **read-only candidate comparison** to existing Firebase Hybrid invoices;
4. A deterministic, content-derived SHA-256 digest and a private,
   idempotent UAT Audit that stores **only sanitized counts and codes**;
5. A Superadmin upload/review/confirm/history UI, an offline CLI and
   tests for malformed/duplicate/cross-tenant data and concurrency.

All post-migration **real-money writers are deliberately absent**. Neither
a syntactically clean export nor its SHA-256 hash is evidence that the
database snapshot was honestly exported, that its bank transactions
occurred, that a signed Source invoice is authentic, or that a tenant's
financial holds can be lifted.

### Original SQL revisions pinned

- `goapi/development/production_lukkaja_m7_additive_SCHEMA_UP_20261107.sql`
  SHA-256: `1b104bf624ce96997c577e3ccc78880bf8fec3e0b9ae108e492d77317afa3eb6`
- `goapi/development/M7_BATCH2_SIGNED_HOLD_POLICY_UP_20261105.sql`
  SHA-256: `54777f521fc6de90739ff4ece48980291840f477ec6b9ccaa4b438c62e01a31c`

These are **version pins**, not live database integrity proofs.

## Main source-to-target table contract

The contract requires an inventory count and a sanitized subset of
columns for each of the following ten Source SQL tables:

| MariaDB Source table | Relationships / checks |
|---|---|
| `merchant_platform_invoice_journal` | Tenant + unique immutable invoice key; type, SHA-256 snapshots, cycle, gross/credit/bank cents, state |
| `merchant_platform_invoice_adjustment_events` | Invoice origin, adjustment SHA/audit; cannot silently rewrite invoice |
| `merchant_service_credit_accounts` | Tenant balance and exact event sequence (an empty account is allowed only with no events) |
| `merchant_service_credit_conversions` | Verified monthly conversion source; bank + earlier credit = gross; Delivery threshold strictly exceeded; invoice ultimately waived |
| `merchant_service_credit_events` | Strict sequence/replay, unique event kind+invoice, conversion linkage, exact offsets and nonnegative balance |
| `merchant_platform_payment_attempts` | One signed invoice; exact gross/credit/bank due and payout evidence types; no raw slips |
| `merchant_platform_bank_reference_claims` | **Global SQL table WITHOUT tenant_id**; join back to a tenant's payment attempt, flag global cross-tenant coverage as unverified |
| `merchant_payment_obligation_holds` | Hold-to-invoice link; frozen amount/credit/bank/state |
| `merchant_payment_hold_events` | Hold event-to-original hold/invoice, type and SHA |
| `merchant_m7_hold_policy_approvals` | Original invoice digest, cutoff not earlier than due, approved policy version |

The SQL revision also contains other relevant tables (beneficiary approvals,
provider dispatches, historic enrollment, receipt checks, correction cases,
etc.). They are **not** covered by this first ten-table structural
preflight. Their independent source evidence is still required for an
operational financial migration.

### Sanitized manifest contract

```text
{
  version: "m7-source-migration-preflight-v1",
  tenantId: "<Source tenant ID>",
  source: {
    sourceCommit: "<pinned 40-char Git commit>",
    sourceSchemaSha256: "<pinned schema SHA>",
    holdSchemaSha256: "<pinned hold schema SHA>",
    capturedAtUtc: "<UTC timestamp>",
    operatorAttestedReadOnly: true,
    inventory: {
      <each of the ten original SQL table names>: <nonnegative row count>
    }
  },
  tables: {
    <each of the ten original SQL table names>: [<sanitized rows>]
  }
}
```

The property names inside rows match the original Source SQL columns,
but sensitive columns **must be excluded**, particularly slip paths,
bank account identifiers, encrypted config references, passwords,
tokens, phone/email/recipient details and free-form private notes.

Only rows belonging to the selected tenant should appear. For
`merchant_platform_bank_reference_claims`, the original SQL table does
not contain `tenant_id`: export the rows joined through the tenant's
payment attempts. It is not enough to attach an invented `tenant_id`
column to that table.

The **entire data import remains read-only**. Limits:
- no more than 250 rows per table;
- no more than 1,000 rows across the ten tables;
- at most 512,000 bytes per manifest;
- original exported inventory count must equal the actual array size
  for each table; mismatches are explicitly reported;
- incomplete time windows, missing SQL rows or wrong schema revisions
  may never be interpreted as a valid complete export.

**Important:** The `source.operatorAttestedReadOnly` boolean and
inventory counts are **self-reported by the operator**. They do
not constitute independently validated transaction consistency.
For larger tenants, use a separately reviewed batch/export procedure,
not partial arrays masquerading as a full snapshot.

## Source arithmetic and invoice reconciliation

All source money in **integer satang**, matching Source Go's
`maxSourceSafeCents = 9007199254740991`.

The validator checks:
- `gross = applied_credit + bank_paid + residual`, with an
  exact zero residual required for `paid` or `settled_credit`;
- the original Source versioned invoice SHA, scope and type;
- converted monthly fees ultimately `waived`, with original
  bank-paid + earlier credit equal to approved monthly gross;
- one conversion per cycle and no yearly credit conversion;
- ordered credit events (conversion + reversal + daily/monthly
  offsets); no negative balance, duplicate events or invented credit;
- invoice credit offsets agree with signed event amounts;
- the Source global bank reference claims join to the original
  payment attempts, while cross-tenant global uniqueness remains
  **unverified** in this tenant-scoped export;
- finance hold approval and hold event links match the original
  invoice and due/cutoff days.

The second read-only reconciliation compares source invoice **candidates**
against current Firebase Hybrid invoice documents by:
- monthly: `cycle_start_day:monthly:fixed`;
- daily: `cycle_start_day:delivery:business_day`;
- yearly: **unmapped** (Firebase Hybrid has no equivalent Source
  invoice authority).

An equal amount/period/type is **only a candidate**, never
proof that the hashes, account/wallet money or paid states match.
Extra/missing/changed target invoices, changed amount/status, existing
unmigrated credit and truncated Firebase scans are explicitly flagged.
There is no automatic mapping or backfill.

## New files and workflows

```text
functions/
  m7-source-migration-contract.js          # Original Source SQL schema pinned + cross-table integrity
  m7-source-migration-reconcile.js         # Firebase invoice candidate comparison only
  m7-source-migration-preflight.js         # UAT-only Superadmin preview / stage-audit / history
  index.js                                  # three new Callables
firestore.rules                            # private immutable migration preflight audit
react-app/src/
  components/M7SourceMigrationPreflight.jsx
  pages/AdminTenantsPage.jsx               # adjacent to finance readiness card
  ui/m7-stripe-test-reservation.css
tools/
  m7-source-migration-preflight.mjs         # offline CLI, no network connection
tests/
  fixtures/m7-source-migration.synthetic.cjs
  react-parity/p1-m7-source-migration-contract.spec.mjs
  react-parity/p1-m7-source-migration-reconcile.spec.mjs
  react-parity/p1-m7-source-migration-cli.spec.mjs
  react-parity/p1-m7-source-migration-browser.spec.mjs
  firebase-emulator/p1-m7-source-migration-preflight.spec.mjs
docs/
  LUKKAJA_P1_M7_SOURCE_MIGRATION_PREFLIGHT_MODULE_20261122.md
```

### Offline check (no login, no DB connection)

`node tools/m7-source-migration-preflight.mjs sanitized-manifest.json`

Or:
`node tools/m7-source-migration-preflight.mjs sanitized-manifest.json --output sanitized-report.json`

The CLI never attempts an SQL, Stripe or Firebase connection.
It prints/writes **only sanitized counts, digest and issue codes**.
No sensitive original rows are printed. Report files are created
non-overwriting with file permissions `0600`.

Exit code:
- `0`: syntactically valid, zero detected structural issues, but
  **not** cleared for migration or financial use.
- `2`: structurally inconsistent; manual investigation required.
- `1`: invalid input, unsafe raw columns, corrupt metadata or
  unreadable source; never output raw input details.

### UAT-only Superadmin UI & Callable contract

Exact opt-in gate (default OFF):
```text
PENGUIN_M7_SOURCE_MIGRATION_PREFLIGHT_ENABLED=1
PENGUIN_M7_SOURCE_MIGRATION_PROJECT_ID=<exact non-prod project containing -uat or -test>
PENGUIN_M7_SOURCE_MIGRATION_TENANT_ID=<exact allowed tenant>
```

The Cloud Project ID must match the active project, may not be
`penguin-food`, may not contain `production`, `prod` or `demo`,
and **Firebase emulators are rejected** for actual runtime enablement.
In tests only, an explicitly injected test allowlist is used.

Callables:
1. `previewPlatformM7SourceMigrationPreflight({manifest})` —
   active Superadmin, tenant-bound, read-only Source validation,
   read-only Firebase candidate comparison, no writes.
2. `stagePlatformM7SourceMigrationPreflight({manifest})` —
   active Superadmin, repeats validation, creates ONE private
   immutable UAT **diagnostic audit** by manifest digest in a
   Firestore transaction; concurrent identical submissions are
   idempotent, changed Source/target snapshot conflicts refuse replay.
3. `getPlatformM7SourceMigrationPreflightHistory({tenantId})` —
   up to 20 sanitized audit summaries, rejects corrupted audit rows.

Only the **digest, schema pins, source table counts, code lists,
candidate comparison counts and reviewer UID** are stored at:
`tenants/{tenantId}/m7SourceMigrationPreflightRuns/{sha256}`.
No raw source invoice, bank reference hash, slip path, event or
Service Credit balance is persisted. Firestore Rules forbid all direct
client reads/writes to this collection.

The Superadmin UI:
- manually selects a small **sanitized JSON**;
- previews independently from saving;
- displays structural issues and Firebase differences in Thai;
- requires a separate confirm before writing a **diagnostic-only** UAT
  audit, which may be repeated without duplicating records;
- shows private UAT audit history;
- contains **no** buttons to mark Paid, apply Service Credit,
  suspend/release stores or refund/transfer money.

Even in a successful report:
```text
sourceInventorySelfReported = true
snapshotConsistencyIndependentlyVerified = false
independentBankSourceAuthenticated = false
sourceSignatureIndependentlyVerified = false
globalBankReferenceCoverageVerified = false
operationalInvoicePaid = false
operationalCreditPostingAllowed = false
tenantAccessReleaseAllowed = false
operationalPromotionAllowed = false
writesPerformed = false
```

The candidate comparison is **non-atomic**, and the diagnostic
staging transaction does not verify original SQL transaction
isolation or lock the Firebase operational invoice collections.
Neither is accepted as an operational migration/settlement witness.

## Test acceptance

- 10-table source integrity against pinned version/sha;
- amount tampering, credit duplication, overdraw, gap in event sequence,
  invalid conversion, orphan claim, missing bank evidence, invalid
  hold cutoff and adjustment SHA;
- stable SHA-256 digest independent of row/property insertion order;
- strict source row bounds and refusal of raw private fields;
- payment reference claims modeled as GLOBAL without made-up tenant IDs;
- Firebase candidate IDs/missing/amount/status changes;
- schema/tenant mismatch and untrusted client fields rejected;
- offline CLI report, exit `0/1/2`, no source rows printed;
- six concurrent UAT audit staging requests create ONE immutable entry;
- audit corruption/replay mismatch refused;
- owner, cashier, inactive Superadmin, wrong tenant or production project rejected;
- Firestore client cannot read or write preflight audit;
- mobile Browser widths 320, 390, 768 and 1440 px, explicit
  review and separate confirmation without money-writing actions.

All UAT and Browser tests use *fictional synthetic data*.
No actual MariaDB migration or live payment provider was accessed.

## Next MODULE: operational M7 posting — **NOT DONE**

The next module must not start from this UAT digest as a trusted
financial source. Before any Production finance migration, it must:
1. Obtain separately reviewed, consistent SQL snapshot and **independent
   bank-reference inventory across all tenants/channels**, not just one
   tenant's subset of ten tables.
2. Verify Original Source immutable invoice signatures, beneficiary,
   pricing, paid/refund history and independent bank statement/source
   claims, using a release authorization not present here.
3. Add a global cross-system reference claim index and a migration
   plan with explicit original invoice key → new Firebase identity
   mapping (no date+amount-only inference).
4. Design one atomic Firestore posted balance journal to transfer
   credit accounts/events/conversions and bank-settled invoice
   balances without historical double-posting or retroactive charges.
5. Add separate, signed hold approvals and canonical access-state
   reconciliation that cannot override other tenant security/manual
   holds, plus compensating rollback/audit and full UAT.
6. Obtain explicit owner approval before Production deployment.

**This module is intended to close the migration PREFLIGHT milestone
as a tested diagnostic, not claim the operational migration is ready.**

## Latest full JSX physical counts (not acceptance)

- Source primary `resources/js/react-port`: **154 JSX files / 48,500 lines**.
- Target `react-app/src` including this preflight card: **102 JSX files / 36,567 lines**.
- Path and line counts alone do not measure React/Go/Firebase functional parity.

## Final local verification, no deployment

| Test | Result |
|---|---|
| `npm run test:m7-source-migration` (contract, comparison, CLI, Chrome responsive) | **18/18 PASS** |
| Firestore Emulator regressions (M7 migration, Hybrid/M7/Telegram/BankAlert) | **65/65 PASS** |
| `npm run test:react-parity` (full existing project chain) | **PASS** |
| `npm run test:react-callables` | **109 references, 0 missing exports** |
| `npm run build:react` + generated build contract | **PASS** |
| Source branch and existing Android companion changes | **untouched** |
| Firebase Hosting / Functions Production | **NOT DEPLOYED** |

Generated Hosting HTML and test-build Vite index assets were
excluded from the Git commit; the original Production bundle remains
unchanged. Only source, rules, tests and documents are committed.
