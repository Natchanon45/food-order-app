# Master Checklist — LUKKAJA → PENGUIN JSX (pinned 2026-11-25)

## Accounting rules (fixed denominator)

- **Authoritative JSX Source:** cosmatch/lukkhaja / feature/react-golang-vite-tailwind-axios @ 7bf9d15934f387cd887b46d1b17ca1f2924ffab0.
- **Target:** Natchanon45/food-order-app / feature/react-firebase-port. Source is read-only.
- A page earns **accepted** only after its latest Source behavior is explicitly adapted to Firebase, role/security and scenario contracts are tested, and its module is accepted locally. This is a *conservative page-level acceptance ledger*, not a prediction or arbitrary equivalence to deployed functionality.
- A Source-only page can earn **dispositioned** only when Source routing proves it is an unused extracted wrapper and the equivalent existing target route is accepted. An unreviewed wrapper remains outstanding.
- The target-only native Firebase AccountEmailVerificationPage is a separate necessary implementation and **not** one of the 65 Source pages.
- Commit/Push, local emulator acceptance and Staging/Production acceptance are different states. **Zero** remaining real-provider acceptance gates should be claimed without authorized Staging evidence.

## Current measurable JSX progress

| Metric | Verified count | Percent | Meaning |
|---|---:|---:|---|
| Source JSX audited and accepted against latest branch | 8/65 | 12.3% | Tested at page/module level, local only |
| Source-only route extract dispositioned without a duplicate page | 1/65 | 1.5% | Existing accepted target Admin UI |
| **Accepted or explicitly dispositioned** | **9/65** | **13.8%** | **Conservative overall Source JSX parity progress** |
| **Still requires latest-Source acceptance review** | **56/65** | **86.2%** | Not necessarily absent: old port code/tests already exist |
| JSX filename already present in Target before rebaseline | 52/65 | 80.0% | **Presence only** — never call it functional progress |

### Do not misread this %

The 65-page baseline includes POS/Laravel thin wrappers and legacy transport. The low accepted count does **not** mean those pages have no existing code, tests or business logic. This strict bar prevents the assistant from announcing 80% merely because 52 files share names. The figure will rise when the remaining existing pages are actually audited/accepted, without recreating projects or repeating finished implementations.

## Exact page-by-page Source ledger

| Source JSX | Functional area | Target JSX at pinned baseline | Acceptance state | Audit evidence / required next step |
|---|---|---|---|---|
| AdminPage.jsx | Merchant Admin / General / Auth | Present (2216 baseline LOC) | Accepted (local) | P2.1 Android observer; P2.2 Store Master/branding/QR |
| AdminQrPage.jsx | Merchant Admin / General / Auth | Present (152 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| AdminSalesReportPage.jsx | Merchant Admin / General / Auth | Present (592 baseline LOC) | Accepted (local) | P2.4 complete sales history and receipt UI |
| AdminStoreMasterPage.jsx | Merchant Admin / General / Auth | Not present | Dispositioned (no new route) | Source-only extract not routed: integrated into AdminPage P2.2; no duplicate route |
| AdminTenantsPage.jsx | Merchant Admin / General / Auth | Present (1943 baseline LOC) | Accepted (local) | P1.5 canonical real-wallet history and review |
| AdminUsersPage.jsx | Merchant Admin / General / Auth | Present (614 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| CanonicalLaravelBridgePage.jsx | Laravel transport/route wrapper audit | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| CashierPage.jsx | Cashier / Kitchen / Queue | Present (1369 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| CashierReceiptPage.jsx | Cashier / Kitchen / Queue | Present (367 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| CashierTableQrPage.jsx | Cashier / Kitchen / Queue | Present (544 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| DeliveryPage.jsx | Delivery / Public Ordering | Present (1269 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| DeliverySuccessPage.jsx | Delivery / Public Ordering | Present (480 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| HomePage.jsx | Merchant Admin / General / Auth | Present (380 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| HybridBillingReportPage.jsx | Superadmin / Billing | Present (338 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| HybridBillingReviewPage.jsx | Superadmin / Billing | Present (563 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| KitchenPage.jsx | Cashier / Kitchen / Queue | Present (712 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| LaravelSessionPage.jsx | Laravel transport/route wrapper audit | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| LegalPage.jsx | Merchant Admin / General / Auth | Present (63 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| LoginPage.jsx | Merchant Admin / General / Auth | Present (291 baseline LOC) | Accepted (local) | P2.3 login role/next policy |
| PlatformContactPage.jsx | Superadmin / Billing | Present (667 baseline LOC) | Accepted (local) | P1.5 Superadmin notification/contact UI |
| PlatformOwnersPage.jsx | Superadmin / Billing | Present (522 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PlatformPage.jsx | Superadmin / Billing | Present (880 baseline LOC) | Accepted (local) | P1.5 central receiver, disabled live collection rail |
| PlatformPricingPage.jsx | Superadmin / Billing | Present (456 baseline LOC) | Accepted (local) | P1.4/P1.5 Premium SaaS pricing and immutable quota |
| PortMissingRoute.jsx | Laravel transport/route wrapper audit | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosBackupPage.jsx | POS และ Source-only POS Master | Present (30 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosCatalogMasterPage.jsx | POS และ Source-only POS Master | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosCatalogPage.jsx | POS และ Source-only POS Master | Present (281 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosCategoriesMasterPage.jsx | POS และ Source-only POS Master | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosCustomerDisplayPage.jsx | POS และ Source-only POS Master | Present (190 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosCustomersMasterPage.jsx | POS และ Source-only POS Master | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosCustomersPage.jsx | POS และ Source-only POS Master | Present (548 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosForbiddenPage.jsx | POS และ Source-only POS Master | Present (40 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosPage.jsx | POS และ Source-only POS Master | Present (1314 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosPayablesPage.jsx | POS และ Source-only POS Master | Present (762 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosProductsMasterPage.jsx | POS และ Source-only POS Master | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosProductsPage.jsx | POS และ Source-only POS Master | Present (1216 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosPurchasesPage.jsx | POS และ Source-only POS Master | Present (1274 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosReceiptPage.jsx | POS และ Source-only POS Master | Present (319 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosReturnsPage.jsx | POS และ Source-only POS Master | Present (849 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosSalesPage.jsx | POS และ Source-only POS Master | Present (861 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosSettingsMasterPage.jsx | POS และ Source-only POS Master | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosSettingsPage.jsx | POS และ Source-only POS Master | Present (463 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosShiftsPage.jsx | POS และ Source-only POS Master | Present (684 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosStockCountsMasterPage.jsx | POS และ Source-only POS Master | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosStockCountsPage.jsx | POS และ Source-only POS Master | Present (950 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosStockMovementsMasterPage.jsx | POS และ Source-only POS Master | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosStockMovementsPage.jsx | POS และ Source-only POS Master | Present (897 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosSuppliersMasterPage.jsx | POS และ Source-only POS Master | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosSuppliersPage.jsx | POS และ Source-only POS Master | Present (354 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosTaxInvoicePage.jsx | POS และ Source-only POS Master | Present (164 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosTaxInvoicesPage.jsx | POS และ Source-only POS Master | Present (495 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PosUsersMasterPage.jsx | POS และ Source-only POS Master | Not present | Pending latest-Source audit | Source-only: verify route/wrapper before adding Firebase JSX |
| PosUsersPage.jsx | POS และ Source-only POS Master | Present (251 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PublicOrderPage.jsx | Delivery / Public Ordering | Present (243 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| PublicRouteMissingPage.jsx | Delivery / Public Ordering | Present (32 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| QuickOrderPage.jsx | Cashier / Kitchen / Queue | Present (1105 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| RegisterPage.jsx | Merchant Admin / General / Auth | Present (508 baseline LOC) | Accepted (local) | P2.3 Owner signup/verified email/native Firebase |
| RevenueShareReportPage.jsx | Superadmin / Billing | Present (839 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| SaasSetupPage.jsx | Superadmin / Billing | Present (153 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| StorefrontCompatibilityEntry.jsx | Delivery / Public Ordering | Present (30 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| TakeawayPage.jsx | Delivery / Public Ordering | Present (220 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| VerifyPage.jsx | Merchant Admin / General / Auth | Present (162 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| WaitingQueueCustomerPage.jsx | Cashier / Kitchen / Queue | Present (287 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| WaitingQueueDisplayPage.jsx | Cashier / Kitchen / Queue | Present (121 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |
| WaitingQueuePage.jsx | Cashier / Kitchen / Queue | Present (717 baseline LOC) | Pending latest-Source audit | Target exists: validate latest Source actions, security, UI and tests |

## Remaining work by function group

| Workstream | Remaining JSX pages | Named pages |
|---|---:|---|
| Merchant Admin / General / Auth | 5 | AdminQrPage, AdminUsersPage, HomePage, LegalPage, VerifyPage |
| Laravel transport/route wrapper audit | 3 | CanonicalLaravelBridgePage, LaravelSessionPage, PortMissingRoute |
| Cashier / Kitchen / Queue | 8 | CashierPage, CashierReceiptPage, CashierTableQrPage, KitchenPage, QuickOrderPage, WaitingQueueCustomerPage, WaitingQueueDisplayPage, WaitingQueuePage |
| Delivery / Public Ordering | 6 | DeliveryPage, DeliverySuccessPage, PublicOrderPage, PublicRouteMissingPage, StorefrontCompatibilityEntry, TakeawayPage |
| Superadmin / Billing | 5 | HybridBillingReportPage, HybridBillingReviewPage, PlatformOwnersPage, RevenueShareReportPage, SaasSetupPage |
| POS และ Source-only POS Master | 29 | PosBackupPage, PosCatalogMasterPage, PosCatalogPage, PosCategoriesMasterPage, PosCustomerDisplayPage, PosCustomersMasterPage, PosCustomersPage, PosForbiddenPage, PosPage, PosPayablesPage, PosProductsMasterPage, PosProductsPage, PosPurchasesPage, PosReceiptPage, PosReturnsPage, PosSalesPage, PosSettingsMasterPage, PosSettingsPage, PosShiftsPage, PosStockCountsMasterPage, PosStockCountsPage, PosStockMovementsMasterPage, PosStockMovementsPage, PosSuppliersMasterPage, PosSuppliersPage, PosTaxInvoicePage, PosTaxInvoicesPage, PosUsersMasterPage, PosUsersPage |

## Stage and financial gates (separate from JSX acceptance)

- **Local only:** P1.4/P1.5, P2.1, P2.2, P2.3 and P2.4 slices tested under demo Firebase Emulators; source adaptation accepted above does not prove complete end-to-end Production behavior.
- **Not enabled as real money:** central bank/LINE LK Connect collection and Stripe LIVE, signed provider webhook/idempotent settlement, bank-backed appeal approvals, provider cash reconciliation and third-party production confirmation.
- **Staging:** a distinct authorized non-production Firebase project, verified email inbox/provider test credentials, release and rollback sign-off are still required.
- **Production:** no deploy, main merge, APK/IPA or real bank payments in these completion receipts.

## How to update each module

1. Pin or verify Source HEAD, then compare changed JSX and Data/backend behavior.
2. Add only verified page entries to the audited mapping above; source-only wrappers need explicit router evidence before being dispositioned.
3. Run read/write, RBAC, data-completeness, responsive UI and all relevant financial test gates.
4. Regenerate this document via `node tools/update-port-master-checklist.mjs`; report accepted/65, remaining/65 and % after Commit/Push.
5. Keep outstanding financial Staging/Production gates separate from page-parity %.
