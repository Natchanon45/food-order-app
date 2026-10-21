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
