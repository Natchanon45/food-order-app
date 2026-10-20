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
