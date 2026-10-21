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
