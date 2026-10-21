# Phase3AF — Pending late-evidence exception candidate

Date: 2026-10-21 Asia/Bangkok. Isolated demo-Emulator source only, not exported or deployed.

Purpose: keep the Phase3AE original immutable-candidate day manifest unchanged when a potential financial settlement arrives on a later Thai day. This is a **pending review EXCEPTION**, not a trusted financial posting, refund journal, invoice adjustment, bank credit, Lalamove payout verification, or accounting credit/debit note.

## Safety design
`functions/hybrid-billing-demo-late-exception.js` validates a Bangkok originalDay, strictly later bookingDay, original-day sourceAt and later-day postedAt, positive integer THB satang amount, SHA-256 reference and *different* source/posted evidence SHA-256 fields. Three candidate labels only: `lalamove_cod_paid_out`, `promptpay_bank_posted`, `bank_refund_posted`; label or hash is not proof of actual source or credit.

Demo-only call rechecks frozen original day via `recheckHybridFrozenDayManifestCandidate` and the complete paid receipt inventory; then an isolated Firestore transaction checks hybrid tenant, active Super Admin, sealed original cutoff, unchanged frozen manifest digest, existing tenant candidate and global-demo reference claim, and creates BOTH the pending exception and reference claim atomically. Exact identical replay returns no-write idempotent status; changed amount/reference proof or cross-tenant reference collision fails closed. Original sealed day, orders, receipt events, invoices and flags are untouched.

Candidate stores `sourceAttested:false`, `bankCreditVerified:false`, `settlementPosted:false`, `financialDayReopened:false`, `coverageCertified:false`, `canIssueInvoice:false`. These fields MUST NOT be promoted automatically. `bookingDay` is only metadata, not a new OPEN financial ledger day.

## Tests and limitations
Unit: `tests/react-parity/hybrid-billing-demo-late-exception.spec.mjs` three pure/production-rejection tests. Real Emulator: `tests/react-parity/hybrid-billing-firestore-emulator.spec.mjs` two integration cases for frozen manifest lineage, deterministic idempotency and replay, no original state modification, missing frozen manifest and cashier denial. At CODE `4e567d589c028174f2ca3b8841bd4a0f10c78209`, PR [39558021865](https://github.com/Natchanon45/food-order-app/actions/runs/39558021865) SUCCESS 6/6, focused Unit 142 PASS, Emulator 70 PASS+2 TODO, Rules11 PASS; Push [39558014787](https://github.com/Natchanon45/food-order-app/actions/runs/39558014787) pending when written.

No independent authenticated provider or bank adapter, no batch payout allocation, no proof of immutable global writer enforcement. Preflight scans are non-atomic and bypassing privileged writers can alter data after the recheck. Still required: trusted Lalamove PAID_OUT and independently posted bank/Wallet credit on approved staging; replay-safe batch allocation/journal in new actually OPEN financial days, all-source admission, Thai accounting signoff, concurrency, App Check UAT and Finance/Security review. NEVER activate four release flags, export candidates, deploy, merge PR, or write real financial records.
