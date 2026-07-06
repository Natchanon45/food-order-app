# Food Order App — Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.15
Build: 2026.07.06.035
Milestone: P9-B002 Running Number — Save Screen Hotfix

## Scope

This branch contains the Food Order, Delivery, Kitchen, Cashier, and Retail POS workflows. The active development focus is the Retail POS Firestore foundation and offline-first sale flow.

## Core Rules

- The system is Multi Tenant. Every business document must include `tenantId` and should also carry `shopId` when applicable.
- Retail POS must support both online and offline operation.
- Offline POS sales must sync back to Firestore when internet connectivity returns.
- Duplicate bills are not allowed.
- Stock must not be deducted twice.
- The same stable `saleId` must be used for both local/offline sale storage and Firestore sync.
- Firestore transactions must read every required document before writing, following Firestore transaction rules.
- When JS/CSS files referenced by HTML are changed, the related `?v=` query string must be bumped to avoid browser cache issues.

## Current Milestone State

Completed:

- QR Table Order
- Kitchen workflow, including serve single item and serve all
- Delivery Lock
- Cashier table move
- Guard to prevent closing a table before payment is completed
- Retail POS Online / Offline / Sync / Tenant support
- POS Firestore Foundation P9-B001
- POS Safe Confirm Payment
- P9-B002 Running Number alignment
- Receipt Freeze Hotfix
- Save Screen Hotfix

Current milestone:

- P9-B002 Running Number — Save Screen Hotfix

Next task:

- P9-B003 Counter

## Retail POS Data Model

Primary tenant-scoped Firestore collections are stored under:

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

## Sale Identity and Duplicate Protection

Retail POS must create one stable `saleId` before saving a sale locally. That same `saleId` is reused during Firestore sync.

Local/offline flow:

1. Create stable `saleId`.
2. Assign a pending SALE document number using the shared P9-B002 running-number helper.
3. Save the local sale with `syncStatus: pending`.
4. Deduct local stock once for the POS UI.
5. Keep the sale in the offline queue for Firestore sync.

Firestore sync flow:

1. Read existing sale by stable `saleId`.
2. If the sale already exists, do not create a duplicate bill and do not deduct stock again.
3. Read daily summary and every product document before writing.
4. Reserve the final running number inside the same transaction.
5. Write `sales`, `saleItems`, `stockMovements`, `dailySummary`, and `syncQueue` updates.
6. Mark the local sale as `synced` and update the final `saleNumber`.

## Running Number Design

P9-B002 introduces shared helpers for document numbering.

Important concepts:

- `SALE` uses prefix `POS`.
- Daily reset is used for SALE running numbers.
- Pending local/offline number format is used until Firestore sync reserves the final number.
- Final number reservation must happen inside a Firestore transaction.
- Running numbers must be tenant-scoped.

Example pending number:

```text
POS-YYYYMMDD-PENDING-XXXXXX
```

Example final number:

```text
POS-YYYYMMDD-00001
```

## Receipt Screen Flow

The receipt screen is temporarily disabled after successful POS sale saves to prevent the page from freezing. The save flow must close old overlays, unlock the POS page, and focus the barcode input for the next sale.

Important rules:

- Do not open a receipt screen automatically after saving.
- Do not start browser print from the sale save flow.
- Do not hook sale localStorage writes to show receipt UI.
- The receipt/print feature should be rebuilt later as a separate lightweight flow.

## Offline Queue and Conflict Handling

The offline worker scans local sales with pending, syncing, failed, or conflict states. It retries failed syncs using delay/backoff rules and marks conflict cases for manual handling when needed.

Known conflict examples:

- Tenant mismatch
- Product not found
- Invalid product id
- Invalid quantity
- Insufficient stock

## Files Related to Current POS Foundation

- `public/assets/js/retail-pos-firestore-foundation.js`
- `public/assets/js/retail-pos-counter.js`
- `public/assets/js/retail-offline-sale-sync.js`
- `public/assets/js/retail-pos-safe-confirm.js`
- `public/assets/js/retail-pos-receipt-modal.js`
- `public/assets/js/retail-pos-receipt-modal-guard.js`
- `public/assets/js/retail-pos-repository.js`
- `public/pos/index.html`

## Deployment

Use the branch workflow only:

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```

## Workflow Notes

Before each development task:

1. Read `PROJECT_CONTEXT.md`.
2. Read `README.md`.
3. Read `ARCHITECTURE.md` if present.
4. Check the latest HEAD on `feature/retail-pos`.
5. Continue from the latest milestone; do not restart or change architecture unnecessarily.

When code changes are made:

- Update `README.md`.
- Update `PROJECT_CONTEXT.md`.
- Update `ARCHITECTURE.md` when architecture or milestone state changes.
- Report Version, Build, and latest HEAD.
