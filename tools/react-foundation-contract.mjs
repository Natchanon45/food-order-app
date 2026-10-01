import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const pkg=JSON.parse(read("package.json"));
const firebase=JSON.parse(read("firebase.json"));
const rewrites=firebase.hosting?.rewrites||[];
assert(pkg.scripts?.["build:react"]==="vite build --config vite.react.config.js","build:react script missing");
assert(rewrites[0]?.source==="/react"&&rewrites[0]?.destination==="/react/index.html","/react rewrite missing");
assert(rewrites[1]?.source==="/react/**"&&rewrites[1]?.destination==="/react/index.html","/react/** rewrite missing");
for(const source of ["/cashier/**","/kitchen/**","/pos/**","/admin/**"])assert(rewrites.some(r=>r.source===source),`legacy rewrite lost: ${source}`);

const dict=JSON.parse(read("react-app/src/i18n/parity-translations.json"));
for(const locale of ["th","en","my","lo","km"]) {
  assert(dict?.[locale]?.home?.meta?.title==="PENGUIN",`home locale missing: ${locale}`);
  assert(Boolean(dict?.[locale]?.auth?.login?.staff_title),`login locale missing: ${locale}`);
  assert(Boolean(dict?.[locale]?.auth?.register?.title),`register locale missing: ${locale}`);
}
const translationValues=[];
const collectTranslationValues=value=>{
  if(typeof value==="string"){translationValues.push(value);return;}
  if(Array.isArray(value)){value.forEach(collectTranslationValues);return;}
  if(value&&typeof value==="object")Object.values(value).forEach(collectTranslationValues);
};
collectTranslationValues(dict);
assert(!translationValues.some(value=>/(LUKKAJA|KINJAI|Food Order\/Delivery With QR|Food Order Delivery|FOOD ORDER QR|\bFOD\b|\bKJ\b)/.test(value)),"visible legacy branding remains in React translations");
const app=read("react-app/src/app/App.jsx");
for(const route of ["/","/login","/register"])assert(app.includes(`path="${route}"`),`route missing: ${route}`);
for(const route of ["/cashier","/cashier/quick-order","/cashier/receipt","/cashier/table-qr","/cashier/waiting-queue"]) {
  assert(app.includes(`path="${route}"`),`cashier parity route missing: ${route}`);
}
assert(app.includes('path="/super-admin/saas-setup"'),"React SaaS Setup route missing");
const saasPage=read("react-app/src/pages/SaasSetupPage.jsx");
const saasService=read("react-app/src/data/saasMigrationService.js");
const saasFunctions=read("functions/saas-migration.js");
const functionsIndex=read("functions/index.js");
const saasTranslations=JSON.parse(read("react-app/src/i18n/saas-setup-master-translations.json"));
for(const locale of ["th","en","my","lo","km"]) assert(Boolean(saasTranslations?.[locale]?.meta?.title),`SaaS Setup MASTER locale missing: ${locale}`);
assert(saasPage.includes("SAAS_TARGET_TENANT")&&saasService.includes("inspectLegacySaasMigration")&&saasService.includes("migrateLegacySaasStore"),"SaaS Setup React callable bridge missing");
assert(saasFunctions.includes('profile.role !== "super_admin"')&&saasFunctions.includes('collection("shops")'),"SaaS migration must remain server-side and super-admin protected");
assert(functionsIndex.includes("inspectLegacySaasMigration")&&functionsIndex.includes("migrateLegacySaasStore"),"SaaS migration callables must be exported");
const platformSettingsService=read("react-app/src/data/platformSettingsService.js");
for(const name of [
  "getPlatformBranding","updatePlatformBranding","getPlatformGoogleApis","updatePlatformGoogleApis",
  "getPlatformSlipVerification","updatePlatformSlipVerification","testPlatformSlipVerification",
  "getPlatformLalamove","updatePlatformLalamove","testPlatformLalamove","registerPlatformLalamoveWebhook",
]) {
  if(name.includes("Branding")) continue;
  assert(platformSettingsService.includes(name),`Platform React service callable missing: ${name}`);
  assert(functionsIndex.includes(`exports.${name} = platformSettings.${name};`),`Platform callable not exported from functions/index.js: ${name}`);
}
const platformBrandingService=read("react-app/src/data/platformBrandingService.js");
for(const name of ["getPlatformBranding","updatePlatformBranding"]) {
  assert(platformBrandingService.includes(name),`Platform branding React callable missing: ${name}`);
  assert(functionsIndex.includes(`exports.${name} = platformSettings.${name};`),`Platform branding callable not exported from functions/index.js: ${name}`);
}
for(const name of [
  "updateTenantLalamoveApproval","getTenantLalamoveWallet","reviewTenantLalamoveWalletTopup",
  "getTenantLalamoveSettings","updateTenantLalamoveSettings","testTenantLalamoveConnection",
  "getOwnTenantLalamoveWallet","submitTenantLalamoveWalletTopup","deleteTenantLalamoveWalletTopup",
]) {
  assert(functionsIndex.includes(`exports.${name} = tenantLalamoveWallet.${name};`),`Tenant Lalamove callable not exported from functions/index.js: ${name}`);
}
const platformSettingsFunctions=read("functions/platform-settings.js");
assert(platformSettingsFunctions.includes('const LEGACY_SLIP2GO_API_URL = "https://connect.slip2go.com";')&&platformSettingsFunctions.includes("migration20260929Slip2GoApiUrlBackfilledAt"),"Slip2Go legacy API URL one-time migration guard missing");
assert(rewrites.some(r=>r.source==="/super-admin/saas-setup")&&rewrites.some(r=>r.source==="/super-admin/saas-setup/**"),"canonical SaaS Setup rewrites missing");
const cashierReceipt=read("react-app/src/pages/CashierReceiptPage.jsx");
for(const id of ["paperSize","printButton","receipt","receiptItems","receiptTotal","verifyQr","verifyCode"]) {
  assert(cashierReceipt.includes(`id="${id}"`),`cashier receipt MASTER id missing: ${id}`);
}
const cashierTableQr=read("react-app/src/pages/CashierTableQrPage.jsx");
for(const id of ["qrPaperSize","availableTables","occupiedTables","walkInTables","issuedQrWrap","issuedQr","printIssuedQr"]) {
  assert(cashierTableQr.includes(`id="${id}"`),`cashier table QR MASTER id missing: ${id}`);
}
for(const locale of ["th","en","my","lo","km"]) {
  assert(Boolean(dict?.[locale]?.cashier_documents?.receipt?.meta_title),`cashier receipt locale missing: ${locale}`);
  assert(Boolean(dict?.[locale]?.cashier_documents?.table_qr?.meta_title),`cashier table QR locale missing: ${locale}`);
}
assert(!app.includes("MigrationHome"),"migration preview must not be part of runtime");
assert(!app.includes("FoundationPage"),"foundation placeholder must not be part of runtime");
const auth=read("react-app/src/auth/AuthProvider.jsx"),tenant=read("react-app/src/tenant/TenantProvider.jsx");
assert(auth.replace(/\s+/g,"").includes('doc(db,"users",user.uid)'),"Firestore user profile contract missing");
assert(tenant.includes('doc(db, "tenants", profile.tenantId)')&&tenant.includes("onSnapshot(tenantRef"),"Firestore real-time tenant contract missing");
assert(tenant.includes("tenantAccessDecision(data, profile.role)")&&tenant.includes("ACCESS_RECHECK_MS"),"Tenant access must re-evaluate Firestore and time-based subscription state");
const authFlow=read("react-app/src/auth/authFlow.js");
assert(authFlow.includes("tenantAccessDecision(tenant, profile.role)")&&authFlow.includes("tenantAccessError(decision)"),"Login tenant access decision contract missing");
assert(
  authFlow.includes("AUTH_TRANSIENT_RETRY_MS = 700")
  &&authFlow.includes("transientFirebaseNetworkError")
  &&authFlow.includes("getDocWithTransientRetry")
  &&authFlow.includes("signInStaffWithTransientRetry")
  &&authFlow.includes("auth.currentUser")
  &&authFlow.includes('code.includes("network-request-failed")'),
  "Staff login must recover once from transient Firebase Auth/Firestore network errors"
);
assert(app.includes("RevenueShareSuspensionGuard")&&app.includes('to="/reports/revenue-share"'),"Revenue-share suspension redirect guard missing");
const revenueSharePage=read("react-app/src/pages/RevenueShareReportPage.jsx");
assert(revenueSharePage.includes("revenueShareSuspensionNotice")&&revenueSharePage.includes("revenue_share_report.suspension.missing_payment"),"Revenue-share suspension warning UI missing");
const revenueShareCss=read("react-app/public/parity/css/revenue-share-report.css");
assert(revenueShareCss.includes(".report-suspension-notice"),"Revenue-share report parity CSS/suspension banner missing");
assert(read("tools/sync-react-parity-assets.py").includes('"revenue-share-report.css"'),"Revenue-share CSS must be included in parity asset sync");
const reactIndex=read("react-app/index.html");
assert(reactIndex.includes("<title>PENGUIN</title>")&&!reactIndex.includes("<title>KINJAI</title>")&&!reactIndex.includes("<title>LUKKAJA</title>"),"React entry title must remain PENGUIN");
assert(reactIndex.includes("page-ready-overlay"),"Laravel-parity pre-React loading overlay missing");
assert(reactIndex.includes('/react/parity/css/app.css'),"global app.css must load on every React route");
const pageReadyCss=read("react-app/public/parity/css/page-ready-state.css");
assert(pageReadyCss.includes(".page-ready-spinner {")&&pageReadyCss.includes("display: block;")&&pageReadyCss.includes("box-sizing: border-box;"),"Page-ready spinner must keep a real 44x44 block box");
assert(pageReadyCss.includes(".page-ready-simple {")&&pageReadyCss.includes("justify-items: center;")&&pageReadyCss.includes("text-align: center;"),"React simple page-ready loader must remain centered");
const globalAppCss=read("react-app/public/parity/css/app.css");
assert(globalAppCss.includes(".brand-mark::after"),"global brand-mark pseudo element missing");
assert(globalAppCss.includes('content: "PG"'),"global compact brand fallback must be PG");
assert(globalAppCss.includes("align-items: center !important;")&&globalAppCss.includes("justify-content: center !important;"),"global FOD vertical centering contract missing");
const brandingRuntime=read("react-app/src/components/PlatformBrandingRuntime.jsx");
assert(brandingRuntime.includes(".brand-mark.platform-brand-image-target::after{content:none!important"),"branding image override must suppress fallback pseudo label");
const i18nProvider=read("react-app/src/i18n/I18nProvider.jsx");
assert(i18nProvider.includes("normalizeVisibleBranding")&&i18nProvider.includes('.replaceAll("LUKKAJA", "PENGUIN")')&&i18nProvider.includes('.replaceAll("KINJAI", "PENGUIN")')&&i18nProvider.includes('.replace(/\\bFOD\\b/g, "PG")')&&i18nProvider.includes('.replace(/\\bKJ\\b/g, "PG")'),"React runtime branding normalization missing");
const adminWorkspaceCss=read("react-app/public/parity/css/admin-workspace.css");
assert(adminWorkspaceCss.includes(".admin-card-toggle .app-icon::before"),"admin collapse icon centering rule missing");
assert(adminWorkspaceCss.includes("display: inline-flex !important;")&&adminWorkspaceCss.includes("justify-content: center !important;"),"admin collapse icon must stay centered");
const toastCss=read("react-app/public/parity/css/toast-system.css");
assert(toastCss.includes(".app-toast > .app-toast-message:first-child"),"iconless toast full-width fallback missing");
const waitingQueuePage=read("react-app/src/pages/WaitingQueuePage.jsx");
assert(waitingQueuePage.includes("app-toast-icon")&&waitingQueuePage.includes("app-toast-message"),"Waiting Queue toast must use standard icon + message structure");
assert(waitingQueuePage.includes("waiting-queue-number-wrap")&&waitingQueuePage.includes("waiting-table-match"),"Waiting Queue staff card markup must match Laravel structure");
assert(waitingQueuePage.includes("addDialogRef")&&waitingQueuePage.includes("dialog.showModal()")&&!waitingQueuePage.includes('open={addOpen}'),"Waiting Queue dialogs must use native showModal top layer like Laravel");
assert(waitingQueuePage.includes('wq("seat.open")')&&!waitingQueuePage.includes('wq("actions.seat")'),"Waiting Queue seat action must use the Laravel seat.open translation");
assert(waitingQueuePage.includes('noShow ? wq("actions.no_show") : wq("customer.cancel_queue")'),"Waiting Queue cancel prompt confirm button must say Cancel queue like Laravel MASTER");
assert(waitingQueuePage.includes('confirmIcon: noShow ? "person-x" : "check-circle"'),"Waiting Queue cancel prompt confirm action must not reuse the dismiss X icon");
const sweetDialogReact=read("react-app/src/components/sweetDialog.js");
assert(sweetDialogReact.includes("options.confirmIcon")&&sweetDialogReact.includes("options.cancelIcon"),"React sweet dialog explicit action-icon override contract missing");
assert(waitingQueuePage.includes("requestAnimationFrame")&&waitingQueuePage.includes("WAITING_TICKET_DIALOG_FAILED"),"Waiting Queue post-save dialog handoff must be guarded");
assert(waitingQueuePage.includes("setTicketQr(qrDataUrl(url, { size: 220, margin: 4 }))")&&!waitingQueuePage.includes("qrDataUrl(url, 220).then"),"Waiting Queue QR generation must use synchronous localQr API and never call .then() on the data URL string");
const waitingQueueI18n=read("react-app/src/i18n/waitingQueueI18n.js");
assert(waitingQueueI18n.includes("masterSelected")&&waitingQueueI18n.includes("masterTranslations?.[locale]"),"Waiting Queue translator must prefer MASTER translations");
assert(waitingQueueI18n.includes("nested(masterSelected, rawKey)"),"Waiting Queue MASTER translation lookup missing");
const validationUi=read("react-app/src/components/FormValidationUi.jsx");
assert(validationUi.includes("form.noValidate = true")&&validationUi.includes("bootstrap-invalid-feedback"),"Global Laravel-style React form validation layer missing");
assert(validationUi.includes('"#registerForm"')&&validationUi.includes("shared.validation.required"),"React validation exclusions/translations must match Laravel");
const adminPage=read("react-app/src/pages/AdminPage.jsx");
assert(adminPage.includes('form={isTable ? "tableForm" : "menuForm"}'),"Admin menu/table modal footer must submit the real form so validation runs");
assert(adminPage.includes('<form id="menuForm" className="grid" noValidate')&&adminPage.includes('<form id="tableForm" className="grid" noValidate'),"Admin menu/table forms must use shared validation UI instead of native browser bubbles");
const homePage=read("react-app/src/pages/HomePage.jsx");
const homeDashboardCss=read("react-app/public/parity/css/home-dashboard.css");
for(const key of ["kitchen","cashier","waiting_queue","admin","admin_users","pos","pos_catalog"]){
  assert(homePage.includes(`cardKey="${key}"`),`Home dashboard semantic card key missing: ${key}`);
  assert(homeDashboardCss.includes(`[data-dashboard-card="${key}"]`),`Home dashboard semantic color selector missing: ${key}`);
}
assert(homeDashboardCss.includes('--dash-icon-fg: #c2410c; --dash-icon-bg: #ffedd5;')&&homeDashboardCss.includes('--dash-icon-fg: #1d4ed8; --dash-icon-bg: #dbeafe;')&&homeDashboardCss.includes('--dash-icon-fg: #7c3aed; --dash-icon-bg: #ede9fe;'),"Home dashboard Kitchen/Cashier/Staff icon palettes must remain distinct");
assert(!homeDashboardCss.includes('.nav-card[href="/kitchen"]'),"Home dashboard colors must not depend on Laravel-only href routes");
assert(homePage.includes("const stylesReady = useParityPage")&&homePage.includes("|| !stylesReady"),"React Home must keep PageReadyOverlay active until Home-specific parity CSS is loaded");
assert(homePage.includes('<span className="brand-mark">PG</span>')&&homePage.includes('<span className="brand-label">{staff ? "PENGUIN" : "PENGUIN"}</span>'),"React Home visible brand must be PENGUIN / PG");
const posPage=read("react-app/src/pages/PosPage.jsx");
const posNavigation=read("react-app/src/components/PosNavigation.jsx");
const posData=read("react-app/src/data/retailPosData.js");
const posCatalogCss=read("react-app/public/parity/css/retail-pos-catalog.css");
const posBarcodeCss=read("react-app/public/parity/css/retail-pos-barcode-scanner.css");
const posDisplayLinkCss=read("react-app/public/parity/css/retail-pos-customer-display-link.css");
const posPaymentEnterCss=read("react-app/public/parity/css/retail-pos-payment-enter.css");
const posPromptpayPaymentCss=read("react-app/public/parity/css/retail-pos-promptpay-payment.css");
const developerPanel=read("react-app/src/components/AppDeveloperPanel.jsx");
const developerPanelCss=read("react-app/public/parity/css/app-version-badge-runtime.css");
const releaseConfig=read("react-app/src/config/release.js");
const parityFooter=read("react-app/src/components/ParityFooter.jsx");
const staticI18n=read("public/assets/js/i18n.js");
const staticUi=read("public/assets/js/ui.js");
const staticHome=read("public/index.html");
const staticHomeSession=read("public/assets/js/home-session-fa.js");
const staticAuthService=read("public/assets/js/auth-service.js");
const staticHomeTranslations=read("public/assets/js/home-translations.js");
const hostingRc=read(".firebaserc");
const reactFirebaseClient=read("react-app/src/firebase/client.js");
const staticFirebaseConfig=read("public/assets/js/firebase-config.js");
const messagingServiceWorker=read("public/firebase-messaging-sw.js");
const publicSignupFunction=read("functions/public-signup.js");
const staticDeliveryEntry=read("public/delivery/index.html");
const staticDeliveryAddresses=read("public/assets/js/delivery-addresses.js");
const staticCustomerProfileService=read("public/assets/js/customer-profile-service.js");
const publicFirebaseContext=read("public/assets/js/public-firebase-context.js");
const publicStorefrontService=read("public/assets/js/public-storefront-service.js");
const staticDataService=read("public/assets/js/data-service.js");
const deliveryCustomerAuthFunction=read("functions/delivery-customer-auth.js");
const firestoreRules=read("firestore.rules");
const storageRules=read("storage.rules");
const staticDeliveryStaffGuard=read("public/assets/js/delivery-staff-guard.js");
const staticDeliveryAddressesCss=read("public/assets/css/delivery-addresses.css");
const staticDeliveryRuntime=read("public/assets/js/delivery.js");
const publicTranslations=read("public/assets/js/public-translations.js");
const paritySync=read("tools/sync-react-parity-assets.py");
const cashierPage=read("react-app/src/pages/CashierPage.jsx");
const cashierRefreshCss=read("react-app/public/parity/css/cashier-refresh.css");
const adminQrPage=read("react-app/src/pages/AdminQrPage.jsx");
const menuQrCss=read("react-app/public/parity/css/menu-qr.css");
const adminRetailParity=read("react-app/public/parity/css/admin-retail-pos-parity.css");
const adminSalesRetailParity=read("react-app/public/parity/css/admin-sales-report-retail-pos-parity.css");
const parityStyleHook=read("react-app/src/hooks/useParityPage.jsx");
const pgHeaderPages=[
  "react-app/src/pages/AdminQrPage.jsx",
  "react-app/src/pages/AdminUsersPage.jsx",
  "react-app/src/pages/CashierPage.jsx",
  "react-app/src/pages/CashierReceiptPage.jsx",
  "react-app/src/pages/CashierTableQrPage.jsx",
  "react-app/src/pages/KitchenPage.jsx",
  "react-app/src/pages/QuickOrderPage.jsx",
].map(read);
assert(
  adminQrPage.includes('className="btn btn-sm admin-qr-header-back"')
  &&adminQrPage.includes('bi bi-arrow-left app-icon')
  &&adminQrPage.indexOf('admin-qr-header-back')<adminQrPage.indexOf('admin-qr-header-actions')
  &&menuQrCss.includes(".admin-qr-header-leading")
  &&menuQrCss.includes(".admin-qr-header-actions")
  &&menuQrCss.includes(".admin-qr-header-back .app-icon::before")
  &&menuQrCss.includes("place-items: center !important")
  &&menuQrCss.includes("vertical-align: middle !important"),
  "Admin QR Back action must stay icon-led, vertically centered, and left-aligned with the header brand"
);
assert(
  hostingRc.includes('"penguin-food"')&&!hostingRc.includes('"natchanon-food-order-delivery"')
  &&[reactFirebaseClient,staticFirebaseConfig,messagingServiceWorker].every(source=>source.includes('authDomain: "penguin-food.web.app"')&&!source.includes("natchanon-food-order-delivery.web.app"))
  &&publicSignupFunction.includes('const PUBLIC_APP_ORIGIN = "https://penguin-food.web.app"')
  &&!publicSignupFunction.includes("natchanon-food-order-delivery.web.app"),
  "PENGUIN production origin must stay canonical across Hosting, Firebase Auth, messaging, and signup links"
);
assert(functionsIndex.includes('exports.lalamoveWebhook = lalamoveWebhook.lalamoveWebhook'),"Lalamove Hosting webhook must stay exported from Functions index");
assert(
  staticDeliveryEntry.includes('class="card delivery-account-card"')
  &&staticDeliveryEntry.includes('id="customerLogoutButton"')
  &&staticDeliveryEntry.includes('bi bi-box-arrow-right app-icon')
  &&staticDeliveryAddresses.includes("customerLogoutButton.innerHTML = '<i class=\"bi bi-box-arrow-right app-icon\"")
  &&staticDeliveryAddresses.includes("customerLogoutButton.setAttribute('aria-label', logoutLabel)")
  &&!staticDeliveryAddresses.includes("currentStaff")
  &&!staticDeliveryAddresses.includes("staffSignedIn")
  &&staticDeliveryAddresses.includes("const showGoogle = !signedIn")
  &&publicFirebaseContext.includes('CUSTOMER_APP_NAME = "penguin-storefront-customer-v2"')
  &&publicFirebaseContext.includes('CUSTOMER_BROKER_APP_NAME = "penguin-google-customer-broker-v1"')
  &&publicFirebaseContext.includes("customerAuth = getAuth(customerApp)")
  &&publicFirebaseContext.includes("customerDb = getFirestore(customerApp)")
  &&publicFirebaseContext.includes("customerStorage = getStorage(customerApp)")
  &&publicFirebaseContext.includes('customerFunctions = getFunctions(customerApp, "asia-southeast1")')
  &&publicFirebaseContext.includes("customerBrokerAuth = getAuth(customerBrokerApp)")
  &&publicFirebaseContext.includes("customerBrokerFunctions = getFunctions(")
  &&staticCustomerProfileService.includes("signInWithPopup(")
  &&staticCustomerProfileService.includes("customerBrokerAuth")
  &&staticCustomerProfileService.includes("customerBrokerFunctions")
  &&!staticCustomerProfileService.includes("signInWithPopup(customerAuth")
  &&staticCustomerProfileService.includes("createDeliveryCustomerSession")
  &&staticCustomerProfileService.includes("signInWithCustomToken(customerAuth, customToken)")
  &&staticCustomerProfileService.includes("claims?.customerContext === true")
  &&staticCustomerProfileService.includes('user?.uid?.startsWith("cust_")')
  &&staticCustomerProfileService.includes("signOut(customerAuth)")
  &&staticCustomerProfileService.includes("customerProfileDoc(user.uid)")
  &&!staticCustomerProfileService.includes("loadGoogleCustomerLoginSetting")
  &&!staticCustomerProfileService.includes("getStaffSession")
  &&publicStorefrontService.includes("customerStorage")
  &&staticDataService.includes("const runtimeDb = publicCustomerRoute ? customerDb : db")
  &&staticDataService.includes("const runtimeStorage = publicCustomerRoute ? customerStorage : storage")
  &&deliveryCustomerAuthFunction.includes('const CUSTOMER_UID_PREFIX = "cust_"')
  &&deliveryCustomerAuthFunction.includes('sign_in_provider === "google.com"')
  &&deliveryCustomerAuthFunction.includes("customerContext: true")
  &&deliveryCustomerAuthFunction.includes("setCustomUserClaims")
  &&functionsIndex.includes("exports.createDeliveryCustomerSession = deliveryCustomerAuth.createDeliveryCustomerSession")
  &&firestoreRules.includes("function customerContext()")
  &&firestoreRules.includes("request.auth.token.get('customerContext', false) == true")
  &&firestoreRules.includes("function signedIn() { return authenticated() && !customerContext(); }")
  &&storageRules.includes("function customerContext()")
  &&storageRules.includes("return authenticated() && !customerContext();")
  &&staticDeliveryStaffGuard.includes("intentionally isolated from staff auth")
  &&!staticDeliveryStaffGuard.includes("googleLoginButton.hidden = true")
  &&staticDeliveryAddressesCss.includes("#customerLogoutButton")
  &&staticDeliveryAddressesCss.includes("position: absolute;")
  &&staticDeliveryAddressesCss.includes("top: 10px;")
  &&staticDeliveryAddressesCss.includes("right: 10px;")
  &&staticDeliveryAddressesCss.includes("background: transparent !important;")
  &&staticDeliveryAddressesCss.includes("border: 0 !important;"),
  "Delivery customer context must be isolated from staff identity, privileges, data, storage, and Functions"
);
assert(
  cashierPage.includes('className="cashier-hero-actions"')
  &&cashierPage.includes('className="btn cashier-hero-order-btn"')
  &&cashierPage.indexOf('cashier-hero-order-btn')<cashierPage.indexOf('cashier-action-bar')
  &&!cashierPage.match(/cashier-actions[\s\S]{0,260}quick-order/)
  &&cashierRefreshCss.includes(".cashier-hero-order-btn")
  &&cashierRefreshCss.includes("flex-direction: column"),
  "Cashier walk-in order action must stay inside the Hero and outside the takeaway action bar"
);
assert(posPage.includes("initialDataReady")&&posPage.includes("!initialDataReady"),"POS full-page readiness must wait for initial Firebase data");
assert(
  adminRetailParity.includes('content: "PG"')&&!adminRetailParity.includes('content: "KJ"')
  &&adminSalesRetailParity.includes('content: "PG"')&&!adminSalesRetailParity.includes('content: "KJ"')
  &&pgHeaderPages.every(page=>page.includes('<span className="brand-mark">PG</span>')&&!page.includes('<span className="brand-mark">FO</span>')),
  "React operational header fallback marks must stay PG"
);
assert(parityStyleHook.includes("REACT_RELEASE.build")&&parityStyleHook.includes("?v="),"React page parity CSS must be cache-busted by the release Build");
const releaseBuildMatch=releaseConfig.match(/build:\s*"([^"]+)"/);
assert(
  releaseConfig.includes('product: "PENGUIN"')
  &&releaseConfig.includes('version: "0.4.280"')
  &&releaseBuildMatch
  &&/^\d{4}\.\d{2}\.\d{2}\.\d{3}$/.test(releaseBuildMatch[1])
  &&parityFooter.includes("REACT_RELEASE.version")
  &&parityFooter.includes("REACT_RELEASE.build")
  &&developerPanel.includes("REACT_RELEASE.version")
  &&developerPanel.includes("REACT_RELEASE.build"),
  "React release identity must stay centralized across footer/developer surfaces"
);
assert(staticI18n.includes("globalThis.APP_I18N_DICTIONARIES")&&staticI18n.includes("activeDictionaries()")&&staticI18n.includes("app:i18n-configured"),"Static i18n must share dictionaries across cache-versioned module instances and publish configuration");
assert(staticUi.includes("localizedFooterText")&&staticUi.includes("data-static-app-footer")&&staticUi.includes("app:i18n-configured")&&staticUi.includes("footerFallback"),"Static footer must never expose raw translation keys while i18n is still configuring");
assert(staticUi.includes('./i18n.js?v=20261001-002')&&staticHomeSession.includes('./i18n.js?v=20261001-002')&&staticHome.includes('/assets/js/ui.js?v=20261001-002')&&staticHome.includes('/assets/js/home-session-fa.js?v=20261001-002'),"Static Home must keep one cache identity for shared i18n modules");
assert(["th","en","my","lo","km"].every(locale=>staticHome.includes(`data-locale-option="${locale}"`))&&["\"th\"","\"en\"","\"my\"","\"lo\"","\"km\""].every(locale=>staticHomeTranslations.includes(locale)),"Static Home language menu and translation payload must include all five supported locales");
assert(staticAuthService.includes('data-user-menu-key="${item.key}"')&&staticAuthService.includes('key: "table_qr"')&&staticAuthService.includes('key: "admin_users"'),"Static user menu must expose semantic keys so menu icon colors match React");
assert(staticHome.includes("data-home-session-ready")&&staticHomeSession.includes("finishHomeReady")&&staticHomeSession.includes("redirecting = true"),"Static Home must cover auth/session bootstrap with the loading overlay");
assert(read("react-app/src/pages/LoginPage.jsx").includes("const stylesReady = useParityPage")&&read("react-app/src/pages/LoginPage.jsx").includes("if (!stylesReady)")&&read("react-app/src/pages/LoginPage.jsx").includes("<PageReadyOverlay"),"React Login must keep the loading overlay until page CSS is ready");
const cashierReceiptPage=read("react-app/src/pages/CashierReceiptPage.jsx");
assert(cashierReceiptPage.includes('bi bi-arrow-left app-icon')&&cashierReceiptPage.includes('bi bi-check-lg app-icon')&&cashierReceiptPage.includes('id="printButton"'),"Cashier Receipt back/print action icons must match Laravel MASTER");
const packageJson=read("package.json");
const generatedBuildContract=read("tools/generated-react-build-contract.mjs");
assert(packageJson.includes('"verify:react-build": "node tools/generated-react-build-contract.mjs"')&&packageJson.includes("npm run verify:react-build"),"React postbuild must verify generated deploy artifacts");
assert(generatedBuildContract.includes("Cashier Receipt generated bundle is missing the Back arrow icon")&&generatedBuildContract.includes("Cashier Receipt generated bundle is missing the Print check icon")&&generatedBuildContract.includes("is stale: expected release Build"),"Generated React build contract must guard release identity and Receipt action icons");
assert(read("react-app/src/components/UserMenu.jsx").includes("loggingOut")&&read("react-app/src/components/UserMenu.jsx").includes("<PageReadyOverlay"),"React logout must show a blocking loading overlay before redirecting to Login");
assert(staticDeliveryEntry.includes('id="deliveryHeroStoreName"')&&!staticDeliveryEntry.includes('<span>PENGUIN</span></h1>')&&!staticDeliveryEntry.includes('<span>KINJAI</span></h1>')&&staticDeliveryRuntime.includes("renderDeliveryStoreHero")&&staticDeliveryRuntime.includes("settings?.shopName")&&staticDeliveryRuntime.includes("activeShop?.name"),"Delivery customer Hero must render the tenant store name, not the platform brand");
for(const key of ["calculating","fee_rule_missing","out_of_range","ready_with_limit","route_failed","store_location_missing","unavailable"]){
  const count=(publicTranslations.match(new RegExp(`"${key}"\\s*:`,"g"))||[]).length;
  assert(count===5,`Delivery distance translation must exist in all five public locales: ${key}`);
}
assert(posPage.includes('import { AppDeveloperPanel }')&&posPage.includes('"app-version-badge-runtime.css"')&&posPage.includes("<AppDeveloperPanel />"),"React POS floating Developer Panel must be mounted");
assert(developerPanel.includes("data-app-version-badge")&&developerPanel.includes("data-app-dev-panel")&&developerPanel.includes("Retail Cache Keys")&&developerPanel.includes("Firebase / Firestore")===false&&developerPanel.includes("REACT_RELEASE.dataService")&&developerPanel.includes("metaKey")&&developerPanel.includes('event.key === "Escape"')&&developerPanel.includes('onClick={() => setOpen(true)}\n      ></button>'),"React Developer Panel runtime diagnostics/keyboard controls/empty MASTER badge button missing");
assert(developerPanelCss.includes("z-index:2147483646")&&read("react-app/public/parity/css/ui-layer-stack.css").includes("--ui-layer-toast-z: 2147483647"),"Developer Panel must remain below the topmost toast layer");
assert(paritySync.includes('extract_runtime_css("app-version-badge.js", "app-version-badge-runtime.css")'),"Developer Panel CSS must remain sourced from Laravel MASTER runtime");
assert(posPage.includes('disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"]')&&read("react-app/src/hooks/useParityPage.jsx").includes("previousDisabledStyles"),"POS shell must suppress React global CSS that Laravel MASTER does not load");
assert(posPage.indexOf("<LocaleSwitcher")<posPage.indexOf("<PosNavigation")&&!posPage.includes("<UserMenu profile={profile} />"),"POS header actions must match MASTER order: display, locale, menu, without app UserMenu");
assert(posPage.includes('className="barcode-input-group tw:min-w-0"')&&posBarcodeCss.includes(".barcode-input-group .scan-barcode-btn")&&posBarcodeCss.includes("width:40px!important"),"POS barcode scanner must stay embedded at the right edge of the barcode field like MASTER");
assert(posPage.includes("bi-box-seam pos-context-icon")&&posPage.includes("bi-cart3 pos-context-icon")&&posPage.includes("bi-x-lg pos-context-icon")&&posPage.includes("bi-pause-circle pos-context-icon")&&posPage.includes("bi-receipt pos-context-icon")&&posPage.includes("bi-credit-card pos-context-icon"),"POS visible heading/action icons must match MASTER runtime icon treatment");
assert(posPage.includes('"pos-locale-switcher-placement.css"')&&posPage.includes('"retail-pos-tailwind-responsive.css"')&&paritySync.includes('"pos-locale-switcher-placement.css"')&&paritySync.includes('"retail-pos-tailwind-responsive.css"'),"POS shell/Responsive CSS must remain synced from Laravel MASTER");
assert(posPage.includes('"retail-pos-payment-enter.css"')&&!posPage.includes('"retail-pos-numeric-pad.css"')&&posPaymentEnterCss.includes("#paymentDialog:has(.payment-form.has-pos-pad)")&&posPaymentEnterCss.includes(".pos-number-pad-title{display:none!important}")&&posPromptpayPaymentCss.includes("width:min(840px,calc(100vw - 56px))!important"),"POS payment modal runtime CSS must match Laravel MASTER");
assert(posPage.includes('bi bi-credit-card pos-context-icon')&&posPage.includes('bi bi-x-lg pos-context-icon')&&paritySync.includes('extract_runtime_css("retail-pos-payment-enter.js"')&&paritySync.includes('extract_runtime_css("retail-pos-promptpay-payment.js"'),"POS payment modal runtime icons/CSS sync missing");
assert(!posPage.includes('paymentCompleteDialog')&&!posPage.includes('retail-pos-complete.css')&&!posPage.includes('completedSale')&&posPage.includes('paymentDialogRef.current?.close?.();')&&posPage.includes('resetSaleState();')&&posPage.includes('if (receiptSettings.autoPrint && sale?.id) openReceiptForSale(sale, { auto: true });'),"React POS post-payment flow must match current Laravel MASTER: close payment, reset sale, toast/optional auto-print, with no legacy complete dialog");
assert(posDisplayLinkCss.includes('a[href^="/pos/customer-display"]'),"React POS customer-display button must receive MASTER display-link styling");
const posCustomerDisplayPage=read("react-app/src/pages/PosCustomerDisplayPage.jsx");
assert(posCustomerDisplayPage.includes('disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"]')&&posCustomerDisplayPage.includes('"pos-locale-switcher-placement.css"')&&posCustomerDisplayPage.includes("data-pos-locale-switcher-target"),"POS Customer Display must use the Laravel POS shell CSS boundary");
assert(posCustomerDisplayPage.indexOf('id="customerDisplayFullscreen"')<posCustomerDisplayPage.indexOf('id="displayPairingCard"')&&posCustomerDisplayPage.indexOf('id="displayPairingCard"')<posCustomerDisplayPage.indexOf("<LocaleSwitcher"),"POS Customer Display header order must match MASTER: fullscreen, pairing QR, locale");
assert(posCustomerDisplayPage.includes("setPaymentQrSrc(localPaymentQr)")&&posCustomerDisplayPage.includes('hidden={!paymentQrSrc || Boolean(payment?.error) || paymentQrFailed}'),"POS Customer Display must fall back to local QR and keep the QR image element for MASTER-compatible hidden-state styling");
const posReceiptPage=read("react-app/src/pages/PosReceiptPage.jsx");
const posReceiptCss=read("react-app/public/parity/css/pos-receipt-page.css");
const posTaxInvoicePage=read("react-app/src/pages/PosTaxInvoicePage.jsx");
const posTaxInvoiceCss=read("react-app/public/parity/css/pos-tax-invoice-page.css");
assert(posReceiptPage.includes('id="taxInvoiceBtn"')&&posReceiptPage.includes('id="taxInvoiceDialog"')&&posReceiptPage.includes("waitForPrintReady")&&posReceiptPage.includes("/api/tax-buyer/lookup")&&posReceiptPage.includes("createPosTaxInvoice")&&posReceiptPage.includes("body>#root{display:block!important}"),"React POS receipt must match MASTER print-ready/full-tax-invoice flow and preserve React root during print");
assert(posReceiptCss.includes(".tax-dialog")&&posReceiptCss.includes("body > :not(.page)")&&paritySync.includes('"pos-receipt-page.css": source / "resources/views/migrated/pos__receipt.blade.php"'),"React POS receipt CSS/print isolation must remain sourced from Laravel MASTER");
assert(posData.includes("export async function createPosTaxInvoice")&&posData.includes("export async function getPosTaxInvoice")&&posData.includes('documentType: "TAX"')&&posData.includes('documentCollection: "taxInvoices"')&&posData.includes('status: "reserved"'),"React POS tax invoice Firestore/running-number parity missing");
assert(posTaxInvoicePage.includes("ITEMS_PER_PAGE = 20")&&posTaxInvoicePage.includes('className="tax-paper"')&&posTaxInvoicePage.includes("waitForPrintReady"),"React POS full tax invoice A4 print page parity missing");
assert(posTaxInvoiceCss.includes(".tax-paper")&&posTaxInvoiceCss.includes("@page{size:A4")&&paritySync.includes('"pos-tax-invoice-page.css": source / "resources/views/migrated/pos__tax_invoice.blade.php"'),"React POS tax invoice print CSS must remain sourced from Laravel MASTER");
for(const asset of ["thai-qr-payment.svg","promptpay.svg","thai-qr-payment-mark.png"]){
  assert(fs.existsSync(path.join(root,"public/assets/images/payment-branding",asset)),`POS Customer Display payment branding asset missing: ${asset}`);
  assert(paritySync.includes(`"${asset}"`),`POS Customer Display payment branding asset must stay synced from MASTER: ${asset}`);
}
assert(posData.includes("export async function loadPosCatalogOrder")&&posData.includes("export async function listPosSales")&&posData.includes('orderBy("createdAt", "desc")')&&posData.includes("limit(500)"),"POS catalog order/latest-500 sales ranking data sources missing");
const appRoutes=read("react-app/src/app/App.jsx");
assert(appRoutes.includes('import { PosCatalogPage } from "@/pages/PosCatalogPage";')&&appRoutes.includes('<Route path="/pos/catalog" element={<PosCatalogPage />} />'),"React POS Catalog route must be mounted");
assert(appRoutes.includes('import { PosTaxInvoicePage } from "@/pages/PosTaxInvoicePage";')&&appRoutes.includes('<Route path="/pos/tax-invoice" element={<PosTaxInvoicePage />} />'),"React POS tax invoice print route must be mounted");
assert(homePage.includes('href="/pos/catalog"'),"Home POS Catalog card must stay inside the React/Firebase route space");
assert(posPage.includes('const [activeCategory, setActiveCategory] = useState("quick")')&&posPage.includes('id="catalogTabs"')&&posPage.includes('data-renderer="catalog"'),"POS catalog tabs/runtime renderer parity missing");
assert(posPage.includes('className={\`product-card visual-card\${imageUrl ? " pos-product-card-image" : ""}\${soldOut ? " is-sold-out" : ""}\`}')&&posPage.includes("catalogRanking")&&posPage.includes("catalogCategoryRank"),"POS product cards/best-seller ordering must match Laravel catalog runtime");
assert(posPage.includes('className="pos-card-hover-info"')&&posPage.includes('className="pos-hover-stock"')&&posPage.includes('className="pos-hover-price"')&&!posPage.includes('title={\`\${product.name || t("pos.runtime.default_product")} •'),"POS product hover must match Laravel after-sale restore markup without the native title tooltip");
assert(posPage.includes("setRenderLimit(current => current + 99)")&&posPage.includes('id="catalogLoadMore"')&&posPage.includes('bi bi-plus-lg pos-context-icon')&&posPage.includes('data-icon-tone="emerald"'),"POS catalog 99-item load-more/icon parity missing");
assert(posPage.includes('await sweetAlert(t("pos.held.no_items_message")')&&posPage.includes('await sweetAlert(t("pos.held.saved_synced")')&&posPage.includes('className="held-bill-card"')&&posPage.includes("openHeldBills"),"POS held-bill SweetAlert/card/refresh parity missing");
assert(posNavigation.includes('tone: "emerald"')&&posNavigation.includes('tone: "blue"')&&posNavigation.includes('tone: "rose"')&&posNavigation.includes('tone: "violet"')&&posNavigation.includes('tone: "teal"')&&posNavigation.includes('tone: "orange"')&&posNavigation.includes('data-icon-tone={group.tone || "green"}')&&posNavigation.includes('data-icon-tone={item.tone || "green"}'),"POS navigation icon tones must match Laravel MASTER");
assert(posNavigation.includes("const roleLabel = useMemo")&&posNavigation.includes("pos_users.role_names.")&&posNavigation.includes("{roleLabel} •"),"POS navigation must render translated/custom role labels like Laravel MASTER");
assert(posCatalogCss.includes(".catalog-tabs")&&posCatalogCss.includes(".product-card.visual-card"),"Canonical Laravel POS catalog CSS missing from React parity assets");
assert(paritySync.includes('"retail-pos-catalog.css"'),"POS catalog CSS must remain sourced from Laravel MASTER parity sync");
const posProductsPage=read("react-app/src/pages/PosProductsPage.jsx");
const posProductsData=read("react-app/src/data/retailProductsData.js");
assert(appRoutes.includes('import { PosProductsPage } from "@/pages/PosProductsPage";')&&appRoutes.includes('<Route path="/pos/products" element={<PosProductsPage />} />'),"React POS Products route must be mounted");
assert(posNavigation.includes('key: "pos.products"')&&posNavigation.includes('href: "/pos/products"')&&read("react-app/src/pages/PosCatalogPage.jsx").includes('href="/pos/products"'),"Migrated POS product links must stay inside React/Firebase routes");
assert(posNavigation.includes('href: "/pos/sales"')&&posNavigation.includes('href: "/pos/tax-invoices"')&&posNavigation.includes('href: "/pos/returns"')&&posNavigation.includes('href: "/pos/shifts"')&&posNavigation.includes("translatedOrFallback"),"POS sales-group navigation must stay inside React and fall back to MASTER labels");
for(const [page,route] of [["PosSalesPage","/pos/sales"],["PosTaxInvoicesPage","/pos/tax-invoices"],["PosReturnsPage","/pos/returns"],["PosShiftsPage","/pos/shifts"]]) assert(appRoutes.includes(`import { ${page} }`)&&appRoutes.includes(`path="${route}"`),`React POS supporting route missing: ${route}`);
assert(posData.includes("export async function createPosReturn")&&posData.includes("export async function openPosShift")&&posData.includes("export async function closePosShift")&&posData.includes("export async function listPosTaxInvoices"),"POS sales-group Firestore operations missing");
assert(firestoreRules.includes("validPosOperationCounter")&&firestoreRules.includes("validPosOperationRunningNumber"),"POS return/shift running-number Firestore rules missing");
assert(posProductsPage.includes('id="productTableBody"')&&posProductsPage.includes('id="productCategoryManager"')&&posProductsPage.includes('id="productSortManager"')&&posProductsPage.includes('id="stockDialog"'),"POS Products product/category/sort/stock subsystems missing");
assert(posProductsPage.includes('import Sortable from "sortablejs";')&&posProductsPage.includes("animation: 120")&&posProductsPage.includes("delay: 80")&&posProductsPage.includes("touchStartThreshold: 4")&&posProductsPage.includes("scrollSensitivity: 60")&&posProductsPage.includes("scrollSpeed: 14"),"POS Products Sortable profile must match Laravel MASTER");
assert(posProductsPage.includes('hasPosPermission(profile, "pos.products.view_cost")')&&posProductsPage.includes('hasPosPermission(profile, "pos.products.clear_history")')&&posProductsPage.includes('tr("runtime.sort_no_permission")'),"POS Products action visibility/permission parity missing");
assert(posProductsData.includes('tenantCollection(id, "products")')&&posProductsData.includes('tenantCollection(id, "categories")')&&posProductsData.includes('tenantCollection(id, "stockMovements")')&&posProductsData.includes('tenantDoc(id, "settings", "catalog-order")'),"POS Products Firestore collection mapping missing");
assert(posProductsData.includes('type = "adjustment"')&&posProductsData.includes("runTransaction")&&posProductsData.includes("after === before")&&posProductsData.includes("_documentIds"),"POS Products stock/legacy-document safeguards missing");
assert(posProductsData.includes('tenants/${id}/product-images/${productId}/'),"POS product image storage path must match Storage rules");
for(const css of ["retail-products.css","retail-products-sort-manager.css","retail-product-categories.css","retail-product-merchandising.css"]) assert(paritySync.includes('"' + css + '"'),"POS Products CSS must remain sourced from Laravel MASTER: " + css);
assert(firestoreRules.includes("function tenantProductManagerRole")&&firestoreRules.includes("function tenantStockMovementRole")&&firestoreRules.includes("settingId == 'catalog-order' && tenantProductManagerRole(tenantId)"),"POS Products Firestore role/routing rules missing");
assert(storageRules.includes("['owner', 'admin', 'manager', 'super_admin']"),"POS product image Storage role parity missing");
const adminUsersPage=read("react-app/src/pages/AdminUsersPage.jsx");
const adminUsersCss=read("react-app/public/parity/css/admin-users.css");
assert(adminUsersPage.includes('className="btn btn-sm admin-users-header-back"')&&adminUsersPage.includes('bi bi-arrow-left app-icon'),"Admin Users back button must keep the left-arrow icon");
assert(
  adminUsersPage.includes('className="admin-users-header-leading"')
  &&adminUsersPage.indexOf('className="brand-mark"')<adminUsersPage.indexOf('admin-users-header-title')
  &&adminUsersPage.indexOf('admin-users-header-title')<adminUsersPage.indexOf('admin-users-header-back')
  &&adminUsersPage.indexOf('admin-users-header-back')<adminUsersPage.indexOf('data-header-actions'),
  "Admin Users mobile header must keep Logo first, title second, Back third, and account actions last"
);
assert(adminUsersPage.indexOf("<LocaleSwitcher")<adminUsersPage.indexOf("<UserMenu"),"Admin Users right actions must keep locale immediately before User Menu");
assert(adminUsersPage.includes("initialUsersReady")&&adminUsersPage.includes("!initialUsersReady"),"Admin Users full-page readiness must wait for the initial staff list");
assert(
  adminUsersCss.includes(".admin-users-header-leading")
  &&adminUsersCss.includes(".admin-users-header-title")
  &&adminUsersCss.includes("flex: 0 1 auto;")
  &&adminUsersCss.includes(".admin-users-page .app-header .app-header-actions")
  &&adminUsersCss.includes("margin-left: auto !important;")
  &&adminUsersCss.includes(".admin-users-header-back")
  &&adminUsersCss.includes("gap: 7px;")
  &&!adminUsersCss.includes("order: 99;"),
  "Admin Users header must keep Logo/title/Back clustered left and account actions pinned right"
);
assert(
  adminUsersPage.includes('className="user-mobile-list"')
  &&adminUsersPage.includes('className="staff-user-card"')
  &&adminUsersPage.includes('className="staff-user-card-fields"')
  &&adminUsersPage.includes('className="staff-user-card-footer"')
  &&adminUsersPage.includes('className="user-table-scroll user-desktop-table"')
  &&adminUsersCss.includes(".user-mobile-list")
  &&adminUsersCss.includes(".user-desktop-table")
  &&adminUsersCss.includes(".staff-user-card")
  &&adminUsersCss.includes(".staff-user-card-fields")
  &&adminUsersCss.includes(".staff-user-card-footer")
  &&adminUsersPage.includes("const isActive = draft.active !== false")
  &&adminUsersPage.includes('role="switch"')
  &&adminUsersPage.includes('className={"staff-user-switch" + (isActive ? " is-on" : " is-off")}')
  &&adminUsersPage.includes("active: !isActive")
  &&adminUsersCss.includes(".staff-user-switch.is-on")
  &&adminUsersCss.includes("background: #16a34a;")
  &&adminUsersCss.includes(".staff-user-switch.is-off")
  &&adminUsersCss.includes(".admin-users-header-back .app-icon::before")
  &&adminUsersCss.includes("vertical-align: middle !important")
  &&adminUsersCss.includes(".staff-user-avatar")
  &&adminUsersCss.includes("margin-top: 18px")
  &&adminUsersCss.includes("display: none;")
  &&adminUsersCss.includes(".staff-create-trigger"),
  "Admin Users must keep separate Mobile cards, isolated controlled switches, centered icons, and the untouched Desktop table"
);
assert(adminPage.includes('import Sortable from "sortablejs";'),"React Admin sort manager must use SortableJS like Laravel MASTER");
assert(adminPage.includes('handle: ".sort-handle"')&&adminPage.includes("animation: 120")&&adminPage.includes("delay: 80")&&adminPage.includes("delayOnTouchOnly: true")&&adminPage.includes("touchStartThreshold: 4")&&adminPage.includes("forceFallback: Boolean(touchDevice)")&&adminPage.includes("fallbackOnBody: Boolean(touchDevice)")&&adminPage.includes('fallbackClass: "sort-fallback"')&&adminPage.includes("scrollSensitivity: 60")&&adminPage.includes("scrollSpeed: 14"),"React Admin sort manager must preserve the low-latency touch movement profile");
assert(adminPage.includes("categorySortListRef")&&adminPage.includes("itemSortListRef")&&adminPage.includes("data-sort-category={name}")&&adminPage.includes("data-sort-menu-id={item.id}"),"React Admin sort lists must expose stable refs/data keys for SortableJS");
assert(adminPage.includes('className={"sort-item" + (selectedSortCategory === name ? " active-category" : "")}')&&adminPage.includes('className="btn"')&&adminPage.includes('onClick={() => setSelectedSortCategory(name)}'),"React Admin category sorting must separate the draggable row from the category-select button like Laravel MASTER");
assert(!adminPage.includes('type="button"\n                    className={"sort-item"')&&!adminPage.includes('onDragStart={() => setDragItem')&&!adminPage.includes("moveCategoryByDrop")&&!adminPage.includes("moveMenuByDrop"),"React Admin sort manager must not regress to clickable-row or HTML5-only drag/drop");

const adminTenantsPage=read("react-app/src/pages/AdminTenantsPage.jsx");
assert(adminTenantsPage.includes("initialTenantsReady")&&adminTenantsPage.includes('profile?.role === "super_admin" && !initialTenantsReady'),"Admin Tenants full-page readiness must wait for the initial tenant list");
const initialTenantEffect=adminTenantsPage.slice(adminTenantsPage.indexOf("// Critical page data starts immediately"),adminTenantsPage.indexOf("useEffect(() => {",adminTenantsPage.indexOf("// Critical page data starts immediately")+1));
assert(initialTenantEffect.indexOf("loadTenantList();")>=0&&initialTenantEffect.indexOf("loadTenantList();")<initialTenantEffect.indexOf("backfillTenantSubscriptions"),"Admin Tenants must start tenant loading before subscription backfill");
assert(adminTenantsPage.includes("loadTenantList({ silent: true })"),"Admin Tenants backfill refresh must remain silent after initial render");
const salesReportModernCss=read("react-app/public/parity/css/sales-report-modern.css");
const salesReportParityCss=read("react-app/public/parity/css/admin-sales-report-retail-pos-parity.css");
assert(salesReportModernCss.includes("width: min(1320px, 100%);"),"Sales Report desktop width contract missing");
assert(salesReportParityCss.includes("body.sales-report-workspace .sales-report-page")&&salesReportParityCss.includes("width: min(1320px, 100%);"),"Sales Report final parity bundle must preserve 1320px desktop width");
assert(cashierRefreshCss.includes("gap: 5px !important;")&&cashierRefreshCss.includes("transform: none;")&&cashierRefreshCss.includes("place-items: center;"),"Cashier top action-bar icon spacing/alignment parity missing");
const sharedIconsCss=read("react-app/public/parity/css/icons.css");
assert(sharedIconsCss.includes(".btn:has(> .app-icon + span):not(.btn-icon-only)")&&sharedIconsCss.includes(".btn:has(> i + span):not(.btn-icon-only)")&&sharedIconsCss.includes(".btn:has(> svg + span):not(.btn-icon-only)")&&sharedIconsCss.includes("gap: 7px;"),"Shared React icon/text button spacing contract missing");
const tableQrPage=read("react-app/src/pages/CashierTableQrPage.jsx");
const odWorkspaceCss=read("react-app/public/parity/css/order-delivery-workspace-theme.css");
assert(tableQrPage.includes('bodyClass: "order-delivery-workspace od-qr-page"'),"Cashier Table QR page must keep od-qr-page scope");
assert(tableQrPage.includes('to="/cashier"><i className="bi bi-arrow-left app-icon"'),"Cashier Table QR back button must keep the left-arrow icon");
assert(odWorkspaceCss.includes("@media (min-width: 1200px)")&&odWorkspaceCss.includes("body.od-qr-page .container")&&odWorkspaceCss.includes("width: min(1440px, calc(100% - 48px));"),"Cashier Table QR desktop container width contract missing");
assert(odWorkspaceCss.includes('body.od-qr-page :is(#availableTables, #occupiedTables, #walkInTables).grid-3')&&odWorkspaceCss.includes("grid-template-columns: repeat(4, minmax(0, 1fr));"),"Cashier Table QR desktop must render 4 cards per row");
const quickOrderCss=read("react-app/public/parity/css/quick-order.css");
assert(quickOrderCss.includes(".quick-held-actions .btn")&&quickOrderCss.includes("display: inline-flex;")&&quickOrderCss.includes("gap: 7px;"),"Quick Order held-bill buttons must preserve icon/text spacing");
const userMenu=read("react-app/src/components/UserMenu.jsx");
for(const key of ["home","waiting_queue","table_qr","admin","admin_users"]){
  assert(userMenu.includes(`key: "${key}"`)&&sharedIconsCss.includes(`[data-user-menu-key="${key}"]`),`User menu semantic palette key missing: ${key}`);
}
assert(userMenu.includes("data-user-menu-key={item.key}"),"React UserMenu must expose semantic menu keys");
assert(!sharedIconsCss.includes('.user-menu-link[href="/admin/users"]'),"User menu icon colors must not depend on Laravel-only href routes");
assert(userMenu.includes('import { createPortal } from "react-dom";')&&userMenu.includes("return createPortal(")&&userMenu.includes("document.body,"),"Owner password dialog must portal to document.body so fixed positioning uses the viewport, not the sticky/backdrop-filter header");
assert(userMenu.includes('className="owner-password-backdrop" data-ui-layer="modal"'),"Owner password dialog must participate in the shared modal layer policy");
assert(sharedIconsCss.includes(".owner-password-backdrop {")&&sharedIconsCss.includes(".owner-password-dialog {")&&sharedIconsCss.includes("z-index: var(--ui-layer-modal-z, 2147483000);"),"Owner password dialog shared CSS missing from parity icons.css");
const layerCss=read("react-app/public/parity/css/ui-layer-stack.css");
assert(layerCss.includes(".owner-password-backdrop,")&&layerCss.includes("--ui-layer-modal-z: 2147483000;")&&layerCss.includes("--ui-layer-dialog-z: 2147483600;")&&layerCss.includes("--ui-layer-toast-z: 2147483647;"),"Owner password modal must remain below SweetAlert and Toast layers");
assert(cashierPage.includes("bi bi-printer app-icon")&&cashierPage.includes("bi bi-x-circle app-icon"),"Cashier order action icons must use Laravel MASTER app-icon markup");
assert(cashierPage.includes("CashierOrderNotifier"),"Cashier Laravel order notifier parity missing");
assert(cashierPage.includes("CASHIER_INITIAL_LOAD_TIMEOUT")&&cashierPage.includes("watchOperationalOrders")&&!cashierPage.includes("loadOperationalSnapshot"),"Cashier must open from realtime orders and must not deadlock on the heavy snapshot");
const authProvider=read("react-app/src/auth/AuthProvider.jsx");
assert(authProvider.includes("AUTH_INITIAL_TIMEOUT_MS")&&authProvider.includes("PROFILE_TIMEOUT_MS")&&authProvider.includes("auth.authStateReady")&&authProvider.includes("resolveUser(auth.currentUser)"),"AuthProvider initial-state/profile timeout fail-safe missing");
const cashierNotifier=read("react-app/src/components/CashierOrderNotifier.jsx");
assert(cashierNotifier.includes('id="orderAlertButton"')&&cashierNotifier.includes("food_order_order_alerts_enabled"),"Cashier order alert button/preference contract missing");
const quickOrderPage=read("react-app/src/pages/QuickOrderPage.jsx");
assert(quickOrderPage.includes('data-category="__best__"')&&quickOrderPage.includes("BEST_SELLER_LIMIT = 12"),"Quick Order best-seller category parity missing");
assert(
  quickOrderPage.includes("quick-menu-info-overlay")
  &&quickOrderPage.includes("quick-menu-image")
  &&quickOrderPage.includes('className="quick-menu-name"')
  &&quickOrderPage.includes('className="quick-menu-category"')
  &&quickOrderPage.includes('className="quick-menu-price-badge"')
  &&quickOrderCss.includes(".quick-menu-info-overlay .quick-menu-name")
  &&quickOrderCss.includes(".quick-menu-info-overlay .quick-menu-category")
  &&quickOrderCss.includes(".quick-menu-info-overlay .quick-menu-price-badge")
  &&quickOrderCss.includes("font-weight: 400;")
  &&quickOrderCss.includes("font-weight: 800;"),
  "Quick Order menu cards must keep bold name, compact category, and bold price badge"
);
assert(quickOrderPage.includes('disabled={serviceType !== "dine_in"}')&&quickOrderPage.includes('{ display: "none" }'),"Quick Order takeaway mode must hide/disable table selection");
assert(read("react-app/src/pages/HomePage.jsx").includes("publicLanding"),"real home page missing");
assert(read("react-app/src/pages/LoginPage.jsx").includes("loginForm"),"real login page missing");
assert(read("react-app/src/pages/RegisterPage.jsx").includes("registerForm"),"real register page missing");
assert(fs.existsSync(path.join(root,"public/react/index.html")),"React build output missing");
const built=read("public/react/index.html");
assert(built.includes("/react/assets/"),"React build base path invalid");
assert(reactIndex.includes("lukkhaja_react_entry_recovery")&&read("react-app/src/main.jsx").includes("__lukkhajaReactEntryLoaded"),"React stale-entry self recovery missing");
const viteConfig=read("vite.react.config.js");
assert(viteConfig.includes("emptyOutDir: false"),"React build must preserve previous hashed entry bundles for already-open tabs");
const firebaseConfig=read("firebase.json");
assert(firebaseConfig.includes('\"source\": \"/react/**\"')&&firebaseConfig.includes("no-cache, no-store, must-revalidate"),"React hosting no-cache contract missing");
assert(!app.includes("WaitingQueueDebugBoundary"),"temporary Waiting Queue debug boundary must not ship");
console.log("React foundation contract: PASS");
