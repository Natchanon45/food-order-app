# Phase 10 — Development closure and fixed acceptance gate

**Date:** 25 October 2026  
**Repository:** `Natchanon45/food-order-app`  
**Scope:** `feature/react-firebase-port`, Hybrid Billing/Finance **local Demo** only  
**Decision:** **STOP expanding Phase 10.** This is a technical delivery/acceptance boundary, not a declaration of Production bank readiness.

## Definition of Done — exactly one final acceptance round

| Area | Fixed acceptance requirement | Verification |
| --- | --- | --- |
| Finance / Invoice | Existing ledger, invoice, proof review, refund proposal and reconciliation behavior unchanged | `npm run test:hybrid-billing` |
| Synthetic Bank Evidence | Valid signatures match expected scope; wrong keys, amounts or replays fail closed | `npm run test:hybrid-bank-evidence`, `npm run test:hybrid-bank-batch` |
| Replay / concurrency | Both Demo Refund Candidate and signed Bank Batch reject overlapping reference/instruction/tenant-adjustment claims atomically; no partial write; Browser denied | `npm run test:hybrid-bank-batch-reservation`, `npm run test:firebase-hybrid-emulator` |
| React migration | Existing parity and build stay unchanged | `npm run test:react-parity`, `npm run build:react` |
| Owner UAT | Owner confirms demo Invoice/Refund/Billing screens and reports display consistently; no false settled/bank verified status | Manual review on **local emulators only** |
| Safe boundary | `bankProviderIdentityIndependentlyAuthenticated`, `settlementAllowed`, `releaseReady`, `productionReleaseAllowed` remain false; no bank payout or Production deploy | Code review and tests |

**Completion rule:** once the seven command groups above **PASS on the final commit**, no critical Demo defects remain and owner signs off the Demo workflow, mark **Phase 10 Demo Development: COMPLETE**. No additional bank-security design work is required to pass that definition. If one test fails, repair only that regression and repeat the same acceptance suite. Do not redefine or append requirements during execution.

## Final test commands

```bash
git status --short
git switch feature/react-firebase-port
git pull --ff-only origin feature/react-firebase-port
npm run test:hybrid-bank-batch-reservation
npm run test:hybrid-bank-batch
npm run test:hybrid-bank-evidence
npm run test:hybrid-billing
npm run test:firebase-hybrid-emulator
npm run test:react-parity
npm run build:react
git status --short
```

Preserve any intentional local `public/**/index.html` edits. Never use `git reset --hard` or `git clean`. The assistant's remote Mac may be offline, so **do not claim unexecuted native Emulator/build tests passed**. Record the actual tested HEAD and results when available.

## Explicitly OUT of this Demo Phase 10 scope

1. **Real bank or PSP:** independently verified bank signer ownership, provider key rotation, credentials/secrets, authenticated real statements, full historical cross-provider payouts, chargebacks and settlement receipts/reversals. These remain **BLOCKED external Production requirements**; synthetic keys/packets/ledger claims are not bank evidence.
2. **Actual transfers or refunds:** no automatic payout, no real settlement writer, no marking real refund as paid; wallet credit is not bank cash movement. Production release flags stay OFF.
3. **Lalamove delivery credit / the previously reported 59 THB Platform fee:** separate business-ledger issue, **not validated by this Finance Demo acceptance suite**. It needs its own targeted UAT before any delivery billing release; do not silently label it fixed.
4. **Unrelated app UX features / Laravel React parity follow-up:** track independently, not as extra rounds of Bank Evidence.

## Scope/ship decisions

- **Phase 10 Demo:** close after final automated tests + owner Demo UAT; do not keep extending it. Mark `COMPLETE` only on observed pass.
- **Bank transfer/settlement Production:** `BLOCKED / NOT IMPLEMENTED`; not implicitly completed by closing the Demo.
- **Overall food-order app:** not automatically certified Production-ready by the Phase 10 signoff; checkout, delivery-wallet settlement and tenant business workflows have their own acceptance criteria.
- **Git / release:** work only on `feature/react-firebase-port`. No merge into `main`, no Firebase deploy, no Production payment activation unless the owner explicitly approves a scoped release.

**Next assistant action after a reported final green test run:** record the actual final HEAD and owner's Demo UAT result, mark Demo Phase 10 development `COMPLETE` (if both pass), and **stop working on Phase 10**. Move to an owner-chosen real product release blocker, not new speculative bank/security phases.
