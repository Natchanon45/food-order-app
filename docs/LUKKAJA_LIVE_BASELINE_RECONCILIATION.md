# LUKKAJA → PENGUIN: deployed 31 October baseline reconciliation

**Date:** 09/11/2026 (Bangkok)  
**Purpose:** Avoid overwriting features that already run on the single Firebase Hosting URL while migrating current LUKKAJA JSX into PENGUIN's existing `feature/react-firebase-port` branch. This is a code-equivalence ledger, **not** authorization to deploy or write production finance data.

## Verified production baseline

- Hosting: `https://penguin-food.web.app/platform` currently references `/react/assets/index-D1lP61q7.js` (checked from Mac via HTTP), which matches `feature/port-lukkaja-20261031@fe338e1d`'s Hosting entrypoint.
- Destination base `feature/react-firebase-port@d87fc375` referenced `index-BVCU-hXZ.js`. Its later Phase P1.1 build generated `index-a8uMEtpo.js`. The new candidate does **not** yet include all the Oct31 old-port source features. **Do not deploy the destination bundle until equivalence is established.**
- The previous port branch has 20 commits from `d87fc375`, including *live/deployed* UI and verified Firebase Functions/Rules for Walk-in, but its original portability tests leave manual production/browser/physical printer UAT open.
- Current pinned LUKKAJA **source** for Phase work: `cosmatch/lukkhaja@e84c8990` (read-only). All P1 changes must prefer source JSX except validated, deliberate Firebase/PENGUIN-only extensions.

## Reuse imported into requested target branch (explicit allowlist)

**No whole-branch merge, cherry-pick, database copy or rewrite of `main`.**

| Imported source | Exact Oct31 assets | Current activation |
|---|---|---|
| Pure cancellation/sales and Walk-in state helpers | `data/salesCancellationReport.mjs`, `data/walkInLifecycle.mjs` | **Dormant** until relevant P4 page/Callable is audited |
| Calendar reporting and HTML-escaped icon helper | `utils/revenueReportPeriod.mjs`, `utils/printFavicon.js` | Report helper is **dormant**; favicon helper is used |
| Merchant terms presentation | `components/MerchantServiceTerms.jsx` and `merchant-service-terms-port.css` | **Dormant** until pricing/billing semantics are approved; wording is not policy activation |
| Existing favicon printing UI | `AdminDeliveryQr.jsx`, `receiptPrintWindow.js`, `WaitingQueuePage.jsx` | **Now in destination source**, matches already deployed behavior, no database mutation |
| Contract/behavior tests | `lukkaja-previous-deploy-pure-reuse.spec.mjs`, `lukkaja-oct31-print-favicon.spec.mjs` | Pass on Mac, cover HTML escaping, calendar read-only filters, cancelled historical receipts, walk-in lifecycle and print tabs |
| Phase P1.1 new functionality | Existing `PlatformPage.jsx`, source-equivalent Firebase read/error guard | Data reads only activate save/test if authenticated Callable succeeded; browser/Emulator pending |

**Why preserve the source icon helper?** The owner-uploaded platform Favicon needs to appear consistently in newly opened printable QR/receipt/queue tabs; this is a non-financial production feature from Oct31 and should not regress with porting.

## Still different from live deployed old-port source (before full parity)

As of the first selective import, `git diff HEAD feature/port-lukkaja-20261031` still reports:
- **12 source paths** under `react-app/src/`: old-port implementations of `DeliveryPage`, `QuickOrderPage`, `CashierPage`, `KitchenPage`, `AdminSalesReportPage`, `CashierReceiptPage`, `RevenueShareReportPage`, old `billingCycleDisplay`, and their service/i18n/release dependencies, plus the *intentionally different* P1.1 `PlatformPage`.
- **5 CSS paths** under `react-app/public/parity/css/`: prior Quick Order skin, cancelled receipt/sales report presentation, Revenue Share filter layout and Wallet scoped CSS.
- **4 backend paths**: `functions/operational-orders.js`, `functions/walkin-finance-policy.js`, `functions/index.js` and `firestore.rules`.

These remaining differences require *feature-by-feature review*, not a mechanical branch merge. The old rules tighten direct browser writes on Walk-in orders; Cloud Functions implement server-side transactional create/append/serve/settle/reviewed cancel and audit. They previously passed synthetic Firestore/Auth Emulator tests. Do **not** import them piecemeal such that a frontend can invoke absent callable names, or deploy Functions/Rules without a full staging review.

## Automated fail-closed predeploy source baseline check

Execute `node tools/verify-deployed-baseline-before-firebase-hosting.mjs` **before** any Hosting deployment. It verifies 12 indispensable source-level behavior groups from the already-deployed October 31 release, including the actual payment-safe Walk-in callables/Rules, Quick Order skin, Cashier/Kitchen state, Revenue Share calendar reporting and printed favicon. While the baseline is incomplete, this command returns a nonzero exit and lists the missing features; **do not deploy**. A zero exit is only one necessary release gate, **not** browser/Emulator acceptance.

Current status (9 Nov): this check is **expected to block** because new destination branch has not yet ported the required old Walk-in Functions/Rules, Cashier/Kitchen and Revenue Share UI together. The existing production deployment remains unchanged.

## Release and test gates (unmet)

1. Reconcile the **old already-live** operations/reports/print UI code and its deployed backend contracts into `feature/react-firebase-port`, retaining new P1.1 guards; keep old reference branch unchanged.
2. Verify all approved existing routes/actions still work, with comparisons at identical test tenants and roles, both live and candidate.
3. Run `npm run test:react-parity`, build and static route checks, plus Auth/Firestore Emulator tests for the old Walk-in transactions and new P1 settings permissions; no real-shop test orders.
4. Verify signed-in screenshots at desktop/tablet/mobile; validate branding, QR, billing and report control states.
5. Only after passing these gates, deploy **Hosting only** to `https://penguin-food.web.app`, confirm asset identity. Any new Cloud Functions/Rules or finance activation require separate review and explicit release decision.
6. Never merge `feature/react-firebase-port` to `main` unless the owner explicitly asks.

## Phase P1.2 continuation

After P1.1, audit `AdminTenantsPage.jsx` from current LUKKAJA source (2,341 lines vs 1,578 lines at the original destination pin). Its newer `TenantControlPanel`, subscription and outage components rely on Go-specific APIs. Reuse JSX markup but write tenant-scoped Firebase adapters and server guards **before** enabling new user creation, suspension, billing or any financial action. Maintain `docs/LUKKAJA_TO_PENGUIN_PAGE_MATRIX.json` statuses based on actual tests; same filename is not completion.
