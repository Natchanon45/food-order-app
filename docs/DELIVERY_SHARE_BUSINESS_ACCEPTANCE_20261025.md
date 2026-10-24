# Delivery share collection — one real business workflow (scope correction)

Date: 25 October 2026. Source: owner-confirmed business rules. Branch: feature/react-firebase-port.
This is the real target; private synthetic Bank Evidence/Refund phases are NOT substitutes.

## Acceptance example (Asia/Bangkok)

- Tenant is activated **3 Oct 2026**: billing cycle **3 Oct–2 Nov 2026** (next reset: 3 Nov).
- Count ONLY verified-paid Delivery merchandise (after applicable refunds), never in-store,
  Retail POS, customer delivery fee, or already-deducted Lalamove prepaid Wallet costs.
- Central settings: Delivery threshold THB 10,000 per activation-anniversary cycle,
  rate 5%; first THB 10,000 is EXEMPT, NOT the assessment base.
- By 9 Oct cumulative sales THB 10,000 => share THB 0.
- On 10 Oct a further THB 1,500 paid Delivery => excess THB 1,500,
  share **THB 75** for that day, no charge on the first 10,000.
- That day's assessed share is payable by **23:59 Bangkok time, 10 Oct**.
  If not confirmed paid by that deadline, automated job on 11 Oct suspends
  service temporarily; the job must be idempotent and check already-approved
  receipts and all other access restrictions, not blindly overwrite them.
- Tenant submits a slip. Verified successful Slip2Go **with receiver, amount,
  date and duplicate checks** approves the receipt; outages/missing service
  go to Super Admin manual review, never automatic approval.
- Super Admin's verified approval unblocks only this billing suspension;
  rejected/undecided proofs cannot be reported as real bank payment.
- Cycle total/next payment and suspension state must be visible on the actual
  tenant owner and Super Admin screens, not merely on a separate demo report.

## Findings / state after scoped correction

- **CORRECTED, tested:** both pure Hybrid calculation and existing Revenue Share
  reporting calculate ONLY excess Delivery amounts over the threshold. Native
  tests: `npm run test:hybrid-billing` **351/351 PASS** and
  `npm run test:signup-billing-revenue-share` **18/18 PASS**.
  Added exact owner scenario covering anniversary, THB 75, due-date,
  next-day overdue logic, renewal reset.
- **ALREADY EXISTS but NOT WIRED TO HYBRID RELEASE:** Billing anniversary
  helper, paid Delivery order source; existing Revenue Share slip form,
  Slip2Go verifier, Super Admin review UI, and 00:20 Bangkok daily scheduled
  reconciler (restricted to historical Revenue Share, monthly for Premium).
- **NOT DELIVERED:** real Hybrid invoice issuance flag remains false;
  Hybrid payment callable flag remains false; new tenants cannot register
  Hybrid via public signup; new Premium subscribers skip Revenue Share
  suspension due to historicalSetting guard; daily Premium workflow and
  next-day enforcement have not been integrated/accepted. These are the
  remaining delivery blockers, not external bank-evidence research.
- **SAFETY:** No real collection/payment scheduling/release was activated
  by this change. Existing signed historical invoices may conflict with
  changed calculation and MUST receive explicit migration/reconciliation,
  never silent rewrite. No Production deployment.

## Exact next implementation objective (no scope creep)

Wire one authoritative server-side daily charge and payment ledger to the
existing owner/Super Admin workflows; change only the Premium Delivery
billing path as required while preserving unrelated legacy revenue share.
Use tested activation anniversary, trusted paid Delivery data and immutable
amounts. Implement idempotent 00:20 overdue enforcement and reversible
billing-only suspension, verified Slip2Go auto-review plus manual Super
Admin fallback, and test full Browser+Firestore Emulator end-to-end before
any Production activation. Do NOT announce it complete until real customer
flow and suspension/unlock pass end-to-end. Synthetic Bank Evidence/Refund
Proof workflows are out of scope and must not block this objective.
