# Food Order App — Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.22
Build: 2026.07.06.042
Milestone: P9-B004 Loyalty + Receipt Privacy Hotfix

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
- Shared helper exports must stay compatible across POS modules.
- Receipt output must mask customer name and phone by default.
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
- Pending Number Helper Hotfix
- Loyalty + Receipt Privacy Hotfix

Current milestone: P9-B004 Loyalty + Receipt Privacy Hotfix

Next task: P9-B005 Repository Layer

## Loyalty and Receipt Privacy

Loyalty points are written after the `retail-pos-sale-saved` event. The loyalty module uses the saved sale customerId as fallback, updates local customer/sale/ledger first, then attempts Firestore sync.

Receipts and sales receipt dialogs must show:

- `ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน` when VAT is present
- VAT rows when applicable
- Loyalty point summary when available
- Masked customer name
- Masked customer phone

## Deployment

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only firestore:rules,hosting
```
