# Phase 3AE — Sealed Day Manifest Witness (Demo Candidate Only)
Date: 2026-10-21 Asia/Bangkok. SOURCE ONLY / UNEXPORTED.

## Scope and data flow
`functions/hybrid-billing-demo-day-manifest.js` contains `previewHybridSealedDayManifestCandidate`, `freezeHybridSealedDayManifestCandidate` and `recheckHybridFrozenDayManifestCandidate`.
Only executes when `GCLOUD_PROJECT=demo-penguin-hybrid-uat` AND `FIRESTORE_EMULATOR_HOST=127.0.0.1:<port>`, and the previous Phase3AD day coordinator has an explicit Super Admin-initiated day SEALED while Demo Epoch remains open. These modules are NOT exported in `functions/index.js`.
The pre-freeze proof runs `previewHybridJournalManifest` over all paid Delivery orders, validates **zero receipt issues**, and pages through ALL `hybridBillingReceiptEvents` (100 default, max200/page, max100pages) to validate source event IDs/source/tenant/actor/shard/timestamps/cents/ref hashes, Bangkok event sourceDay vs actual paidAt/refundAt, all receipts-to-16-fence-version count equality, and a stable pre/post 16-shard fence witness. It computes a SHA-256 digest binding journal root, fences, event page digests and day count/sums. No raw bank or customer PII in returned witness. Bounded scans fail closed on page limit, mismatched fence, invalid source day, orphan receipt or missing immutable journal.

A Super Admin-guarded Firestore transaction CREATEs exactly one synthetic document at `tenants/{tenantId}/hybridBillingDayManifestCandidates/{YYYY-MM-DD}`, rechecks the same day seal/epoch status, candidate absence and 16 fence versions, plus no global certified status. Repeat freeze refuses. A read-only recheck reruns the audit and compares digests; an Admin SDK unjournaled paid bypass AFTER freeze is detected and the candidate remains untouched.
This is **not a globally immutable financial close**: Admin SDK writers that do not enroll may still mutate journal, fences or manifest directly; no platform-level immutable anchor or complete source coverage is proven, and a non-atomic cross-page financial witness cannot certify source identity after seal. The snapshot itself is only create-once THROUGH this internal helper, not write-protected from every privileged backend. After detection, fail closed; never auto-invoice or silently rewrite the historic day.

## Tested coverage
- Real Firestore Emulator tests Phase3AE: (1) two genuine COD receipt writers, post-SEAL preview/freeze/recheck, repeated freeze denied and direct Admin SDK paid-without-journal post-freeze detected; (2) a preexisting unjournaled paid Delivery order refuses freeze; (3) orphan receipt without fence and forged timestamp/sourceDay reject freeze.
- No live provider/bank verification: `sourceCompletenessProven=false`, `immutableFinancialDayManifest=false`, `coverageCertified=false`, `canIssueInvoice=false`.
- The earlier 10k true COD journal benchmark is a SEPARATE 2-worker run, not a 10k financial day manifest workload. Higher writer concurrency, indexes and third-party money evidence remain BLOCKED.

## Next release blockers
All Admin/legacy/browser/REST/import/backup, independent authenticated Lalamove provider COD PAID_OUT + actually posted bank/Wallet credit, late settlement as append-only linked next OPEN day with original hash, backpressure/4–32 concurrent load, legal Thai tax/Refund/AR and real App Check human UAT; explicit Finance/Security signoff. Keep all four release flags FALSE, candidate unexported, no Firebase deploy, no Draft PR merge, no real financial writes.
