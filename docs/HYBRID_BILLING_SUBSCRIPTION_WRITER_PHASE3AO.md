# Phase3AO — Source-only Transaction Fence for Legacy Subscription Access

Date: 2026-10-21 (Asia/Bangkok). Branch: `feature/hybrid-billing-github-first`, Draft PR #7. **NO DEPLOY / NO LIVE FINANCIAL WRITES**.

## Gap after Phase3AN
Legacy `functions/subscription-admin.js` had four Admin SDK batch routes mutating `tenants/{id}.active` and `tenantSlugs/{slug}.active`, and skipped only `billingPolicyVersion === 'hybrid_v1'`. A tenant with just `hybridBillingEnabled`, `hybridReceiptJournalMode` (including empty string) or `hybridReceiptJournalCoverageReady` could still be reactivated by a stale scheduled, triggered, or Super Admin Legacy Subscription write. Client SDK Firestore Rules cannot stop Admin SDK.

## Implemented
`functions/hybrid-billing-legacy-access-guard.js` adds `mirrorLegacySubscriptionAccess`: a real Firestore transaction reads current Tenant before any write, calls existing `legacyDeliveryPaidWriterAllowed` (which denies all four Hybrid migration signals), runs a synchronous, source-owned `makePatch(tenant)` only for legitimate Legacy, validates strict subscription patch/slug patch field allowlists and `active` boolean, then atomically writes tenant and current slug or returns an explicit no-op. Firestore transactions retry against concurrent Tenant changes, rechecking the marker. No journal or Paid mutation is performed.

All four Subscription writers in `functions/subscription-admin.js` use `writeLegacySubscription`, with patch computation inside transaction:
1. `initializeTenantSubscription` on create: preserve trial/plan and skip if already initialized/revenue-share, Hybrid ignored.
2. `backfillTenantSubscriptions`: recheck current tenant; count only actual Legacy writes; no Hybrid reactivation.
3. `updateTenantSubscription`: Super Admin actions `extend`, `set-expiry`, `suspend`, `activate` evaluate current tenant; missing tenant or Hybrid fails with HttpsError, no bypass.
4. `syncExpiredTenants`: recheck current tenant, compute active/status in transaction, preserve existing slug expiration for status-only updates, skip already synced/suspended/revenue-share/Hybrid.

The parent `functions/index.js` finance candidate exports remain unchanged (unexported). Privileged static fingerprint for changed Subscription Admin source re-pinned. This change affects existing legacy functionality only **if released later following all gates**.

## Evidence
`tests/react-parity/hybrid-billing-firestore-emulator.spec.mjs` adds genuine isolated Demo Firestore Emulator test covering hybrid policy, partial enabled Hybrid, journal mode-only, journal coverage-only, unchanged tenant/slug on rejection, legitimate Legacy success, no-op and forbidden Hybrid-marker patch rejection. `tests/react-parity/hybrid-billing-legacy-payment-guard.spec.mjs` asserts all 4 Subscription writers call the transactional path and cannot use a direct batch. `tests/react-parity/signup-billing-revenue-share.spec.mjs` updates the source-level contract to check preservation of plan/trial plus transactional architecture rather than old batch shape.

Latest code commit `f618b173193b05594d9c8c41d727c13c366f89be`, CI Push `39579132633`, PR `39579141234` initially pending. Do not report final success until verified on exact final docs HEAD. Phase3AN baseline was 167 Hybrid Units, 78 Firestore Emulator PASS +2 TODO, 17 Auth+Rules, Push+PR 6/6.

## Unresolved Release Gates
Source-only narrowed legacy Subscription access path is not full Admin SDK/REST/import enforcement; tenant-admin, subscription/revenue-share settings, outside clients, cashiers, refunds, membership and all unknown service accounts require complete source-by-source review and runtime enforcement. The two original Emulator TODO remain OPEN: non-PromptPay trusted canonical `paidAt` + immutable receipt journal; all-path suspended-Hybrid protection. Real Lalamove bank/Wallet reconciliation, stable immutable lineage/cutoff, Thai tax/AR/refund review, higher concurrency, real App Check, staged device UAT and Finance/Security signoffs pending. All four Release Flags FALSE; no live coverage certification, Firebase deploy, merge, real money writes.

### Phase3AO CI regression and contract correction — 2026-10-21
- Phase3AO initial CODE `f618b173193b05594d9c8c41d727c13c366f89be` Code Push Actions `39579132633` FAILED 5/6: Hybrid Unit 167 PASS + 1 FAIL because `tests/react-parity/hybrid-billing.spec.mjs` asserted four literal `billingPolicyVersion === "hybrid_v1"` checks, now replaced by the stronger single transaction-time four-signal Hybrid guard. Other five Jobs (including real Firestore Emulator, Auth+Rules, Functions, Storage, React) passed. Corresponding PR run was cancelled by docs commits.
- Corrected Unit contract CODE `cb62a1e8381a4771e94e775c28cda6b2cbf90bc3` now asserts all FOUR `await writeLegacySubscription(db,...)` paths, shared `tx.get(tenantRef)` and `legacyDeliveryPaidWriterAllowed(tenant)` instead of a brittle count. The guard remains strict; no security bypass. Current Push Run `39579518210` and PR Run `39579525783` pending at initial recording. Verify final HEAD CI independently and report any failures precisely. Do not claim Phase3AO pass from cancelled/superseded runs.
- No Finance Candidate exported, no live money writes, Firebase deploy or Draft PR merge. Two original Emulator TODO and all financial, Global Backend Writer, App Check and Finance/Security Release Gates stay OPEN. Four flags remain FALSE.
