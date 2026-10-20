# PENGUIN Hybrid Billing — Release Blockers, Evidence, and Staging Approval Matrix

Updated: 2026-10-20 (Asia/Bangkok). GitHub-first source of truth: `Natchanon45/food-order-app`, `feature/hybrid-billing-github-first`, [Draft PR #7](https://github.com/Natchanon45/food-order-app/pull/7).

**Overall: BLOCKED for Production.** Last green CODE commit `43ef8e08ec87e1e1d91584bc73576de9e8bcaa5c`; GH Actions PR run `39401725967` 6/6 PASS: Hybrid 104/104, real Firestore 37 PASS + 2 TODO, Rules/Storage/Auth Functions + React compilation/Parity PASS. These green checks are **emulator/source checks only**, not evidence of real bank payment, Lalamove settlement, genuine App Check attestation, tax accounting or PC/mobile staging.

## Already tested in GitHub CI (not live)

1. Canonical Bangkok anniversary cycles: signup 16 Oct → reset 16 Nov, then 16 Dec; short-month day clamp; first cycle free of fixed monthly charge; 10,000 THB threshold; full *closed* trigger-day paid Delivery sales 15,500 × 5% = 775 THB; subsequent days only own paid Delivery base, excludes shipping/POS/other/unpaid/refunds.
2. Hybrid immutable invoice, day-seal SHA, same-transaction paid order and historical source audit, duplicate prevention, arrears/suspension plus guarded Super Admin recovery in Emulator. Owner finance and Super Admin UI staged but release flags OFF.
3. Historical ISO/missing `paidAt` anomaly inventory plus source-only correction candidate with **injected mock bank/provider attestation**, exact reference/amount/order, Super Admin actor, no silent invoice rewrite.
4. New source-only UNAPPLIED credit/debit adjustment candidates from independently attested closed-day digest change: 50 THB credit for 1,000 THB refund, 275 THB debit for 5,500 THB late paid sale. No legal tax note number, no AR credit, no refund or settlement.
5. A real Firestore Emulator bulk fixture of 3,001 paid Delivery receipts: full 13-page READ-ONLY audit inventory, while current transaction billing fails closed at 3,000, creating **zero** invoices/periods. This test does NOT validate scalable high-volume issue/close; the release blocker remains.

## Mandatory unpassed Production gates

| Gate | Required evidence and acceptance | Current state |
| --- | --- | --- |
| Historical paidAt and trusted canonical source | Independently query bank/provider for exact order, gross THB, original paid time and recipient; preserve raw signed provider evidence/digest and immutable audit; dual review; no browser ISO conversion; retry/reference conflict tests | BLOCKED — only injected mock verifier |
| Credit notes, debit notes, and refunds | Decide Thai accounting/tax credit-note numbering and period correction policy; distinguish unpaid invoice offset vs paid refund/credit balance; dual authorization, actual bank refund proof, reversal, duplicate/replay, partial refunds and threshold/topology changes; adjustment state must reconcile source and invoice/arrears without rewriting original | BLOCKED — approved_unapplied note candidate only |
| Paid receipt scale and concurrency | Server-only immutable receipt events written atomically on every trustable payment/refund, partition by tenant/cycle/date; 10k+/100k+ load tests, replays, late events, retroactive corrections and cut-off fence; audited counts/hashes; index READY in real staging; no silent cross-page phantoms | BLOCKED — 3,001 fail-closed smoke only |
| Bank reconciliation | Real, independently retrieved bank statement/API or approved controlled bank export, account and reference/amount match, anti-duplicate global claim, review identity and retained evidence. Uploaded slip **alone is never settlement** | BLOCKED — mock/manual attestation only |
| Lalamove COD provenance | Verify partner-completed COD via signed webhook + authenticated server-side inquiry and real settlement where applicable; signature, replay, tenant/order linkage, exact amount and cancellation tests | BLOCKED — completion flags not real provider attestation |
| App Check | Actual web/domain and supported mobile-device attestation with `enforceAppCheck=true`; rejected missing/spoofed/replayed token in non-production staging; never claim demo emulator `enforceAppCheck=false` proves App Check | BLOCKED |
| Real secured endpoints + Rules | Reviewed Functions exports staged only, fully activated callable Auth+AppCheck+Storage and Rules matrix for Owner, Admin, cashier, unauthenticated and suspended Hybrid, plus **Legacy regression** | BLOCKED — candidates unexported |
| Manual desktop/mobile UAT | Authenticated Owner invoice/slip, Super Admin independent review, rejects, failed provider/timeout, arrears/manual holds/recovery, refund/late payment and event races on PC 1280+, mobile 320/390/430 and tablet; screenshots/logs + human acceptance | BLOCKED |
| Production approval | Signed financial/accounting/safety and rollback go/no-go with staging record, no unresolved P0 or 2 TODOs; explicit user approval for merge/deploy | BLOCKED |

## Safe staged implementation order (no automatic deploy)

1. Agree on invoices vs ledger adjustments vs legal credit-note policy with accounting owner, including payment received vs not yet received. Fail closed on topology changes and more than one changed day until reviewed rules exist.
2. Build an immutable server-trusted receipt journal and index strategy. Every COD/PromptPay/Delivery/Provider payment and refund must create an idempotent source event in the same trusted write boundary, with validated paidAt and financial bases. Preserve historical order, seller and settlement hashes. Reject client writes and inconsistent counts.
3. Design cutoff: day close uses a verified monotonic receipt watermark and finalized day-manifest with durable SHA; concurrent writes after cutoff are explicitly late adjustments; no retroactive change to original seals. Firestore transaction read query may not protect cross-page phantom inserts without an independently coordinated writer barrier.
4. Implement actual bank/Lalamove verification behind stage-only credentials/approved endpoints. Persist only minimum necessary PII and redact credentials/individual bank data from tests/logs. Authenticated browser callers must never pass `verified:true` or timestamps themselves.
5. Stage security Apps/Rules/Storage/Auth/Functions and **real** App Check; run negative permission tests and no-customer-money synthetic E2E. Keep stage project separate from production, with allowlisted test tenants.
6. Perform PC/tablet/mobile UAT and documented owner/Super Admin approval; only thereafter review release flags, export strategy, indexes and rollback. **Do not Merge/Deploy now.**

## Verification commands (GitHub CI, demo-only; not release authorization)

`npm run test:hybrid-billing`

`npm run test:hybrid-billing:emulator`

`npm run test:hybrid-billing:rules-emulator`

`npm run test:hybrid-billing:rules-baseline`

`npm run test:hybrid-billing:storage-emulator`

`npm run test:hybrid-billing:functions-emulator`

`npm run test:react-parity`

`npm run test:operational`

No claims of staging or real paid UAT may be made based on these demo-mode commands alone. Preserve the **Draft** PR and all OFF release gates. Do not reset/clean Mac uncommitted assets.

---

## 2026-10-20 — Phase 3O: atomic COD Receipt Journal, strict closing fence and real concurrency UAT (GitHub-only)

- Continued GitHub-only on `Natchanon45/food-order-app`, `feature/hybrid-billing-github-first`, Draft PR #7. Last VERIFIED **code SHA `17f647dc864796ed1f62bc6aa2dbbc4c760e7950`**. GitHub Actions PR run **39404559545**: **6/6 GREEN**, focused Hybrid Unit **106/106 PASS**; isolated real Firestore Emulator **41 PASS + 2 explicit TODO**; Auth+Storage, Auth+Firestore Rules including Legacy, demo Auth+HTTPS Functions, React source build/Parity/Operational all PASS. Push workflow also triggered; check GitHub current state at next startup.
- New internal, **UNEXPORTED** `functions/hybrid-billing-receipt-journal.js`, integrated with unexported COD candidate `functions/hybrid-billing-cod-payment.js`: within a single real Firestore transaction, COD order becomes server-stamped paid, an immutable `hybridBillingReceiptEvents/cod-{orderId}` entry is created, and one of 16 deterministic `hybridBillingReceiptFences/shard-00...15` versions increments. Idempotent duplicate COD calls cannot produce duplicate journal events; an already-paid COD order tagged with the trusted source but missing event now fails closed. Browser has no direct journal write path.
- `functions/hybrid-billing-ledger.js` adds SOURCE-ONLY **optional strict mode** `tenant.hybridReceiptJournalMode === "strict_v1"` which additionally REQUIRES `hybridReceiptJournalCoverageReady === true`. Inside the same closing transaction, reads the 16 shard fences BEFORE order queries, checks that all paid Delivery records in the closed-day query have a matching server-owned COD journal and verified original paid timestamp/amount, then still uses existing 3,000-row safe scan/immutable invoice logic. A participating receipt writer overlapping the close creates a Firestore transaction conflict/retry; an order committed after an earlier close remains a late adjustment, NEVER a silent rewrite. The mode is NOT enabled for Production, NOT source-certified for non-COD writers and does NOT yet validate all historical cross-cycle receipts.
- Real Firestore Emulator added atomic two-call receipt + one shard version; strict uncertified tenant denied; fake `CoverageReady=true` alone still cannot legitimize unjournaled paid Delivery; strict 10,000+5,500 trusted COD → 775 THB closed-day invoice, idempotent close; carefully orchestrated concurrent COD writer vs day-close yields either complete inclusion, transaction abort+safe retry, OR original immutable invoice plus follow-up **HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT**. NO silent amount replacement.
- Diagnosed failed intermediate CI: one cold GitHub runner's JDK probe exceeded the previous 5-second timeout (not a Firestore data failure), and a first concurrency test waited for a writer while holding a read lock, deadlocking the TEST. Increased isolated demo Java probe to 30 seconds; changed race test to release the pause BEFORE awaiting the COD writer. **Only final verified `17f647dc864796ed1f62bc6aa2dbbc4c760e7950` is the accepted green checkpoint**; prior failed/cancelled runs are not claimed green.
- **Important unreleased limitations**: only trusted COD writer writes this journal, not PromptPay, Lalamove provider settlement, historical repair, partial/full refunds or other Admin SDK writes; shard 16 is NOT proven 10k/100k throughput; per-cycle lifecycle/manifest/backfill plus immutable corrections and independent provider evidence remain unimplemented; old >3,000 scan cap persists and prevents high-volume invoice issuance. `hybridReceiptJournalCoverageReady` has no production certification workflow and MUST stay unset for real tenants. Genuine Firebase App Check/web+device staging, real bank statement or provider COD verification, legal tax credit/debit notes, settlement/refund posting and PC/mobile UAT are still absent.
- **Safety unchanged:** keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. Do not export COD/Finance/Daily/Repair/Adjustment/Journal candidates from `functions/index.js`, enable strict coverage for a real tenant, deploy any Firebase service, merge, mutate real money records or touch the Mac workspace. Preserve older uncommitted hashed assets and no reset/clean.
- Next highest-priority engineering: server-authoritative receipt events for *every* trusted payment/refund provider; an independently audited immutable day-manifest enrollment/backfill protocol with exclusive close writer fence and safe immutable late adjustment; staged Firestore indexes and >3,000 performance/transaction cutoffs. Then real bank/Lalamove attestation, App Check tokens, legal accounting notes and recorded PC/mobile UAT plus user approval.
