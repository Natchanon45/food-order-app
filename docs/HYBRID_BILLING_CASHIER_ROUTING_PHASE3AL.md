# Phase3AL — Hybrid Cashier Partial-Migration Routing (UNEXPORTED / SOURCE ONLY)

Date: 2026-10-21 Asia/Bangkok. Target: GitHub Draft PR #7 only. **Do not deploy.**

## Problem and trust boundary

An existing Cashier route classified Delivery as Hybrid ONLY when `billingPolicyVersion === "hybrid_v1"`. An incomplete migration with `hybridBillingEnabled === true`, or a previously recorded financial journal mode/coverage marker, but a still-Legacy policy could be classified as `legacy` and reach the browser-side ISO `paidAt` update attempt. Candidate Firestore Rules already rejected such writes, but routing incorrectly offered the Legacy path and depended on server Rules to stop it. Suspended Hybrid PromptPay also previously entered `proof_review` before suspension was checked.

## Source change

`react-app/src/data/hybridCodCashierRoute.mjs` now fails closed for Delivery when tenant context is absent (`hybrid_tenant_unknown`). It treats the four independent policy/journal markers as a Hybrid/migration signal and returns `hybrid_incomplete_migration` if policy is not `hybrid_v1`. For actual `hybrid_v1` tenants, disabled, inactive and suspended tenant states return `hybrid_disabled` prior to PromptPay/manual review. Authorized active Hybrid PromptPay still routes to existing `proof_review`, which MUST remain subject to server Auth/Rules and the deployed server-side Hybrid blocking guard. COD remains `cutover_not_released` because `HYBRID_COD_CASHIER_CUTOVER_READY=false`. Legacy genuine non-Hybrid and non-Delivery paths retain their behavior. An absent tenant object is no longer interpreted as proof of Legacy for Delivery.

## Evidence and regression

Three Node route/unit tests added in `tests/react-parity/hybrid-billing-cashier-route.spec.mjs`. One new genuine Firestore Emulator test tests three fail-closed tenant states: partial Hybrid Enabled but Legacy policy, disabled `hybrid_v1`, and legacy policy carrying journal mode; no Paid Order, canonical `paidAt` or Receipt Event may be created. No live tenants or money writes. Real CI counts require separate finalized logs.

- First CODE commit `2e20cfbf625ee33a1b588a79417ea466f96cd068` failed a legacy regression because it mislabeled fully enrolled but disabled Hybrid as `hybrid_incomplete_migration`. Corrected CODE commit `d3ae1337295ca86d272fe949782d4de422fe656a` restores `hybrid_disabled` and updates expected test. Do not claim first commit green.
- Old Phase3AK VERIFIED final: Push 39573043783 and PR 39573049991, SUCCESS 6/6, 163 Hybrid Units, 76 Emulator PASS +2 TODO, 13 Auth+Rules PASS.
- Phase3AL amended-code Push/PR CI: pending verification; the latest real CI runs and completed logs, not source assertion, decide PASS.

## Non-guarantees

UI routing is not security enforcement. Firestore Rules cannot stop Admin SDK bypass. Still need an enrolled, transactional, independently verified server-side source for non-PromptPay/cashier paidAt with immutable same-transaction receipt journals, policy-safe legacy cutover, rollback and global Admin/REST/import caller inventory. Two historical Emulator TODO are NOT closed. Source-only demo Lalamove reservation and COMPLETED do not prove settled COD. Finance posting/cutoff, Thai tax credit/debit/AR, independent bank/Wallet posted credit, real App Check and UAT/approvals remain blocked.

Four flags FALSE; `functions/index.js` has no new Candidate Finance export, real money/tenant records untouched, no Firebase Deploy or PR merge.
