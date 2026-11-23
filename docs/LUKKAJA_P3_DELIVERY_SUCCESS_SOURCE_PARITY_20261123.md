# P3 — Delivery Success Source UI Parity (2026-11-23)

**Source read-only:** `cosmatch/lukkhaja`, `feature/lukkaja_bankalert_stripe` @
`e60858c12b3e52a7ca6785e329d77004160e6657`

**Target:** `Natchanon45/food-order-app`, `feature/react-firebase-port`.

**Module scope:** Carry current Source delivery-success **presentation and customer
actions** forward onto the existing Firebase order/QR/tracking backend.
No Go, Laravel, SQL or Stripe payment-execution port was made in this module.
No Production deployment is included.

## Source delta reviewed

Source: `resources/js/react-port/pages/DeliverySuccessPage.jsx`
(1,005 lines) and `resources/css/react-port-delivery-success.css`.

Latest Source 23 November changes:
- One green order-received card for successful Stripe and PromptPay; payment
  channel and Sandbox are **display-only badges**, never payment authority.
- Three equal icon-first actions (view latest, download PNG, order again),
  immediately under the green Header on desktop/mobile.
- Stripe unpaid/failed status remains separate amber/red, without showing
  the green paid success card.
- Confirmed PromptPay QR must not show receipt/payment success early.
- Align top action, success card and tracking card to one width,
  compact vertical spacing.

## Target implementation

```text
react-app/src/pages/DeliverySuccessPage.jsx
react-app/src/utils/deliverySuccessCustomerState.js
public/react/parity/css/delivery-success-customer-actions.css
```

- Retained the existing `getPublicOrder`, `watchPublicOrder` and
  `CompanionConfirmedQr` Firebase providers without reusing the Go payment
  endpoints or Stripe Checkout execution.
- Migrated the Source's new three SVG-icon actions into a single
  equal-width responsive toolbar. Labels are hidden visually but kept
  accessible with `aria-label`, `title` and descriptive text.
- Kept the original PNG receipt generator and `#customerReceipt`,
  `#verifyLatestLink`, `#saveImageButton`, tracking and totals hooks.
- Added a compact green confirmation card for server-recorded Paid or
  accepted/kitchen-admitted orders. If an order is accepted without bank
  confirmation (including COD or a supervised unverified kitchen admission),
  the card explicitly says that **payment is not verified**.
- For Stripe, a server-recorded Paid can show the same green card, while
  Pending/Failed/Expired/Rejected use the distinct amber/red status card.
  The Firebase Stripe execution/resume/cancel **is NOT implemented here**,
  so none of those status cards has a pay-again or create-checkout action.
- `VITE_SHOW_PAYMENT_SANDBOX_BADGE=false` hides only the cosmetic Sandbox
  badge for a later live release; the default retains the Source UAT marker.
  It does not change any transaction status.
- Pending confirmed QR flow still uses the existing Firebase capability
  and slip review, and hides premature receipt/action controls.
- Sources of financial truth remain server-owned. These front-end badges
  cannot authorize bank transfer, stripe charge, tenant release, COD
  collection, kitchen payment approval or any new order.
- The CSS is a narrowly scoped derivative of the Source's order-received
  card and three-action toolbar rules, loaded AFTER existing
  `delivery-success-tracking.css`; it does not import Go payment-state
  modal styling or alter other PENGUIN pages.

## Acceptance scenarios

1. PromptPay Paid: view-latest, download PNG, order-again in three equal
   icon cells; one green confirmation card; correct PromptPay badge.
2. Store accepts an order while bank is unverified: show **order received**,
   distinguish explicitly unpaid or pending; do not label bank Paid.
3. Confirmed PromptPay QR before verified settlement: maintain the
   Firebase QR widget, no success card/receipt/download controls.
4. Stripe Pending/Failed/Expired: separate status card, no green Paid
   or new payment attempt/resume button.
5. Stripe Paid: use same green card, Stripe badge; optional Sandbox
   environment badge. Switching the badge flag cannot change `Paid`.
6. COD accepted but unpaid: show a received order with an explicit
   cash-on-delivery unpaid badge, never a bank Paid badge.
7. Order state updates while the page is already open update the cards
   and actions without a reload.
8. 320, 390, 768, 1440px: three equal action widths, compact aligned
   card widths, no horizontal overflow.
9. Original receipt item, money, recipient, QR verification and order
   tracking layout still rendered; no regression to existing Firebase
   payment security/authorization flows.
10. Source repository untouched; destination changes committed only
    to `feature/react-firebase-port`.

## Test files

- `tests/react-parity/p1-delivery-success-customer-state.spec.mjs`
- `tests/react-parity/p1-delivery-success-customer-browser.spec.mjs`
- `tests/react-parity/delivery-success-parity.spec.mjs` was updated
  from the old tracking-before-toolbar expectation (legacy UI) to
  the current Source first-action-card contract. Its live-order route
  test still requires `DELIVERY_SUCCESS_ORDER_ID` and is not presented
  as a completed live Production UAT.

**Limits / next P3 work:** the whole Source 1,005-line page contains
additional features absent from the 364-line Firebase baseline:
manual slip retries and correction workflow, Stripe Connect payment
resumption, dynamic tracking label angles and historical order revisions.
These require separate server/API proof and are NOT claimed as ported
by this UI milestone. P1/P2 LK Shop FCM/QR pairing remains a distinct
module and is not part of this change.

**Do not deploy** or enable actual Stripe Connect from this visual port.

## Final local module verification

| Check | Status |
|---|---|
| `npm run test:delivery-success-source-ui` | **9/9 PASS** (7 policy, 2 browser/structure) |
| Browser viewport contracts | **320, 390, 768, 1440 px PASS** |
| Dynamic states on existing order subscription | **PromptPay Paid/Pending, supervised kitchen Pending, Stripe Pending/Failed/Paid, COD unpaid PASS** |
| Zero source receipt regression/early paid or double scan | **PASS** in synthetic Browser |
| `npm run test:react-foundation` updated current Source icon/spacing contract | **PASS** |
| `npm run test:react-parity` complete existing project chain | **PASS** |
| Actual provider bank settlement/Stripe customer payment | **NOT RUN / NOT ENABLED** |
| Live signed-in production browser visual acceptance | **NOT RUN** |
| Firebase Hosting/Functions/Rules Production deploy | **NOT PERFORMED** |

Full React parity includes M7, Hybrid Billing, signup, UI layers,
receipt presentation, cart/QR, Cashier/Quick Order and other existing
function contracts. Tests use synthetic browser order documents;
they do NOT prove operational real-money transfer or merchant
acceptance of every remaining Source JSX workflow.

The 23 Nov JSX source audit remains a pinned historical snapshot.
After this feature commit the audit will be re-run to record exact
Target JSX LOC without falsely changing the Source commit.


## Post-commit JSX reconciliation

- Delivery Success Source remains **1,005 JSX physical lines** at
  `e60858c1`, unchanged during this port.
- Target Delivery Success is now **480 JSX physical lines** in
  `1f3a039e` (previous 364); this new module adds **+116 net lines**
  to that page, plus a pure status helper and Source-derived scoped CSS.
- Entire Firebase Target: **103 JSX files / 36,874 physical lines**,
  while entire Source remains **156 / 48,954**.
- Counts/paths and phase tracker updated in
  `LUKKAJA_BANKALERT_STRIPE_JSX_AUDIT_20261123.json` and
  `LUKKAJA_TO_PENGUIN_PAGE_MATRIX.json`.
- Exact JSX line difference is **not** a function-completion percentage.
