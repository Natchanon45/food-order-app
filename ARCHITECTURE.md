# Food Order App — Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.20
Build: 2026.07.06.040
Milestone: P9-B004 Firestore Rules Hotfix

## Scope

This branch contains Food Order, Delivery, Kitchen, Cashier, and Retail POS workflows. Current work focuses on Retail POS, offline-first sale flow, running numbers, receipt output, customers, and loyalty points.

## Core Rules

- Every business document must include `tenantId`.
- Retail POS must support online and offline sale save.
- Offline sales must sync back to Firestore.
- Duplicate bills are not allowed.
- Stock must not be deducted twice.
- Use the same stable `saleId` for local sale and Firestore sync.
- Firestore transactions must read required documents before writes.
- Firestore Security Rules must allow every document read/write used by POS transactions.
- Bump HTML `?v=` when referenced JS/CSS changes.

## Current Milestone State

Completed:

- QR Table Order
- Kitchen workflow
- Delivery Lock
- Cashier table move
- Paid-before-close guard
- Retail POS Online / Offline / Sync / Tenant support
- POS Firestore Foundation P9-B001
- POS Safe Confirm Payment
- P9-B002 Running Number alignment
- Receipt Service
- P9-B003 Counter
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver
- Sync Timeout Hotfix
- Firestore Rules Hotfix

Current milestone: P9-B004 Firestore Rules Hotfix

Next task: P9-B005 Repository Layer

## Firestore Rules for POS Sync

Tenant-scoped POS sync requires rules for:

- `sales`
- `saleItems`
- `stockMovements`
- `products` stock update
- `counters`
- `runningNumbers`
- `dailySummary`
- `syncQueue`
- `customers`
- `loyaltyLedger`
- `customerDisplays`

`runningNumbers` is required because P9-B003 uses an idempotent reservation ledger before writing the final sale.

## Deployment

Rules changes require Firestore rules deploy:

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only firestore:rules,hosting
```
