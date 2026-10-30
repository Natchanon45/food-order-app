# PENGUIN / LUKKAJA — 31 October 2026 port matrix

**Source:** cosmatch/lukkhaja, branch feature/react-golang-vite-tailwind-axios, HEAD f9a6ddcd655da5c8c12e023a28880c74246ef768.

**Destination:** Natchanon45/food-order-app, isolated review branch feature/port-lukkaja-20261031, based on feature/react-firebase-port d87fc3752efff126dc9846d7cbe844aa982840a2. No main merge or Firebase Production deploy.

**Critical:** LUKKAJA Go/MySQL code cannot be directly cherry-picked into Firebase. PENGUIN's Firestore and Cloud Functions transactions remain authoritative. Existing Laravel MASTER remains a UX reference. Business payment/void work is NOT complete or deployable before emulator verification.

## Source commit mapping: all 24 commits from 31 October 2026 (Asia/Bangkok)

| Source commit | Original change | PENGUIN port state |
|---|---|---|
| 0f9a8824 | Uploaded favicon on all web/print tabs | ADAPTED: existing Firebase branding runtime plus new print favicon helper. No Go favicon redirect copied |
| c5dafa80 | Green Quick Order design | PORTED: route-scoped responsive emerald CSS |
| a8a952fd | Held bill delete confirmation/icons | PORTED: shared confirmation blocks immediate delete; cash amount auto-select |
| d99371a0 | M2.148 deployment docs | DOC-ONLY, no code to transfer |
| a6505499 | Admin-controlled category and menu sorting | ALREADY NATIVE in Firebase menuSort and Quick Order watch |
| c256afcf | Reviewed paid Walk-in cancellation | PENDING: authenticated Cloud Function review, source attribution and ledger safety |
| 991cd7e2 | Paid cancellations and sales-report exclusion | PENDING: transaction and audit, cancellation attribution, financial reporting |
| 85f596b7 | Isolated MySQL cancellation tests | PENDING: replace with isolated Firestore/Functions Emulator integration |
| 0d12554e | Cancellation UAT docs | DOC-ONLY |
| 24fe0b63 | Cancelled receipt status filter / watermark | PENDING trusted cancellation event |
| 7f32f7b6 | Actor-specific bordered red watermark | PENDING trusted cancellation event |
| 97996782 | Larger framed cancellation watermark | PENDING trusted cancellation event |
| ff67e133 | Cancelled net displayed but not counted in sales | PENDING server-trusted paid/cancelled reconciliation |
| 458b4ba5 | M2.156 release docs | DOC-ONLY |
| 0aa55507 | Wallet credit scroll and slip history spacing | PORTED: independent scoped CSS, no revenue logic change |
| 5a085593 | M2.157 release docs | DOC-ONLY |
| 727e8523 | Send to kitchen before payment, add-on rounds, final settlement | PENDING Firestore Cloud Function transaction, idempotency and table lock |
| 4d6b5ce1 | Go local runtime repair notes | DOC-ONLY |
| 3a356543 | Deferred bill display and cashier/kitchen cancellation | PENDING: depends on unpaid bill server contract |
| 70e76afd | M2.160 local runtime notes | DOC-ONLY |
| eb2b9f8c | Google Login/Logout refresh delivery address via GPS | PORTED with Firebase-specific guest/cloud favorite merge and race guards |
| db329335 | Preserve mobile scroll during Google Login | PORTED: initial-only full-page overlay, menu/cart DOM stays mounted |
| e4c1e928 | M2.162 production release docs | DOC-ONLY |
| f9a6ddcd | Production file cleanup docs | DOC-ONLY; NEVER copy production cleanup to PENGUIN |

Quick Order select-all tender was included with kitchen-first changes, and is already ported independently without enabling unverified kitchen-first pay-later buttons.

## Completed in this isolated branch

- Auth changes for Delivery: switch customer address book only after Firebase authentication event, clear old checkout destination, invalidate stale async responses, request fresh GPS once per confirmed identity, and only select a nearby accurately pinned saved address. Preserve guest/cloud favorite merging and cart/catalog DOM (mobile scroll).
- Green/gray/black Quick Order skin; cash tender input selects its number; dialog confirmation for held-bill deletion before its existing Firebase Callable is invoked. Existing Firebase menuSort already implements admin order; no new sorting writer.
- Latest Wallet list bounded scroll and slip-history inner card spacing for the existing Revenue Share page.
- Firebase-uploaded platform favicon is already applied to browser tabs; print receipt, admin QR and waiting queue tabs inherit it with safe HTML escaping.
- Native regression coverage; NO changes to Go, Firestore rules, Cloud Functions, finance, live tenant data or release credentials.

## Pending acceptance and technical scope (NOT COMPLETE)

1. Paid and unpaid cancellation must be routed through role-checked Firebase Callables with atomic audit, idempotency and expected payment status. Existing direct-client Firestore update methods MUST NOT be used as proof of a reviewed cancellation or refund.
2. Kitchen-first unpaid Walk-in: authoritative server menu pricing, claimed table, deduplicated add-on operations, per-round kitchen served lines, final cashier settlement and atomic table release. No new payment UI until protected transaction APIs exist and pass tests.
3. Only after those guards pass: cancellation source and status filters, red receipt marks and watermark, display original net totals without counting cancelled bills as paid revenue.
4. Test Auth/Firestore/Functions concurrency, retries, tenant isolation, role permissions, paid/unpaid crossover, dine-in/takeaway, table release and sales exclusion against a LOCAL Firebase Emulator project only.
5. Reconcile UI with Laravel MASTER and owner UAT. Never merge main or deploy Firebase Hosting/Functions without separate approval.

**Status:** This is a traceable first PORT INCREMENT, not a claim all 24 commits' behavior is already implemented.
