# Source-first UI rebase inventory

Source branch: `feature/react-golang-vite-tailwind-axios`
Source commit: `7e47e85f9012e4b084b68d816b32b6e60b15f3d2`

This is a dependency and byte-identity inventory, **not visual acceptance**. A different JSX file may be necessary for Firebase transport. Source-only extracts must be checked against actual Router use. Never use a target file as the presentation template for the rebase.

## Global Source entry stylesheet order

| # | Source stylesheet | SHA-256 prefix | Direct match in target |
|---:|---|---|---|
| 1 | `react-port-parity.css` | `82125f30b0d5` | Not copied: — |
| 2 | `react-port-platform-tenants.css` | `d70509e6eb66` | Different: react-app/public/parity/css/react-port-platform-tenants.css |
| 3 | `react-port-platform-owners.css` | `ae66d86a836a` | Not copied: — |
| 4 | `react-port-platform-contact.css` | `243afb7be31e` | Not copied: — |
| 5 | `react-port-platform-pricing.css` | `1f372b2f1dca` | Not copied: — |
| 6 | `react-port-login.css` | `77aef04563ab` | Not copied: — |
| 7 | `react-port-session.css` | `3f6dc826a5d1` | Not copied: — |
| 8 | `react-port-platform.css` | `bdd9456a6c69` | Not copied: — |
| 9 | `react-port-card-collapse.css` | `c4bc9aa711c9` | Not copied: — |
| 10 | `react-port-platform-accordion.css` | `40fe40581d63` | Not copied: — |
| 11 | `react-port-brandmark.css` | `1ae606fee25f` | Not copied: — |
| 12 | `react-port-admin-store-master.css` | `05f5f2edce1c` | Not copied: — |
| 13 | `react-port-delivery-fee-source.css` | `17ba489559f7` | Not copied: — |
| 14 | `react-port-store-branding-source.css` | `a56c946d103b` | Not copied: — |
| 15 | `react-port-admin-users.css` | `4dc495e32247` | Not copied: — |
| 16 | `react-port-admin-qr.css` | `d99a29621711` | Not copied: — |
| 17 | `react-port-admin-sales-report.css` | `cce7aecf1c3b` | Not copied: — |
| 18 | `react-port-kitchen.css` | `33314c569273` | Not copied: — |
| 19 | `react-port-delivery-account.css` | `ed0347cbd5f5` | Not copied: — |
| 20 | `react-port-delivery-checkout-review.css` | `cae472f84a77` | Not copied: — |
| 21 | `react-port-cashier.css` | `cc4d5c5fbc56` | Not copied: — |
| 22 | `react-port-order-header-compact.css` | `6315a4f348c0` | Not copied: — |
| 23 | `react-port-quick-order.css` | `ba9dc51f19c3` | Not copied: — |
| 24 | `react-port-cashier-receipt.css` | `65a98c9e7820` | Not copied: — |
| 25 | `react-port-cashier-table-qr.css` | `5ea4334834e0` | Not copied: — |
| 26 | `react-port-waiting-customer.css` | `bd9c328e74ec` | Not copied: — |
| 27 | `react-port-waiting-display.css` | `d7149be72fbc` | Not copied: — |
| 28 | `react-port-waiting-queue.css` | `76fe14dd3570` | Not copied: — |
| 29 | `react-port-revenue-share.css` | `998c610aff4d` | Not copied: — |
| 30 | `react-port-hybrid-billing.css` | `efbbb72f6e64` | Not copied: — |
| 31 | `react-port-takeaway.css` | `88e35896701f` | Not copied: — |
| 32 | `react-port-table-order.css` | `ce68d36d932d` | Not copied: — |
| 33 | `react-port-pos-sales.css` | `32f9e84cd2d6` | Not copied: — |
| 34 | `react-port-pos-products-source.css` | `00831d158081` | Not copied: — |
| 35 | `react-port-pos-stock-movements-source.css` | `ffa4d2a4bf39` | Not copied: — |
| 36 | `react-port-pos-stock-counts-source.css` | `b86b33f5cb00` | Not copied: — |
| 37 | `react-port-pos-suppliers-source.css` | `91eb2cd71924` | Not copied: — |
| 38 | `react-port-pos-customers-source.css` | `87b1a22ee366` | Not copied: — |
| 39 | `react-port-pos-settings-source.css` | `d36a13c5940e` | Not copied: — |
| 40 | `react-port-pos-users-source.css` | `e94f8e6772fb` | Not copied: — |
| 41 | `react-port-pos-catalog.css` | `9cd278797879` | Not copied: — |
| 42 | `react-port-platform-mobile-containment.css` | `be0f35e5e4f5` | Not copied: — |
| 43 | `react-port-restaurant-cascade-isolation.css` | `bf4b2f4987e6` | Not copied: — |
| 44 | `react-port-quick-order-redesign.css` | `aacba877fd68` | Not copied: — |
| 45 | `react-port-modal-standard.css` | `09795b41d403` | Exact: react-app/src/ui/react-port-modal-standard.css |
| 46 | `react-port-dynamic-auto.css` | `1ccdbcf5a434` | Exact: react-app/src/ui/react-port-dynamic-auto.css |
| 47 | `react-port-revenue-share-cascade-isolation.css` | `1fcd8d93d79e` | Not copied: — |
| 48 | `react-port-sales-presentation-polish.css` | `c224cd9c6121` | Not copied: — |
| 49 | `react-port-order-button-font-weight.css` | `b772334c7cda` | Exact: react-app/src/ui/react-port-order-button-font-weight.css |

An import-only Source wrapper can map to already present base CSS without being byte-identical; its full import chain and cascade order still require comparison.

## Source JSX pages

| Source page | SHA-256 prefix | Target file | Source page CSS imports |
|---|---|---|---|
| `AdminPage.jsx` | `184877ff4296` | Different | react-port-dynamic-field.css, react-port-admin-store-dynamic.css |
| `AdminQrPage.jsx` | `36ff7042a427` | Different | Entry/shared CSS |
| `AdminSalesReportPage.jsx` | `0a575a546757` | Different | Entry/shared CSS |
| `AdminStoreMasterPage.jsx` | `c56746365d8d` | Not copied | Entry/shared CSS |
| `AdminTenantsPage.jsx` | `4fdf4431e991` | Different | react-port-tenant-report-desktop-row.css, react-port-wallet-review.css, react-port-new-tenant-setup.css |
| `AdminUsersPage.jsx` | `095dad248e3a` | Different | Entry/shared CSS |
| `CanonicalLaravelBridgePage.jsx` | `b1e4caa742b1` | Not copied | Entry/shared CSS |
| `CashierPage.jsx` | `27df12ffc6fc` | Different | Entry/shared CSS |
| `CashierReceiptPage.jsx` | `d3721a6cf663` | Different | Entry/shared CSS |
| `CashierTableQrPage.jsx` | `098205f635b7` | Different | Entry/shared CSS |
| `DeliveryPage.jsx` | `bfaae8350207` | Different | react-port-delivery.css |
| `DeliverySuccessPage.jsx` | `4656642da577` | Different | react-port-delivery-success.css |
| `HomePage.jsx` | `6cbf85387117` | Different | react-port-home.css |
| `HybridBillingReportPage.jsx` | `8eac6eb83737` | Different | Entry/shared CSS |
| `HybridBillingReviewPage.jsx` | `fef7ecd78704` | Different | Entry/shared CSS |
| `KitchenPage.jsx` | `2fce0443043c` | Different | Entry/shared CSS |
| `LaravelSessionPage.jsx` | `5265a910de6c` | Not copied | Entry/shared CSS |
| `LegalPage.jsx` | `b3b57c2d6812` | Different | react-port-legal.css |
| `LoginPage.jsx` | `509dee60530c` | Different | Entry/shared CSS |
| `PlatformContactPage.jsx` | `e8ea15d0660d` | Different | Entry/shared CSS |
| `PlatformOwnersPage.jsx` | `14f209519cff` | Different | Entry/shared CSS |
| `PlatformPage.jsx` | `e31162ad06af` | Different | react-port-platform-receiver-redesign.css |
| `PlatformPricingPage.jsx` | `79c1894b5a22` | Different | Entry/shared CSS |
| `PortMissingRoute.jsx` | `ed0423c51ef4` | Not copied | Entry/shared CSS |
| `PosBackupPage.jsx` | `40325f322384` | Different | react-port-pos-backup.css |
| `PosCatalogMasterPage.jsx` | `c35afcb5f6a8` | Not copied | Entry/shared CSS |
| `PosCatalogPage.jsx` | `f67a919f938c` | Different | react-port-pos-catalog.css |
| `PosCategoriesMasterPage.jsx` | `bc1ac0c0371d` | Not copied | react-port-pos-categories.css |
| `PosCustomerDisplayPage.jsx` | `443cc6fd0558` | Different | react-port-pos-customer-display.css |
| `PosCustomersMasterPage.jsx` | `8c036a48ba4c` | Not copied | react-port-pos-customers.css |
| `PosCustomersPage.jsx` | `485dffe0e9c5` | Different | react-port-pos-customers-source.css |
| `PosForbiddenPage.jsx` | `25b3cfe90a2e` | Different | react-port-pos-forbidden.css |
| `PosPage.jsx` | `6060c1f131db` | Different | react-port-pos-main.css |
| `PosPayablesPage.jsx` | `cc6e8cf27b27` | Different | react-port-pos-payables.css |
| `PosProductsMasterPage.jsx` | `918d260f8ebf` | Not copied | react-port-pos-products.css |
| `PosProductsPage.jsx` | `8130e34f0c22` | Different | react-port-pos-products-source.css |
| `PosPurchasesPage.jsx` | `a7ae586736b7` | Different | react-port-pos-purchases.css, react-port-dynamic-field.css |
| `PosReceiptPage.jsx` | `b2d762cdb55a` | Different | react-port-pos-receipt.css |
| `PosReturnsPage.jsx` | `04807953b291` | Different | react-port-pos-returns.css |
| `PosSalesPage.jsx` | `6073f83d35b3` | Different | react-port-pos-sales.css |
| `PosSettingsMasterPage.jsx` | `2a5441fad0c3` | Not copied | react-port-pos-settings.css |
| `PosSettingsPage.jsx` | `e3b5d6a2dc9a` | Different | react-port-pos-settings-source.css |
| `PosShiftsPage.jsx` | `2a0851d9b44a` | Different | react-port-pos-shifts.css |
| `PosStockCountsMasterPage.jsx` | `9a21d4b778ef` | Not copied | react-port-pos-stock-counts.css |
| `PosStockCountsPage.jsx` | `3925032ab0f6` | Different | react-port-pos-stock-counts-source.css |
| `PosStockMovementsMasterPage.jsx` | `0ee75857e77f` | Not copied | react-port-pos-stock-movements.css |
| `PosStockMovementsPage.jsx` | `9d981f8306f7` | Different | react-port-pos-stock-movements-source.css |
| `PosSuppliersMasterPage.jsx` | `635f10e04894` | Not copied | react-port-pos-suppliers.css |
| `PosSuppliersPage.jsx` | `6a8ced755d31` | Different | react-port-pos-suppliers-source.css |
| `PosTaxInvoicePage.jsx` | `90e6eead3d5e` | Different | react-port-pos-tax-invoice.css |
| `PosTaxInvoicesPage.jsx` | `255f52ca0900` | Different | react-port-pos-tax-invoices.css |
| `PosUsersMasterPage.jsx` | `e7533901989d` | Not copied | react-port-pos-users.css |
| `PosUsersPage.jsx` | `ac4051ed4f80` | Different | react-port-pos-users-source.css |
| `PublicOrderPage.jsx` | `69e330e707ec` | Different | react-port-table-order.css |
| `PublicRouteMissingPage.jsx` | `7e068c90b22f` | Different | Entry/shared CSS |
| `QuickOrderPage.jsx` | `d87a1e7b732c` | Different | Entry/shared CSS |
| `RegisterPage.jsx` | `29e01dfe4b86` | Different | react-port-register.css |
| `RevenueShareReportPage.jsx` | `911dd40f8bb3` | Different | Entry/shared CSS |
| `SaasSetupPage.jsx` | `e71e2a01bdb6` | Different | Entry/shared CSS |
| `StorefrontCompatibilityEntry.jsx` | `f77ba9013521` | Different | Entry/shared CSS |
| `TakeawayPage.jsx` | `08e9a7204ec8` | Different | react-port-takeaway.css |
| `VerifyPage.jsx` | `fb1002fbf902` | Different | react-port-verify.css |
| `WaitingQueueCustomerPage.jsx` | `0a43ca661466` | Different | Entry/shared CSS |
| `WaitingQueueDisplayPage.jsx` | `d35a6985e00b` | Different | Entry/shared CSS |
| `WaitingQueuePage.jsx` | `504bc07da5ac` | Different | Entry/shared CSS |

Source pages: 65; matching target filenames: 52; source-only filenames: 13.

## Rebase acceptance criteria

- Start from the complete Source presentation tree and ordered CSS dependencies; adapt Firebase data providers/commands, never invent replacement views.
- Record deviations explicitly: branding, actual Firebase data/authorization, missing provider or billing capability. Do not present unavailable data as confirmed.
- Check actual browser layout at desktop and mobile, empty/loading/error/filled states, dialog and responsive behavior; do not equate a build or file match with visual acceptance.
- Deploy Hosting only after scoped verification. Backend schema, permissions and live payment changes are separate acceptance work.

