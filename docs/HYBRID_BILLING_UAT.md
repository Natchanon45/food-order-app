# PENGUIN Hybrid Billing — UAT / Release Gate (2026-10-19)

**Overall state: BLOCKED — not deployable to Firebase production.**

Production remains Version 0.4.294 / Build 2026.10.18.524.
Candidate React remains Version 0.4.296 / Build 2026.10.19.526.
HYBRID_REGISTRATION_READY is false. Existing tenants retain their legacy Subscription/Revenue Share configuration.

## Current evidence

| Area | Current result | Missing real UAT |
| --- | --- | --- |
| Existing Phase 1 calculator/signup/settings | Existing Node/React parity regression PASS | Registration is intentionally blocked |
| Phase 2 paid Delivery report | Existing read-only fake Firestore regression PASS | Authenticated staging tenant preview and refund verification |
| Phase 3A immutable invoice | **8/8 synthetic real Firestore Emulator tests PASS**, mock unit tests PASS | paidAt query phantom/race under concurrent writes, high-volume read limit/scalability, post-close refund/late-sales adjustment, deadline grace |
| Phase 3B evidence/manual review | Mock tests PASS; synthetic Emulator cross-invoice bank reference uniqueness PASS | Auth/profile callable wiring, Storage metadata/rules, **actual independent bank reconciliation**, Slip2Go |
| Phase 3C overdue assessment | Mock PASS; real Firestore Emulator cross-anniversary unpaid debt + guarded state PASS | Real scheduler, admin manual-disable-safe recovery, backend order writes enforcement |
| Phase 3D Slip2Go quota | Mock transaction tests PASS | Live Delivery verify wiring, provider errors/credits, reservation expiry |
| UI payment/invoice/review | NOT IMPLEMENTED | PC + tablet + mobile UAT |
| Backend secure Rules/Storage | NOT IMPLEMENTED for Hybrid | Emulator allow/deny matrices |
| Firebase Production | NOT DEPLOYED | Requires written release approval |

## Minimum emulator / UAT acceptance scenarios

1. **Legacy zero impact:** Subscription and Revenue Share owners can sign in, receive orders, issue existing bills and use Retail POS. Hybrid jobs skip them. No legacy migration.
2. **Billing boundary:** Unpaid/pending Delivery and POS/Table/Takeaway/shipping fee never enter the base; paidAt is server timestamp; Bangkok midnight, February/December rollover, partial/full refunds, malformed and missing data.
3. **Trigger whole day:** Threshold reached 09:00 at 10,000 and paid Delivery total by 23:00 = 15,500: only AFTER full day close charge 15,500 x 5% = **775 THB**, idempotently. If 9,000 sold yesterday and 4,000 today crosses cumulative 10,000, charge today 4,000 x 5% = **200 THB** (not threshold x 5%), subsequent day new 2,000 x 5% = 100 THB. No previous-day back-billing.
4. **Signup-anniversary cycle:** Signup 16/10/2026 means first cycle 16/10–15/11; reset 16/11, then 16/12. First anniversary cycle waives fixed fee, not share. Subsequent cycle with paid Delivery 9,999 charges only fixed fee on its closing day (15/12). Signup on day 31 clamps in February (28/29) without drifting original anchor for March.
5. **Evidence versus money:** Uploaded slip remains pending; wrong amount, wrong recipient, reused bank transaction ref, stale/forged provider status, unauthorized approval and cross-tenant requests are rejected. A Super Admin separately verifies bank receipt before settlement.
6. **Suspension:** Unpaid day D share blocks operations on D+1, but owner/admin billing-only access remains; staff cannot transact, public checkout and backend writers cannot bypass. Prior-month debt persists after month rollover.
7. **Recovery:** Only when every overdue invoice has a trusted settlement. Manual Super Admin disable/suspension must never be cleared accidentally. Reconcile multiple payment and suspension transactions, service restarts, and delayed approval.
8. **Anniversary quota:** Exactly N unique eligible provider attempts within an anniversary cycle; retries do not double count. Signup 16 Oct does NOT reset 1 Nov; resets 16 Nov even if previous cycle threshold entitlement unlimited. Provider failure needs manual fallback.
9. **Access control:** Firestore invoices, evidence, payment proofs, settlement, audit and quota cannot be altered by browser clients. Owner/Admin can read only their tenant via authenticated callable; Super Admin reviewer must use real authenticated server profile. Storage upload/read is scoped to specific tenant/payment ID and file type/size.
10. **E2E PC/mobile:** Registration blocked while launch flag false. Once staging-only enabled, run real new signup, daily share invoice, bank slip upload, Super Admin approve/reject, suspension/pay screen, unlock, threshold/quota transition, previous-month debt, and legacy safety regression.

## Open decisions (must be approved before go-live)

- **RESOLVED:** first period is a signup-date anniversary cycle; 16 Oct–15 Nov, reset 16 Nov. Not a calendar month / fixed 30 days. Confirm short-month clamping in staging.
- Fixed-fee due date and expiry/suspension grace, and whether D+1 midnight day-close is acceptable when invoices are generated just after midnight.
- Refunds/chargebacks after a day has been sealed: adjustment/credit-note workflow rather than silent modification.
- Which Slip2Go operations count against the monthly quota: request, provider attempt, or successful verification; release/refund on provider failure; reservation TTL and retry limits.
- Treatment of slip pending review exactly at the deadline; verified bank recipient and Super Admin reconciliation controls.
- Safe separation of manual administrative disable from financial suspension, including who may authorize recovery and any required approval audit.

## Rollout order (not performed)

1. Confirm policies above and audit every backend write path for suspended shops.
2. Add secure callable validation, bank payment UX, invoice read-only view, Super Admin review, recovery, Slip2Go quota integration and security rules.
3. Test Firestore + Functions + Storage emulators with denied/allowed cases and transaction concurrency; run customer PC/mobile UAT in isolated staging project with synthetic tenants.
4. Explicit owner approval for coordinated Functions/Rules/Storage/Hosting rollout and any data migration. Preserve previous hashed builds; never open HYBRID_REGISTRATION_READY until safe.
5. New Version/Build before Hosting deploy; verify live checksum, role access, legacy store behavior and all settlement alarms. Production only after approval.

## Phase 3E updated risk and UAT scope

- Unit/mock tests now cover paid-order reads *inside* an invoice Firestore transaction (including >500 pagination and a 3000-order safety cap), due-invoice scans *inside* arrears transactions, and safe anniversary invoice IDs. **73/73 Hybrid Node tests PASS**.
- **Phase 3F partially proved in actual Emulator:** invoice query reads, 520-row paging, concurrent triple job idempotency, historical refund mismatch detection, settlement duplicate prevention, cross-cycle debts. **Still not proved:** a paidAt order inserted or changed concurrently with the query transaction, field mutation/write locks near midnight, transaction memory/time limits at 3000, and policy for late refunds/credits. Keep launch fail-closed.

## Phase 3F Firestore Emulator smoke run — 2026-10-19

- Command: `npm run test:hybrid-billing:emulator`. Explicit project **`demo-penguin-hybrid-uat`**, localhost:8187 only, Java 21+ (JBR 25 selected on the Mac), temporary deny-all client rules, no production Firebase credentials needed, no production writes.
- **8/8 PASS** actual Firestore Emulator scenarios: full trigger-day 775 THB + next-day, order refund seal mismatch, evidence-only and suspended account waiting admin recovery, 520-order transaction pagination + safe scan cap, legacy guard, three concurrent invoice calls -> one invoice, unpaid previous anniversary cycle after rollover, duplicate global bank reference rejected.
- **Still blocked:** full security Rules allow/deny (the UAT intentionally used temporary deny-all emulator rules), Auth/Functions/Storage emulation and provider verification, concurrent order writers inserting/query phantoms, late refund adjustment ledger, real payment UX, Slip2Go hookup and protected admin recovery, E2E PC/mobile. No staging/prod deployment.

## Phase 3G — race tests and blocking source provenance/Rules gaps

- `npm run test:hybrid-billing:emulator` now **12/12 PASS**, including concurrently inserting paidAt before the transaction query, adding a backdated receipt after a sealed day, updating refund concurrently with issue, and concurrent invoice issuers + paid order insertion. **2 test.todo cases remain unresolved** (NOT passed). Old immutable invoice is preserved on late change; subsequent reconciliation rejects with `HYBRID_CLOSED_DAY_CHANGED_REQUIRES_ADJUSTMENT`. A credit note or documented adjustment process is still mandatory.
- **BLOCKER P0:** React `CashierPage.jsx` non-PromptPay Delivery payment can save `paidAt` as client ISO string, while the invoice reader selects only Firestore Timestamp `paidAt` in a range. The record is invisible to the billing calculation. Server-trusted payment receipt canonicalization plus comprehensive paid Delivery reconciliation and emulated negative-case tests must replace this risk.
- **BLOCKER P0:** current `firestore.rules` `tenantBusinessEnabled` ignores `hybridBillingSuspended`/tenant `active`. Need complete Rules/Functions/Storage Auth matrix proving staff/cashier/public checkout/retail POS cannot place or alter operations after financial suspension, while a billing-only owner and Super Admin can reconcile; legacy access must remain unchanged.
- Source locations and detailed history in `docs/WORKLOG.md`. Do not enable `HYBRID_REGISTRATION_READY` or deploy before both are resolved and approved.

## Phase 3G — Auth + Firestore Rules isolated candidate (local-only, 2026-10-19)

- New separate repeatable smoke command: `npm run test:hybrid-billing:rules-emulator`. The runner uses the checked-in `firestore.rules` **read-only** as a source and constructs an extra Hybrid billing `hybridBillingSuspended`/`active` check in a temporary file (never writes it to production rules). Uses fresh demo project `demo-penguin-hybrid-rules-uat`, localhost Auth :9098 + Firestore :8188, Android Studio JDK 25. No deployed rule changes, no Production tenant changes.
- Tests via real Firebase client SDK authentication and real Firestore Rules emulator: **5/5 local candidate scenarios PASS** for normal Hybrid read/update, suspended Hybrid order deny, suspended POS deny, unchanged legacy cashier read/update and billing/tenant fields inaccessible to cashier. This is a **partial policy smoke**, NOT security signoff.
- **Critical unresolved problem:** The Emulator prints `PERMISSION_DENIED: Unable to evaluate the expression as the maximum of 1000 expressions ...` for certain denied write paths. Consequently those writes may have been denied due to evaluation exhaustion, not because the new early guard is correctly evaluating all branches. Fix Rules complexity and rerun explicit allow/deny with no evaluation errors before counting writer authorization as proven. Also protect top-level legacy order write paths, Functions Admin SDK writers and Storage separately.
- Files: `tools/run-hybrid-billing-rules-emulator.mjs`, `tests/react-parity/hybrid-billing-rules-emulator.spec.mjs`, package.json command. No changes to `firestore.rules`, `storage.rules`, `firebase.json` or `.firebaserc`.

**Phase 3G FINAL STRICT SECURITY CHECK (2026-10-19):** `npm run test:hybrid-billing:rules-emulator` runs 5/5 role assertions but **intentionally exits with code 2 (BLOCKED)** because Firestore logged `maximum of 1000 expressions` on denied writes. The temporary candidate therefore MUST NOT be considered proven secure; real `firestore.rules` remains unchanged. The new runner now detects these messages and fails the UAT gate instead of returning a misleading success. In contrast, `npm run test:hybrid-billing:emulator` (transaction emulator) **12/12 PASS, 2 TODO**, focused `test:hybrid-billing` **73/73 PASS**, full React Parity **PASS**, Operational **PASS**, existing React Build .526 contract **PASS**, no new build/Production deploy.

## 2026-10-19 — Phase 3H: Paid Delivery source completeness fail-closed guard

- **Root cause verified:** Cashier's non-PromptPay Delivery write may store `paidAt` as ISO text, while the billing engine's timestamp range cannot select the row. The previous `paidDeliverySale` validator only rejected invalid timestamps it could see; invisible paid orders could cause silent underbilling.
- **Source-only mitigation implemented:** `functions/hybrid-billing-preview.js` now exports `auditPaidDeliveryReceiptCoverage(tenantRef, {transaction,maxRecords})`, a separate paginated Firestore query on ALL `orderType=delivery` + `paymentStatus=paid` records with independent index/order-by document ID, requiring true Firestore Timestamp-derived `toDate()`. Both read-only preview and internal `functions/hybrid-billing-ledger.js` now fail closed on ISO/missing paidAt before billing a period. Ledger audit runs inside its **same Firestore transaction** and before any invoice/period writes; scans bounded to 3,000 paid Delivery receipts per tenant across historical cycles. Overlimit and partial-read data also block issuance. No string conversion or client time trust, no production deployment.
- **Real Firestore Emulator QA:** **14/14 passed + 2 TODOs**. New end-to-end case proves a trusted 10,000 THB paid Delivery order plus an invisible 5,500 THB ISO paidAt cannot generate an underbilled 500 THB invoice or seal a period; invalid ISO and missing paidAt each abort. Read-only preview also aborts. POS ISO paidAt unaffected; 520-order audit pagination and 500-limit cutoff tested. Previous midnight/775 THB, idempotency, bank/arrears, concurrency cases still pass. Focused `npm run test:hybrid-billing` **73/73 PASS**.
- **Release remains BLOCKED:** Guard detects but does **NOT** repair existing ISO-string receipts or create an authoritative payment timestamp, so hybrid shops with these records cannot issue invoices. Need server-trusted non-PromptPay payment capture (cashier role and business guards), controlled reconciliation/migration of legacy data, full source completeness using immutable receipt events, Firestore compound index for `{orderType,paymentStatus}` in staging (`docs/HYBRID_BILLING_INDEXES_CANDIDATE.json` reference ONLY), scalable index/transaction design, late refund credit notes, and suspended-business Rules/backend enforcement. A 3,000-row tenant lifetime cap is an intentional fail-closed staging guard, not a production-scalable solution.
- `npm run test:hybrid-billing:rules-emulator` is **still explicitly BLOCKED (exit 2)** due to Firestore Rules `maximum of 1000 expressions` on denied writes despite 5/5 client assertions. This has NOT been bypassed. No modifications to production Rules/Storage/indexes or Firestore project, no Functions exports/deploy, no commit/push/merge, `HYBRID_REGISTRATION_READY=false`.
- **Backend indexing gate:** The new all-paid-Delivery audit needs an actual composite collection index on `orders` (`orderType` + `paymentStatus`) in real Firestore, not only the lenient Emulator. `docs/HYBRID_BILLING_INDEXES_CANDIDATE.json` is a *reference only*, not imported/deployed. Before any rollout add the index through reviewed, coordinated infrastructure update, await READY status and confirm query execution in staging. This audit is intentionally blocked when >3,000 matching paid Delivery receipts exist across tenant lifetime, until paginated immutable receipt index and archival strategy are built.


## Phase 3I — COD cashier / Rules gates (2026-10-20)

- **Actual Firestore Emulator PASS 19/19, TODO 2:** authorized COD cashier sets an actual server Firestore Timestamp; concurrent COD receipt calls settle only once, verified actor/tenant and suspension checked transactionally, Lalamove COD requires COMPLETED state and gets server audit timestamps, old paid ISO timestamps require manual reconciliation (no overwrites), Legacy tenants untouched. Run `npm run test:hybrid-billing:emulator`. Focused contracts now 77/77 PASS.
- **NOT launched:** `hybrid-billing-cod-payment.js` not exported to Cloud Functions or connected to CashierPage. It is an internal transaction candidate only. Implement secure callable with auth-derived actorUid, change Hybrid-only cashier client path to call it, prohibit COD client-side `paidAt/paymentStatus` writes in reviewed Rules and test role/legacy parity. Historical ISO receipts require controlled review/migration; unsafe coercion from browser timestamp is prohibited.
- **Security BLOCKED:** `npm run test:hybrid-billing:rules-emulator` returns 2, even after adding early temporary guard on order/POS write paths; the emulator reports max 1,000 rule evaluation expressions on denied writes. 5/5 assertion-level test success is not a security pass. Live firestore.rules and production indexes untouched.


## Phase 3J — Auth-shaped handler, COD source and Rules UAT (2026-10-20)

- Focused unit/contract suite: **81/81 PASS**. Actual Firestore Emulator: **21/21 PASS + 2 TODO** (includes authenticated-*shaped* request handler + real Firestore transaction, cross-tenant/inactive cashier rejection, forged Lalamove status without full completion markers denied). These tests DO NOT run a Functions HTTPS Callable server nor prove Firebase Auth/AppCheck integration.
- `onCall` candidate exists in unexported source file `functions/hybrid-billing-cod-callable.js`, configured `enforceAppCheck:true`. **Not exposed through `functions/index.js`, not called by React Cashier, not deployed.** Strict caller field allowlist prevents browser actor/timestamp/amount injection at handler boundary.
- **7/7 Auth+Firestore Rules Candidate assertion checks PASS**, covering allowed Hybrid operation, suspended denial, POS denial, legacy parity and Hybrid direct payment/amount/provider-field tamper denials. **SECURITY GATE BLOCKED exit 2**, as Firestore Rules still logs max 1000 expressions on denied writes: test assertions may pass because evaluator exhausts, not because correct rule allowed/denied. Candidate only; checked-in `firestore.rules` unchanged.
- Lalamove fields currently sourced by server webhook/refresh, but write access from existing client rules remains a risk; merely requiring completion markers in the internal COD engine does not establish their trusted provenance until rules/backend guards pass. Also stage full Callable+Auth+AppCheck, Storage, payment reconciliation, COD browser rollout, old ISO receipts, credit notes, bank and mobile tests before any production enablement.


## Phase 3K — Staged Cashier→Invoice→Evidence→Settlement golden-path check

- `npm run test:hybrid-billing`: **87/87 PASS**, including Hybrid/Legacy/PromptPay route split, gate-off fail-closed tests and staged adapter refusing to invoke an unavailable callable. `npm run test:hybrid-billing:emulator`: **22/22 PASS + 2 explicit TODO**. One new golden-path test runs TWO simulated trusted COD receipts worth 10,000+5,500 THB through handler and real Firestore Transaction, issues exactly 775 THB after Bangkok day close, submits mock proof, approves mock bank match and verifies safe recovery is NOT automatically allowed.
- `npm run test:react-parity`: **PASS** including React callable contract. A first attempt with an `httpsCallable` reference to a still-unexported function was correctly rejected by that contract; adapter was changed to an explicit unregistered callable boundary, **not** by weakening the check.
- **IMPORTANT LIMIT:** The new golden path simulates payment times and Storage/bank verification; it is NOT Firebase Functions HTTPS/AppCheck E2E, not a verified external bank settlement and not a tested PC/mobile deployment. React gate `HYBRID_COD_CASHIER_CUTOVER_READY=false`, backend registration `HYBRID_REGISTRATION_READY=false`, `functions/index.js` does not export Hybrid COD candidate. Existing Production Firestore Rules allow dangerous browser payment/fulfillment writes until reviewed enforcement is developed; strict Rules candidate still **BLOCKED exit 2** due to evaluation budget.
- Remaining release work: Rules engine complexity and permission matrix; Functions/Auth/AppCheck/Storage emulation; immutable payment receipt and Lalamove COD provenance; invoice adjustment/credit notes and safe reactivation; historical ISO cleanup; high-volume audit/index; real bank verification, staging PC/mobile UAT.
