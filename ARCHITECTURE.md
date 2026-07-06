# Food Order App — Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.16
Build: 2026.07.06.036
Milestone: P9-B002 Receipt Service

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
- Save Screen Hotfix
- Receipt Service

Current milestone: P9-B002 Receipt Service

Next task: P9-B003 Counter

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

Local sale flow:

1. Create stable `saleId`.
2. Assign pending SALE number.
3. Save local sale with `syncStatus: pending`.
4. Deduct local stock once.
5. Keep sale for offline sync.

Sync flow:

1. Read sale by stable `saleId`.
2. If it exists, do not create a duplicate and do not deduct stock again.
3. Read summary and product docs before writes.
4. Reserve final number in transaction.
5. Write sale, items, stock movements, summary, and sync queue.

## Receipt Service

Receipt output uses `/pos/receipt/`. The POS screen saves and unlocks first. The receipt page reads the saved local sale by `saleId`, shows items, customer information, and loyalty point summary, then handles browser printing outside the main POS screen.

Rules:

- Do not block the main POS screen.
- Do not use the old in-page receipt overlay after sale save.
- Read receipt data from the saved sale.
- Include customer data from sale.
- Include loyalty data when available.

## Loyalty Flow

The loyalty module waits for the saved sale and writes updated customer points, sale loyalty summary, and loyalty ledger row. The receipt page waits briefly so points can appear on the bill.

## Files

- `public/assets/js/retail-pos-firestore-foundation.js`
- `public/assets/js/retail-pos-counter.js`
- `public/assets/js/retail-offline-sale-sync.js`
- `public/assets/js/retail-pos-safe-confirm.js`
- `public/assets/js/retail-pos-receipt-modal.js`
- `public/assets/js/retail-pos-receipt-window.js`
- `public/assets/js/retail-pos-loyalty.js`
- `public/pos/receipt/index.html`
- `public/pos/index.html`

## Deployment

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```
