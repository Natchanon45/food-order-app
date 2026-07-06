# Food Order App — Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.25
Build: 2026.07.06.045
Milestone: P9-B005 Repository Layer / POS UX Hotfix

## Scope

This branch contains Food Order, Delivery, Kitchen, Cashier, and Retail POS workflows. Current work focuses on Retail POS, offline-first sale flow, running numbers, receipt output, customers, loyalty points, repository-layer consolidation, and POS cashier UX.

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
- P9-B005 Repository Layer foundation
- POS UX Hotfix for product hover, sold-out cards, and bill reset after payment
- Receipt privacy and simplified half-card product hover label hotfix

Current milestone: P9-B005 Repository Layer / POS UX Hotfix

Next task: Continue P9-B005 integration by replacing direct POS localStorage/tenant ref usage in runtime modules with repository helpers, then move to P9-B006 Firestore Composite Index.

## Repository Layer

The Retail POS repository layer is the preferred access point for shared POS data helpers. It now owns:

- Tenant-scoped collection and document refs.
- Tenant metadata validation and normalization.
- Local JSON repositories for sales, products, stock movements, sync queue, and customers.
- Local value repositories for active shift and store settings.
- Tenant repositories for products, sales, stock movements, shifts, returns, customers, settings, sync queue, audit logs, and counters.

Runtime POS modules should gradually replace direct localStorage keys and duplicate tenant ref helpers with `retail-pos-repository.js` exports. This keeps Online / Offline / Sync behavior centralized while preserving stable saleId and duplicate-protection rules.

## POS UX Hotfix

Retail POS product cards on PC should use a half-card bottom overlay on hover. The overlay should show only the product name and price, without a separate browser tooltip, so cashiers can read it quickly without covering nearby products.

Sold-out products should be visually greyed out and marked with a sold-out badge.

After any successful payment flow or receipt close, the active bill must be cleared. The reset must clear cart rows, discount, payment input, customer/loyalty selection UI, totals, and return focus to the barcode input so the cashier can immediately start the next sale.

## Loyalty and Receipt Privacy

Loyalty points are written after the `retail-pos-sale-saved` event. The loyalty module uses the saved sale customerId as fallback, updates local customer/sale/ledger first, then attempts Firestore sync.

Receipts and sales receipt dialogs must show:

- `ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน` when VAT is present
- VAT rows when applicable
- Loyalty point summary when available
- Masked customer first name: first up to 5 characters followed by `*****`
- Masked customer last name: `*****` followed by the last 3 characters
- Masked customer phone

## Deployment

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```
