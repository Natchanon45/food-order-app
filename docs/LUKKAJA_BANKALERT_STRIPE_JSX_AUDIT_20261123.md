# LUKKAJA BankAlert Stripe → PENGUIN: refreshed JSX inventory (2026-11-23)

**Source (read-only):** `cosmatch/lukkhaja` `feature/lukkaja_bankalert_stripe` `e60858c12b3e52a7ca6785e329d77004160e6657`
**Destination:** `Natchanon45/food-order-app` `feature/react-firebase-port` `bd7a337429aaff869cb60d1dba728f0878be0599`
**Previous Source audit:** `03d2aaeeaf56f4c0d63a51d19bf7ebbcc63d62fd`. **New Source commits:** 3.
**Previous target audit:** `c42b2981b7fd8b6388faa377cc2afe5423078162`. These are counts at the pinned commits, not tests of JSX parity.

## Latest numbers

| Group | Prior Source | New Source | Source Δ lines | Target current | Matched names | Source only | Target only | Changed Source |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| pages | 65 / 35,702 | **65 / 35,878** | +176 | **52 / 30,124** | 52 | 13 | 0 | 4 |
| components | 84 / 12,312 | **86 / 12,590** | +278 | **47 / 6,244** | 36 | 50 | 11 | 4 |
| other | 5 / 486 | **5 / 486** | +0 | **6 / 790** | 2 | 3 | 4 | 0 |
| **Total** | **154 / 48,500** | **156 / 48,954** | **+454** | **105 / 37,158** | **90** | **66** | **15** | **8** |

Source JSX net change: **+454 lines** across 8 changed JSX files, including **2 newly added JSX files**.
Target now has **17 additional JSX files** compared with the previous audit.
Do not interpret source-only names, unmatched bodies or line difference as a confirmed unimplemented feature; route usage and Firebase actions require manual verification.

## Source commits included in this refresh

- `e60858c1` — fix(delivery): align success cards and polish customer icon actions
- `7fbb6c88` — fix(delivery): present PromptPay verification in SweetAlert-style modal
- `95ad6914` — feat(lk-shop): integrate staff notifications FCM and mobile payment UI

## Changed Source JSX since previous audit (exact file delta)

| Source path | Previous LOC | Current LOC | Δ LOC | Added / removed lines | Target current LOC | Review |
|---|---:|---:|---:|---:|---:|---|
| `components/LKShopPairingPanel.jsx` | — | 221 | +221 | +221 / -0 | 222 | New dependency: inventory first |
| `components/ParityFooter.jsx` | 25 | 26 | +1 | +1 / -0 | 25 | Compare UI and behavior |
| `components/PaymentCompanionPairingCard.jsx` | 534 | 541 | +7 | +7 / -0 | 116 | Compare UI and behavior |
| `components/PublicAppDownloads.jsx` | — | 49 | +49 | +49 / -0 | 33 | New dependency: inventory first |
| `pages/AdminPage.jsx` | 2390 | 2403 | +13 | +13 / -0 | 2216 | Compare UI and behavior |
| `pages/DeliverySuccessPage.jsx` | 906 | 1005 | +99 | +135 / -36 | 480 | Compare UI and behavior |
| `pages/HomePage.jsx` | 401 | 404 | +3 | +3 / -0 | 380 | Compare UI and behavior |
| `pages/PlatformContactPage.jsx` | 603 | 664 | +61 | +62 / -1 | 623 | Compare UI and behavior |

## Source-only JSX names (evaluate route/usage, not blindly copy)

- `pages/AdminStoreMasterPage.jsx` — 364 lines
- `pages/CanonicalLaravelBridgePage.jsx` — 41 lines
- `pages/LaravelSessionPage.jsx` — 72 lines
- `pages/PortMissingRoute.jsx` — 11 lines
- `pages/PosCatalogMasterPage.jsx` — 3 lines
- `pages/PosCategoriesMasterPage.jsx` — 150 lines
- `pages/PosCustomersMasterPage.jsx` — 358 lines
- `pages/PosProductsMasterPage.jsx` — 320 lines
- `pages/PosSettingsMasterPage.jsx` — 179 lines
- `pages/PosStockCountsMasterPage.jsx` — 177 lines
- `pages/PosStockMovementsMasterPage.jsx` — 152 lines
- `pages/PosSuppliersMasterPage.jsx` — 232 lines
- `pages/PosUsersMasterPage.jsx` — 221 lines
- `components/AdminDeliveryFeeEditor.jsx` — 78 lines
- `components/AdminLalamoveSettingsCard.jsx` — 149 lines
- `components/AdminLalamoveWalletPanel.jsx` — 259 lines
- `components/AdminMenusMasterCard.jsx` — 200 lines
- `components/AdminPromotionEditor.jsx` — 92 lines
- `components/AdminRestaurantMenuSortingCard.jsx` — 105 lines
- `components/AdminSettingsGroup.jsx` — 40 lines
- `components/AdminStoreLocationMap.jsx` — 210 lines
- `components/AdminTablesMasterCard.jsx` — 166 lines
- `components/AppModal.jsx` — 55 lines
- `components/DeliveryOrderHeading.jsx` — 54 lines
- `components/FormDynamicEnhancer.jsx` — 159 lines
- `components/GoPlatformBrandingRuntime.jsx` — 57 lines
- `components/LalamoveCODReconciliationPanel.jsx` — 44 lines
- `components/LaravelPosNavigation.jsx` — 2 lines
- `components/M7CorrectionPanel.jsx` — 132 lines
- `components/M7FinancePolicyPanel.jsx` — 246 lines
- `components/M7Gate3OperationalDetails.jsx` — 301 lines
- `components/M7HomeInvoiceNotice.jsx` — 23 lines
- `components/M7IssuedInvoiceList.jsx` — 655 lines
- `components/M7MerchantServicePaymentHistory.jsx` — 69 lines
- `components/M7OperationalOutageReviewItem.jsx` — 53 lines
- `components/M7PlatformManualReview.jsx` — 109 lines
- `components/M7PlatformPaymentHistory.jsx` — 144 lines
- `components/M7PolicyAcceptancePanels.jsx` — 241 lines
- `components/M7ReleaseGatePanel.jsx` — 105 lines
- `components/M7StripeInvoicePayment.jsx` — 190 lines
- `components/M7StripeSandboxTestPanel.jsx` — 106 lines
- `components/M7TenantExtendedReview.jsx` — 77 lines
- `components/M7TenantLegacyEnrollmentReview.jsx` — 180 lines
- `components/M7TenantOperationalIssuance.jsx` — 127 lines
- `components/M7TenantSourceEvidence.jsx` — 245 lines
- `components/M7TenantSuspensionGate.jsx` — 254 lines
- `components/OrderRevisionDisplay.jsx` — 53 lines
- `components/PlatformBankEvidencePanel.jsx` — 100 lines
- `components/PlatformBankVerificationRequestPanel.jsx` — 104 lines
- `components/PlatformBillingScenarioPanel.jsx` — 351 lines
- `components/PlatformCollapsibleCard.jsx` — 27 lines
- `components/PlatformFinanceBeneficiaryDraftPanel.jsx` — 154 lines
- `components/PlatformFinanceBeneficiaryReviewPanel.jsx` — 111 lines
- `components/PlatformHybridManualSlipPanel.jsx` — 150 lines
- `components/PlatformM7OwnerPayeeCard.jsx` — 150 lines
- `components/PublicStorefrontOperationalGate.jsx` — 108 lines
- `components/ReactBootstrapReadyGate.jsx` — 27 lines
- `components/ReactPortErrorBoundary.jsx` — 54 lines
- `components/SalesReportReadFailure.jsx` — 14 lines
- `components/StripeConnectDeliveryCard.jsx` — 232 lines
- `components/SuperAdminNotificationBell.jsx` — 377 lines
- `components/TelegramOrderFocus.jsx` — 36 lines
- `components/WaitingQueueNavigationBridge.jsx` — 32 lines
- `PortRoutes.jsx` — 19 lines
- `auth/LaravelAuthProvider.jsx` — 121 lines
- `tenant/LaravelTenantProvider.jsx` — 44 lines

## New JSX files in Firebase destination since previous audit

- `components/BankalertStripeHistory.jsx` — 83 lines
- `components/BankalertStripePlatformSettings.jsx` — 49 lines
- `components/BankalertStripeWalletTopup.jsx` — 103 lines
- `components/CompanionCashierReview.jsx` — 46 lines
- `components/CompanionConfirmedQr.jsx` — 99 lines
- `components/DynamicField.jsx` — 71 lines
- `components/LKShopPairingPanel.jsx` — 222 lines
- `components/M7FinanceEvidenceHistory.jsx` — 123 lines
- `components/M7OperationalFinanceReadiness.jsx` — 108 lines
- `components/M7SourceMigrationPreflight.jsx` — 228 lines
- `components/M7StripeTestReservation.jsx` — 190 lines
- `components/M7StripeTestShadowHistory.jsx` — 221 lines
- `components/M7UatFinancialShadow.jsx` — 174 lines
- `components/PaymentCompanionPairingCard.jsx` — 116 lines
- `components/PlatformCardAccordionHeader.jsx` — 40 lines
- `components/PlatformPaymentHistory.jsx` — 98 lines
- `components/PublicAppDownloads.jsx` — 33 lines

## Per-file current JSX LOC

| File | Group | Old Source LOC | Source current LOC | Old Target LOC | Target current LOC | Changed Source | Exact JSX bytes |
|---|---|---:|---:|---:|---:|---|---|
| `pages/AdminPage.jsx` | pages | 2390 | 2403 | 2196 | 2216 | yes | no |
| `pages/AdminQrPage.jsx` | pages | 180 | 180 | 152 | 152 | no | no |
| `pages/AdminSalesReportPage.jsx` | pages | 591 | 591 | 592 | 592 | no | no |
| `pages/AdminStoreMasterPage.jsx` | pages | 364 | 364 | — | — | no | no |
| `pages/AdminTenantsPage.jsx` | pages | 2275 | 2275 | 1553 | 1569 | no | no |
| `pages/AdminUsersPage.jsx` | pages | 435 | 435 | 431 | 436 | no | no |
| `pages/CanonicalLaravelBridgePage.jsx` | pages | 41 | 41 | — | — | no | no |
| `pages/CashierPage.jsx` | pages | 1581 | 1581 | 1362 | 1369 | no | no |
| `pages/CashierReceiptPage.jsx` | pages | 405 | 405 | 367 | 367 | no | no |
| `pages/CashierTableQrPage.jsx` | pages | 624 | 624 | 544 | 544 | no | no |
| `pages/DeliveryPage.jsx` | pages | 1614 | 1614 | 1234 | 1269 | no | no |
| `pages/DeliverySuccessPage.jsx` | pages | 906 | 1005 | 362 | 480 | yes | no |
| `pages/HomePage.jsx` | pages | 401 | 404 | 377 | 380 | yes | no |
| `pages/HybridBillingReportPage.jsx` | pages | 335 | 335 | 335 | 338 | no | no |
| `pages/HybridBillingReviewPage.jsx` | pages | 561 | 561 | 558 | 563 | no | no |
| `pages/KitchenPage.jsx` | pages | 681 | 681 | 707 | 712 | no | no |
| `pages/LaravelSessionPage.jsx` | pages | 72 | 72 | — | — | no | no |
| `pages/LegalPage.jsx` | pages | 83 | 83 | 63 | 63 | no | no |
| `pages/LoginPage.jsx` | pages | 266 | 266 | 286 | 286 | no | no |
| `pages/PlatformContactPage.jsx` | pages | 603 | 664 | 495 | 623 | yes | no |
| `pages/PlatformOwnersPage.jsx` | pages | 371 | 371 | 386 | 397 | no | no |
| `pages/PlatformPage.jsx` | pages | 764 | 764 | 882 | 890 | no | no |
| `pages/PlatformPricingPage.jsx` | pages | 461 | 461 | 308 | 462 | no | no |
| `pages/PortMissingRoute.jsx` | pages | 11 | 11 | — | — | no | no |
| `pages/PosBackupPage.jsx` | pages | 90 | 90 | 30 | 30 | no | no |
| `pages/PosCatalogMasterPage.jsx` | pages | 3 | 3 | — | — | no | no |
| `pages/PosCatalogPage.jsx` | pages | 470 | 470 | 281 | 281 | no | no |
| `pages/PosCategoriesMasterPage.jsx` | pages | 150 | 150 | — | — | no | no |
| `pages/PosCustomerDisplayPage.jsx` | pages | 223 | 223 | 190 | 190 | no | no |
| `pages/PosCustomersMasterPage.jsx` | pages | 358 | 358 | — | — | no | no |
| `pages/PosCustomersPage.jsx` | pages | 563 | 563 | 548 | 548 | no | no |
| `pages/PosForbiddenPage.jsx` | pages | 56 | 56 | 40 | 40 | no | no |
| `pages/PosPage.jsx` | pages | 1445 | 1445 | 1314 | 1314 | no | no |
| `pages/PosPayablesPage.jsx` | pages | 812 | 812 | 762 | 762 | no | no |
| `pages/PosProductsMasterPage.jsx` | pages | 320 | 320 | — | — | no | no |
| `pages/PosProductsPage.jsx` | pages | 1290 | 1290 | 1216 | 1216 | no | no |
| `pages/PosPurchasesPage.jsx` | pages | 1357 | 1357 | 1274 | 1274 | no | no |
| `pages/PosReceiptPage.jsx` | pages | 346 | 346 | 319 | 319 | no | no |
| `pages/PosReturnsPage.jsx` | pages | 894 | 894 | 849 | 849 | no | no |
| `pages/PosSalesPage.jsx` | pages | 891 | 891 | 861 | 861 | no | no |
| `pages/PosSettingsMasterPage.jsx` | pages | 179 | 179 | — | — | no | no |
| `pages/PosSettingsPage.jsx` | pages | 460 | 460 | 463 | 463 | no | no |
| `pages/PosShiftsPage.jsx` | pages | 728 | 728 | 684 | 684 | no | no |
| `pages/PosStockCountsMasterPage.jsx` | pages | 177 | 177 | — | — | no | no |
| `pages/PosStockCountsPage.jsx` | pages | 984 | 984 | 950 | 950 | no | no |
| `pages/PosStockMovementsMasterPage.jsx` | pages | 152 | 152 | — | — | no | no |
| `pages/PosStockMovementsPage.jsx` | pages | 914 | 914 | 897 | 897 | no | no |
| `pages/PosSuppliersMasterPage.jsx` | pages | 232 | 232 | — | — | no | no |
| `pages/PosSuppliersPage.jsx` | pages | 479 | 479 | 354 | 354 | no | no |
| `pages/PosTaxInvoicePage.jsx` | pages | 189 | 189 | 164 | 164 | no | no |
| `pages/PosTaxInvoicesPage.jsx` | pages | 552 | 552 | 495 | 495 | no | no |
| `pages/PosUsersMasterPage.jsx` | pages | 221 | 221 | — | — | no | no |
| `pages/PosUsersPage.jsx` | pages | 408 | 408 | 251 | 251 | no | no |
| `pages/PublicOrderPage.jsx` | pages | 247 | 247 | 243 | 243 | no | no |
| `pages/PublicRouteMissingPage.jsx` | pages | 32 | 32 | 32 | 32 | no | no |
| `pages/QuickOrderPage.jsx` | pages | 1269 | 1269 | 1105 | 1105 | no | no |
| `pages/RegisterPage.jsx` | pages | 554 | 554 | 508 | 508 | no | no |
| `pages/RevenueShareReportPage.jsx` | pages | 927 | 927 | 834 | 839 | no | no |
| `pages/SaasSetupPage.jsx` | pages | 152 | 152 | 210 | 210 | no | no |
| `pages/StorefrontCompatibilityEntry.jsx` | pages | 29 | 29 | 30 | 30 | no | no |
| `pages/TakeawayPage.jsx` | pages | 231 | 231 | 220 | 220 | no | no |
| `pages/VerifyPage.jsx` | pages | 165 | 165 | 162 | 162 | no | no |
| `pages/WaitingQueueCustomerPage.jsx` | pages | 288 | 288 | 287 | 287 | no | no |
| `pages/WaitingQueueDisplayPage.jsx` | pages | 131 | 131 | 121 | 121 | no | no |
| `pages/WaitingQueuePage.jsx` | pages | 719 | 719 | 717 | 717 | no | no |
| `components/AdminCollapsibleCard.jsx` | components | 66 | 66 | 65 | 65 | no | no |
| `components/AdminDeliveryFeeEditor.jsx` | components | 78 | 78 | — | — | no | no |
| `components/AdminDeliveryQr.jsx` | components | 176 | 176 | 176 | 176 | no | no |
| `components/AdminLalamoveSettingsCard.jsx` | components | 149 | 149 | — | — | no | no |
| `components/AdminLalamoveWalletPanel.jsx` | components | 259 | 259 | — | — | no | no |
| `components/AdminMenusMasterCard.jsx` | components | 200 | 200 | — | — | no | no |
| `components/AdminMobileEntityList.jsx` | components | 91 | 91 | 91 | 91 | no | yes |
| `components/AdminPromotionEditor.jsx` | components | 92 | 92 | — | — | no | no |
| `components/AdminRestaurantMenuSortingCard.jsx` | components | 105 | 105 | — | — | no | no |
| `components/AdminSettingsGroup.jsx` | components | 40 | 40 | — | — | no | no |
| `components/AdminStoreLocationMap.jsx` | components | 210 | 210 | — | — | no | no |
| `components/AdminTablesMasterCard.jsx` | components | 166 | 166 | — | — | no | no |
| `components/AppDeveloperPanel.jsx` | components | 83 | 83 | 86 | 86 | no | no |
| `components/AppModal.jsx` | components | 55 | 55 | — | — | no | no |
| `components/BankalertStripeHistory.jsx` | components | 60 | 60 | — | 83 | no | no |
| `components/BankalertStripePlatformSettings.jsx` | components | 176 | 176 | — | 49 | no | no |
| `components/BankalertStripeWalletTopup.jsx` | components | 345 | 345 | — | 103 | no | no |
| `components/CashierOrderNotifier.jsx` | components | 369 | 369 | 218 | 218 | no | no |
| `components/CompanionCashierReview.jsx` | components | — | — | — | 46 | no | no |
| `components/CompanionConfirmedQr.jsx` | components | — | — | — | 99 | no | no |
| `components/DeliveryCustomIcons.jsx` | components | 43 | 43 | 43 | 43 | no | yes |
| `components/DeliveryHoursEditor.jsx` | components | 106 | 106 | 100 | 100 | no | no |
| `components/DeliveryLocationPicker.jsx` | components | 213 | 213 | 213 | 213 | no | no |
| `components/DeliveryOrderHeading.jsx` | components | 54 | 54 | — | — | no | no |
| `components/DynamicField.jsx` | components | 70 | 70 | — | 71 | no | no |
| `components/FormDynamicEnhancer.jsx` | components | 159 | 159 | — | — | no | no |
| `components/FormValidationUi.jsx` | components | 265 | 265 | 265 | 265 | no | no |
| `components/GoPlatformBrandingRuntime.jsx` | components | 57 | 57 | — | — | no | no |
| `components/HybridReviewDecisionPanel.jsx` | components | 100 | 100 | 100 | 100 | no | no |
| `components/HybridTenantProofPanel.jsx` | components | 238 | 238 | 191 | 191 | no | no |
| `components/LKShopPairingPanel.jsx` | components | — | 221 | — | 222 | yes | no |
| `components/LalamoveCODReconciliationPanel.jsx` | components | 44 | 44 | — | — | no | no |
| `components/LaravelPosNavigation.jsx` | components | 2 | 2 | — | — | no | no |
| `components/LocaleSwitcher.jsx` | components | 55 | 55 | 53 | 53 | no | no |
| `components/M7CorrectionPanel.jsx` | components | 132 | 132 | — | — | no | no |
| `components/M7FinanceEvidenceHistory.jsx` | components | — | — | — | 123 | no | no |
| `components/M7FinancePolicyPanel.jsx` | components | 246 | 246 | — | — | no | no |
| `components/M7Gate3OperationalDetails.jsx` | components | 301 | 301 | — | — | no | no |
| `components/M7HomeInvoiceNotice.jsx` | components | 23 | 23 | — | — | no | no |
| `components/M7IssuedInvoiceList.jsx` | components | 655 | 655 | — | — | no | no |
| `components/M7MerchantServicePaymentHistory.jsx` | components | 69 | 69 | — | — | no | no |
| `components/M7OperationalFinanceReadiness.jsx` | components | — | — | — | 108 | no | no |
| `components/M7OperationalOutageReviewItem.jsx` | components | 53 | 53 | — | — | no | no |
| `components/M7PlatformManualReview.jsx` | components | 109 | 109 | — | — | no | no |
| `components/M7PlatformPaymentHistory.jsx` | components | 144 | 144 | — | — | no | no |
| `components/M7PolicyAcceptancePanels.jsx` | components | 241 | 241 | — | — | no | no |
| `components/M7ReleaseGatePanel.jsx` | components | 105 | 105 | — | — | no | no |
| `components/M7SourceMigrationPreflight.jsx` | components | — | — | — | 228 | no | no |
| `components/M7StripeInvoicePayment.jsx` | components | 190 | 190 | — | — | no | no |
| `components/M7StripeSandboxTestPanel.jsx` | components | 106 | 106 | — | — | no | no |
| `components/M7StripeTestReservation.jsx` | components | — | — | — | 190 | no | no |
| `components/M7StripeTestShadowHistory.jsx` | components | — | — | — | 221 | no | no |
| `components/M7TenantExtendedReview.jsx` | components | 77 | 77 | — | — | no | no |
| `components/M7TenantLegacyEnrollmentReview.jsx` | components | 180 | 180 | — | — | no | no |
| `components/M7TenantOperationalIssuance.jsx` | components | 127 | 127 | — | — | no | no |
| `components/M7TenantSourceEvidence.jsx` | components | 245 | 245 | — | — | no | no |
| `components/M7TenantSuspensionGate.jsx` | components | 254 | 254 | — | — | no | no |
| `components/M7UatFinancialShadow.jsx` | components | — | — | — | 174 | no | no |
| `components/MerchantServiceTerms.jsx` | components | 72 | 72 | 65 | 65 | no | no |
| `components/OrderRevisionDisplay.jsx` | components | 53 | 53 | — | — | no | no |
| `components/PageReadyOverlay.jsx` | components | 75 | 75 | 75 | 75 | no | no |
| `components/ParityFooter.jsx` | components | 25 | 26 | 25 | 25 | yes | no |
| `components/ParityLayout.jsx` | components | 15 | 15 | 15 | 15 | no | no |
| `components/PaymentCompanionPairingCard.jsx` | components | 534 | 541 | — | 116 | yes | no |
| `components/PlatformBankEvidencePanel.jsx` | components | 100 | 100 | — | — | no | no |
| `components/PlatformBankVerificationRequestPanel.jsx` | components | 104 | 104 | — | — | no | no |
| `components/PlatformBillingScenarioPanel.jsx` | components | 351 | 351 | — | — | no | no |
| `components/PlatformBrandingRuntime.jsx` | components | 4 | 4 | 129 | 129 | no | no |
| `components/PlatformCardAccordionHeader.jsx` | components | 40 | 40 | — | 40 | no | no |
| `components/PlatformCollapsibleCard.jsx` | components | 27 | 27 | — | — | no | no |
| `components/PlatformFinanceBeneficiaryDraftPanel.jsx` | components | 154 | 154 | — | — | no | no |
| `components/PlatformFinanceBeneficiaryReviewPanel.jsx` | components | 111 | 111 | — | — | no | no |
| `components/PlatformHybridManualSlipPanel.jsx` | components | 150 | 150 | — | — | no | no |
| `components/PlatformM7OwnerPayeeCard.jsx` | components | 150 | 150 | — | — | no | no |
| `components/PlatformPaymentHistory.jsx` | components | — | — | — | 98 | no | no |
| `components/PlatformReceiverBankSelect.jsx` | components | 156 | 156 | 156 | 156 | no | yes |
| `components/PosNavigation.jsx` | components | 305 | 305 | 293 | 293 | no | no |
| `components/PosUserProfile.jsx` | components | 13 | 13 | 13 | 13 | no | yes |
| `components/PublicAppDownloads.jsx` | components | — | 49 | — | 33 | yes | no |
| `components/PublicStorefront.jsx` | components | 307 | 307 | 297 | 297 | no | no |
| `components/PublicStorefrontOperationalGate.jsx` | components | 108 | 108 | — | — | no | no |
| `components/ReactBootstrapReadyGate.jsx` | components | 27 | 27 | — | — | no | no |
| `components/ReactPortErrorBoundary.jsx` | components | 54 | 54 | — | — | no | no |
| `components/RequireRole.jsx` | components | 4 | 4 | 4 | 4 | no | no |
| `components/SalesReportReadFailure.jsx` | components | 14 | 14 | — | — | no | no |
| `components/StartupGate.jsx` | components | 8 | 8 | 8 | 8 | no | no |
| `components/StoreBrandingEditor.jsx` | components | 138 | 138 | 136 | 136 | no | no |
| `components/StoreHeroBranding.jsx` | components | 30 | 30 | 24 | 24 | no | no |
| `components/StripeConnectDeliveryCard.jsx` | components | 232 | 232 | — | — | no | no |
| `components/SuperAdminNotificationBell.jsx` | components | 377 | 377 | — | — | no | no |
| `components/TelegramOrderFocus.jsx` | components | 36 | 36 | — | — | no | no |
| `components/TelegramSettingsPanel.jsx` | components | 246 | 246 | 243 | 270 | no | no |
| `components/TenantControlPanel.jsx` | components | 611 | 611 | 591 | 591 | no | no |
| `components/TenantDeliveryManualReview.jsx` | components | — | — | 147 | 147 | no | no |
| `components/TenantFinanceSourceEvidence.jsx` | components | — | — | 127 | 127 | no | no |
| `components/UserMenu.jsx` | components | 266 | 266 | 264 | 264 | no | no |
| `components/WaitingQueueNavigationBridge.jsx` | components | 32 | 32 | — | — | no | no |
| `PortRoutes.jsx` | other | 19 | 19 | — | — | no | no |
| `app/App.jsx` | other | — | — | 234 | 234 | no | no |
| `auth/AuthProvider.jsx` | other | — | — | 130 | 130 | no | no |
| `auth/LaravelAuthProvider.jsx` | other | 121 | 121 | — | — | no | no |
| `hooks/useParityPage.jsx` | other | 64 | 64 | 77 | 77 | no | no |
| `i18n/I18nProvider.jsx` | other | 238 | 238 | 205 | 205 | no | no |
| `main.jsx` | other | — | — | 37 | 37 | no | no |
| `tenant/LaravelTenantProvider.jsx` | other | 44 | 44 | — | — | no | no |
| `tenant/TenantProvider.jsx` | other | — | — | 107 | 107 | no | no |

## Scope and safety

- New Source includes **LK Shop Flutter mobile app** and Go FCM/QR pairing endpoints; these are outside JSX LOC and need a separate Firebase-side FCM/mobile contract, not copy/paste of Go/SQL or Android binaries.
- Latest customer order-success UI changes payment badges, card grouping, mobile icon controls and a Stripe Sandbox build flag. Their presentation must be compared for PC/mobile, but must never infer Paid from a badge.
- New `LKShopPairingPanel` has role-scoped room selection, QR expiry/revoke and device listing. No Firebase implementation may activate FCM/device pairing until Auth, tenant scope, revocation and replay tests pass.
- No new Source page file or `PortRoutes.jsx` change occurred in this delta. Existing 65 page-file phase scopes remain; 65 is *not* a route count.
- New JSX in Target since last audit is not automatically accepted as Source parity. Prior verified tests/financial hold gates must be preserved.
- No Production deploy, Source write or arbitrary cross-repo merge is part of this refresh.

Regenerate with `python3 tools/refresh_lukkaja_jsx_audit.py --source ../lukkhaja_bankalert_stripe --update-page-matrix` (source must be checked out at the intended commit).
