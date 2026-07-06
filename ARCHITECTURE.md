# Food Order App — Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.19
Build: 2026.07.06.039
Milestone: P9-B004 Offline Queue Sync Timeout Hotfix

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

Current milestone: P9-B004 Offline Queue Sync Timeout Hotfix

Next task: P9-B005 Repository Layer

## Retail POS Data Model

Tenant-scoped Firestore path:

```text
tenants/{tenantId}/{collectionName}/{documentId}
```

Known POS collections:

- `sales`
- `saleItems`
- `stockMovements`
- `shifts`
- `counters`
- `runningNumbers`
- `dailySummary`
- `syncQueue`
- `auditLogs`

## Sale Identity

Retail POS creates one stable `saleId` before saving. The same `saleId` is used locally and during Firestore sync.

Sync rules:

1. Read sale by stable `saleId`.
2. If it exists, do not create a duplicate and do not deduct stock again.
3. Read summary and product docs before writes.
4. Reserve final number in transaction.
5. Write sale, items, stock movements, summary, and sync queue.

## P9-B004 Offline Queue

The offline queue worker manages local sales with `pending`, `syncing`, `failed`, and `conflict` states.

Capabilities:

- Detailed queue snapshot and status counts
- Retry backoff with `nextRetryAt`
- Stale `syncing` recovery
- Per-sale sync timeout guard to prevent `กำลัง Sync...` from staying forever
- Conflict detection for tenant mismatch, product not found, invalid product id, invalid quantity, and insufficient stock
- Manual retry or discard conflict resolver
- Diagnostic API exposed as `window.retailOfflineQueue`

## Deployment

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```
