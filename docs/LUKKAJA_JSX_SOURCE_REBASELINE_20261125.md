# LUKKAJA → PENGUIN | New JSX source rebaseline (2026-11-25)

**Authoritative Source requested by user:** `cosmatch/lukkhaja`, branch `feature/react-golang-vite-tailwind-axios`, pinned exact commit `7bf9d15934f387cd887b46d1b17ca1f2924ffab0`. Confirmed local HEAD, remote-tracking HEAD and `git ls-remote` agree. Source working tree clean; **strictly read-only**.

**Port Target:** `Natchanon45/food-order-app` branch `feature/react-firebase-port`. Target base `fc48054952f912694cce7cd6d59276f6a4e975be`. Never recreate project, wipe completed Firebase modules, or port Laravel/Go network APIs directly.

## Inventory and previous-source delta

- **Source JSX:** 65 pages, 36,001 lines (including `wc -l` total). **Target JSX before this rebaseline:** 53 pages, 30,893 lines.
- **Shared by exact filename:** 52 pages. **Source-only:** 13. **Target-only:** `AccountEmailVerificationPage.jsx` — intentional native Firebase email-verification UI; retain it.
- **Changed Source JSX since old baseline `8b108f1`:** 15 relevant Source commits, **8 pages** materially modified. A full filename inventory follows.
- **Do not equate LOC deltas with missing functionality:** PENGUIN has Firebase-based adaptation and security/operation receipts absent from original Laravel JSX. Source-only `CanonicalLaravelBridgePage`, `LaravelSessionPage`, `PortMissingRoute` are legacy transport/navigation references, not automatic Firebase page requirements; the various `Pos*MasterPage` need route/interface verification before porting.

## Latest Source changes to port, prioritized

1. **P1 Platform / Payment receiver / Pricing / Contact:** Source removed editable Slip2Go quota control (still retains historical billing field); added `PlatformCollectionPreferences` for Stripe vs bank/LINE and separate central receiver + PromptPay form with dynamic labels and anchor navigation. Contact LK Shop copy changed. PENGUIN **must not enable financial routing merely by saving a receiver account**; reconcile with private bank webhook/review and Stripe test/live gates. Current port implements receiver account storage with transaction and read-after-write, but collection routing remains **disabled pending provider UAT**, no fake "paid".
2. **P1.2 Superadmin Tenants wallet:** Source shifted from Stripe-only rows to consolidated `wallet.topupHistory` and requires explicit bank reference for appeal approvals. Target Firebase wallet model must be reconciled before moving any approval control; never infer approval from line notifications or payment screenshots.
3. **P2 Merchant Admin:** Store operations, LK Shop notification comparisons and observer settings modified.
4. **P3/P4 Cashier / Kitchen / Delivery:** Changed Lalamove dispatch cancellation guard and cashier bank verification/LINE matching. Carry through idempotent state transitions, no retroactive paid statuses.
5. **P5 Retail POS:** Source-only master pages may be obsolete Laravel bridge wrappers; compare actual reachable menu/route and Firebase POS shell before adding new Firebase pages.

## Every top-level JSX page (pinned snapshot)

| JSX file | Source LOC | Target LOC at baseline | Rebaseline status |
|---|---:|---:|---|
| `AccountEmailVerificationPage.jsx` | — | 100 | Firebase only — keep |
| `AdminPage.jsx` | 2428 | 2216 | Latest Source JSX modified |
| `AdminQrPage.jsx` | 180 | 152 | Shared — adapter/parity review |
| `AdminSalesReportPage.jsx` | 591 | 592 | Shared — adapter/parity review |
| `AdminStoreMasterPage.jsx` | 364 | — | Source only — requires route/adapter audit |
| `AdminTenantsPage.jsx` | 2286 | 1943 | Latest Source JSX modified |
| `AdminUsersPage.jsx` | 435 | 614 | Shared — adapter/parity review |
| `CanonicalLaravelBridgePage.jsx` | 41 | — | Source only — requires route/adapter audit |
| `CashierPage.jsx` | 1635 | 1369 | Latest Source JSX modified |
| `CashierReceiptPage.jsx` | 405 | 367 | Shared — adapter/parity review |
| `CashierTableQrPage.jsx` | 624 | 544 | Shared — adapter/parity review |
| `DeliveryPage.jsx` | 1614 | 1269 | Shared — adapter/parity review |
| `DeliverySuccessPage.jsx` | 1005 | 480 | Shared — adapter/parity review |
| `HomePage.jsx` | 404 | 380 | Shared — adapter/parity review |
| `HybridBillingReportPage.jsx` | 335 | 338 | Shared — adapter/parity review |
| `HybridBillingReviewPage.jsx` | 561 | 563 | Latest Source JSX modified |
| `KitchenPage.jsx` | 683 | 712 | Latest Source JSX modified |
| `LaravelSessionPage.jsx` | 72 | — | Source only — requires route/adapter audit |
| `LegalPage.jsx` | 83 | 63 | Shared — adapter/parity review |
| `LoginPage.jsx` | 266 | 291 | Shared — adapter/parity review |
| `PlatformContactPage.jsx` | 664 | 667 | Latest Source JSX modified |
| `PlatformOwnersPage.jsx` | 371 | 522 | Shared — adapter/parity review |
| `PlatformPage.jsx` | 802 | 880 | Latest Source JSX modified |
| `PlatformPricingPage.jsx` | 454 | 456 | Latest Source JSX modified |
| `PortMissingRoute.jsx` | 11 | — | Source only — requires route/adapter audit |
| `PosBackupPage.jsx` | 90 | 30 | Shared — adapter/parity review |
| `PosCatalogMasterPage.jsx` | 3 | — | Source only — requires route/adapter audit |
| `PosCatalogPage.jsx` | 470 | 281 | Shared — adapter/parity review |
| `PosCategoriesMasterPage.jsx` | 150 | — | Source only — requires route/adapter audit |
| `PosCustomerDisplayPage.jsx` | 223 | 190 | Shared — adapter/parity review |
| `PosCustomersMasterPage.jsx` | 358 | — | Source only — requires route/adapter audit |
| `PosCustomersPage.jsx` | 563 | 548 | Shared — adapter/parity review |
| `PosForbiddenPage.jsx` | 56 | 40 | Shared — adapter/parity review |
| `PosPage.jsx` | 1445 | 1314 | Shared — adapter/parity review |
| `PosPayablesPage.jsx` | 812 | 762 | Shared — adapter/parity review |
| `PosProductsMasterPage.jsx` | 320 | — | Source only — requires route/adapter audit |
| `PosProductsPage.jsx` | 1290 | 1216 | Shared — adapter/parity review |
| `PosPurchasesPage.jsx` | 1357 | 1274 | Shared — adapter/parity review |
| `PosReceiptPage.jsx` | 346 | 319 | Shared — adapter/parity review |
| `PosReturnsPage.jsx` | 894 | 849 | Shared — adapter/parity review |
| `PosSalesPage.jsx` | 891 | 861 | Shared — adapter/parity review |
| `PosSettingsMasterPage.jsx` | 179 | — | Source only — requires route/adapter audit |
| `PosSettingsPage.jsx` | 460 | 463 | Shared — adapter/parity review |
| `PosShiftsPage.jsx` | 728 | 684 | Shared — adapter/parity review |
| `PosStockCountsMasterPage.jsx` | 177 | — | Source only — requires route/adapter audit |
| `PosStockCountsPage.jsx` | 984 | 950 | Shared — adapter/parity review |
| `PosStockMovementsMasterPage.jsx` | 152 | — | Source only — requires route/adapter audit |
| `PosStockMovementsPage.jsx` | 914 | 897 | Shared — adapter/parity review |
| `PosSuppliersMasterPage.jsx` | 232 | — | Source only — requires route/adapter audit |
| `PosSuppliersPage.jsx` | 479 | 354 | Shared — adapter/parity review |
| `PosTaxInvoicePage.jsx` | 189 | 164 | Shared — adapter/parity review |
| `PosTaxInvoicesPage.jsx` | 552 | 495 | Shared — adapter/parity review |
| `PosUsersMasterPage.jsx` | 221 | — | Source only — requires route/adapter audit |
| `PosUsersPage.jsx` | 408 | 251 | Shared — adapter/parity review |
| `PublicOrderPage.jsx` | 247 | 243 | Shared — adapter/parity review |
| `PublicRouteMissingPage.jsx` | 32 | 32 | Shared — adapter/parity review |
| `QuickOrderPage.jsx` | 1269 | 1105 | Shared — adapter/parity review |
| `RegisterPage.jsx` | 554 | 508 | Shared — adapter/parity review |
| `RevenueShareReportPage.jsx` | 927 | 839 | Shared — adapter/parity review |
| `SaasSetupPage.jsx` | 152 | 153 | Shared — adapter/parity review |
| `StorefrontCompatibilityEntry.jsx` | 29 | 30 | Shared — adapter/parity review |
| `TakeawayPage.jsx` | 231 | 220 | Shared — adapter/parity review |
| `VerifyPage.jsx` | 165 | 162 | Shared — adapter/parity review |
| `WaitingQueueCustomerPage.jsx` | 288 | 287 | Shared — adapter/parity review |
| `WaitingQueueDisplayPage.jsx` | 131 | 121 | Shared — adapter/parity review |
| `WaitingQueuePage.jsx` | 719 | 717 | Shared — adapter/parity review |

## Implementation constraints

- **Do not copy Source imports** `react-pilot/storefrontApi`, `LaravelAuthProvider`, Go APIs or financial server methods into PENGUIN. Preserve real Firebase Auth + Tenant scope, Firestore/Storage Rules and signed Callables.
- **Source business changes are not automatically safe on Firebase:** particularly bank account selection, Stripe / LINE settlement, wallet appeals, and Lalamove status. Use independent canonical readback, revision/operation guards, manual-review fallbacks and separate real-provider staging testing.
- **P1 new Source pricing and receiver pass** is the first rebase slice. It explicitly leaves actual payment-channel switching disabled, while allowing read-only readiness and secured central receiver configuration. Next slice must audit admin/tenant wallet and provider routing after these safety boundaries, not claim all 65 pages ported.
- Retain existing P1.3e email verification guard; Staging Firebase project/inbox/live provider UAT remains blocked until separately approved. No Production deploy, `main` merge, APK/IPA build or Source edits.

## First new-Source port verification (2026-11-25)

First P1 Platform/Price/Contact slice: Receiver Backend Emulator **6/6**, real signed React Browser **1/1**, Source static **5/5**, updated prior Firebase/UI contracts **14/14**, managed email security **46 protected modules / 146 onCall definitions**, entire React Parity **exit 0**, React Build/Hosting Contract **PASS**, generated files removed. This does **not** imply 65/65 pages ported. See `docs/LUKKAJA_P1_NEW_SOURCE_PLATFORM_REBASE_20261125.md`.

## Acceptance trail

See `docs/LUKKAJA_P1_NEW_SOURCE_PLATFORM_REBASE_20261125.md` for tests, new Firebase receiver schema, UI and release gates. All claims must be backed by local test receipts; save no bank credentials or private reference data in documentation.
