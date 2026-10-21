# Phase3AN — Transactional Revenue Share Legacy Tenant Access Writer Guard

Date 2026-10-21, Asia/Bangkok. Source candidate in GitHub Draft PR #7. **NO FIREBASE DEPLOY.**

## Privileged writer escape identified
`functions/revenue-share.js` deployed legacy exports handle manual unlocks, approved payment release, auto-approval and scheduled access synchronization. Their shared `mirrorTenantAccess` helper previously used an Admin SDK batch and mirrored `active` to both `tenants/{id}` and `tenantSlugs/{slug}`, using tenant state fetched earlier in the request. A Hybrid finance suspension/migration could race a stale legacy unlock; Admin SDK writes bypass Client Rules, so Phase3AM alone could not stop this.

Independently, `functions/subscription-admin.js` still includes legacy `active` mutators and is *not* covered by this transactional change. Any implication of global protection is prohibited.

## Scoped code change
`functions/hybrid-billing-legacy-access-guard.js` exports `mirrorLegacyTenantAccess` for the single Revenue Share access mirror. The helper validates dependencies/patch shape, refuses attempts to mutate Hybrid finance control markers, reads current Tenant doc **within** a Firestore transaction, reuses `legacyDeliveryPaidWriterAllowed` to deny Hybrid policy, partial enabled Hybrid, any journal coverage marker/mode or missing Tenant, and atomically writes legacy Tenant and current TenantSlug access mirror. Optimistic Firestore transaction retries require rechecking the tenant marker after conflicting writes.

`functions/revenue-share.js` routes its existing mirror helper through this guarded operation. It does not alter a production deployment during GitHub Draft phase. For actually Legacy tenants without Hybrid/journal markers, the same access fields are mirrored. No invoice, receipt, bank proof, or paidAt is created.

`functions/hybrid-billing-phase3ai-privileged-ingress.js` fingerprints the updated Revenue Share source and the unchanged Subscription Admin source for review tripwire purposes (10 pinned critical files, from 8). This SHA pin is NOT a runtime security boundary.

## Real tests
- Auth and source contracts assert the deployed Revenue Share module delegates to the atomic guard instead of a standalone batch; the guarded code reads Tenant before writes.
- One new REAL isolated Firestore Emulator test ensures `active=true` legacy attempts are denied for financially suspended `hybrid_v1`, marker-only journal mode `""`, and marker-only coverage-ready tenant. All rejected cases retain Tenant and TenantSlug `active=false`; genuine Legacy tenant can still mirror `active=true`.
- Previous Phase3AM verified: 166 Hybrid Unit PASS, 77 Emulator PASS+2 TODO, 17 Rules PASS. Phase3AN Code Push 39577150836 / PR 39577156697 must be checked again to establish final test counts and CI. No production Firestore actions.

## Still unresolved
The remaining Subscription Admin legacy access writers, other privileged REST/import paths, actual trusted cashier non-PromptPay paidAt and journal, full-scope suspended Hybrid Client+Backend gate, provider/posted credit, immutable cutoff, Thai tax/AR, concurrency 4/8/32, real App Check, staging device UAT and Finance/Security approvals remain **BLOCKERS**. The two original Firestore Emulator TODO are OPEN. Four readiness flags FALSE. Do not export finance candidates from `functions/index.js`, flip coverage ready on real stores, merge PR #7 or deploy Firebase.

### Phase3AN CI-driven correction — 2026-10-21
- Initial CODE `7756f4d9fcfc2817ebde431c734c03b130dbc4f3` failed the new **genuine Firestore Emulator** test because the new guard had a reversed patch-validation condition. Push run `39577150836` and PR run `39577156697` were FAILURE 5/6: 77 PASS + 2 TODO + 1 FAIL. No Hybrid money or live records touched.
- Corrected CODE `81ea30924169d99001b208073075eb8c4b7bc66d` flips the validation condition to accept only patches with legitimate legacy access fields and continue to the authoritative `tx.get(tenantRef)` transaction guard; the security gate is **not bypassed**. New CODE Push `39577593617`, PR `39577604861` started; must verify actual final CI status/counts before reporting PASS.
- The scoped guard still applies ONLY to Revenue Share access mirroring, and the independent `subscription-admin.js` legacy active/slug mutators are still unguarded. Both historical Firestore Emulator TODO remain OPEN. None of four readiness flags were enabled, no finance exports/deploy/merge.
