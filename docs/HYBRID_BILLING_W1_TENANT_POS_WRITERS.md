# Gate W1 — Tenant metadata and Retail POS restore writer protection

Date: 2026-10-21 Asia/Bangkok. Source-only candidate on Draft PR #7. Gate **NOT RELEASE READY**.

## Security issue
1. The legacy Super Admin `updateTenant` used a Tenant snapshot read before an Admin SDK batch. A financial hold could change the tenant state between read and batch, allowing an outdated `tenantSlugs.active=true` write.
2. The legacy Retail POS restore could delete/replace sales, returns, invoices, ledger and stock documents through unguarded 200-row Admin SDK batches. A Tenant migrating to Hybrid could undergo an unsafe restore without a trusted finance admission.

## Implemented source
- `functions/hybrid-billing-tenant-admin-guard.js` provides `updateTenantMetadataTransaction`, used by `functions/tenant-admin.js`. Reads CURRENT tenant, current target slug and old slug ownership before writes in a single Firestore transaction, retries when Tenant changes, applies suspended/manual-hold and incomplete Hybrid marker checks before mirroring slug activation, and preserves prior metadata edit behavior where allowed. Doesn't silently change the Tenant.active field.
- `functions/retail-pos-backup.js` uses `transactLegacyMigration` as a server-owned transaction guard on preflight and each POS backup clear/restore/settings chunk. Rejects Hybrid policy, enabled Hybrid, journal marker or ready coverage. Backup settings validation moved **before** destructive writes.
- Reviewed source fingerprints updated for these two changed noncandidate files. Candidate finance Functions remain unexported.

## Test coverage
Two real Firestore Emulator isolated tests: no slug reactivation for suspended Hybrid including simulated inconsistent Tenant.active=true; foreign slug collision blocked; no destructive POS sales deletion under Hybrid/journal marker, while unmarked Legacy can modify. Two source contract tests assert transaction calls and per-chunk restore gates. Run IDs `39611229914` Push, `39611238879` PR were in progress when drafted; verify exact final CI separately.

## Remaining W1 blockers
Client Rules do not fence Admin SDK/service accounts. Some membership/profile writes are still outside fully source-complete concurrency protection. Retail POS restore is multi-transaction and can partially complete for Legacy if interrupted; cannot claim all-or-nothing restore. Trusted non-PromptPay cashier canonical paidAt plus same-transaction immutable journal and full suspended all-source enforcement are the two original Emulator TODO and remain open. Full service credential/REST/import/refund enrollment, bank/provider reconciliation, stable cutoff, 4/8/32 contention, Thai tax, App Check, device UAT and Finance/Security approvals remain outside current source evidence. All four release flags FALSE, no Firebase deploy, merge or real financial writes.

### W1 code + CI contract correction — 2026-10-21
- Initial W1 CODE `5da3e49dbb8233192bff7d187fc5631f9e305b7e` failed the existing React Foundation Contract (GitHub Push `39611229914`, PR `39611238879`) because `tools/react-foundation-contract.mjs` still required the previously unguarded call literal `clearCollection(db, ref, name)`. The new guarded restore necessarily passes `tenant`: `clearCollection(db, tenant, ref, name)`.
- Latest CODE `81922a93b9f711330f1ec37857fa296c20ad7288` updates the contract to require tenant-aware restore and presence of `transactLegacyMigration` while disallowing raw `db.batch()`, without weakening the security guard. Prior 171 Hybrid Unit tests passed before this contract failure; **do not claim final CI PASS** until final new Push `39611883634` and PR `39611892718` plus ultimate docs HEAD complete successfully.
- Both historic Emulator TODO remain OPEN. Gate W1 remains BLOCKED, along with W2–W6. No Finance Candidate exports, live money changes, Firebase Deploy, merge or readiness flags.

### W1 grouped writer gate — CI-driven signup/master-business contract correction (2026-10-21)
- Initial W1 CODE `5da3e49dbb8233192bff7d187fc5631f9e305b7e` Unit 171 PASS but React Foundation Contract failed due outdated unsafe backup restore `clearCollection(db, ref, name)` literal; fixed without weakening guard in CODE `81922a93b9f711330f1ec37857fa296c20ad7288`.
- Next source+docs HEAD `7210fb4ae56294f3885f5a6e9cd59135a0a5d46a` failed a pre-existing `signup-billing-revenue-share.spec.mjs` assertion demanding `businessUnitsFor(requestedBusinessType)` inside the `updateTenant` handler rather than the new tenant-current transactional helper. New CODE commit `2a3ab20bf66f4343876c27e32dc683e4b08694bf` fixes the *contract only* to assert that `updateTenant` passes `requestedBusinessType, businessUnitsFor` to `updateTenantMetadataTransaction`; that helper actually computes business units after `tx.get(tenantRef)` and neither file writes signup billing or revenue share choices. No bypass, rollback or relaxation of money-data protection.
- CODE Push `39612640476`, PR `39612648253` initially PENDING. Check exact final CI on last six-doc HEAD before declaring all-green. W1-W6 still BLOCKED/INCOMPLETE, both original real Firestore Emulator TODO remain OPEN. All four flags FALSE; no Finance candidate export, live money, Firebase Deploy or PR merge.
