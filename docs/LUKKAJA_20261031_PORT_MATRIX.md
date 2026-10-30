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
| c256afcf | Reviewed paid Walk-in cancellation | CANDIDATE: audited paid-Walk-in Callable, actor attribution and preserved payment (Firestore Emulator verified); owner UAT pending |
| 991cd7e2 | Paid cancellations and sales-report exclusion | CANDIDATE: paid/unpaid cancellation, role audit, zero counted sales, historic receipts; non-Walk-in coverage pending |
| 85f596b7 | Isolated MySQL cancellation tests | ADAPTED: real local Firestore+Auth Emulator with demo-only DB; replaces MySQL integration |
| 0d12554e | Cancellation UAT docs | DOC-ONLY |
| 24fe0b63 | Cancelled receipt status filter / watermark | CANDIDATE: status filter/actor-framed red watermark from audited record, browser print UAT pending |
| 7f32f7b6 | Actor-specific bordered red watermark | CANDIDATE: status filter/actor-framed red watermark from audited record, browser print UAT pending |
| 97996782 | Larger framed cancellation watermark | CANDIDATE: status filter/actor-framed red watermark from audited record, browser print UAT pending |
| ff67e133 | Cancelled net displayed but not counted in sales | CANDIDATE: historical amount visible while cancelled net excluded from sales KPIs and charts; UAT pending |
| 458b4ba5 | M2.156 release docs | DOC-ONLY |
| 0aa55507 | Wallet credit scroll and slip history spacing | PORTED: independent scoped CSS, no revenue logic change |
| 5a085593 | M2.157 release docs | DOC-ONLY |
| 727e8523 | Send to kitchen before payment, add-on rounds, final settlement | CANDIDATE: Cloud Function transactions for server-priced append, stable operation ID, serve-before-pay and atomic table release; Emulator PASS |
| 4d6b5ce1 | Go local runtime repair notes | DOC-ONLY |
| 3a356543 | Deferred bill display and cashier/kitchen cancellation | CANDIDATE: kitchen-first, partial/full cancellations and table release with role checks; physical/UAT pending |
| 70e76afd | M2.160 local runtime notes | DOC-ONLY |
| eb2b9f8c | Google Login/Logout refresh delivery address via GPS | PORTED with Firebase-specific guest/cloud favorite merge and race guards |
| db329335 | Preserve mobile scroll during Google Login | PORTED: initial-only full-page overlay, menu/cart DOM stays mounted |
| e4c1e928 | M2.162 production release docs | DOC-ONLY |
| f9a6ddcd | Production file cleanup docs | DOC-ONLY; NEVER copy production cleanup to PENGUIN |

Quick Order select-all tender, Pay First / Kitchen First flows and add-on mode now use Firebase Callables in a review-only candidate. Nothing has been deployed.

## Completed in this isolated branch

- Auth changes for Delivery: switch customer address book only after Firebase authentication event, clear old checkout destination, invalidate stale async responses, request fresh GPS once per confirmed identity, and only select a nearby accurately pinned saved address. Preserve guest/cloud favorite merging and cart/catalog DOM (mobile scroll).
- Green/gray/black Quick Order skin; cash tender input selects its number; dialog confirmation for held-bill deletion before its existing Firebase Callable is invoked. Existing Firebase menuSort already implements admin order; no new sorting writer.
- Latest Wallet list bounded scroll and slip-history inner card spacing for the existing Revenue Share page.
- Firebase-uploaded platform favicon is already applied to browser tabs; print receipt, admin QR and waiting queue tabs inherit it with safe HTML escaping.
- New tenant-authenticated Firebase Callables handle deferred creation, append with server menu pricing, serving, cash settlement, unpaid cancellation, reviewed paid cancellation, role/audit and table release. Existing operational error helpers now actually throw on invalid inputs, discovered by the Emulator.
- Firestore Security Rules deny Browser creation and modification of protected Walk-in records; tested normal cashier non-Walk-in edit as a positive control.
- Cancelled receipt history is searchable with displayed original money but excluded from sales KPI, charts and counted revenue; print code/watermark shows actor; five locale texts.
- Local demo Firestore/Auth Emulator transaction/rules tests 2/2 PASS; pure policy/accounting tests 9/9 PASS; no production writes, no Firebase deploy, original LUKKAJA untouched.

## Remaining gates for exact parity and true failover

- Browser + print UAT comparing both products: Kitchen/Quick Order/Cashier, physical 58/80/A4 receipt, admin Sales Report. Owner has not signed off.
- Other order types: reviewed payment cancellation for Delivery, QR-table and Takeaway, existing Lalamove/COD and payment provider evidence must be separately tested and aligned. For paid Walk-in, Kitchen item-level editing intentionally remains blocked without a transactional endpoint.
- New counter paid PromptPay rejects unverified payment as LUKKAJA does; provider verification live is unproven.
- Demo-only Emulator tests do NOT constitute Production certification. Require staging and owner UAT; do not merge or deploy without separate release approval.
- **CRITICAL BACKUP LIMIT:** matching logic does not replicate MySQL to Firestore or vice versa. Orders, accounts, payments, audit, media and outstanding liabilities remain in separate databases. Actual hot standby requires data/event synchronization, deduplication, conflict resolution, security/consent rules, failover and tested restore runbooks. No such replication is deployed yet.

**Status:** Business flow code is a local/isolated candidate, not an operating live backup or certified exact parity.
