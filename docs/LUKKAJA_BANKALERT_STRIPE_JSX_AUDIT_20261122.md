# LUKKAJA BankAlert Stripe → PENGUIN: JSX baseline (2026-11-22)

Source: `cosmatch/lukkhaja` / `feature/lukkaja_bankalert_stripe` / `03d2aaeeaf56f4c0d63a51d19bf7ebbcc63d62fd` (read only).
Target: `Natchanon45/food-order-app` / `feature/react-firebase-port` / `c42b2981b7fd8b6388faa377cc2afe5423078162` (before this port).
Prior source `e84c899028eb16c67401dcc05c5faed84bf48f63` is an ancestor; 241 commits since baseline.

Count physical lines in committed UTF-8 JSX blobs (including blank lines). Only React port roots, excluding reference copies, pilot and test files. Same path/count is not proof of parity.

| Group | Prior source files / lines | New source files / lines | Target files / lines | Matched paths | Source only | Target only | Changed source files |
|---|---:|---:|---:|---:|---:|---:|---:|
| pages | 65 / 34616 | 65 / 35702 | 52 / 29601 | 52 | 13 | 0 | 26 |
| components | 70 / 9634 | 84 / 12312 | 30 / 4213 | 28 | 56 | 2 | 29 |
| other | 5 / 480 | 5 / 486 | 6 / 790 | 2 | 3 | 4 | 1 |

## Phase order (retain existing plan; revalidate against new source)

- P1: all seven Super Admin routes (existing Firebase guards; new accordion, contact, payment settings, pricing, tenant approvals).
- P2: merchant/admin settings, dynamic fields, role and store setup.
- P3: public checkout / delivery / takeaway, review, QR expiry, BankAlert, Stripe, COD and receipt.
- P4: cashier, kitchen, quick order, queue, Telegram and status gates.
- P5: POS and stock, no blind replacement of Firebase-specific masters.
- P6: finance ledger, quota, Stripe, suspension/reconciliation, provider authorization and emulator tests.
- P7: parity, build, Hosting validation; no deployment of unverified provider or financial logic.

## Per-file line counts

| Path | Prior source | New source | Target | Changed source | Exact match |
|---|---:|---:|---:|---|---|
| pages/AdminPage.jsx | 2239 | 2390 | 2196 | yes | no |
| pages/AdminQrPage.jsx | 180 | 180 | 152 | no | no |
| pages/AdminSalesReportPage.jsx | 596 | 591 | 592 | yes | no |
| pages/AdminStoreMasterPage.jsx | 364 | 364 | — | yes | no |
| pages/AdminTenantsPage.jsx | 2340 | 2275 | 1553 | yes | no |
| pages/AdminUsersPage.jsx | 431 | 435 | 431 | yes | no |
| pages/CanonicalLaravelBridgePage.jsx | 41 | 41 | — | no | no |
| pages/CashierPage.jsx | 1358 | 1581 | 1362 | yes | no |
| pages/CashierReceiptPage.jsx | 398 | 405 | 367 | yes | no |
| pages/CashierTableQrPage.jsx | 624 | 624 | 544 | no | no |
| pages/DeliveryPage.jsx | 1317 | 1614 | 1234 | yes | no |
| pages/DeliverySuccessPage.jsx | 613 | 906 | 362 | yes | no |
| pages/HomePage.jsx | 401 | 401 | 377 | no | no |
| pages/HybridBillingReportPage.jsx | 335 | 335 | 335 | no | no |
| pages/HybridBillingReviewPage.jsx | 561 | 561 | 558 | no | no |
| pages/KitchenPage.jsx | 662 | 681 | 707 | yes | no |
| pages/LaravelSessionPage.jsx | 72 | 72 | — | no | no |
| pages/LegalPage.jsx | 83 | 83 | 63 | no | no |
| pages/LoginPage.jsx | 247 | 266 | 286 | yes | no |
| pages/PlatformContactPage.jsx | 495 | 603 | 495 | yes | no |
| pages/PlatformOwnersPage.jsx | 361 | 371 | 386 | yes | no |
| pages/PlatformPage.jsx | 827 | 764 | 882 | yes | no |
| pages/PlatformPricingPage.jsx | 308 | 461 | 308 | yes | no |
| pages/PortMissingRoute.jsx | 11 | 11 | — | no | no |
| pages/PosBackupPage.jsx | 90 | 90 | 30 | no | no |
| pages/PosCatalogMasterPage.jsx | 3 | 3 | — | no | no |
| pages/PosCatalogPage.jsx | 470 | 470 | 281 | no | no |
| pages/PosCategoriesMasterPage.jsx | 150 | 150 | — | yes | no |
| pages/PosCustomerDisplayPage.jsx | 223 | 223 | 190 | no | no |
| pages/PosCustomersMasterPage.jsx | 358 | 358 | — | yes | no |
| pages/PosCustomersPage.jsx | 563 | 563 | 548 | no | no |
| pages/PosForbiddenPage.jsx | 56 | 56 | 40 | no | no |
| pages/PosPage.jsx | 1438 | 1445 | 1314 | yes | no |
| pages/PosPayablesPage.jsx | 812 | 812 | 762 | no | no |
| pages/PosProductsMasterPage.jsx | 320 | 320 | — | yes | no |
| pages/PosProductsPage.jsx | 1290 | 1290 | 1216 | no | no |
| pages/PosPurchasesPage.jsx | 1332 | 1357 | 1274 | yes | no |
| pages/PosReceiptPage.jsx | 346 | 346 | 319 | no | no |
| pages/PosReturnsPage.jsx | 894 | 894 | 849 | no | no |
| pages/PosSalesPage.jsx | 891 | 891 | 861 | no | no |
| pages/PosSettingsMasterPage.jsx | 179 | 179 | — | no | no |
| pages/PosSettingsPage.jsx | 460 | 460 | 463 | no | no |
| pages/PosShiftsPage.jsx | 728 | 728 | 684 | no | no |
| pages/PosStockCountsMasterPage.jsx | 177 | 177 | — | no | no |
| pages/PosStockCountsPage.jsx | 984 | 984 | 950 | no | no |
| pages/PosStockMovementsMasterPage.jsx | 152 | 152 | — | no | no |
| pages/PosStockMovementsPage.jsx | 914 | 914 | 897 | no | no |
| pages/PosSuppliersMasterPage.jsx | 232 | 232 | — | yes | no |
| pages/PosSuppliersPage.jsx | 479 | 479 | 354 | no | no |
| pages/PosTaxInvoicePage.jsx | 189 | 189 | 164 | no | no |
| pages/PosTaxInvoicesPage.jsx | 552 | 552 | 495 | no | no |
| pages/PosUsersMasterPage.jsx | 221 | 221 | — | yes | no |
| pages/PosUsersPage.jsx | 408 | 408 | 251 | no | no |
| pages/PublicOrderPage.jsx | 247 | 247 | 243 | no | no |
| pages/PublicRouteMissingPage.jsx | 32 | 32 | 32 | no | no |
| pages/QuickOrderPage.jsx | 1267 | 1269 | 1105 | yes | no |
| pages/RegisterPage.jsx | 547 | 554 | 508 | yes | no |
| pages/RevenueShareReportPage.jsx | 1034 | 927 | 834 | yes | no |
| pages/SaasSetupPage.jsx | 152 | 152 | 210 | no | no |
| pages/StorefrontCompatibilityEntry.jsx | 29 | 29 | 30 | no | no |
| pages/TakeawayPage.jsx | 231 | 231 | 220 | no | no |
| pages/VerifyPage.jsx | 164 | 165 | 162 | yes | no |
| pages/WaitingQueueCustomerPage.jsx | 288 | 288 | 287 | no | no |
| pages/WaitingQueueDisplayPage.jsx | 131 | 131 | 121 | no | no |
| pages/WaitingQueuePage.jsx | 719 | 719 | 717 | no | no |
| components/AdminCollapsibleCard.jsx | 65 | 66 | 65 | yes | no |
| components/AdminDeliveryFeeEditor.jsx | 78 | 78 | — | no | no |
| components/AdminDeliveryQr.jsx | 176 | 176 | 176 | no | no |
| components/AdminLalamoveSettingsCard.jsx | 127 | 149 | — | yes | no |
| components/AdminLalamoveWalletPanel.jsx | 259 | 259 | — | no | no |
| components/AdminMenusMasterCard.jsx | 200 | 200 | — | yes | no |
| components/AdminMobileEntityList.jsx | 91 | 91 | 91 | no | yes |
| components/AdminPromotionEditor.jsx | 53 | 92 | — | yes | no |
| components/AdminRestaurantMenuSortingCard.jsx | 105 | 105 | — | no | no |
| components/AdminSettingsGroup.jsx | 40 | 40 | — | no | no |
| components/AdminStoreLocationMap.jsx | 210 | 210 | — | no | no |
| components/AdminTablesMasterCard.jsx | 166 | 166 | — | yes | no |
| components/AppDeveloperPanel.jsx | 86 | 83 | 86 | yes | no |
| components/AppModal.jsx | 55 | 55 | — | no | no |
| components/BankalertStripeHistory.jsx | — | 60 | — | yes | no |
| components/BankalertStripePlatformSettings.jsx | — | 176 | — | yes | no |
| components/BankalertStripeWalletTopup.jsx | — | 345 | — | yes | no |
| components/CashierOrderNotifier.jsx | 218 | 369 | 218 | yes | no |
| components/DeliveryCustomIcons.jsx | 43 | 43 | 43 | no | yes |
| components/DeliveryHoursEditor.jsx | 100 | 106 | 100 | yes | no |
| components/DeliveryLocationPicker.jsx | 213 | 213 | 213 | no | no |
| components/DeliveryOrderHeading.jsx | — | 54 | — | yes | no |
| components/DynamicField.jsx | — | 70 | — | yes | no |
| components/FormDynamicEnhancer.jsx | — | 159 | — | yes | no |
| components/FormValidationUi.jsx | 265 | 265 | 265 | no | no |
| components/GoPlatformBrandingRuntime.jsx | 57 | 57 | — | no | no |
| components/HybridReviewDecisionPanel.jsx | 100 | 100 | 100 | no | no |
| components/HybridTenantProofPanel.jsx | 238 | 238 | 191 | no | no |
| components/LalamoveCODReconciliationPanel.jsx | 44 | 44 | — | no | no |
| components/LaravelPosNavigation.jsx | 2 | 2 | — | no | no |
| components/LocaleSwitcher.jsx | 55 | 55 | 53 | no | no |
| components/M7CorrectionPanel.jsx | 132 | 132 | — | no | no |
| components/M7FinancePolicyPanel.jsx | 246 | 246 | — | no | no |
| components/M7Gate3OperationalDetails.jsx | 301 | 301 | — | no | no |
| components/M7HomeInvoiceNotice.jsx | 23 | 23 | — | no | no |
| components/M7IssuedInvoiceList.jsx | 611 | 655 | — | yes | no |
| components/M7MerchantServicePaymentHistory.jsx | — | 69 | — | yes | no |
| components/M7OperationalOutageReviewItem.jsx | 53 | 53 | — | no | no |
| components/M7PlatformManualReview.jsx | 109 | 109 | — | no | no |
| components/M7PlatformPaymentHistory.jsx | — | 144 | — | yes | no |
| components/M7PolicyAcceptancePanels.jsx | 172 | 241 | — | yes | no |
| components/M7ReleaseGatePanel.jsx | 105 | 105 | — | no | no |
| components/M7StripeInvoicePayment.jsx | — | 190 | — | yes | no |
| components/M7StripeSandboxTestPanel.jsx | — | 106 | — | yes | no |
| components/M7TenantExtendedReview.jsx | 77 | 77 | — | no | no |
| components/M7TenantLegacyEnrollmentReview.jsx | 180 | 180 | — | no | no |
| components/M7TenantOperationalIssuance.jsx | 127 | 127 | — | no | no |
| components/M7TenantSourceEvidence.jsx | 245 | 245 | — | no | no |
| components/M7TenantSuspensionGate.jsx | 254 | 254 | — | yes | no |
| components/MerchantServiceTerms.jsx | 72 | 72 | 65 | no | no |
| components/OrderRevisionDisplay.jsx | 53 | 53 | — | no | no |
| components/PageReadyOverlay.jsx | 75 | 75 | 75 | no | no |
| components/ParityFooter.jsx | 25 | 25 | 25 | no | no |
| components/ParityLayout.jsx | 15 | 15 | 15 | no | no |
| components/PaymentCompanionPairingCard.jsx | — | 534 | — | yes | no |
| components/PlatformBankEvidencePanel.jsx | 100 | 100 | — | no | no |
| components/PlatformBankVerificationRequestPanel.jsx | 104 | 104 | — | no | no |
| components/PlatformBillingScenarioPanel.jsx | 351 | 351 | — | no | no |
| components/PlatformBrandingRuntime.jsx | 4 | 4 | 129 | no | no |
| components/PlatformCardAccordionHeader.jsx | — | 40 | — | yes | no |
| components/PlatformCollapsibleCard.jsx | — | 27 | — | yes | no |
| components/PlatformFinanceBeneficiaryDraftPanel.jsx | 154 | 154 | — | no | no |
| components/PlatformFinanceBeneficiaryReviewPanel.jsx | 111 | 111 | — | no | no |
| components/PlatformHybridManualSlipPanel.jsx | 150 | 150 | — | no | no |
| components/PlatformM7OwnerPayeeCard.jsx | 150 | 150 | — | no | no |
| components/PlatformReceiverBankSelect.jsx | 156 | 156 | 156 | no | yes |
| components/PosNavigation.jsx | 305 | 305 | 293 | no | no |
| components/PosUserProfile.jsx | 13 | 13 | 13 | no | yes |
| components/PublicStorefront.jsx | 301 | 307 | 297 | yes | no |
| components/PublicStorefrontOperationalGate.jsx | 108 | 108 | — | no | no |
| components/ReactBootstrapReadyGate.jsx | 27 | 27 | — | no | no |
| components/ReactPortErrorBoundary.jsx | 54 | 54 | — | no | no |
| components/RequireRole.jsx | 4 | 4 | 4 | no | no |
| components/SalesReportReadFailure.jsx | 14 | 14 | — | no | no |
| components/StartupGate.jsx | 8 | 8 | 8 | no | no |
| components/StoreBrandingEditor.jsx | 138 | 138 | 136 | no | no |
| components/StoreHeroBranding.jsx | 30 | 30 | 24 | no | no |
| components/StripeConnectDeliveryCard.jsx | — | 232 | — | yes | no |
| components/SuperAdminNotificationBell.jsx | 263 | 377 | — | yes | no |
| components/TelegramOrderFocus.jsx | 36 | 36 | — | no | no |
| components/TelegramSettingsPanel.jsx | 224 | 246 | 243 | yes | no |
| components/TenantControlPanel.jsx | 610 | 611 | 591 | yes | no |
| components/TenantDeliveryManualReview.jsx | — | — | 147 | no | no |
| components/TenantFinanceSourceEvidence.jsx | — | — | 127 | no | no |
| components/UserMenu.jsx | 266 | 266 | 264 | no | no |
| components/WaitingQueueNavigationBridge.jsx | 32 | 32 | — | no | no |
| PortRoutes.jsx | 19 | 19 | — | no | no |
| app/App.jsx | — | — | 234 | no | no |
| auth/AuthProvider.jsx | — | — | 130 | no | no |
| auth/LaravelAuthProvider.jsx | 121 | 121 | — | no | no |
| hooks/useParityPage.jsx | 64 | 64 | 77 | no | no |
| i18n/I18nProvider.jsx | 232 | 238 | 205 | yes | no |
| main.jsx | — | — | 37 | no | no |
| tenant/LaravelTenantProvider.jsx | 44 | 44 | — | no | no |
| tenant/TenantProvider.jsx | — | — | 107 | no | no |

## P1 continuation — first candidate (not phase acceptance)

- Ported the source PlatformContactPage presentation and scoped collapse CSS, retaining PENGUIN Firebase auth, reads, saves, error guards and routing. Public contact, Google and Telegram cards collapse independently; paired previews follow the card. Telegram header reload uses a portal while retaining Firebase callables; demo text is labeled fictional.
- New contact regression contract 2/2 PASS; existing platform Firebase readiness contract 4/4 PASS; full `npm run test:react-parity` PASS; `npm run build:react` and generated build contract PASS. These are static/unit/build checks, not signed-in browser/provider UAT.
- Other six P1 pages and newly added DynamicField/payment components still require source comparison and Firebase adapter work. No full phase acceptance, no Cloud Functions/Rules changes, no deployment.
- Existing live Hosting JS `/react/assets/index-BaKCYABy.js` differs from candidate `/react/assets/index-DDUK5rrM.js`; preserve live release until approved parity and authenticated UAT.

### P1 continuation — shared controls and effective-dated delivery threshold

- Ported shared DynamicField and PlatformCardAccordionHeader, platform settings accordion, owner and user modal fields, Telegram token/chat fields, and destructive tenant confirmation styling; retained Firebase handlers and guards.
- Ported PlatformPricing threshold history/schedule UI and Firebase callables. Immutable original baseline, validated append-only effective dates, transaction serialization and readback. Existing store cycles retain their original threshold until the next applicable cycle; historical excess is calculated using the cycle-start threshold, including quota selection.
- Verification: focused P1 initial contracts 16/16; isolated Chromium component fixture at 320/390/768/1440; billing regression 59/59 and new threshold tests 2/2; npm run test:react-parity exit 0; React build exit 0. The component fixture is not authenticated live-page UAT. No real Firebase emulator transaction/provider UAT completed in this continuation.
- Source remains read-only. SaasSetup existing Firebase migration behavior retained. Remaining P1 scope: source Stripe/BankAlert wallet/settings/history and M7 payment history alignment; authenticated and emulator UAT; release gate. No production deployment. Generated candidate bundles were removed after verification so the existing Hosting release remains untouched.

### P1 continuation — Stripe Sandbox readiness and payment history (partial)

- Added source-style Stripe PromptPay Lalamove Wallet test settings accordion. Firebase callable is active-Superadmin-only, reads Thai test account and PromptPay configuration from Stripe only on an explicit Verify action, and does not expose credentials. Configure Firebase Secret Manager variables PENGUIN_STRIPE_WALLET_TEST_KEY and PENGUIN_STRIPE_WALLET_TEST_WEBHOOK and server environment PENGUIN_STRIPE_WALLET_TEST_ACCOUNT_ID before configuring a future sandbox deployment. PENGUIN_STRIPE_WALLET_SANDBOX_ENABLED must be 1; live mode and local emulators deny provider requests. No secrets provisioned or real Stripe requests made. Missing credentials or failed reads never imply readiness. Checkout and webhook processing remain disabled.
- Added pure raw Webhook signature verification and independent test-session/payment-intent evidence validation, neither exposed as a settlement endpoint nor permitted to credit live wallets.
- Added source-style horizontal-scroll payment history table and Firebase Superadmin projection of existing Revenue Share records with tenant/status filtering before limit, independent of sales dates, explicit partial-history and error states, no private slip data. Added composite Firestore index. This is not Stripe settlement history or M7 issued invoice evidence, and existing slip-review workflows remain available.
- Verification: new Stripe policy/callable mock tests 5/5; payment history contract tests 2/2; isolated JDK21 Firestore emulator on 127.0.0.1:18080, project demo-penguin-hybrid, callable-handler tests 3/3 (actual tenant-scoped history, transaction contention and original baseline lock, sandbox gate); full npm run test:react-parity exit 0; React build and generated build contract PASS. Local emulator shut down. No real provider/Checkout, HTTP callable auth transport or authenticated browser UAT in this continuation.
- Remaining P1: test-only wallet Checkout reservation and provider-confirmed settlement ledger separated from live wallet, actual webhook endpoint and dedupe, BankAlert ingestion/matching and Stripe/M7 histories, complete UAT. No deployment. Existing generated Hosting entrypoints restored after checking candidate build.

### P1 continuation — isolated Stripe wallet checkout, webhook and ledger candidate

- Added source-style merchant Stripe Sandbox wallet and Superadmin compact history. Test wallet is visibly separate from the real Lalamove balance; existing slip top-up UI remains intact. The browser can create/resume a reserved reference, follow a validated Stripe-hosted URL, recheck status, close an open Checkout after confirmation, and read history. A lost create response retries the same reference; return/cancel URL is only a lookup hint, never evidence of payment.
- Added Firebase callables for sandbox gate, tenant availability/history, Checkout creation, status and expiry, and Superadmin readonly history. A single designated active tenant with approved central mode is allowed; its owner/admin role is checked again inside the reservation transaction. New Checkout requires PENGUIN_STRIPE_WALLET_SANDBOX_ENABLED=1, PENGUIN_STRIPE_WALLET_SANDBOX_CHECKOUT_ENABLED=1, PENGUIN_STRIPE_WALLET_SANDBOX_TENANT_ID, the previous test account and Secret Manager configuration, and a signed test webhook independently confirmed by retrieving the event from Stripe. Actual configuration, secrets and provider endpoint registration were not provisioned.
- Checkout uses fixed HTTPS return origin, THB PromptPay only, exact amounts in satang, metadata binding, server-side idempotency, single pending reference and bounded retry window. A non-verified or ambiguous request never releases credit. Raw-body signature plus independent test account, event, session and PaymentIntent checks guard settlement. Firestore transaction writes balance, attempt, unique intent claim and one immutable ledger record together, including webhook/refresh races. Expiry must be confirmed by Stripe. Asynchronous failure without independently verified terminal expiry remains pending for review.
- Dedicated collections stripeWalletSandboxTenants, stripeWalletSandboxIntentClaims and stripeWalletSandboxControl are server-only and explicitly denied by Firestore Rules. No operational wallet, delivery, fee or invoice writers are called by this candidate. Actual provider calls are disabled in all Firebase emulators, demo projects, and when live mode is enabled.
- Verification: actual Firestore Emulator plus synthetic Stripe HTTP transport tests 2/2 PASS (including signed event readiness, invalid signature, incorrect amount, concurrent reservations, idempotent retry, duplicate webhooks + status check, verified expiration, role/tenant isolation, admin history with no Checkout URLs, untouched real wallet); actual source component isolated Chromium browser test PASS at 320/390/768/1440 including lost response retry and verified balance; earlier sandbox policy tests 5/5 PASS; React Callable contract 85 references, React build/generated contract PASS; existing full parity suite passed before final history addition. No actual Stripe API call, payment, HTTP transport UAT, or production deployment. Record authenticated page UAT and dedicated Stripe Test Mode end-to-end validation as outstanding.
- Remaining: actual Stripe test account/endpoint configuration and provider UAT, BankAlert companion ingestion/matching, complete M7 Stripe invoice settlements/history and P1 phase acceptance. Keep real wallet/production deployment gates closed. Source branch untouched.

### P1 continuation — BankAlert/payment companion observation pilot candidate

- Ported owner-only Android pairing and notification dashboard presentation from Source, including DynamicField, the four overview metrics, masked one-time token, device revoke/archive, observation grouping and advisory candidates. Existing Firebase payment, order and slip-review behavior remains unchanged.
- Firebase Cloud Functions accept structured notice fields at the same two Android client routes, /api/companion/device/status and /api/companion/notifications, with HTTPS Hosting rewrites. Explicit opt-in PENGUIN_PAYMENT_COMPANION_PILOT_ENABLED=1 and PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID required; actual production enablement not done. Pairing requires an active owner and tenant, serializes the max-three-device check, hashes the generated 256-bit token, and revokes by deleting its key index and clearing its hash transactionally. Archive retains the original observations. No plaintext token saved or returned in dashboard.
- Only selected source, event identity, satang, masked four-digit account suffix and bounded UTC timestamps are persisted. Tenant is derived from the authenticated device key, never from untrusted input. Same device/event is idempotent; changed payload conflicts; repeated independent observations are preserved and marked ambiguous, not silently merged. Raw notifications are explicitly rejected; no raw bank messages or OTP are stored or forwarded. Dedicated server-only collections and Firestore Rules deny client access. No APK published or Android source modified.
- Advisory candidates use existing Firebase pending PromptPay delivery orders, exact satang, current saved bank code and suffix, and strictly preceding 15-minute interval. Shared/duplicate observations remain ambiguous. Truncated reads fail closed. This matches the current Firebase slip-before-submit shape, not the source confirmed-order five-minute QR flow; saved account is advisory, not proof of the historical recipient. No notification can approve Paid, settle invoices, release kitchen, or dispatch a rider. Automatic kitchen, raw-forwarding/Telegram and later cashier reconciliation remain outstanding, as do source pay-first flow and account reconfirmation gates.
- Verification: pure notice/candidate policy tests 2/2; actual Firestore emulator 2/2 with local synthetic handler transport (concurrent 4-device cap, owner/tenant access, replay/conflict, invalid raw/forged status, masked fields, ambiguous two-order match, revoked token rejected, archive preserves observations, order unchanged, actual handler disabled in emulator); Chromium isolated component at 320/390/768/1440 with masked/revealed/closed token, device revoke and advisory state; full React parity exit 0 before final scoped CSS/browser fixture; React callable contract 88 references; final React build/generated contract PASS. No real bank, Android APK transport, Telegram, authenticated browser, or production UAT. No deployment.
- Next: account confirmation bound to payment settings, server-owned QR/order reference and evidence claims, cashier reconciliation/notification integration, source BankAlert automatic kitchen admission with explicit safety gates, complete M7 Finance and Stripe payment history. Do not enable provider/pilot until dedicated UAT and review.

### P1 continuation — receiver consent and preliminary cashier review

- Owner confirmation uses saved bank and PromptPay fields rather than a separately editable recipient. Masked display, enable/disable and re-confirmation control added. Server-private receiver revision includes full payment settings and Firestore document update timestamp: any subsequent store save (even unrelated or restoring prior values) requires new consent. Existing pre-link observations and replays cannot acquire a new revision. Disabled/revoked devices cannot contribute new matching evidence.
- Cashier review is an explicit, advisory-only action for an active owner/admin/cashier of the pilot tenant. Bounded candidate reads check exact satang, bank/suffix/time, active receiver revision, active device, one unambiguous match and a scoped slip path; recording additionally requires the observation to have reached the server before the order, and order creation after opt-in. A transaction records one reviewed-unverified audit per order and one claim per notification; concurrent same-reference retry is idempotent, other claims fail closed. No order, payment, invoice, wallet or kitchen state is written. The review does NOT prove slip content, historical payee, actual bank receipt or settlement, and does NOT substitute for the existing Superadmin technical-fallback approval.
- Source's full auto-kitchen flow is still outstanding: Firebase checkout currently requires a slip before submit and lacks the canonical server QR/receiver snapshot, globally unique original slip hash and late recheck evidence required by Source. Existing kitchen admission and direct-payment policy intentionally remain intact. Merchant Telegram notification and full cashier bank reconciliation not yet ported; no real provider or APK calls.
- Validation: actual Firestore emulator 2/2 PASS (including wrong suffix, owner-only binding, same-last-four account change and change-back invalidation, reconsent rejects old observations, concurrent cashier audit/claim, unauthorized kitchen role, unchanged order status/payment/kitchen release); component Chromium tests 320/390/768/1440 and policy tests 3/3 PASS; full React parity exit 0; callable contract 91 references; React generated build contract PASS. Existing Hosting artifacts restored, no deployment.
- Next: canonical server-owned checkout/receiver/slip evidence, five-minute confirmed-order QR and recheck flow, gated source kitchen admission, cashier settlement and Telegram integration; then M7 payment evidence/history and complete dedicated UAT. No live pilot enablement.

### P1 continuation — confirmed-order PromptPay QR and separate-project Kitchen UAT

- See `docs/LUKKAJA_P1_CONFIRMED_ORDER_QR_AND_COMPANION_UAT_20261122.md` for exact implementation tree, source comparison, server-only flags, acceptance scenarios and remaining blockers.
- Added an isolated, server-authoritative order-before-QR PromptPay 5-minute flow for explicitly selected Lalamove test tenant, quote/cart validation and receipt/reload behavior. Added post-expiry original-slip upload with order-scoped 256-bit capability, global immutable image claim and manual-unverified audit.
- After-confirm BankAlert candidates include exact recipient and original QR interval; SCB whole-minute alerts remain manual-review-only. Owner receiver consent now requires the current update-revision as a client-visible, server-validated precondition; same-last-four/changed-back races fail.
- Added separate project-only owner opt-in UAT kitchen admission with exact uniqueness and one-claim Firestore transaction. Explicit warning and FCM wording; Pending/Unverified remains, no payment/settlement/wallet/rider dispatch. Production, Firebase emulator and demo project flags refuse UAT activation.
- React components: customer confirmed QR, merchant UAT owner consent, cashier and kitchen warning + existing slip review. Full Stripe M7/Telegram, signed bank statements, real Android UAT and deployment remain outstanding. Never equate green unit/emulator tests to money-provider acceptance.
