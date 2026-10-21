# Hybrid Billing — Six Release Gates / Single Definition of Done

Updated: 2026-10-21 (Asia/Bangkok). Branch `feature/hybrid-billing-github-first`; Draft PR [#7](https://github.com/Natchanon45/food-order-app/pull/7). This board replaces counting Phase labels as progress. **Not production-approved.**

| Gate | Acceptance evidence required | Current state |
| --- | --- | --- |
| W1. Trusted all-source financial writers | Full enumerated source/actor inventory and fail-closed runtime guard for *every* Admin SDK, Legacy, cashier, PromptPay, refund, REST, import and client path; server-owned canonical `paidAt` written atomically with immutable receipt journal; any suspension consistently enforced on both read/write; 2 historic Emulator TODO closed with *real* integration tests, not assertions | **BLOCKED** — scattered guarded paths, still missing final source coverage; new code `c4913098` guards SaaS import, disallows some tenant deletion; existing client rules do not guard Admin SDK |
| W2. Financial cutoff & ledger lineage | Immutable day manifest covering all admitted trusted paid sources, stable cutoff and late settlement to next OPEN day with reversible lineage, no backdating or omitted journals, replay/idempotency and cross-day exception evidence | **BLOCKED** — candidate demo features only |
| W3. Lalamove independently settled cash | Authorized staged Lalamove COD `PAID_OUT` attestation reconciled against separate bank/Wallet `POSTED` credit, disputes/refunds and unmatched exceptions with durable references | **BLOCKED — external provider/staging evidence**. Delivery `COMPLETED` is NOT money received |
| W4. Scale & security | Actual 10,000+ *all-source* trusted journal writer tx with 4/8/32-worker contention, P95/P99/indexes/retries; Rules/Auth/Functions/Storage verified, App Check on real domains and devices; independent security review | **BLOCKED** — past *isolated* 10k two-worker demo at ~40.05 tx/s, P95 16 ms, P99 2014 ms; prior eight-worker failed |
| W5. Thai finance & tax correctness | Approved credit/debit note cases, partial/full refund ledger & hash lineage, tax invoice interactions, Accounts Receivable and bank remittance reconciliation with Finance-approved numerical samples | **BLOCKED — Finance review** |
| W6. End-to-end release approval | Owner + Super Admin staging UAT on PC, tablet, phone, signed Finance and Security approval, rollback/cutover/recovery runbooks and approved release flag change | **BLOCKED — staging and signoffs** |

## Active security workstream (not a new phase for each file)
Verified baseline HEAD `8f73b75410bcb2b5ed34a0b160e0eeb6180fb7d7`: Push `39579807102` and PR `39579814883` SUCCESS 6/6; 168 Hybrid Unit PASS, 79 genuine Firestore Emulator PASS + 2 historic TODO, 17 Auth/Rules PASS.

New CODE `c49130989f491615e907dfb635d699b135d6a986`:
- Old `saas-migration.js` transactional import policy guard via `hybrid-billing-legacy-migration-guard.js` on prepare, per-document collection (including historic Orders), settings and finalization. It re-reads current tenant policy/journal marker in each Firestore transaction before writing.
- `tenant-admin.js` rejects recursive delete for Hybrid/journal-marked tenants and protects additional hybrid invoices, periods, settlements, receipt events/fences, refund chains, reviews, evidence, recoveries and day manifest/cutoff collections. This is a **preflight**, not an atomic deletion prevention in face of concurrent migration; further hardening is required.
- Source integrity audit now pins 12 selected noncandidate privileged modules; this is static fingerprint only, not runtime global enforcement.
- New real isolated Emulator case and source regression. Push `39608746459` / PR `39608755199` **PENDING final verification** at initial document write.

## Still unreviewed (nonexhaustive)
- `tenant-admin.updateTenant`: stale TenantSlug mirror under concurrent financial suspension; other membership/role/profile writers
- `tenant-admin.createTenantOwner` and REST/service credential pathways
- `retail-pos-backup.js`: POS financial data restore, batch destructive deletes
- `saas-migration` uses per-row transactions, **not** a whole-import atomic financial snapshot: partial imports remain possible for pre-Hybrid Legacy if the Hybrid policy changes mid-migration
- cashier non-PromptPay trusted server `paidAt` with same-transaction immutable journal; source-complete all-backend suspended-Hybrid protection
- reconciliation of actual bank/wallet POSTED and Lalamove PAID_OUT; tax/AR, cutoff; App Check, concurrency, UAT and approvals

## Hard prohibitions
All 4 flags remain FALSE: `HYBRID_REGISTRATION_READY`, `HYBRID_COD_CASHIER_CUTOVER_READY`, `HYBRID_FINANCE_UI_READY`, `HYBRID_FINANCE_API_READY`. No Candidate Finance export in `functions/index.js`, no real money/tenant coverage writes, no Firebase Deploy, no Draft PR merge, no production assumption from mock gateway or client Rules. Keep original >1 MB WORKLOG and all Mac uncommitted/untracked assets untouched.

## Recursive handoff
Before each chat END: update six canonical docs and PR #7, with verified full Worklog blob. Only near current chat quota exhaustion issue a copy-ready new-chat prompt listing Repo/Branch/PR, actual HEAD/latest CODE SHA, independently verified CI IDs/counts, this gate board, done/blocked status, all six docs, restrictions, and next steps. Repeat the instruction in future handoffs.

## W1 batch evidence — 2026-10-21: TenantSlug + Retail POS restore

CODE `5da3e49dbb8233192bff7d187fc5631f9e305b7e` (candidate only). Old `tenant-admin.updateTenant` could mirror `tenantSlugs/{slug}.active` from a stale `Tenant` snapshot, potentially overriding suspension. New `updateTenantMetadataTransaction` reads CURRENT tenant and slug ownership inside one transaction and fails closed on Hybrid/journal-only/suspended/manual-hold activation signals. User/membership query is still read outside transaction (not source-complete). Name/settings edits remain permitted, while existing Tenant.active bit remains unchanged.

Old `retail-pos-backup.restoreRetailPosBackup` used multiple unguarded Admin SDK batches to delete/restore POS collections, including sales, returns, invoices, ledger and counters. It now validates settings before any delete, preflights trusted tenant policy and wraps **each** destructive 200-document chunk and settings write in a transaction that re-reads the Tenant marker. Any Hybrid policy/enabled/journal-mode/coverage signal is denied. Legacy can still restore. **This does not make multi-batch Legacy restore atomic**; a rollback/recovery plan for interrupted Restore remains necessary for W1.

Real isolated Emulator regression cases added for Hybrid/journal-only POS destructive denial and suspended Hybrid slug reactivation refusal; source contracts assert transaction route and no raw batch. Source SHA audit re-pinned, still 12 reviewed modules. Initial Code Push `39611229914` and PR `39611238879` require independent final job verification. All SIX release gates remain **BLOCKED** and the same two original Emulator TODO stay OPEN. Four Release Flags FALSE. No live money writes, deploy, Finance exports or PR merge.

### W1 code + CI contract correction — 2026-10-21
- Initial W1 CODE `5da3e49dbb8233192bff7d187fc5631f9e305b7e` failed the existing React Foundation Contract (GitHub Push `39611229914`, PR `39611238879`) because `tools/react-foundation-contract.mjs` still required the previously unguarded call literal `clearCollection(db, ref, name)`. The new guarded restore necessarily passes `tenant`: `clearCollection(db, tenant, ref, name)`.
- Latest CODE `81922a93b9f711330f1ec37857fa296c20ad7288` updates the contract to require tenant-aware restore and presence of `transactLegacyMigration` while disallowing raw `db.batch()`, without weakening the security guard. Prior 171 Hybrid Unit tests passed before this contract failure; **do not claim final CI PASS** until final new Push `39611883634` and PR `39611892718` plus ultimate docs HEAD complete successfully.
- Both historic Emulator TODO remain OPEN. Gate W1 remains BLOCKED, along with W2–W6. No Finance Candidate exports, live money changes, Firebase Deploy, merge or readiness flags.

### W1 grouped writer gate — CI-driven signup/master-business contract correction (2026-10-21)
- Initial W1 CODE `5da3e49dbb8233192bff7d187fc5631f9e305b7e` Unit 171 PASS but React Foundation Contract failed due outdated unsafe backup restore `clearCollection(db, ref, name)` literal; fixed without weakening guard in CODE `81922a93b9f711330f1ec37857fa296c20ad7288`.
- Next source+docs HEAD `7210fb4ae56294f3885f5a6e9cd59135a0a5d46a` failed a pre-existing `signup-billing-revenue-share.spec.mjs` assertion demanding `businessUnitsFor(requestedBusinessType)` inside the `updateTenant` handler rather than the new tenant-current transactional helper. New CODE commit `2a3ab20bf66f4343876c27e32dc683e4b08694bf` fixes the *contract only* to assert that `updateTenant` passes `requestedBusinessType, businessUnitsFor` to `updateTenantMetadataTransaction`; that helper actually computes business units after `tx.get(tenantRef)` and neither file writes signup billing or revenue share choices. No bypass, rollback or relaxation of money-data protection.
- CODE Push `39612640476`, PR `39612648253` initially PENDING. Check exact final CI on last six-doc HEAD before declaring all-green. W1-W6 still BLOCKED/INCOMPLETE, both original real Firestore Emulator TODO remain OPEN. All four flags FALSE; no Finance candidate export, live money, Firebase Deploy or PR merge.

## W1 Owner enrollment transaction and incomplete-Hybrid slug admission — 2026-10-21

CODE `586fcabb073b45dcbb1808cb1f13d3d66b36b6ce`: Super Admin `createTenantOwner` previously allowed an enabled Auth user to be created before a potentially stale Admin SDK Owner role/membership batch. `createLegacyTenantOwnerTransaction` now reads current Tenant and live active Owner membership query in one Firestore transaction before assigning any User/Membership and Tenant owner fields. It refuses all Hybrid financial markers including partial migrations, inactive/suspended/manual-hold tenants and duplicate Owner. The external Auth creation is preflighted first and best-effort deleted on failed financial admission; **Firestore and Firebase Auth cannot be atomically committed together**, so an Auth delete failure is a remaining recovery risk. Normal unmarked Legacy enrollment retains original function. Tenant metadata guard also requires both `hybrid_v1` AND `hybridBillingEnabled=true` to reactivate a financially signaled slug, with no suspension or manual hold.

New actual Firestore Emulator case covers six denial classes, one permitted Legacy, duplicate-owner denial and no denied Firestore User/Membership. Source contract verifies revalidation within transaction and rollback path. **W1 still BLOCKED:** legacy `index.js` membership trigger and user migration Admin SDK routes, direct REST/service accounts and all receipts/refunds, two original Emulator TODO, plus interrupted Retail POS restore and deletion retention race. Future `index.js` changes require explicit human-reviewed pinned SHA rebaseline—never silently repin. All W2–W6 gates BLOCKED. CODE Push `39617700881` and PR `39617710271` initially pending; final docs HEAD CI separate. Flags all FALSE, no deploy/merge/live money.
