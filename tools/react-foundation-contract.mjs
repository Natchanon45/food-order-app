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

const publicTenantResolver=read("public/assets/js/public-tenant-resolver.js");
assert(
  publicTenantResolver.includes('font-family:"Kanit Local"')
  && publicTenantResolver.includes('url("/assets/fonts/Kanit-Regular.ttf")')
  && publicTenantResolver.includes('url("/assets/fonts/Kanit-SemiBold.ttf")')
  && publicTenantResolver.includes('--app-ui-font:"Kanit Local"')
  && !publicTenantResolver.includes("--system-font")
  && !publicTenantResolver.includes("system-ui")
  && publicTenantResolver.includes('class="storefront-state"')
  && publicTenantResolver.includes('class="storefront-state__store-name"')
  && publicTenantResolver.includes('doc(customerDb, "tenants", tenantId, "settings", "store")')
  && publicTenantResolver.includes('storeSnapshot.data()?.shopName')
  && publicTenantResolver.includes('const shopName = await configuredStoreName(tenant)')
  && publicTenantResolver.includes('id="storefrontUnavailableBack"')
  && publicTenantResolver.includes('id="storefrontUnavailableRetry"')
  && publicTenantResolver.includes('<path d="m15 18-6-6 6-6"></path>')
  && publicTenantResolver.includes('<path d="M20 4v7h-7"></path>'),
  "Public unavailable storefront must use Kanit, show the resolved store name, and keep icon actions"
);

const dict=JSON.parse(read("react-app/src/i18n/parity-translations.json"));
for(const locale of ["th","en","my","lo","km"]) {
  assert(dict?.[locale]?.home?.meta?.title==="PENGUIN",`home locale missing: ${locale}`);
  assert(Boolean(dict?.[locale]?.auth?.login?.staff_title),`login locale missing: ${locale}`);
  assert(Boolean(dict?.[locale]?.auth?.register?.title),`register locale missing: ${locale}`);
}
assert(
  dict?.th?.admin?.delivery_settings?.lalamove_save_account==="บันทึก"
  &&dict?.en?.admin?.delivery_settings?.lalamove_save_account==="Save",
  "Admin Lalamove save action must use the compact Laravel-parity label"
);
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
assert(
  revenueSharePage.includes("const displayHistoryPeriodLabel = value =>")
  &&revenueSharePage.includes('raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/)')
  &&revenueSharePage.includes('displayHistoryPeriodLabel(item.period?.label)'),
  "Revenue-share payment history daily labels must display YYYY-MM-DD as DD/MM/YYYY"
);
assert(
  revenueShareCss.includes(".revenue-share-hero .btn{flex:0 0 auto;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px")
  &&revenueShareCss.includes(".report-submit-slip{min-height:60px;margin-top:23px;padding-inline:18px;display:inline-flex;align-items:center;justify-content:center;gap:8px")
  &&revenueShareCss.includes(".revenue-share-hero .tenant-button-spinner,.report-submit-slip .tenant-button-spinner{margin-right:4px}"),
  "Revenue-share loading buttons must keep spinner/text spacing and vertical alignment"
);
assert(read("tools/sync-react-parity-assets.py").includes('"revenue-share-report.css"'),"Revenue-share CSS must be included in parity asset sync");
const reactIndex=read("react-app/index.html");
assert(reactIndex.includes("<title>PENGUIN</title>")&&!reactIndex.includes("<title>KINJAI</title>")&&!reactIndex.includes("<title>LUKKAJA</title>"),"React entry title must remain PENGUIN");
assert(reactIndex.includes("page-ready-overlay"),"Laravel-parity pre-React loading overlay missing");
assert(reactIndex.includes('/react/parity/css/app.css'),"global app.css must load on every React route");
const horizontalScrollRestore=read("public/assets/js/horizontal-scroll-restore.js");
assert(
  reactIndex.includes('/assets/js/horizontal-scroll-restore.js?v=20261002-002')
  &&horizontalScrollRestore.includes("function bindTouchDrag(element)")
  &&horizontalScrollRestore.includes("element.style.touchAction = 'pan-y'")
  &&horizontalScrollRestore.includes("element.addEventListener('touchmove'")
  &&horizontalScrollRestore.includes("{ passive: false }")
  &&horizontalScrollRestore.includes("bindTouchDrag(element);")
  &&horizontalScrollRestore.includes("function containsScrollableTarget(node)")
  &&horizontalScrollRestore.includes("if (!containsScrollableTarget(node)) return;"),
  "React horizontal-scroll helper must load globally, preserve touch drag support, and ignore unrelated DOM mutations"
);
const pageReadyCss=read("react-app/public/parity/css/page-ready-state.css");
assert(pageReadyCss.includes(".page-ready-spinner {")&&pageReadyCss.includes("display: block;")&&pageReadyCss.includes("box-sizing: border-box;"),"Page-ready spinner must keep a real 44x44 block box");
assert(pageReadyCss.includes(".page-ready-simple {")&&pageReadyCss.includes("justify-items: center;")&&pageReadyCss.includes("text-align: center;"),"React simple page-ready loader must remain centered");
const globalAppCss=read("react-app/public/parity/css/app.css");
assert(globalAppCss.includes(".brand-mark::after"),"global brand-mark pseudo element missing");
assert(globalAppCss.includes('content: "PG"'),"global compact brand fallback must be PG");
assert(globalAppCss.includes("align-items: center !important;")&&globalAppCss.includes("justify-content: center !important;"),"global FOD vertical centering contract missing");
const brandingRuntime=read("react-app/src/components/PlatformBrandingRuntime.jsx");
const platformPage=read("react-app/src/pages/PlatformPage.jsx");
const platformControlCenterCss=read("react-app/public/parity/css/platform-control-center.css");
assert(brandingRuntime.includes(".brand-mark.platform-brand-image-target::after{content:none!important"),"branding image override must suppress fallback pseudo label");
assert(
  brandingRuntime.includes("width:42px!important")
  && brandingRuntime.includes("height:42px!important")
  && brandingRuntime.includes("padding:3px!important")
  && brandingRuntime.includes("width:min(220px,84%)!important")
  && brandingRuntime.includes("height:110px!important")
  && brandingRuntime.includes("width:36px!important")
  && brandingRuntime.includes("width:min(190px,86%)!important")
  && brandingRuntime.includes("height:95px!important"),
  "Platform branding runtime must use square contained header icons and a wide login logo surface"
);
assert(
  brandingRuntime.includes("const hasBrandTarget = node =>")
  && brandingRuntime.includes("[...record.addedNodes].some(hasBrandTarget)"),
  "Platform branding observer must ignore unrelated realtime DOM mutations"
);
assert(
  platformPage.includes('recommendationKey: "logo_recommended"')
  && platformPage.includes('recommendationKey: "favicon_recommended"')
  && platformPage.includes('recommendationKey: "app_icon_recommended"')
  && platformPage.includes('className="platform-branding-size"')
  && platformPage.includes('platform-branding-item-${item.key}')
  && platformControlCenterCss.includes(".platform-branding-copy .platform-branding-size")
  && platformControlCenterCss.includes(".platform-branding-item-logo .platform-branding-preview"),
  "Super Admin Branding must show per-asset recommended dimensions"
);
for(const locale of ["th","en","my","lo","km"]){
  const branding=dict[locale]?.platform?.branding;
  assert(
    branding?.logo_recommended
    &&branding?.favicon_recommended
    &&branding?.app_icon_recommended,
    `Platform Branding recommended-size translations missing: ${locale}`
  );
}
const i18nProvider=read("react-app/src/i18n/I18nProvider.jsx");
assert(i18nProvider.includes("normalizeVisibleBranding")&&i18nProvider.includes('.replaceAll("LUKKAJA", "PENGUIN")')&&i18nProvider.includes('.replaceAll("KINJAI", "PENGUIN")')&&i18nProvider.includes('.replace(/\\bFOD\\b/g, "PG")')&&!i18nProvider.includes('.replaceAll("PENGUIN", "KINJAI")')&&!i18nProvider.includes('.replace(/\\bPG\\b/g, "KJ")'),"React runtime branding normalization missing");
const adminWorkspaceCss=read("react-app/public/parity/css/admin-workspace.css");
assert(adminWorkspaceCss.includes(".admin-card-toggle .app-icon::before"),"admin collapse icon centering rule missing");
assert(adminWorkspaceCss.includes("display: inline-flex !important;")&&adminWorkspaceCss.includes("justify-content: center !important;"),"admin collapse icon must stay centered");
const toastCss=read("react-app/public/parity/css/toast-system.css");
assert(toastCss.includes(".app-toast > .app-toast-message:first-child"),"iconless toast full-width fallback missing");
const waitingQueuePage=read("react-app/src/pages/WaitingQueuePage.jsx");
const waitingQueueDisplayPage=read("react-app/src/pages/WaitingQueueDisplayPage.jsx");
const waitingQueueCore=read("react-app/src/data/waitingQueueCore.js");
const waitingQueueCss=read("react-app/public/parity/css/waiting-queue.css");
assert(waitingQueuePage.includes("app-toast-icon")&&waitingQueuePage.includes("app-toast-message"),"Waiting Queue toast must use standard icon + message structure");
assert(
  waitingQueuePage.includes('className="waiting-header-leading"')
  &&waitingQueuePage.includes('<span>{wq("header.back")}</span>')
  &&waitingQueuePage.indexOf('className="brand"')<waitingQueuePage.indexOf('className="btn btn-dark btn-sm waiting-home-link"')
  &&waitingQueuePage.indexOf('className="btn btn-dark btn-sm waiting-home-link"')<waitingQueuePage.indexOf("<LocaleSwitcher />")
  &&waitingQueueCss.includes(".waiting-header-leading{display:flex;align-items:center;gap:8px")
  &&waitingQueueCss.includes(".waiting-app-header>.app-locale-switcher{margin-left:auto!important}")
  &&waitingQueueCss.includes(".waiting-home-link>.app-icon{width:1.15em;height:1.15em")
  &&waitingQueueCss.includes("place-items:center!important")
  &&waitingQueueCss.includes("vertical-align:middle!important")
  &&waitingQueueCss.includes(".waiting-home-link span{display:inline!important}")
  &&waitingQueueCss.includes(".waiting-header-leading .brand>.app-icon{margin-right:-3px}"),
  "Waiting Queue header must keep Brand + labeled Back clustered left, locale right, and the Back icon vertically centered"
);
assert(
  waitingQueuePage.includes('<span>{wq("hero.step_receive")}</span><i className="bi bi-chevron-right"></i>')
  &&waitingQueuePage.includes('<span>{wq("hero.step_call")}</span><i className="bi bi-chevron-right"></i>')
  &&waitingQueuePage.includes('<span>{wq("hero.step_table")}</span><i className="bi bi-chevron-right"></i>')
  &&waitingQueueCss.includes("body.waiting-queue-workspace .waiting-page-heading {")
  &&waitingQueueCss.includes("text-align: left;")
  &&waitingQueueCss.includes("body[data-module=\"waiting-queue\"] .waiting-flow {")
  &&waitingQueueCss.includes("flex-wrap: nowrap;")
  &&waitingQueueCss.includes("justify-content: flex-start;")
  &&waitingQueueCss.includes("body[data-module=\"waiting-queue\"] .waiting-flow i {")
  &&waitingQueueCss.includes("display: inline-grid;"),
  "Waiting Queue mobile Hero must align left and keep all four flow badges separated by visible chevrons"
);
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
assert(
  validationUi.includes("function containsValidationTarget(node)")
  && validationUi.includes("if (containsValidationTarget(node)) scan(node);"),
  "Global form validation observer must ignore unrelated realtime DOM mutations"
);
const adminPage=read("react-app/src/pages/AdminPage.jsx");
assert(
  adminPage.includes('const centralLalamoveMode = lalamoveForm.accountMode === "fod_central"')
  &&adminPage.includes('String(lalamove.platformApiKeyMasked || "")')
  &&adminPage.includes('String(lalamove.platformApiSecretMasked || "")')
  &&adminPage.includes('platform.slip_verification.receiver_account_types.${code}')
  &&adminPage.includes('{walletDestinationTypeLabel}')
  &&dict?.th?.platform?.slip_verification?.receiver_account_types?.["01014"]==="ธนาคารไทยพาณิชย์ (SCB)",
  "Admin central Lalamove masks and wallet destination bank-name parity are missing"
);
assert(
  adminPage.includes('id="lalamoveAccountCard"')
  &&adminPage.includes('id="lalamoveFodWalletTopupPanel"')
  &&adminPage.includes('className="admin-lalamove-wallet-topup-destination"')
  &&adminPage.includes('id="lalamoveFodWalletTopupAmount"')
  &&adminPage.includes('id="lalamoveFodWalletSlipPicker"')
  &&adminPage.includes('id="lalamoveFodWalletTopupSubmit"')
  &&adminPage.includes('className="admin-lalamove-wallet-credit-policy"')
  &&adminPage.includes('const walletTopupReady = Boolean(!walletLoadError && walletTopup.storageReady && walletTopup.allowed && walletDestination.configured);'),
  "Admin Lalamove central-wallet UI must retain Laravel top-up structure and readiness semantics"
);
const adminMasterVisualCss=read("react-app/public/parity/css/admin-react-master-visual.css");
assert(adminPage.includes('form={isTable ? "tableForm" : "menuForm"}'),"Admin menu/table modal footer must submit the real form so validation runs");
assert(adminPage.includes('<form id="menuForm" className="grid" noValidate')&&adminPage.includes('<form id="tableForm" className="grid" noValidate'),"Admin menu/table forms must use shared validation UI instead of native browser bubbles");
const adminMobileTableCss=read("react-app/public/parity/css/admin-mobile-table.css");
assert(
  adminPage.includes('className="admin-table-scroll admin-table-list-scroll" data-horizontal-scroll="true"')
  &&adminMobileTableCss.includes("body.admin-vr-page .admin-table-scroll")
  &&adminMobileTableCss.includes("overflow-x: auto !important;")
  &&adminMobileTableCss.includes("body.admin-vr-page .admin-table-list-scroll .table-list")
  &&adminMobileTableCss.includes("min-width: 600px !important;"),
  "Admin table list must keep a horizontally scrollable mobile viewport"
);
assert(
  adminPage.includes('className="admin-sales-report-spotlight"')
  &&adminPage.includes('className="admin-sales-report-spotlight__icon"')
  &&adminPage.includes('className="admin-sales-report-spotlight__content"')
  &&adminPage.includes('className="admin-sales-report-spotlight__action"')
  &&adminPage.includes('bi bi-eye')
  &&!adminPage.includes('bi bi-arrow-right-short admin-sales-report-spotlight__arrow')
  &&!adminMasterVisualCss.includes(".admin-sales-report-spotlight__arrow")
  &&!adminPage.includes('className="card admin-vr-card" style={{ marginBottom: 16 }} data-admin-card-role="sales-report"')
  &&adminMasterVisualCss.includes(".admin-sales-report-spotlight")
  &&adminMasterVisualCss.includes("grid-template-columns: 50px minmax(0, 1fr) auto;")
  &&adminMasterVisualCss.includes(".admin-sales-report-spotlight::after")
  &&adminMasterVisualCss.includes("content: none;")
  &&adminMasterVisualCss.includes("grid-template-columns: 42px minmax(0, 1fr) auto;"),
  "Admin Sales Report dashboard card must keep the dedicated flat spotlight design instead of generic layered admin-vr-card decoration"
);
const homePage=read("react-app/src/pages/HomePage.jsx");
const homeDashboardCss=read("react-app/public/parity/css/home-dashboard.css");
for(const key of ["kitchen","cashier","admin","admin_users","pos","pos_catalog"]){
  assert(homePage.includes(`cardKey="${key}"`),`Home dashboard semantic card key missing: ${key}`);
  assert(homeDashboardCss.includes(`[data-dashboard-card="${key}"]`),`Home dashboard semantic color selector missing: ${key}`);
}
assert(homeDashboardCss.includes('--dash-icon-fg: #c2410c; --dash-icon-bg: #ffedd5;')&&homeDashboardCss.includes('--dash-icon-fg: #1d4ed8; --dash-icon-bg: #dbeafe;')&&homeDashboardCss.includes('--dash-icon-fg: #7c3aed; --dash-icon-bg: #ede9fe;'),"Home dashboard Kitchen/Cashier/Staff icon palettes must remain distinct");
assert(!homeDashboardCss.includes('.nav-card[href="/kitchen"]'),"Home dashboard colors must not depend on Laravel-only href routes");
assert(homePage.includes("const stylesReady = useParityPage")&&homePage.includes("|| !stylesReady"),"React Home must keep PageReadyOverlay active until Home-specific parity CSS is loaded");
assert(homePage.includes('<span className="brand-mark">PG</span>')&&homePage.includes('<span className="brand-label">{staff ? "PENGUIN" : "PENGUIN"}</span>'),"React Home visible brand must be PENGUIN / PG");
assert(
  homePage.includes('className="dashboard-section dashboard-section-order-delivery"')
  &&!homePage.includes('cardKey="waiting_queue"')
  &&homeDashboardCss.includes(".dashboard-section-order-delivery .dashboard-section-head")
  &&homeDashboardCss.includes("grid-template-columns: max-content minmax(0, 1fr);")
  &&homeDashboardCss.includes("white-space: nowrap;")
  &&homeDashboardCss.includes("max-width: 210px;")
  &&homeDashboardCss.includes("text-wrap: balance;"),
  "React Home Order / Delivery header must stay one-line with a two-line-capable description and no Waiting Queue main card"
);
assert(
  waitingQueuePage.includes('<a className="btn btn-dark btn-sm waiting-home-link" href="/?from=waiting-queue"')
  &&!waitingQueuePage.includes('<Link className="btn btn-dark btn-sm waiting-home-link"'),
  "Waiting Queue Back must full-navigate with a fresh cache key to canonical static Home instead of rendering the alternate React Home route"
);
assert(
  waitingQueueCore.includes('rows => callback(rows.filter(row => normalizeString(row.queueDate) === toDateKey()))')
  &&waitingQueueDisplayPage.includes('const todayRows = useMemo(')
  &&waitingQueueDisplayPage.includes('String(row.queueDate || "") === todayKey')
  &&waitingQueueCore.includes("export async function cleanupStaleWaitingQueueProjections")
  &&waitingQueueCore.includes('row.active === true && normalizeString(row.queueDate) !== today')
  &&waitingQueuePage.includes("cleanupStaleWaitingQueueProjections(tenant.id)"),
  "Waiting Queue public board must ignore old queue dates and staff manager must deactivate stale public projections"
);
const posPage=read("react-app/src/pages/PosPage.jsx");
const posNavigation=read("react-app/src/components/PosNavigation.jsx");
const retailPosNavigation=read("public/assets/js/retail-pos-navigation.js");
const legacyPosThemeRuntime=read("public/assets/js/retail-pos-theme.js");
const posThemeConfig=read("react-app/src/config/posThemes.js");
const posThemeData=read("react-app/src/data/posThemeData.js");
const posThemeHook=read("react-app/src/hooks/usePosTheme.js");
const posThemesCss=read("react-app/public/parity/css/retail-pos-themes.css");
const legacyPosThemesCss=read("public/assets/css/retail-pos-themes.css");
const legacyPosSettingsHtml=read("public/pos/settings/index.html");
const legacyPosSettingsJs=read("public/assets/js/retail-pos-settings.js");
const legacyRetailReceiptSettings=read("public/assets/js/retail-sales-receipt-settings.js");
const posSettingsPage=read("react-app/src/pages/PosSettingsPage.jsx");
const posSettingsVisualCss=read("react-app/public/parity/css/retail-settings-visual-dashboard.css");
const posThemeTranslations=JSON.parse(read("react-app/src/i18n/parity-translations.json"));
const posUserProfile=read("react-app/src/components/PosUserProfile.jsx");
const retailPosSession=read("react-app/src/auth/retailPosSession.js");
const posData=read("react-app/src/data/retailPosData.js");
assert(
  posData.includes('const ids=["retailPos","store","tax","payment","receipt","loyalty","pos-theme"]')
  && posData.includes('const retailPos={id:"retailPos",type:"retail-pos"')
  && posData.includes('const rows=new Map([["retailPos",retailPos]')
  && !posData.includes('const rows=new Map([["store",store]')
  && posSettingsPage.includes('shopName: String(retailPos.shopName || DEFAULTS.shopName)')
  && posSettingsPage.includes('["retailPos", "tax", "payment", "receipt", "pos-theme"]')
  && legacyPosSettingsJs.includes('getRecord(RetailCollections.settings, "retailPos")')
  && legacyPosSettingsJs.includes('id: "retailPos"')
  && legacyRetailReceiptSettings.includes('getRecord(RetailCollections.settings, "retailPos")')
  && read("public/assets/js/public-storefront-service.js").includes('return String(settings?.shopName || "").trim();'),
  "Retail POS identity must use settings/retailPos while restaurant storefront remains on settings/store",
);
const posReturnsPage=read("react-app/src/pages/PosReturnsPage.jsx");
const posReturnsData=read("react-app/src/data/retailPosReturns.js");
const posReturnsVisualCss=read("react-app/public/parity/css/retail-returns-visual-dashboard.css");
const posShiftsPage=read("react-app/src/pages/PosShiftsPage.jsx");
const posShiftsData=read("react-app/src/data/retailPosShifts.js");
const posCatalogCss=read("react-app/public/parity/css/retail-pos-catalog.css");
const posBarcodeCss=read("react-app/public/parity/css/retail-pos-barcode-scanner.css");
const posMobileCartCss=read("react-app/public/parity/css/retail-mobile-cart-bar.css");
const posDisplayLinkCss=read("react-app/public/parity/css/retail-pos-customer-display-link.css");
const posNavigationCss=read("react-app/public/parity/css/retail-pos-navigation.css");
const posTaxInvoicesCss=read("react-app/public/parity/css/pos-tax-invoices-page.css");
const posTaxInvoicesVisualCss=read("react-app/public/parity/css/pos-tax-invoices-visual-dashboard.css");
const posShiftsCss=read("react-app/public/parity/css/retail-shifts.css");
const posShiftsVisualCss=read("react-app/public/parity/css/retail-shifts-visual-dashboard.css");
const posPaymentEnterCss=read("react-app/public/parity/css/retail-pos-payment-enter.css");
const posPromptpayPaymentCss=read("react-app/public/parity/css/retail-pos-promptpay-payment.css");
const developerPanel=read("react-app/src/components/AppDeveloperPanel.jsx");
const developerPanelCss=read("react-app/public/parity/css/app-version-badge-runtime.css");
const releaseConfig=read("react-app/src/config/release.js");
const parityFooter=read("react-app/src/components/ParityFooter.jsx");
const staticI18n=read("public/assets/js/i18n.js");
const staticUi=read("public/assets/js/ui.js");
const staticHome=read("public/index.html");
const staticPrivacyEntry=read("public/privacy/index.html");
const staticTermsEntry=read("public/terms/index.html");
const staticVerifyEntry=read("public/verify/index.html");
const staticVerifyRuntime=read("public/assets/js/verify.js");
const staticVerifyCss=read("public/assets/css/verify-page.css");
const staticBrandingRuntime=read("public/assets/js/platform-branding-runtime.js");
const staticHomeDashboardCss=read("public/assets/css/home-dashboard.css");
const staticPublicLandingRefreshCss=read("public/assets/css/public-landing-refresh.css");
const registerPageCss=read("react-app/public/parity/css/register-page.css");
const firebaseHostingConfig=read("firebase.json");
const staticHomeSession=read("public/assets/js/home-session-fa.js");
assert(
  staticHome.includes('class="dashboard-section dashboard-section-order-delivery"')
  &&!staticHome.includes('waiting-queue-home-card')
  &&!staticHome.includes('waiting-queue-entry.js')
  &&staticHomeDashboardCss.includes(".dashboard-section-order-delivery .dashboard-section-head")
  &&staticHomeDashboardCss.includes("grid-template-columns: max-content minmax(0, 1fr);")
  &&staticHomeDashboardCss.includes("white-space: nowrap;")
  &&staticHomeDashboardCss.includes("max-width: 210px;")
  &&staticHome.includes('get("from") === "waiting-queue"')
  &&staticHome.includes('history.replaceState(null, "", "/")')
  &&firebaseHostingConfig.includes('"source": "/"')
  &&firebaseHostingConfig.includes('"source": "/index.html"')
  &&firebaseHostingConfig.includes('"value": "no-cache, no-store, must-revalidate"'),
  "Canonical static Home must keep the requested layout, omit Waiting Queue, and never remain stale behind Hosting cache"
);
assert(
  staticHome.includes('/assets/js/platform-branding-runtime.js?v=20261005-130')
  &&staticBrandingRuntime.includes('doc(db, "platformSettings", "branding")')
  &&staticBrandingRuntime.includes("onAuthStateChanged(auth")
  &&staticBrandingRuntime.includes('applyBrandImage(".brand-mark", appIconUrl || logoUrl')
  &&staticBrandingRuntime.includes("width:42px!important")
  &&staticBrandingRuntime.includes("object-fit:contain!important"),
  "Canonical static Home must consume the shared Super Admin Branding App Icon instead of remaining PG-only"
);
const staticAuthService=read("public/assets/js/auth-service.js");
const staticHomeTranslations=read("public/assets/js/home-translations.js");
const hostingRc=read(".firebaserc");
const reactFirebaseClient=read("react-app/src/firebase/client.js");
const staticFirebaseConfig=read("public/assets/js/firebase-config.js");
const messagingServiceWorker=read("public/firebase-messaging-sw.js");
const publicSignupFunction=read("functions/public-signup.js");
const staticDeliveryEntry=read("public/delivery/index.html");
const staticDeliverySuccessEntry=read("public/delivery/success/index.html");
const staticDeliverySuccessRuntime=read("public/assets/js/delivery-success.js");
assert(
  [staticPrivacyEntry, staticTermsEntry, staticDeliveryEntry].every(source=>source.includes('/assets/js/platform-branding-runtime.js?v=20261005-130')),
  "Public Privacy, Terms, and Delivery headers must consume the shared Super Admin Branding runtime instead of staying PG-only"
);
assert(
  staticVerifyEntry.includes('class="verify-page"')
  &&staticVerifyEntry.includes('/assets/css/verify-page.css?v=20261005-133')
  &&staticVerifyEntry.includes('/assets/js/platform-branding-runtime.js?v=20261005-133')
  &&staticVerifyEntry.includes('/assets/js/verify.js?v=20261005-133')
  &&staticVerifyEntry.includes('<span class="brand-mark">PG</span>')
  &&staticVerifyRuntime.includes("tenantContext?.name")
  &&staticVerifyRuntime.includes("settings?.orderDeliveryShopName")
  &&staticVerifyRuntime.includes('class="verify-summary-grid"')
  &&staticVerifyRuntime.includes('class="verify-detail-panel"')
  &&staticVerifyRuntime.includes('class="verify-items-panel"')
  &&staticVerifyCss.includes(".verify-result-card")
  &&staticVerifyCss.includes(".verify-metric-total")
  &&staticVerifyCss.includes("linear-gradient(120deg,#0a392c")
  &&staticVerifyCss.includes("@media(max-width:480px)"),
  "Public Verify must use shared Branding, tenant-side store naming, and the responsive visual verification-card design"
);
assert(
  staticHome.includes('id="homePremiumAnnualPromo" hidden aria-hidden="true"')
  &&staticHome.includes('/assets/css/public-landing-refresh.css?v=20261005-130')
  &&staticPublicLandingRefreshCss.includes("#homePremiumAnnualPromo")
  &&staticPublicLandingRefreshCss.includes(".public-feature-card:nth-child(1)")
  &&staticPublicLandingRefreshCss.includes("linear-gradient(118deg,#0a3c2c")
  &&staticPublicLandingRefreshCss.includes("overflow-x:clip"),
  "Unauthenticated Home must hide the annual promo block and keep the colorful public landing refresh"
);
assert(
  registerPageCss.includes(".register-header>.btn")
  &&registerPageCss.includes("margin-left:10px")
  &&registerPageCss.includes(".old-price-slash")
  &&registerPageCss.includes("text-decoration-color:#dc2626")
  &&registerPageCss.includes("text-decoration-thickness:3px"),
  "Register must keep header action spacing and the red strike-through on the original annual price"
);
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
const staticDeliveryPagination=read("public/assets/js/dom-menu-pagination.js");
const publicI18nBootstrap=read("public/assets/js/public-i18n-bootstrap.js");
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
  functionsIndex.includes("exports.quotePublicLalamoveDelivery = lalamoveDispatch.quotePublicLalamoveDelivery")
  &&publicStorefrontService.includes('httpsCallable(customerFunctions, "quotePublicLalamoveDelivery")')
  &&publicStorefrontService.includes("getLalamoveQuotation")
  &&staticDeliveryRuntime.includes("function usesLalamove()")
  &&staticDeliveryRuntime.includes("dataService.getLalamoveQuotation")
  &&staticDeliveryRuntime.includes('deliveryProvider: usesLalamove() ? "lalamove" : "self"')
  &&staticDeliveryRuntime.includes('"lalamove_quotation"')
  &&staticDeliveryRuntime.includes("lalamoveDispatchQuote"),
  "Public Delivery must use a live Lalamove quotation when the tenant selects Lalamove"
);
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
  &&staticDeliveryEntry.includes('class="delivery-account-user-row"')
  &&staticDeliveryAddressesCss.includes(".delivery-account-user-row {")
  &&staticDeliveryAddressesCss.includes("align-items: center;")
  &&staticDeliveryAddressesCss.includes("justify-content: space-between;")
  &&staticDeliveryAddressesCss.includes("#customerAccount:not([hidden])")
  &&staticDeliveryAddressesCss.includes("#customerLogoutButton")
  &&staticDeliveryAddressesCss.includes("position: static;")
  &&staticDeliveryAddressesCss.includes("align-self: center;")
  &&staticDeliveryAddressesCss.includes("flex: 0 0 30px;")
  &&!staticDeliveryAddressesCss.includes("top: 10px;")
  &&!staticDeliveryAddressesCss.includes("right: 10px;")
  &&staticDeliveryAddressesCss.includes("background: transparent !important;")
  &&staticDeliveryAddressesCss.includes("border: 0 !important;"),
  "Delivery customer context must be isolated from staff identity, privileges, data, storage, and Functions"
);
assert(
  cashierPage.includes('className="cashier-hero-title-row"')
  &&cashierPage.includes('className="cashier-hero-actions"')
  &&cashierPage.includes('className="btn cashier-hero-order-btn"')
  &&cashierPage.includes('translated(t, "quick_order.entry.short_button", t("kitchen.actions.accept"))')
  &&cashierPage.indexOf('cashier-hero-order-btn')<cashierPage.indexOf('cashier-action-bar')
  &&!cashierPage.match(/cashier-actions[\s\S]{0,260}quick-order/)
  &&cashierRefreshCss.includes(".cashier-hero-title-row")
  &&cashierRefreshCss.includes("justify-content: space-between;")
  &&cashierRefreshCss.includes("white-space: nowrap;")
  &&cashierRefreshCss.includes(".cashier-hero-order-btn")
  &&!cashierRefreshCss.includes("flex-direction: column"),
  "Cashier walk-in order action must stay inside the Hero, share the title row, and use the short order label"
);
assert(posPage.includes("initialDataReady")&&posPage.includes("!initialDataReady"),"POS full-page readiness must wait for initial Firebase data");
assert(
  adminRetailParity.includes('content: "PG"')&&!adminRetailParity.includes('content: "KJ"')
  &&adminSalesRetailParity.includes('content: "PG"')&&!adminSalesRetailParity.includes('content: "KJ"')
  &&pgHeaderPages.every(page=>page.includes('<span className="brand-mark">PG</span>')&&!page.includes('<span className="brand-mark">KJ</span>')&&!page.includes('<span className="brand-mark">FO</span>')),
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
assert(
  staticDeliveryEntry.includes('id="deliveryHeroStoreName"')
  &&!staticDeliveryEntry.includes('<span>PENGUIN</span></h1>')
  &&!staticDeliveryEntry.includes('<span>KINJAI</span></h1>')
  &&staticDeliveryEntry.includes('/assets/js/delivery.js?v=20261006-144')
  &&staticDeliveryRuntime.includes("renderDeliveryStoreHero")
  &&staticDeliveryRuntime.includes("dataService.getOrderDeliveryShopName(settings)")
  &&publicStorefrontService.includes("getOrderDeliveryShopName(settings = {})")
  &&publicStorefrontService.includes('return String(settings?.shopName || "").trim();')
  &&!publicStorefrontService.includes('tenant?.name\n      || settings?.orderDeliveryShopName\n      || settings?.shopName'),
  "Delivery customer Hero must use settings/store.shopName only and must not fall back to the Super Admin tenant name"
);
assert(
  staticDeliverySuccessEntry.includes('/assets/js/platform-branding-runtime.js?v=20261005-131')
  &&staticDeliverySuccessEntry.includes('/assets/js/delivery-success.js?v=20261005-136')
  &&staticDeliverySuccessRuntime.includes("./public-storefront-service.js?v=20261005-136")
  &&staticDeliverySuccessRuntime.includes('dataService.getOrderDeliveryShopName(settings)')
  &&staticDeliverySuccessEntry.includes('<span class="brand-mark">PG</span>'),
  "Delivery Success must apply shared Super Admin Branding and use settings/store.shopName through the same storefront resolver"
);
assert(
  !staticDeliveryPagination.includes("common.pagination.")
  &&staticDeliveryPagination.includes('"delivery.checkout.menu.previous_page"')
  &&staticDeliveryPagination.includes('"delivery.checkout.menu.next_page"')
  &&staticDeliveryPagination.includes('"delivery.checkout.menu.page_aria"')
  &&staticDeliveryPagination.includes('"delivery.checkout.menu.page_summary"')
  &&staticDeliveryPagination.includes("value === key ? fallback : value")
  &&(publicTranslations.match(/"page_summary"\s*:/g)||[]).length>=10
  &&staticDeliveryEntry.includes('/assets/js/public-i18n-bootstrap.js?v=20261002-007')
  &&staticDeliveryEntry.includes('/assets/js/dom-menu-pagination.js?v=20261002-001')
  &&publicI18nBootstrap.includes('./public-translations.js?v=20261002-007'),
  "Delivery pagination must use Delivery-localized copy with a fallback and must never expose raw common.pagination keys"
);
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
assert(posPage.includes("const scanHandledRef = useRef(false)")&&posPage.includes("if (!code || scanHandledRef.current) return;")&&posPage.includes("currentQuantity >= stock")&&posPage.includes("if (addProductByCode(code))")&&posPage.includes('showToast(t("pos_products.scanner.success"))')&&!posPage.includes('showToast("สแกนบาร์โค้ดสำเร็จ")'),"POS sale scanner must emit exactly one typed Toast result per camera scan and only show success after a real cart add");
assert(posPage.includes("bi-box-seam pos-context-icon")&&posPage.includes("bi-cart3 pos-context-icon")&&posPage.includes("bi-x-lg pos-context-icon")&&posPage.includes("bi-pause-circle pos-context-icon")&&posPage.includes("bi-receipt pos-context-icon")&&posPage.includes("bi-credit-card pos-context-icon"),"POS visible heading/action icons must match MASTER runtime icon treatment");
assert(posPage.includes('"pos-locale-switcher-placement.css"')&&posPage.includes('"retail-pos-tailwind-responsive.css"')&&paritySync.includes('"pos-locale-switcher-placement.css"')&&paritySync.includes('"retail-pos-tailwind-responsive.css"'),"POS shell/Responsive CSS must remain synced from Laravel MASTER");
assert(posPage.includes('"retail-mobile-cart-bar.css"')&&posPage.includes('data-mobile-cart-bar')&&posPage.includes('data-mobile-cart-drawer')&&posPage.includes('data-mobile-cart-checkout')&&posPage.includes('data-mobile-cart-hold')&&posPage.includes('data-mobile-cart-held')&&posPage.includes('setMobileCartOpen(true)')&&posPage.includes('openPayment();')&&posPage.includes('holdBill();')&&posPage.includes('openHeldBills();'),"React POS must expose the Laravel-style mobile/tablet sale cart drawer with checkout/hold/held-bill actions");
assert(posMobileCartCss.includes("@media(max-width:1023px)")&&posMobileCartCss.includes(".mobile-cart-secondary-actions")&&posMobileCartCss.includes("@media(min-width:601px) and (max-width:1023px)")&&paritySync.includes('extract_runtime_css("retail-mobile-cart-bar.js", "retail-mobile-cart-bar.css")'),"React POS mobile cart CSS must stay sourced from current Laravel MASTER through 1023px");
for(const locale of ["th","en","my","lo","km"]){const mobileCart=dict[locale]?.pos?.mobile_cart;assert(mobileCart?.title&&mobileCart?.view_bill,`React POS mobile cart translations missing: ${locale}`);}
assert(posPage.includes('"retail-pos-payment-enter.css"')&&!posPage.includes('"retail-pos-numeric-pad.css"')&&posPaymentEnterCss.includes("#paymentDialog:has(.payment-form.has-pos-pad)")&&posPaymentEnterCss.includes(".pos-number-pad-title{display:none!important}")&&posPromptpayPaymentCss.includes("width:min(840px,calc(100vw - 56px))!important"),"POS payment modal runtime CSS must match Laravel MASTER");
assert(posPage.includes('bi bi-credit-card pos-context-icon')&&posPage.includes('bi bi-x-lg pos-context-icon')&&paritySync.includes('extract_runtime_css("retail-pos-payment-enter.js"')&&paritySync.includes('extract_runtime_css("retail-pos-promptpay-payment.js"'),"POS payment modal runtime icons/CSS sync missing");
assert(!posPage.includes('paymentCompleteDialog')&&!posPage.includes('retail-pos-complete.css')&&!posPage.includes('completedSale')&&posPage.includes('paymentDialogRef.current?.close?.();')&&posPage.includes('resetSaleState();')&&posPage.includes('if (receiptSettings.autoPrint && sale?.id) openReceiptForSale(sale, { auto: true });'),"React POS post-payment flow must match current Laravel MASTER: close payment, reset sale, toast/optional auto-print, with no legacy complete dialog");
assert(posDisplayLinkCss.includes('a[href^="/pos/customer-display"]'),"React POS customer-display button must receive MASTER display-link styling");
const posCustomerDisplayPage=read("react-app/src/pages/PosCustomerDisplayPage.jsx");
const legacyPosCustomerDisplayHtml=read("public/pos/customer-display/index.html");
const legacyPosCustomerDisplay=read("public/assets/js/retail-customer-display.js");
const legacyPosI18nBootstrap=read("public/assets/js/retail-pos-i18n-bootstrap.js");
const legacyPosTranslations=read("public/assets/js/retail-pos-translations.js");
const legacyPosCustomerDisplayCss=read("public/assets/css/retail-customer-display.css");
const reactPosCustomerDisplayCss=read("react-app/public/parity/css/retail-customer-display.css");
const customerDisplayQrConsistencyCss=read("react-app/public/parity/css/retail-customer-display-qr-consistency.css");
assert(posCustomerDisplayPage.includes('disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"]')&&posCustomerDisplayPage.includes('"pos-locale-switcher-placement.css"')&&posCustomerDisplayPage.includes("data-pos-locale-switcher-target"),"POS Customer Display must use the Laravel POS shell CSS boundary");
assert(posCustomerDisplayPage.indexOf('id="customerDisplayFullscreen"')<posCustomerDisplayPage.indexOf('id="displayPairingCard"')&&posCustomerDisplayPage.indexOf('id="displayPairingCard"')<posCustomerDisplayPage.indexOf("<LocaleSwitcher"),"POS Customer Display header order must match MASTER: fullscreen, pairing QR, locale");
assert(posCustomerDisplayPage.includes("setPaymentQrSrc(localPaymentQr)")&&posCustomerDisplayPage.includes('hidden={!paymentQrSrc || Boolean(payment?.error) || paymentQrFailed}'),"POS Customer Display must fall back to local QR and keep the QR image element for MASTER-compatible hidden-state styling");
assert(posCustomerDisplayPage.includes('typeof value?.toMillis === "function"')&&posCustomerDisplayPage.includes('Date.parse(String(value))')&&!posCustomerDisplayPage.includes('hidden={snapshot?.status !== "paid"}'),"React POS Customer Display must normalize Firestore/string timestamps and keep the MASTER thank-you strip visible");
assert(legacyPosCustomerDisplay.includes("import { qrDataUrl } from './local-qr.js?v=20260722-037'")&&legacyPosCustomerDisplay.includes("payment.payload")&&legacyPosCustomerDisplay.includes("qrDataUrl(payment.payload")&&legacyPosCustomerDisplay.includes("timestampMillis(snapshot.updatedAt)")&&legacyPosCustomerDisplay.includes("els.paidState.hidden = false"),"Legacy POS Customer Display must render PromptPay payload locally, normalize timestamps, and keep the MASTER thank-you strip visible");
assert(legacyPosCustomerDisplayHtml.includes('class="total-summary"')&&legacyPosCustomerDisplayHtml.includes('retail-customer-display-responsive.css')&&legacyPosCustomerDisplayHtml.includes('retail-customer-display-qr-consistency.css')&&legacyPosCustomerDisplayHtml.includes('class="thai-qr-payment-header"')&&legacyPosCustomerDisplayHtml.includes('class="promptpay-brand"')&&legacyPosCustomerDisplayHtml.includes('class="thai-qr-center-mark"')&&!legacyPosCustomerDisplayHtml.includes('id="paidState" class="paid-state" hidden'),"Legacy POS Customer Display must keep the Laravel MASTER total-summary/Thai QR Payment frame and visible thank-you strip");
assert(legacyPosCustomerDisplayCss.includes(".thai-qr-payment-header")&&legacyPosCustomerDisplayCss.includes(".promptpay-brand-logo")&&legacyPosCustomerDisplayCss.includes(".thai-qr-center-mark")&&reactPosCustomerDisplayCss.includes(".thai-qr-payment-header"),"POS Customer Display Thai QR Payment frame CSS missing");
assert(["th","en","my","lo","km"].every(locale=>legacyPosI18nBootstrap.includes(`data-locale-option="${locale}"`))&&legacyPosI18nBootstrap.includes('if (locale !== "th")')&&legacyPosTranslations.includes('"my": {')&&legacyPosTranslations.includes('"lo": {')&&legacyPosTranslations.includes('"km": {'),"Legacy POS locale switcher must expose and translate all five system locales");
assert(!legacyPosCustomerDisplayHtml.includes('bi-arrows-fullscreen" aria-hidden="true"></i><span>')&&!legacyPosCustomerDisplay.includes("pairing-toggle-copy")&&!posCustomerDisplayPage.includes("pairing-toggle-copy"),"POS Customer Display top-right actions must be icon-only like Laravel MASTER");
assert(customerDisplayQrConsistencyCss.includes(".display-header-button,")&&customerDisplayQrConsistencyCss.includes(".pairing-toggle {")&&customerDisplayQrConsistencyCss.includes("border-radius: 14px !important;"),"POS Customer Display icon-only action sizing / thank-you lower-corner parity missing");
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
assert(posNavigation.includes("const roleLabel = useMemo")&&posNavigation.includes("pos_users.role_names.")&&posNavigation.includes("<PosUserProfile profile={posProfile} roleLabel={roleLabel} />")&&posNavigation.includes("getRetailPosSession()")&&retailPosSession.includes("export function getRetailPosSession()")&&posUserProfile.includes('className="pos-menu-user"')&&posUserProfile.includes("bi bi-person-circle pos-menu-user-icon")&&posUserProfile.includes("<strong>{name}</strong>")&&posUserProfile.includes("role}{email ?"),"React POS User Profile must preserve the legacy POS session/name/role/email structure");
assert(posNavigation.includes('import { createPortal } from "react-dom";')&&posNavigation.includes("createPortal(")&&posNavigation.includes("document.body) : null")&&posNavigation.includes('bi bi-house pos-context-icon')&&posNavigation.includes('data-icon-tone="emerald"'),"React POS drawer must portal to document.body like legacy and render the central-home icon explicitly");
assert(posNavigationCss.includes(".pos-menu-panel{background:#f8fbf9;color:var(--black);"),"React POS drawer must keep explicit dark text even when mounted from a white-text header context");
assert(posNavigation.includes('data-menu-tone={group.tone || "green"}')&&posNavigation.includes('aria-current={item.key === currentKey ? "page" : undefined}')&&posNavigation.includes('bi bi-chevron-right pos-menu-link-chevron'),"React POS Modern Card v2 navigation must preserve group tone, active-page semantics, and submenu chevrons");
assert(retailPosNavigation.includes('data-menu-tone="${esc(group.tone || "green")}"')&&retailPosNavigation.includes('bi bi-chevron-right pos-menu-link-chevron')&&retailPosNavigation.includes('aria-current="page"'),"Legacy POS Modern Card v2 navigation must preserve group tone, active-page semantics, and submenu chevrons");
assert(posNavigationCss.includes("POS menu Modern Card v2.1")&&posNavigationCss.includes("width:min(420px,96vw)!important")&&posNavigationCss.includes("min-height:54px!important")&&posNavigationCss.includes("min-height:45px!important")&&posNavigationCss.includes("background:linear-gradient(90deg,#bfeccc 0%,#d9f5e2 100%)!important")&&posNavigationCss.includes(".pos-menu-link.is-current")&&posNavigationCss.includes("grid-template-columns:31px minmax(0,1fr) 16px!important"),"POS Modern Card v2.1 CSS must keep the approved wider/taller/stronger-color sizing and active submenu treatment");
assert(posNavigationCss.includes("POS menu Modern Card v2.2")&&posNavigationCss.includes("flex:1 1 0%!important")&&posNavigationCss.includes("height:0!important")&&posNavigationCss.includes("overflow-y:auto!important")&&posNavigationCss.includes("overflow-x:hidden!important")&&posNavigationCss.includes("scrollbar-gutter:stable")&&posNavigationCss.includes("flex:0 0 auto!important")&&posNavigationCss.includes("safe-area-inset-bottom"),"POS Modern Card v2.2 must keep header/profile/home/footer fixed while only the center navigation scrolls");
assert(posNavigationCss.includes("POS menu Modern Card v2.3")&&posNavigationCss.includes("display:flex!important")&&posNavigationCss.includes("flex-direction:column!important")&&posNavigationCss.includes("align-items:stretch!important")&&posNavigationCss.includes("height:auto!important")&&posNavigationCss.includes("min-height:0!important"),"POS Modern Card v2.3 must stack expanded cards by natural height instead of CSS Grid tracks so cards cannot overlap");
assert(posNavigationCss.includes(".pos-menu-footer #posLogoutBtn{")&&posNavigationCss.includes("column-gap:12px!important"),"POS drawer logout button must keep visible spacing between its icon and label");
assert(posNavigation.includes("scrollOpenedGroupIntoView")&&posNavigation.includes("data-menu-group-card={group.id}")&&posNavigation.includes('scrollIntoView({ block: "nearest", behavior: "smooth" })'),"React POS multi-open drawer must auto-scroll newly opened groups into the visible nav area");
assert(retailPosNavigation.includes('data-menu-group-card="${esc(group.id)}"')&&retailPosNavigation.includes('group.scrollIntoView({ block: "nearest", behavior: "smooth" })'),"Legacy POS multi-open drawer must auto-scroll newly opened groups into the visible nav area");

const posThemeIds=["minimal-clean","modern-card","section-sidebar","summary","dark-hitech"];
assert(posThemeConfig.includes('DEFAULT_POS_THEME = "modern-card"')&&legacyPosThemeRuntime.includes("DEFAULT_POS_THEME = 'modern-card'"),"POS theme system must preserve Modern Card as the backward-compatible default");
for(const themeId of posThemeIds){
  assert(posThemeConfig.includes(`id: "${themeId}"`),`React POS theme option missing: ${themeId}`);
  assert(legacyPosThemeRuntime.includes(`id: '${themeId}'`),`Legacy POS theme option missing: ${themeId}`);
  assert(posSettingsPage.includes(`POS_THEME_OPTIONS.map`),`React POS Settings must render the shared theme option catalog: ${themeId}`);
}
assert(posThemeHook.includes("loadPosThemeSetting")&&posThemeHook.includes("readCachedPosTheme")&&posThemeHook.includes("pos-theme-applied"),"React POS theme hook must apply cached tenant theme immediately and reconcile the Firestore setting");
assert(posThemeData.includes('POS_THEME_SETTINGS_ID = "pos-theme"')&&posThemeData.includes('doc(db, "tenants"')&&posThemeData.includes('"settings", POS_THEME_SETTINGS_ID')&&posThemeData.includes("savePosThemeSetting"),"React POS theme preference must use tenant-scoped settings/pos-theme");
assert(legacyPosThemeRuntime.includes("POS_THEME_SETTINGS_ID = 'pos-theme'")&&legacyPosThemeRuntime.includes("getRecord(RetailCollections.settings, POS_THEME_SETTINGS_ID)")&&legacyPosThemeRuntime.includes("document.documentElement.dataset.posTheme"),"Legacy POS theme runtime must read tenant settings/pos-theme and apply a document-level theme token");
assert(posData.includes('["retailPos","store","tax","payment","receipt","loyalty","pos-theme"]')&&posData.includes('const posTheme={id:"pos-theme",type:"pos-theme"')&&posData.includes('["pos-theme",posTheme]')&&posData.includes("options.sections")&&posData.includes("return loadPosStoreSettings(tenantId)"),"React POS Store Settings load/save must persist the retail identity, tenant theme, and permission-scoped settings writes");
assert(legacyPosSettingsJs.includes('id: "pos-theme"')&&legacyPosSettingsJs.includes('type: "pos-theme"')&&legacyPosSettingsJs.includes("saveSettingsDocumentsLocalFirst")&&legacyPosSettingsJs.includes("applyPosTheme(themeSettings.theme)"),"Legacy POS Settings must save the tenant theme through the existing local-first settings sync and apply it immediately");
assert(legacyPosSettingsHtml.includes('/react/assets/index-')&&!legacyPosSettingsHtml.includes('id="storeSettingsForm"'),"Canonical /pos/settings shell must be cut over to React instead of retaining the legacy settings form");
assert(posSettingsPage.includes('className="pos-theme-picker"')&&posSettingsPage.includes('name="posTheme"')&&posSettingsPage.includes('tr("theme.note")'),"React POS Settings must expose the translated five-card theme picker");
assert(posSettingsPage.includes('applyPosTheme(value, tenant?.id, { cache: false })')&&posSettingsPage.includes("applyPosTheme(next.posTheme, tenant.id)")&&legacyPosSettingsJs.includes('applyPosTheme(normalizePosTheme(event.target.value), { cache: false })')&&legacyPosSettingsJs.includes('applyPosTheme(themeSettings.theme)'),"POS theme preview must stay temporary until Save while saved theme changes update the persistent cache");
assert(posSettingsPage.includes("getRetailPosSession")&&posSettingsPage.includes('pagePermissions.has("pos.settings")')&&posSettingsPage.includes("firstAllowedPosPage(posAccessProfile, roleRows)")&&posSettingsPage.includes("<PageReadyOverlay"),"Canonical React POS Settings must preserve POS session/permission routing and full-page readiness");
assert(posSettingsPage.includes('...(canEditStore ? ["retailPos", "tax", "payment", "receipt", "pos-theme"] : [])')&&posSettingsPage.includes('...(canEditLoyalty ? ["loyalty"] : [])')&&posSettingsPage.includes('sections: ["retailPos", "tax", "payment", "receipt", "pos-theme"]'),"React POS Settings save/reset must preserve granular retail-store-vs-loyalty permission boundaries");
assert(posSettingsPage.includes('sweetConfirm(tr("actions.reset_confirm"), {')&&posSettingsPage.includes('confirmIcon: "arrow-clockwise"')&&!posSettingsPage.includes("sweetConfirm({"),"React POS Settings reset must use the shared app confirmation dialog with the real message argument");
assert(posSettingsPage.includes('className="settings-visual-hero"')&&posSettingsPage.includes('className="settings-card-grid"')&&posSettingsPage.includes('className="settings-preview-layout"')&&posSettingsVisualCss.includes("linear-gradient(120deg,#083b2d")&&posSettingsVisualCss.includes(".settings-card-grid{display:grid")&&posSettingsVisualCss.includes("@media(max-width:620px)"),"React POS Settings must keep the approved colorful responsive Control Center visual structure");
assert(posThemesCss.includes('html[data-pos-theme="minimal-clean"]')&&posThemesCss.includes('html[data-pos-theme="section-sidebar"]')&&posThemesCss.includes('html[data-pos-theme="summary"]')&&posThemesCss.includes('html[data-pos-theme="dark-hitech"]'),"React POS theme stylesheet must implement themes 1, 3, 4, and 5 while Modern Card inherits the approved v2.3 base");
assert(legacyPosThemesCss.includes('html[data-pos-theme="minimal-clean"]')&&legacyPosThemesCss.includes('html[data-pos-theme="section-sidebar"]')&&legacyPosThemesCss.includes('html[data-pos-theme="summary"]')&&legacyPosThemesCss.includes('html[data-pos-theme="dark-hitech"]'),"Legacy POS theme stylesheet must match the React theme catalog");
assert(posThemesCss.includes(".pos-theme-summary{")&&posThemesCss.includes('html[data-pos-theme="summary"] .pos-theme-summary')&&posThemesCss.includes('display:grid!important'),"Theme 4 must reveal its summary dashboard only when the Summary theme is active");
assert(posNavigation.includes('posTheme !== "section-sidebar"')&&posNavigation.includes("setOpenGroups(new Set(groups.map(group => group.id)))")&&retailPosNavigation.includes('activeTheme === "section-sidebar"')&&retailPosNavigation.includes("expandAllThemeGroups"),"Theme 3 must keep all permitted groups visible as a sectioned sidebar on React and legacy POS");
assert(posNavigation.includes('posTheme !== "summary"')&&posNavigation.includes("loadPosThemeSummary")&&retailPosNavigation.includes('activeTheme === "summary"')&&retailPosNavigation.includes("refreshThemeSummary"),"Theme 4 summary data must load lazily only for the Summary theme");
assert(posNavigation.includes('permissions.has("pos.sales")')&&posNavigation.includes('permissions.has("pos.products")')&&posThemeData.includes("includeSales ? listPosSales")&&posThemeData.includes("includeProducts ? listRetailProducts"),"React Theme 4 summary must query only datasets the POS role is allowed to view");
assert(retailPosNavigation.includes('hasPermission("pos.sales")')&&retailPosNavigation.includes('hasPermission("pos.products")')&&legacyPosThemeRuntime.includes("includeSales ? listRecords(RetailCollections.sales)")&&legacyPosThemeRuntime.includes("includeProducts ? listRecords(RetailCollections.products)"),"Legacy Theme 4 summary must preserve POS permission boundaries before reading sales/product metrics");
assert(!posThemeData.includes("deleteDoc(")&&!posThemeData.includes("runTransaction(")&&!legacyPosThemeRuntime.includes("saveRecord("),"POS menu theme rendering/summary data must remain read-only apart from the explicit settings/pos-theme save path");
assert(firestoreRules.includes("match /settings/{settingId} { allow read: if true; allow create, update, delete: if (tenantAdminRole(tenantId)")&&firestoreRules.includes("settingId != 'lalamove'")&&firestoreRules.includes("settingId != 'lalamoveWallet'"),"Existing tenant settings Rules must continue to allow admins to save pos-theme without a Rules deployment");
for(const locale of ["th","en","my","lo","km"]){
  const catalog=posThemeTranslations[locale];
  assert(catalog?.pos_settings?.theme?.title&&catalog?.pos_settings?.theme?.description&&catalog?.pos_settings?.theme?.note,`POS Settings theme translations incomplete: ${locale}`);
  assert(catalog?.pos_settings?.printing?.ask&&["kicker","hero_description","store_status","vat_status","promptpay_status","loyalty_status","ready","needs_setup","editable","read_only","loyalty_description","save_failed","reset_title","cancel","saving"].every(key=>catalog?.pos_settings?.visual?.[key]),`React POS Settings Control Center translations incomplete: ${locale}`);
  for(const key of ["minimal_clean","modern_card","section_sidebar","summary","dark_hitech"]){
    assert(catalog?.pos_theme?.options?.[key]?.name&&catalog?.pos_theme?.options?.[key]?.description,`POS theme option translation missing: ${locale} ${key}`);
  }
  for(const key of ["title","subtitle","loading","today_sales","bill_count","in_stock","load_failed"]){
    assert(catalog?.pos_theme?.summary?.[key],`POS Theme 4 summary translation missing: ${locale} ${key}`);
  }
}

const legacyPosSaleMaster=read("tests/fixtures/retail-pos-legacy/pos-index.html");
assert(legacyPosSaleMaster.includes('id="productGrid"')&&legacyPosSaleMaster.includes('id="cartList"')&&legacyPosSaleMaster.includes('id="payBtn"')&&legacyPosSaleMaster.includes('id="paymentDialog"'),"Retail POS sale legacy MASTER fixture must preserve the pre-React root UI/action inventory");
const legacyPosSalesMaster=read("tests/fixtures/retail-pos-legacy/pos-sales-index.html");
assert(legacyPosSalesMaster.includes('id="salesTableBody"')&&legacyPosSalesMaster.includes('id="saleDialog"')&&legacyPosSalesMaster.includes('id="exportCsvBtn"')&&legacyPosSalesMaster.includes('id="printReceiptBtn"'),"Retail POS sales-history legacy MASTER fixture must preserve the pre-React UI/action inventory");
const legacyPosTaxInvoicesMaster=read("tests/fixtures/retail-pos-legacy/pos-tax-invoices-index.html");
const posTaxInvoicesPage=read("react-app/src/pages/PosTaxInvoicesPage.jsx");
const legacyPosTaxInvoiceIds=[...legacyPosTaxInvoicesMaster.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
assert(legacyPosTaxInvoiceIds.length>=52&&legacyPosTaxInvoiceIds.includes("taxInvoiceList")&&legacyPosTaxInvoiceIds.includes("lateTaxInvoiceDialog")&&legacyPosTaxInvoiceIds.includes("taxProfileDialog")&&legacyPosTaxInvoiceIds.includes("voidTaxInvoiceDialog")&&legacyPosTaxInvoiceIds.includes("editTaxBuyerDialog"),"Retail POS tax-invoice-history legacy MASTER fixture must preserve the pre-React UI/action inventory");
for(const id of legacyPosTaxInvoiceIds) assert(posTaxInvoicesPage.includes(`id="${id}"`),`React POS tax-invoice-history legacy ID missing: ${id}`);
assert(posTaxInvoicesPage.includes("getRetailPosSession")&&posTaxInvoicesPage.includes('posPermissions.has("pos.tax_invoices")')&&posTaxInvoicesPage.includes("firstAllowedPosPage(posAccessProfile)")&&posTaxInvoicesPage.includes("/pos/login/?next="),"React POS tax-invoice-history session/permission parity missing");
assert(posTaxInvoicesPage.includes("/assets/js/retail-pos-full-tax-invoice.js?v=20260716-017")&&posTaxInvoicesPage.includes("syncPendingTaxInvoices")&&posTaxInvoicesPage.includes("syncTaxBuyerProfiles")&&posTaxInvoicesPage.includes("createFullTaxInvoiceFromSale")&&posTaxInvoicesPage.includes("voidFullTaxInvoice")&&posTaxInvoicesPage.includes("retryTaxInvoiceSync")&&posTaxInvoicesPage.includes("updateLocalTaxInvoiceBuyer"),"React POS tax-invoice-history must retain the production tax sync/offline behavior bridge");
assert(posTaxInvoicesPage.includes('import { sweetConfirm } from "@/components/sweetDialog";')&&posTaxInvoicesPage.includes('"sweet-dialog.css"')&&posTaxInvoicesPage.includes('title: t("shared.dialog.confirm_title")')&&!posTaxInvoicesPage.includes("window.confirm("),"Canonical React Tax Invoice History must use the app sweet confirmation dialog instead of a browser-native confirm");
assert(!posTaxInvoicesPage.includes('className="btn btn-secondary" href="/pos/"')&&posTaxInvoicesPage.includes('data-pos-supporting-header')&&posTaxInvoicesPage.includes('bi bi-receipt pos-context-icon')&&posTaxInvoicesPage.includes('bi bi-bookmark-star pos-context-icon')&&posTaxInvoicesPage.includes('["all","all","x-circle","rose"]')&&posTaxInvoicesPage.includes('["remote","remote_only","sliders","slate"]'),"React POS tax-invoice visual controls/icons must match the current task2 reference");
assert(posTaxInvoicesCss.includes(".tax-invoices-page .shell{width:100%;max-width:none;margin:0;padding:26px 18px 38px}"),"React POS tax-invoice desktop shell must keep the full-width base layout");
assert(posTaxInvoicesPage.includes('"pos-tax-invoices-visual-dashboard.css"')&&posTaxInvoicesPage.includes('className="tax-visual-hero"')&&posTaxInvoicesPage.includes('className="tax-timeline"')&&posTaxInvoicesPage.includes('className="tax-health-ring"')&&posTaxInvoicesPage.includes("const visualStats = useMemo")&&posTaxInvoicesPage.includes("const taxTimeline = useMemo"),"React POS tax-invoice Tax Document Control Center structure missing");
assert(posTaxInvoicesPage.includes('data-tax-status={invoice.status === "void" ? "void" : "issued"}')&&posTaxInvoicesPage.includes("data-tax-sync={syncFilterForInvoice(invoice)}"),"React POS tax-invoice document cards must expose visual status/sync state without changing actions");
assert(posTaxInvoicesVisualCss.includes("linear-gradient(125deg,#073c2c")&&posTaxInvoicesVisualCss.includes("conic-gradient(#10b981")&&posTaxInvoicesVisualCss.includes(".tax-timeline-bar")&&posTaxInvoicesVisualCss.includes(".tax-workspace-panel .list")&&posTaxInvoicesVisualCss.includes("grid-template-columns:repeat(2,minmax(0,1fr))")&&posTaxInvoicesVisualCss.includes("@media(max-width:760px)"),"React POS tax-invoice colorful Visual Analytics responsive styling missing");
assert(posTaxInvoicesVisualCss.includes(".tax-invoices-page .pos-header .header-actions{")&&posTaxInvoicesVisualCss.includes("flex-wrap:nowrap!important")&&posTaxInvoicesVisualCss.includes(".tax-invoices-page .pos-header #refreshBtn>span")&&posTaxInvoicesVisualCss.includes(".tax-invoices-page .pos-header #posMenuTrigger .pos-menu-trigger-label")&&posTaxInvoicesVisualCss.includes("flex:0 0 40px!important"),"React POS tax-invoice mobile header must keep Refresh/Locale/Menu on one icon-only row");
const legacyPosReturnsMaster=read("tests/fixtures/retail-pos-legacy/pos-returns-index.html");
const legacyPosReturnIds=[...legacyPosReturnsMaster.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
assert(legacyPosReturnIds.length===21&&legacyPosReturnIds.includes("returnSaleSearch")&&legacyPosReturnIds.includes("returnEditorPanel")&&legacyPosReturnIds.includes("returnHistory")&&legacyPosReturnIds.includes("voidSaleBtn")&&legacyPosReturnIds.includes("confirmReturnBtn"),"Retail POS returns legacy MASTER fixture must preserve the pre-React 21-ID UI/action inventory");
for(const id of legacyPosReturnIds) assert(posReturnsPage.includes(`id="${id}"`),`React POS returns legacy ID missing: ${id}`);
assert(posReturnsPage.includes("getRetailPosSession")&&posReturnsPage.includes('permissions.has("pos.returns")')&&posReturnsPage.includes("firstAllowedPosPage(posAccessProfile)")&&posReturnsPage.includes("/pos/login/?next="),"React POS returns session/permission parity missing");
assert(posReturnsPage.includes("selectAllRemainingForVoid")&&posReturnsPage.includes("sweetConfirm")&&posReturnsPage.includes('id="returnLoyaltyPreview"')&&posReturnsPage.includes('id="scanReturnSearchBtn"')&&posReturnsPage.includes('className="return-receipt-dialog"')&&posReturnsPage.includes('id="printReturnReceipt"'),"React POS returns must preserve VOID-confirm, loyalty preview, barcode scan, and receipt actions");
assert(posReturnsPage.includes('import { sweetConfirm } from "@/components/sweetDialog";')&&posReturnsPage.includes('"sweet-dialog.css"')&&posReturnsPage.includes('title: t("shared.dialog.confirm_title")')&&!posReturnsPage.includes("window.confirm("),"Canonical React Returns must use the app sweet confirmation dialog instead of a browser-native confirm");
assert(posReturnsPage.includes('const [toastType, setToastType] = useState("success")')&&posReturnsPage.includes('"x-circle" : "check-circle"')&&posReturnsPage.includes('scannerText("unsupported")')&&posReturnsPage.includes('scannerText("failed")')&&posReturnsPage.includes('scannerText("success")'),"Canonical React Returns scanner Toast must use localized success/error messages with circle icons");
assert(posReturnsPage.includes('id="returnSearchMode"')&&posReturnsPage.includes('pos_returns.search.mode_receipt')&&posReturnsPage.includes('pos_returns.search.mode_product')&&posReturnsPage.includes('pos_returns.search.mode_barcode')&&posReturnsPage.includes('"app-version-badge-runtime.css"')&&posReturnsPage.includes('bi bi-receipt pos-context-icon')&&posReturnsPage.includes('bi bi-arrow-counterclockwise pos-context-icon'),"React POS Returns must preserve current task2 search-mode/icon/floating visual parity");
assert(posReturnsPage.includes('<div className="return-search-row">\n          <select id="returnSearchMode"')&&posReturnsVisualCss.includes("grid-template-columns:minmax(220px,260px) minmax(0,1fr) auto!important")&&posReturnsVisualCss.includes(".return-search-row{\n    grid-template-columns:1fr!important;"),"React POS Returns search controls must stay one-row/three-column on desktop and stack safely on mobile");
assert(posReturnsData.includes("runTransaction")&&posReturnsData.includes("stockMovements")&&posReturnsData.includes("loyaltyLedger")&&posReturnsData.includes("refundStatus")&&posReturnsData.includes("pos_sale_voided")&&posReturnsData.includes("pos_return_completed")&&posReturnsData.includes("RETURN_QTY_EXCEEDED"),"React POS returns must keep transaction-safe stock, loyalty, refund-status, audit, and quantity validation behavior");
assert(posReturnsPage.includes('"retail-returns-visual-dashboard.css"')&&posReturnsPage.includes('className="returns-visual-hero"')&&posReturnsPage.includes('className="returns-timeline"')&&posReturnsPage.includes('className="returns-refund-ring"')&&posReturnsPage.includes("const visualStats = useMemo")&&posReturnsPage.includes("const returnTimeline = useMemo"),"React POS returns Visual Analytics Control Center structure missing");
assert(posReturnsVisualCss.includes("linear-gradient(125deg,#063e2e")&&posReturnsVisualCss.includes(".returns-timeline-bar")&&posReturnsVisualCss.includes(".returns-refund-ring")&&posReturnsVisualCss.includes(".return-history{")&&posReturnsVisualCss.includes("grid-template-columns:repeat(2,minmax(0,1fr))")&&posReturnsVisualCss.includes("@media(max-width:700px)"),"React POS returns colorful visual dashboard/responsive treatment missing");
assert(posReturnsVisualCss.includes("width:auto!important")&&posReturnsVisualCss.includes("min-width:0!important")&&posReturnsVisualCss.includes(".return-history-actions button{width:100%}"),"React POS returns mobile search/history cards must remain contained without horizontal scrolling");
assert(posReturnsPage.includes('bi bi-arrow-right-circle')&&posReturnsPage.includes('bi bi-arrow-repeat')&&posReturnsPage.includes('bi bi-x-octagon')&&posReturnsPage.includes('bi bi-check2-circle')&&posReturnsPage.includes('bi bi-receipt-cutoff')&&posReturnsPage.includes('bi bi-printer'),"React POS returns lower workflow action buttons must retain visible semantic icons");
assert(posReturnsPage.includes('className="return-field-label"')&&posReturnsPage.includes('bi bi-calendar3')&&posReturnsPage.includes('bi bi-wallet2')&&posReturnsPage.includes('bi bi-chat-square-text')&&posReturnsPage.includes('bi bi-sticky')&&posReturnsPage.includes('bi bi-cash-stack'),"React POS returns editor field/summary icon hierarchy missing");
assert(posReturnsVisualCss.includes("/* Returns lower-workflow visual polish */")&&posReturnsVisualCss.includes(".return-field-label{")&&posReturnsVisualCss.includes(".return-actions #voidSaleBtn{")&&posReturnsVisualCss.includes(".return-actions #confirmReturnBtn{")&&posReturnsVisualCss.includes(".return-history-panel>.empty-state::before{"),"React POS returns lower workflow visual polish regression");
assert(posReturnsVisualCss.includes(".returns-loyalty-icon{")&&posReturnsVisualCss.includes("display:grid!important")&&posReturnsVisualCss.includes("place-items:center!important")&&posReturnsVisualCss.includes(".returns-loyalty-icon>i{"),"React POS returns Loyalty icon must remain centered inside its visual badge");
assert(posReturnsVisualCss.includes(".returns-loyalty-strip>div:first-child .returns-loyalty-icon>i::before{")&&posReturnsVisualCss.includes("color:#fff!important")&&posReturnsVisualCss.includes("text-shadow:0 1px 3px rgba(52,16,101,.5)"),"React POS returns Loyalty star must remain high-contrast white on the purple badge");
assert(posReturnsPage.includes("saleDocumentId: selectedSale._documentId || selectedSale.id")&&posReturnsData.includes("cachedProduct?._documentId")&&posReturnsData.includes("cachedCustomer?._documentId"),"React POS returns must preserve legacy logical-ID versus Firestore-document-ID compatibility");
const legacyPosShiftsMaster=read("tests/fixtures/retail-pos-legacy/pos-shifts-index.html");
const legacyPosShiftIds=[...legacyPosShiftsMaster.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
assert(legacyPosShiftIds.length===24&&legacyPosShiftIds.includes("noActiveShift")&&legacyPosShiftIds.includes("activeShiftPanel")&&legacyPosShiftIds.includes("openShiftForm")&&legacyPosShiftIds.includes("closeShiftForm")&&legacyPosShiftIds.includes("shiftHistoryBody")&&legacyPosShiftIds.includes("clearShiftHistory"),"Retail POS shifts legacy MASTER fixture must preserve the pre-React 24-ID UI/action inventory");
for(const id of legacyPosShiftIds) assert(posShiftsPage.includes(`id="${id}"`),`React POS shifts legacy ID missing: ${id}`);
assert(posShiftsPage.includes("getRetailPosSession")&&posShiftsPage.includes('pagePermissions.has("pos.shifts")')&&posShiftsPage.includes("firstAllowedPosPage(posAccessProfile, roleRows)")&&posShiftsPage.includes("/pos/login/?next="),"React POS shifts session/page-permission parity missing");
for(const permission of ["pos.shifts.open","pos.shifts.close","pos.shifts.view_amount","pos.shifts.view_history","pos.shifts.clear_history"]) assert(posShiftsPage.includes(permission),`React POS shifts granular permission missing: ${permission}`);
assert(posShiftsPage.includes('bi bi-clock-history pos-context-icon')&&posShiftsPage.includes('bi bi-bar-chart-line pos-context-icon')&&posShiftsPage.includes('bi bi-play-circle pos-context-icon')&&posShiftsPage.includes('"app-version-badge-runtime.css"')&&posShiftsPage.includes("<AppDeveloperPanel />"),"React POS shifts must preserve task2 shift/history/action icons and floating developer/version control");
assert(posShiftsPage.includes('import { sweetConfirm } from "@/components/sweetDialog";')&&posShiftsPage.includes('"sweet-dialog.css"')&&posShiftsPage.includes('title: t("shared.dialog.confirm_title")')&&posShiftsPage.includes('confirmText: t("shared.actions.confirm")')&&posShiftsPage.includes('cancelText: t("shared.actions.cancel")')&&!posShiftsPage.includes("window.confirm("),"Canonical React Shifts must use the centered app sweet confirmation dialog instead of a browser-native confirm");
assert(posShiftsPage.includes('const [toastType, setToastType] = useState("success")')&&posShiftsPage.includes('"x-circle" : "check-circle"')&&posShiftsPage.includes('className="app-toast-message"'),"Canonical React Shifts Toast must render the global success/error icon + message structure");
assert(posShiftsPage.includes('toLocaleString("th-TH"')&&posShiftsPage.includes('year: "numeric"')&&posShiftsPage.includes('data-validation-state={clean(cashierName) ? "valid" : undefined}')&&posShiftsPage.includes('data-validation-state={clean(terminalCode) ? "valid" : undefined}'),"React POS shifts must preserve task2 full Buddhist-year timestamps and authored valid-field states");
assert(posShiftsCss.includes('[data-validation-state="valid"]')&&posShiftsCss.includes('border-color:#15803d!important')&&posShiftsCss.includes('background-color:#f4fcf6!important'),"React POS shifts must preserve task2 green valid-input visual state");
assert(posShiftsPage.includes("sale.shiftId")&&posShiftsPage.includes("createdAt >= openedAt")&&posShiftsPage.includes("totalCashSales")&&!posShiftsPage.includes("refundTotal"),"React POS shifts totals must retain task2 shift-id/time fallback and gross-sale calculation semantics");
assert(posShiftsData.includes("retail_pos_shift_sync_queue_v1")&&posShiftsData.includes("pending_sync")&&posShiftsData.includes("syncPendingPosShifts")&&posShiftsData.includes("submitLocalPosShiftOpen")&&posShiftsData.includes("submitLocalPosShiftClose")&&posShiftsData.includes("retail:shift-sync"),"React POS shifts must keep task2-style offline-first local pending/sync behavior");
assert(posShiftsData.includes('POS_SHIFT_HISTORY_CLEAR_KEY = "retail_pos_shift_history_clear_v1"')&&posShiftsData.includes("historyClearedAt")&&posShiftsData.includes("isClearedHistoryShift")&&posShiftsData.includes(".filter(visibleHistory)")&&posShiftsData.includes("[key]: clearedAt"),"React POS shifts clear-history must persist a tenant-scoped local cutoff and suppress cleared server history after reload");
assert(posShiftsVisualCss.includes(".shift-form>.btn .pos-context-icon::before{")&&posShiftsVisualCss.includes("color:#fff!important")&&posShiftsVisualCss.includes("text-shadow:0 1px 3px rgba(4,72,45,.5)"),"React POS shifts open-shift action icon must remain high-contrast white");
assert(posShiftsVisualCss.includes(".shift-heading h1 .pos-context-icon{")&&posShiftsVisualCss.includes(".history-head h2 .pos-context-icon{")&&posShiftsVisualCss.includes("flex:0 0 42px!important")&&posShiftsVisualCss.includes("min-width:42px!important;min-height:42px!important")&&posShiftsVisualCss.includes("aspect-ratio:1/1"),"React POS shifts heading icon badges must remain square 42x42 and resist flex compression");
assert(posShiftsPage.includes('"retail-shifts-visual-dashboard.css"')&&posShiftsPage.includes('className={"shifts-visual-hero"')&&posShiftsPage.includes('className="shifts-timeline"')&&posShiftsPage.includes('className="shifts-sales-ring"')&&posShiftsPage.includes("const shiftVisualStats = useMemo")&&posShiftsPage.includes("const shiftTimeline = useMemo"),"React POS shifts Shift Operations Dashboard structure missing");
assert(posShiftsPage.includes('className="shift-field-label"')&&posShiftsPage.includes("bi bi-person-badge")&&posShiftsPage.includes("bi bi-display")&&posShiftsPage.includes("bi bi-calculator")&&posShiftsPage.includes("data-label={tr(\"history.cashier\")}"),"React POS shifts form/history visual hierarchy missing");
assert(posShiftsVisualCss.includes("linear-gradient(125deg,#063e2e")&&posShiftsVisualCss.includes(".shifts-timeline-bar")&&posShiftsVisualCss.includes(".shifts-sales-ring")&&posShiftsVisualCss.includes(".shift-stats article span i")&&posShiftsVisualCss.includes(".shift-table tbody tr{")&&posShiftsVisualCss.includes("@media(max-width:760px)"),"React POS shifts colorful visual dashboard/responsive treatment missing");
assert(posShiftsVisualCss.includes(".shift-table thead{display:none}")&&posShiftsVisualCss.includes("content:attr(data-label)")&&posShiftsVisualCss.includes(".table-wrap::after{display:none!important}"),"React POS shifts mobile history must render as contained cards without horizontal-scroll instruction");
assert(posShiftsPage.includes('activeShift\n              ? (canViewAmount ? money(totals.totalSales) : "—")\n              : (canViewAmount && canViewHistory ? money(shiftVisualStats.salesTotal) : "—")')&&posShiftsPage.includes("canViewHistory ? formatNumber(history.length)")&&posShiftsPage.includes("canViewAmount && (activeShift || canViewHistory)"),"React POS shifts dashboard must preserve amount/history permission boundaries");
assert(posData.includes("POS_SHIFT_SYNC_QUEUE_KEY")&&posData.includes("closingIds")&&posData.includes("requestedShiftId")&&posData.includes("requestedClosedAt")&&posData.includes("actualCash:closeCash")&&posData.includes("salesTotal:totalSales"),"Shared POS data layer must preserve pending-close visibility and legacy shift field aliases");
assert(paritySync.includes('"public/pos/index.html"')||read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/index.html"'),"React postbuild must sync the canonical /pos root entry to the React shell");
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/sales/index.html"'),"React postbuild must sync canonical /pos/sales to the React shell");
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/tax-invoices/index.html"'),"React postbuild must sync canonical /pos/tax-invoices to the React shell");
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/returns/index.html"'),"React postbuild must sync canonical /pos/returns to the React shell");
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/shifts/index.html"'),"React postbuild must sync canonical /pos/shifts to the React shell");
assert(firebaseHostingConfig.includes('"source": "/pos"')&&firebaseHostingConfig.includes('"source": "/pos/sales"')&&firebaseHostingConfig.includes('"source": "/pos/tax-invoices"')&&firebaseHostingConfig.includes('"source": "/pos/returns"')&&firebaseHostingConfig.includes('"source": "/pos/shifts"')&&firebaseHostingConfig.includes('"source": "/pos/shifts/**"')&&firebaseHostingConfig.includes('"source": "/pos/**"')&&firebaseHostingConfig.includes('"destination": "/pos/index.html"'),"Hosting must cache-bust canonical React POS routes while retaining legacy POS subroute fallback");
assert(posPage.includes('/pos/login/?next=${encodeURIComponent(requested)}')&&posPage.includes("firstAllowedPosPage(posAccessProfile)")&&posPage.includes("location.replace(posRedirectTarget)")&&!posPage.includes('<Navigate to="/login?next=%2Fpos"'),"React POS sale access redirects must preserve legacy POS login/permission behavior with full-page navigation");
assert(posNavigation.includes('location.replace("/pos/login/")')&&posNavigation.includes("export function firstAllowedPosPage"),"React POS navigation logout/first-allowed routing must stay inside the legacy POS session flow");
assert(posCatalogCss.includes(".catalog-tabs")&&posCatalogCss.includes(".product-card.visual-card"),"Canonical Laravel POS catalog CSS missing from React parity assets");
assert(paritySync.includes('"retail-pos-catalog.css"'),"POS catalog CSS must remain sourced from Laravel MASTER parity sync");
const posProductsPage=read("react-app/src/pages/PosProductsPage.jsx");
const posProductsVisualCss=read("react-app/public/parity/css/retail-products-visual-dashboard.css");
const posStockMovementsPage=read("react-app/src/pages/PosStockMovementsPage.jsx");
const posStockMovementsVisualCss=read("react-app/public/parity/css/retail-stock-movements-visual-dashboard.css");
const posStockCountsPage=read("react-app/src/pages/PosStockCountsPage.jsx");
const posStockCountsVisualCss=read("react-app/public/parity/css/retail-stock-counts-visual-dashboard.css");
const posPurchasesPage=read("react-app/src/pages/PosPurchasesPage.jsx");
const posPurchasesVisualCss=read("react-app/public/parity/css/retail-purchases-visual-dashboard.css");
const posPayablesPage=read("react-app/src/pages/PosPayablesPage.jsx");
const posPayablesVisualCss=read("react-app/public/parity/css/retail-payables-visual-dashboard.css");
const posSuppliersPage=read("react-app/src/pages/PosSuppliersPage.jsx");
const posSuppliersVisualCss=read("react-app/public/parity/css/retail-suppliers-visual-dashboard.css");
const posCustomersPage=read("react-app/src/pages/PosCustomersPage.jsx");
const posCustomersVisualCss=read("react-app/public/parity/css/retail-customers-visual-dashboard.css");
const posPurchasingData=read("react-app/src/data/retailPurchasingData.js");
const posPurchaseBarcodeCss=read("react-app/public/parity/css/retail-barcode-scan-tools.css");
const posCatalogPage=read("react-app/src/pages/PosCatalogPage.jsx");
const posProductsData=read("react-app/src/data/retailProductsData.js");
assert(!posProductsPage.includes('from "@/components/UserMenu"')&&!posProductsPage.includes("<UserMenu"),"React POS Products must not add the global UserMenu on top of the legacy POS profile/menu shell");
assert(!posCatalogPage.includes('from "@/components/UserMenu"')&&!posCatalogPage.includes("<UserMenu"),"React POS Catalog must preserve the legacy supporting header without the global UserMenu");
assert(appRoutes.includes('import { PosProductsPage } from "@/pages/PosProductsPage";')&&appRoutes.includes('<Route path="/pos/products" element={<PosProductsPage />} />'),"React POS Products route must be mounted");
assert(posNavigation.includes('key: "pos.products"')&&posNavigation.includes('href: "/pos/products"')&&read("react-app/src/pages/PosCatalogPage.jsx").includes('href="/pos/products"'),"Migrated POS product links must stay inside React/Firebase routes");
assert(posNavigation.includes('href: "/pos/sales"')&&posNavigation.includes('href: "/pos/tax-invoices"')&&posNavigation.includes('href: "/pos/returns"')&&posNavigation.includes('href: "/pos/shifts"')&&posNavigation.includes("translatedOrFallback"),"POS sales-group navigation must stay inside React and fall back to MASTER labels");
for(const [page,route] of [["PosSalesPage","/pos/sales"],["PosTaxInvoicesPage","/pos/tax-invoices"],["PosReturnsPage","/pos/returns"],["PosShiftsPage","/pos/shifts"]]) assert(appRoutes.includes(`import { ${page} }`)&&appRoutes.includes(`path="${route}"`),`React POS supporting route missing: ${route}`);
const posSalesPage=read("react-app/src/pages/PosSalesPage.jsx");
const posSalesVisualCss=read("react-app/public/parity/css/retail-sales-visual-dashboard.css");
for(const id of ["saleSearch","dateFrom","dateTo","paymentFilter","todayBtn","monthBtn","clearFilterBtn","saleCount","saleTotal","beforeVatTotal","vatTotal","vatBillCount","cashTotal","transferTotal","discountTotal","itemQtyTotal","averageSale","highestSale","bestSellerList","bestSellerEmpty","cashPercent","cashBar","transferPercent","transferBar","reportPeriodText","exportCsvBtn","salesTableBody","salesEmpty","saleDialog","closeSaleDialog","receiptArea","receiptShopName","receiptShopAddress","receiptShopPhone","receiptTaxId","receiptTaxBranch","receiptSaleId","receiptDate","receiptPayment","receiptItems","receiptSubtotal","receiptDiscount","receiptTotal","receiptReceivedRow","receiptReceived","receiptChangeRow","receiptChange","receiptThanks","receiptFooter","closeSaleBtn","printReceiptBtn"]) assert(posSalesPage.includes(`id="${id}"`),`React POS sales-history legacy ID missing: ${id}`);
assert(posSalesPage.includes('bi bi-calendar3 pos-context-icon')&&posSalesPage.includes('bi bi-x-circle pos-context-icon')&&posSalesPage.includes('bi bi-graph-up-arrow')&&posSalesPage.includes('bi bi-bar-chart-line-fill')&&posSalesPage.includes('bi bi-pie-chart-fill pos-context-icon')&&posSalesPage.includes('bi bi-stars pos-context-icon')&&posSalesPage.includes('data-icon-tone="blue"')&&posSalesPage.includes('data-icon-tone="rose"')&&posSalesPage.includes('data-icon-tone="emerald"'),"React POS sales-history Visual Analytics semantic icons missing");
assert(posSalesPage.includes('"retail-sales-visual-dashboard.css"')&&posSalesPage.includes('className="sales-visual-hero"')&&posSalesPage.includes('className="sales-chart"')&&posSalesPage.includes('className="payment-donut"')&&posSalesPage.includes("const salesTrend = useMemo"),"React POS sales-history Visual Analytics dashboard structure missing");
assert(posSalesVisualCss.includes("linear-gradient(125deg,#063c2b")&&posSalesVisualCss.includes("conic-gradient(#10b981")&&posSalesVisualCss.includes(".sales-chart-bar")&&posSalesVisualCss.includes(".ranking-item::before")&&posSalesVisualCss.includes(".sales-table tbody tr")&&posSalesVisualCss.includes("@media(max-width:780px)"),"React POS sales-history colorful visual dashboard/responsive treatment missing");
assert(posSalesVisualCss.includes("bottom:min(calc(var(--bar-height,0%) + 6px),calc(100% - 30px))")&&posSalesVisualCss.includes("overflow:visible")&&!posSalesPage.includes('title={t("pos_sales_runtime.runtime.amount"'),"React POS sales-history chart tooltip must stay inside the plot without a duplicate native browser tooltip");
assert(posSalesPage.includes('className="sale-amount-group"')&&posSalesPage.indexOf('className="view-sale"')>posSalesPage.indexOf('className="sale-amount-group"'),"React POS sales-history View Bill action must remain grouped with net sales");
assert(posSalesVisualCss.includes("max-width:none!important")&&posSalesVisualCss.includes(".sales-table tbody td.sale-amount{")&&posSalesVisualCss.includes("grid-column:1/-1!important")&&posSalesVisualCss.includes(".sale-amount .view-sale{"),"React POS sales-history mobile receipt header/action layout regression");
assert(posSalesPage.includes("watchPosSales")&&posSalesPage.includes('currentKey="pos.sales"')&&posSalesPage.includes("firstAllowedPosPage(posAccessProfile)")&&posSalesPage.includes("/pos/login/?next="),"React POS sales-history realtime/session/permission parity missing");
assert(posData.includes("export function watchPosSales")&&posData.includes("onSnapshot("),"React POS sales-history realtime Firestore watcher missing");
assert(posData.includes("export async function createPosReturn")&&posData.includes("export async function openPosShift")&&posData.includes("export async function closePosShift")&&posData.includes("export async function listPosTaxInvoices"),"POS sales-group Firestore operations missing");
assert(firestoreRules.includes("validPosOperationCounter")&&firestoreRules.includes("validPosOperationRunningNumber"),"POS return/shift running-number Firestore rules missing");
const legacyPosProductsMaster=read("tests/fixtures/retail-pos-legacy/pos-products-index.html");
const legacyPosProductIds=[...legacyPosProductsMaster.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
assert(legacyPosProductIds.length===60&&legacyPosProductIds.includes("productTableBody")&&legacyPosProductIds.includes("productCategoryManager")&&legacyPosProductIds.includes("productSortManager")&&legacyPosProductIds.includes("productDialog")&&legacyPosProductIds.includes("categoryDialog")&&legacyPosProductIds.includes("stockDialog")&&legacyPosProductIds.includes("toast"),"Retail POS Products legacy MASTER fixture must preserve the pre-React 60-ID UI/action inventory");
for(const id of legacyPosProductIds) assert(posProductsPage.includes(`id="${id}"`),`React POS Products legacy ID missing: ${id}`);
assert(posProductsPage.includes("getRetailPosSession")&&posProductsPage.includes('pagePermissions.has("pos.products")')&&posProductsPage.includes("firstAllowedPosPage(posAccessProfile, roleRows)")&&posProductsPage.includes("/pos/login/?next="),"React POS Products session/page-permission parity missing");
assert(posProductsPage.includes('localStorage.getItem("retail_pos_roles_v1")')&&posProductsPage.includes("BUILTIN_POS_ROLES")&&posProductsPage.includes("ROLE_SETTINGS_TIMEOUT_MS = 6000")&&posProductsPage.includes("POS_ROLE_SETTINGS_TIMEOUT"),"React POS Products must use cached/built-in role readiness and avoid an indefinite role-settings gate");
assert(posProductsPage.includes("INITIAL_DATA_TIMEOUT_MS = 10000")&&posProductsPage.includes("POS_PRODUCTS_INITIAL_LOAD_TIMEOUT")&&posProductsPage.includes("setInitialReady(true)"),"React POS Products initial Firestore load must fail open to realtime watchers instead of showing an indefinite loading screen");
for(const permission of ["pos.products.create","pos.products.edit","pos.products.delete","pos.products.adjust_stock","pos.products.view_cost","pos.products.clear_history"]) assert(posProductsPage.includes(permission),`React POS Products granular permission missing: ${permission}`);
assert(posProductsPage.includes('import Sortable from "sortablejs";')&&posProductsPage.includes("animation: 140")&&posProductsPage.includes('easing: "cubic-bezier(0.22, 1, 0.36, 1)"')&&posProductsPage.includes('direction: "vertical"')&&posProductsPage.includes("swapThreshold: 0.62")&&posProductsPage.includes("delay: 100")&&posProductsPage.includes("touchStartThreshold: 5")&&posProductsPage.includes("forceFallback: true")&&posProductsPage.includes("fallbackOnBody: true")&&posProductsPage.includes("fallbackTolerance: 5")&&posProductsPage.includes("scrollSensitivity: 80")&&posProductsPage.includes("scrollSpeed: 12"),"POS Products Sortable profile must preserve drag handles/fallback semantics while using the approved smooth-motion tuning");
assert(posProductsPage.includes("watchRetailProducts")&&posProductsPage.includes("watchRetailCategories")&&posProductsPage.includes("watchRetailStockMovements")&&posProductsPage.includes("watchRetailCatalogOrder"),"React POS Products must keep realtime Firestore watchers for products/categories/movements/catalog-order");
assert(posProductsPage.includes('id="posScanDialog"')&&posProductsPage.includes('id="posScanVideo"')&&posProductsPage.includes('id="posScanStatus"')&&posProductsPage.includes("BarcodeDetector")&&posProductsPage.includes("BrowserMultiFormatReader"),"React POS Products barcode scanner must retain native BarcodeDetector plus ZXing fallback");
for(const locale of ["th","en","my","lo","km"]){const scanner=dict[locale]?.pos_products?.scanner;assert(scanner&&["button","title","help","close","preparing","loading","scanning","found","success","unsupported","failed","not_found"].every(key=>scanner[key]&&scanner[key]!==`pos_products.scanner.${key}`),`React POS barcode scanner translations incomplete: ${locale}`);}
assert(posBarcodeCss.includes("left:50%;right:auto;top:50%;width:min(calc(76% - 12px),348px)")&&read("react-app/public/parity/css/retail-barcode-scan-tools.css").includes("left:50%;right:auto;top:50%;width:min(calc(76% - 12px),348px)"),"React POS scanner red guide line must remain inset inside the green frame across Products and shared management scanners");
assert(posProductsPage.includes('id="toast"')&&posProductsPage.includes('"x-circle" : "check-circle"')&&posProductsPage.includes("<AppDeveloperPanel />"),"React POS Products must use typed Toast status icons and preserve the floating developer/version control");
assert(posProductsPage.includes("sweetConfirm")&&!posProductsPage.includes("window.confirm(")&&posProductsPage.includes('title: tr("runtime.clear_history_title")'),"React POS Products destructive actions must use the shared centered confirmation dialog");
assert(posProductsPage.includes('"retail-products-visual-dashboard.css"')&&posProductsPage.includes('className="products-visual-hero"')&&posProductsPage.includes('className="products-health-ring"')&&posProductsPage.includes('className="products-category-bars"')&&posProductsPage.includes("const productVisualStats = useMemo")&&posProductsPage.includes("const stockHealthGradient"),"React POS Products Product & Stock Command Center structure missing");
assert(posProductsPage.includes('bi bi-boxes')&&posProductsPage.includes('bi bi-exclamation-triangle-fill')&&posProductsPage.includes('bi bi-box-arrow-in-down')&&posProductsPage.includes('bi bi-pencil-square')&&posProductsPage.includes('bi bi-trash3'),"React POS Products semantic status/action icons missing");
assert(posProductsPage.includes('data-label={tr("products.columns.id")}')&&posProductsPage.includes('data-label={tr("products.columns.product")}')&&posProductsPage.includes('data-label={tr("visual.actions")}'),"React POS Products responsive card data labels missing");
assert(posProductsVisualCss.includes("linear-gradient(125deg,#063e2e")&&posProductsVisualCss.includes(".products-health-ring")&&posProductsVisualCss.includes(".products-category-track>span")&&posProductsVisualCss.includes(".product-table tbody tr.is-low")&&posProductsVisualCss.includes("@media(max-width:760px)"),"React POS Products colorful visual dashboard/responsive treatment missing");
assert(posProductsVisualCss.includes(".product-table thead{display:none}")&&posProductsVisualCss.includes("content:attr(data-label)")&&posProductsVisualCss.includes(".products-list-panel .table-wrap::after{display:none!important}")&&posProductsVisualCss.includes("min-width:0!important"),"React POS Products Mobile product list must render contained cards without legacy horizontal scrolling");
assert(posProductsPage.includes("const PRODUCT_PAGE_SIZES = [10, 25, 50, 100]")&&posProductsPage.includes("useState(10);"),"React POS Products product pagination must default to 10 rows with 10/25/50/100 choices");
assert(posProductsPage.includes('className="product-editor-dialog"')&&posProductsPage.includes('id="productImageInput"')&&posProductsPage.includes('className="product-upload-input"')&&posProductsPage.includes("onDragOver=")&&posProductsPage.includes("onDrop=")&&posProductsPage.includes("selectProductImage"),"React POS Products editor must use the custom drag/drop image uploader");
assert(posProductsPage.includes('className="category-editor-dialog"')&&posProductsPage.includes('bi bi-tags-fill')&&posProductsPage.includes('id="cancelCategoryBtn"')&&posProductsPage.includes('id="saveCategoryBtn"'),"React POS Products category editor visual/icon treatment missing");
assert(posProductsPage.includes('className="sort-save"')&&posProductsPage.includes('"floppy"')&&posProductsPage.includes('bi bi-x-circle')&&posProductsPage.includes('bi bi-trash3'),"React POS Products modal/sort action icons missing");
assert(posProductsVisualCss.includes(".product-pagination .page-ellipsis")&&posProductsVisualCss.includes(".category-page-ellipsis")&&posProductsVisualCss.includes("width:28px")&&posProductsVisualCss.includes("#productDialog.product-editor-dialog")&&posProductsVisualCss.includes(".product-upload-input")&&posProductsVisualCss.includes("#categoryDialog.category-editor-dialog"),"React POS Products pagination/modal polish CSS missing");
assert(posProductsVisualCss.includes("#productDialog.product-editor-dialog{")&&posProductsVisualCss.includes("overflow:hidden;")&&posProductsVisualCss.includes(".product-editor-form{")&&posProductsVisualCss.includes("overflow-y:auto;")&&posProductsVisualCss.includes("scrollbar-gutter:stable;")&&posProductsVisualCss.includes(".product-editor-form::-webkit-scrollbar"),"React POS Products editor scrollbar must stay inside the rounded dialog shell");
assert(posProductsVisualCss.includes(".product-editor-actions{")&&posProductsVisualCss.includes("margin:14px -24px 0!important")&&posProductsVisualCss.includes("bottom:0!important"),"React POS Products editor footer must sit flush with the modal bottom edge");
assert(posProductsPage.includes("animation: 140")&&posProductsPage.includes('easing: "cubic-bezier(0.22, 1, 0.36, 1)"')&&posProductsPage.includes("swapThreshold: 0.62")&&posProductsPage.includes("scrollSensitivity: 80")&&posProductsPage.includes("scrollSpeed: 12"),"React POS Products Sortable motion tuning missing");
assert(posProductsVisualCss.includes(".sort-ghost{")&&posProductsVisualCss.includes(".sort-drag,")&&posProductsVisualCss.includes(".sort-fallback{")&&posProductsVisualCss.includes("transform:none;")&&posProductsVisualCss.includes("transition:none!important"),"React POS Products drag rows must remain straight and visually stable");
for(const locale of ["th","en","my","lo","km"]){const visual=dict[locale]?.pos_products?.visual;assert(visual&&visual.eyebrow&&visual.hero_description&&visual.category_mix_title&&visual.stock_health_title&&visual.healthy&&visual.actions,`React POS Products visual translations missing: ${locale}`);}
assert(posProductsData.includes('tenantCollection(id, "products")')&&posProductsData.includes('tenantCollection(id, "categories")')&&posProductsData.includes('tenantCollection(id, "stockMovements")')&&posProductsData.includes('tenantDoc(id, "settings", "catalog-order")'),"POS Products Firestore collection mapping missing");
assert(posProductsData.includes('type = "adjustment"')&&posProductsData.includes("runTransaction")&&posProductsData.includes("after === before")&&posProductsData.includes("_documentIds")&&posProductsData.includes('source._documentId || productId')&&posProductsData.includes('product._documentId || product.id')&&posProductsData.includes("legacyDocumentIds.forEach"),"POS Products stock/legacy-document safeguards missing");
assert(posProductsData.includes('tenants/${id}/product-images/${productId}/'),"POS product image storage path must match Storage rules");
for(const css of ["retail-products.css","retail-products-sort-manager.css","retail-product-categories.css","retail-product-merchandising.css"]) assert(paritySync.includes('"' + css + '"'),"POS Products CSS must remain sourced from Laravel MASTER: " + css);
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/products/index.html"'),"React postbuild must sync canonical /pos/products to the React shell");
assert(firebaseHostingConfig.includes('"source": "/pos/products"')&&firebaseHostingConfig.includes('"source": "/pos/products/**"'),"Hosting must cache-bust canonical React POS Products");

const legacyPosStockMovementsMaster=read("tests/fixtures/retail-pos-legacy/pos-stock-movements-index.html");
const legacyPosStockMovementIds=[...legacyPosStockMovementsMaster.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
assert(legacyPosStockMovementIds.length===17&&legacyPosStockMovementIds.includes("movementSearch")&&legacyPosStockMovementIds.includes("movementCount")&&legacyPosStockMovementIds.includes("exportMovementCsv")&&legacyPosStockMovementIds.includes("movementTableBody")&&legacyPosStockMovementIds.includes("movementEmpty"),"Retail POS Stock Movements legacy MASTER fixture must preserve the pre-React 17-ID UI/action inventory");
for(const id of legacyPosStockMovementIds) assert(posStockMovementsPage.includes(`id="${id}"`),`React POS Stock Movements legacy ID missing: ${id}`);
assert(posStockMovementsPage.includes("getRetailPosSession")&&posStockMovementsPage.includes('pagePermissions.has("pos.stock_movements")')&&posStockMovementsPage.includes("firstAllowedPosPage(posAccessProfile, roleRows)")&&posStockMovementsPage.includes("/pos/login/?next="),"React POS Stock Movements session/page-permission parity missing");
for(const permission of ["pos.stock_movements.view_quantity","pos.stock_movements.export"]) assert(posStockMovementsPage.includes(permission),`React POS Stock Movements granular permission missing: ${permission}`);
assert(posStockMovementsPage.includes('localStorage.getItem("retail_pos_roles_v1")')&&posStockMovementsPage.includes("ROLE_SETTINGS_TIMEOUT_MS = 6000")&&posStockMovementsPage.includes("POS_ROLE_SETTINGS_TIMEOUT"),"React POS Stock Movements must use cached/built-in role readiness with a bounded role-settings wait");
assert(posStockMovementsPage.includes("INITIAL_DATA_TIMEOUT_MS = 10000")&&posStockMovementsPage.includes("POS_STOCK_MOVEMENTS_INITIAL_LOAD_TIMEOUT"),"React POS Stock Movements initial load must not block indefinitely");
assert(posStockMovementsPage.includes("watchRetailStockMovements")&&posStockMovementsPage.includes("watchRetailProducts"),"React POS Stock Movements must keep realtime Firestore movement/product watchers");
assert(posStockMovementsPage.includes('note.includes("คืนสินค้า")')&&posStockMovementsPage.includes('note.includes("purchase")')&&posStockMovementsPage.includes('note.includes("sale-")')&&posStockMovementsPage.includes('note.includes("count-")')&&posStockMovementsPage.includes('return "adjustment";')&&!posStockMovementsPage.includes("const explicit =")&&posStockMovementsPage.includes("delta: after - before"),"React POS Stock Movements must preserve exact legacy note-based movement classification/fallback and before/after delta math");
assert(posStockMovementsPage.includes("row.createdAt || row.createdAtServer || row.updatedAt"),"React POS Stock Movements must prefer legacy createdAt before server/update timestamps");
assert(posStockMovementsPage.includes("sweetAlert")&&posStockMovementsPage.includes('tr("errors.no_export_data")')&&posStockMovementsPage.includes('retail-stock-movements-${from || "all"}-${to || "all"}.csv'),"React POS Stock Movements CSV export/no-data warning parity missing");
assert(posStockMovementsPage.includes('hidden={!canViewQuantity}')&&posStockMovementsPage.includes('hidden={!canExport}')&&posStockMovementsPage.includes('currentKey="pos.stock_movements"')&&posStockMovementsPage.includes("<AppDeveloperPanel />"),"React POS Stock Movements quantity/export permission visibility and shared POS shell missing");
assert(posStockMovementsPage.includes('id="scanMovementProductBtn"')&&posStockMovementsPage.includes('id="posScanDialog"')&&posStockMovementsPage.includes('id="posScanVideo"')&&posStockMovementsPage.includes('id="posScanStatus"')&&posStockMovementsPage.includes('"BarcodeDetector" in window')&&posStockMovementsPage.includes("BrowserMultiFormatReader"),"React POS Stock Movements must preserve legacy barcode-filter scanner behavior");
assert(posStockMovementsPage.includes('const [toastType, setToastType] = useState("success")')&&posStockMovementsPage.includes('"x-circle" : "check-circle"')&&posStockMovementsPage.includes("scannerText(\"unsupported\")")&&posStockMovementsPage.includes("scannerText(\"failed\")"),"React POS Stock Movements scanner must use typed global Toast success/error feedback");
assert(posStockMovementsPage.includes('bi bi-calendar3 pos-context-icon')&&posStockMovementsPage.includes('bi bi-x-circle pos-context-icon')&&posStockMovementsPage.includes('bi bi-bookmark-star pos-context-icon')&&posStockMovementsPage.includes('data-icon-tone="green"')&&posStockMovementsPage.includes('bi bi-download pos-context-icon'),"React POS Stock Movements must author the semantic icons injected by legacy retail-pos-icons");
assert(posStockMovementsPage.includes('"retail-barcode-scan-tools.css"')&&!posStockMovementsPage.includes('"retail-stock-movements-scroll.css"'),"React POS Stock Movements must keep the scanner control styling and legacy mobile card layout without the stale horizontal-scroll override");
const posBarcodeScanCss=read("react-app/public/parity/css/retail-barcode-scan-tools.css");
assert(posBarcodeScanCss.includes(".movement-product-input input{padding-right:100px!important}")&&posBarcodeScanCss.includes(".movement-filter-clear"),"React POS barcode parity CSS must include the legacy Stock Movements clear/scan input treatment");
assert(posStockMovementsPage.includes('t(`pos_stock.movements.${key}`')&&posStockMovementsPage.includes('tr("header.title")')&&posStockMovementsPage.includes('tr("report.title")'),"React POS Stock Movements must use the five-language pos_stock.movements translation catalog");
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/stock-movements/index.html"'),"React postbuild must sync canonical /pos/stock-movements to the React shell");
assert(firebaseHostingConfig.includes('"source": "/pos/stock-movements"')&&firebaseHostingConfig.includes('"source": "/pos/stock-movements/**"'),"Hosting must cache-bust canonical React POS Stock Movements");


const legacyPosStockCountsMaster=read("tests/fixtures/retail-pos-legacy/pos-stock-counts-index.html");
const legacyPosStockCountIds=[...legacyPosStockCountsMaster.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
assert(legacyPosStockCountIds.length===21&&legacyPosStockCountIds.includes("countName")&&legacyPosStockCountIds.includes("countTableBody")&&legacyPosStockCountIds.includes("countedItems")&&legacyPosStockCountIds.includes("countHistory")&&legacyPosStockCountIds.includes("confirmCountBtn")&&legacyPosStockCountIds.includes("toast"),"Retail POS Stock Counts legacy MASTER fixture must preserve the pre-React 21-ID UI/action inventory");
for(const id of legacyPosStockCountIds) assert(posStockCountsPage.includes(`id="${id}"`),`React POS Stock Counts legacy ID missing: ${id}`);
assert(appRoutes.includes('import { PosStockCountsPage }')&&appRoutes.includes('path="/pos/stock-counts"'),"React POS Stock Counts route must be mounted");
assert(posStockCountsPage.includes("getRetailPosSession")&&posStockCountsPage.includes('pagePermissions.has("pos.stock_counts")')&&posStockCountsPage.includes("firstAllowedPosPage(posAccessProfile, roleRows)")&&posStockCountsPage.includes("/pos/login/?next="),"React POS Stock Counts session/page-permission parity missing");
for(const permission of ["pos.stock_counts.perform","pos.stock_counts.view_value","pos.stock_counts.view_history"]) assert(posStockCountsPage.includes(permission),`React POS Stock Counts granular permission missing: ${permission}`);
assert(posStockCountsPage.includes('localStorage.getItem("retail_pos_roles_v1")')&&posStockCountsPage.includes("ROLE_SETTINGS_TIMEOUT_MS = 6000")&&posStockCountsPage.includes("POS_ROLE_SETTINGS_TIMEOUT"),"React POS Stock Counts must use cached/built-in role readiness with a bounded role-settings wait");
assert(posStockCountsPage.includes("INITIAL_DATA_TIMEOUT_MS = 10000")&&posStockCountsPage.includes("POS_STOCK_COUNTS_INITIAL_LOAD_TIMEOUT"),"React POS Stock Counts initial data load must not block indefinitely");
assert(posStockCountsPage.includes("watchRetailProducts")&&posStockCountsPage.includes("watchRetailStockCounts"),"React POS Stock Counts must keep realtime Firestore product/count watchers");

assert(posStockCountsPage.includes('id="scanCountSearchBtn"')&&posStockCountsPage.includes('id="posScanDialog"')&&posStockCountsPage.includes('id="posScanVideo"')&&posStockCountsPage.includes('id="posScanStatus"')&&posStockCountsPage.includes('"BarcodeDetector" in window')&&posStockCountsPage.includes("BrowserMultiFormatReader"),"React POS Stock Counts must preserve legacy barcode scanner behavior");
assert(posStockCountsPage.includes('const [toastType, setToastType] = useState("success")')&&posStockCountsPage.includes('"x-circle" : "check-circle"')&&posStockCountsPage.includes('scannerText("not_found")'),"React POS Stock Counts scanner must use typed global Toast feedback");
assert(posStockCountsPage.includes("sweetConfirm")&&!posStockCountsPage.includes("window.confirm(")&&!posStockCountsPage.includes("confirm(message)"),"React POS Stock Counts confirmation must use the shared centered app dialog");
assert(posStockCountsPage.includes('bi bi-clipboard-check pos-context-icon')&&posStockCountsPage.includes('bi bi-x-lg pos-context-icon')&&posStockCountsPage.includes('bi bi-plus-lg pos-context-icon')&&posStockCountsPage.includes('bi bi-check-lg pos-context-icon'),"React POS Stock Counts must author the semantic icons injected by legacy retail-pos-icons");
assert(posStockCountsPage.includes('t(`pos_stock.counts.${key}`')&&posStockCountsPage.includes('tr("header.title")')&&posStockCountsPage.includes('tr("history.title")'),"React POS Stock Counts must use the five-language pos_stock.counts translation catalog");
assert(!posStockCountsPage.includes("ทุน")&&!posStockCountsPage.includes("บาท"),"React POS Stock Counts JSX must not hard-code Thai-only cost/currency labels");
assert(posStockCountsPage.includes('t("pos_products.runtime.cost"')&&posStockCountsPage.includes('t("pos_stock.common.amount_thb"')&&posStockCountsPage.includes("formatDate("),"React POS Stock Counts cost/currency/date display must remain locale-aware");
assert(posStockCountsPage.includes('movementNote: tr("movement_note", { id: countId })')&&posStockCountsPage.includes("documentId: row.product._documentId || row.product.id"),"React POS Stock Counts commit payload must preserve translated movement notes and legacy product document IDs");

assert(
  posStockCountsPage.includes('"retail-stock-counts-visual-dashboard.css"')
  && posStockCountsPage.includes('className="count-visual-hero"')
  && posStockCountsPage.includes('className="count-progress-ring"')
  && posStockCountsPage.includes('className="panel count-variance-panel"')
  && posStockCountsPage.includes("const countVisual = useMemo"),
  "React POS Stock Counts visual control-center structure missing",
);
assert(
  posStockCountsPage.includes('canViewValue ? money(summary.value) : "—"')
  && posStockCountsPage.includes('id="varianceValue" hidden={!canViewValue}')
  && posStockCountsPage.includes('className="count-value-mask" hidden={canViewValue}'),
  "React POS Stock Counts visual summary must preserve view_value masking",
);
assert(
  posStockCountsPage.includes('className="panel count-history-panel" hidden={!canViewHistory}')
  && posStockCountsPage.includes('className="count-history-total-badge"'),
  "React POS Stock Counts history redesign must preserve view_history visibility",
);
assert(
  posStockCountsVisualCss.includes("linear-gradient(120deg,#083b2d")
  && posStockCountsVisualCss.includes(".count-progress-ring")
  && posStockCountsVisualCss.includes("conic-gradient(#10b981")
  && posStockCountsVisualCss.includes(".count-variance-track")
  && posStockCountsVisualCss.includes(".count-table tr::before")
  && posStockCountsVisualCss.includes(".count-meta-field")
  && posStockCountsVisualCss.includes("linear-gradient(120deg,#0b513d")
  && posStockCountsVisualCss.includes("min-height:0!important")
  && posStockCountsVisualCss.includes("padding:14px 18px!important")
  && posStockCountsVisualCss.includes("left:1px")
  && posStockCountsVisualCss.includes("right:1px")
  && posStockCountsVisualCss.includes("border-bottom:1px solid #edf2ef")
  && posStockCountsVisualCss.includes("border-bottom:0!important")
  && posStockCountsVisualCss.includes(".count-list-controls")
  && posStockCountsVisualCss.includes(".count-list-sticky-shell")
  && posStockCountsVisualCss.includes(".count-table-sticky-head")
  && posStockCountsVisualCss.includes("position:sticky")
  && posStockCountsVisualCss.includes("top:74px")
  && posStockCountsVisualCss.includes(".count-table.has-value tbody tr")
  && posStockCountsVisualCss.includes("grid-template-areas:")
  && posStockCountsVisualCss.includes('"product product"')
  && posStockCountsVisualCss.includes('"system actual"')
  && posStockCountsVisualCss.includes('"variance value"')
  && posStockCountsVisualCss.includes(".count-number-system")
  && posStockCountsVisualCss.includes(".count-number-value")
  && posStockCountsVisualCss.includes("@media(max-width:620px)"),
  "React POS Stock Counts colorful visual dashboard/responsive treatment missing",
);
assert(
  posStockCountsPage.includes('className="count-heading-copy"')
  && !posStockCountsPage.includes('className="count-workspace-kicker"')
  && !posStockCountsPage.includes('className="count-workspace-badges"')
  && posStockCountsPage.includes('<h1><i className="bi bi-clipboard-check pos-context-icon"')
  && posStockCountsPage.includes('<p>{tr("new.description")}</p>')
  && posStockCountsPage.includes('id="fillSystemBtn"')
  && posStockCountsPage.includes('id="clearActualBtn"')
  && posStockCountsPage.includes('className="count-meta-label"')
  && posStockCountsPage.includes('className="count-list-sticky-shell"')
  && posStockCountsPage.includes('className="count-list-controls"')
  && posStockCountsPage.includes('className="count-list-heading"')
  && posStockCountsPage.includes('count-table-sticky-head')
  && posStockCountsPage.includes('className={`count-table ${canViewValue ? "has-value" : "no-value"}`}')
  && posStockCountsPage.includes('count-number-system')
  && posStockCountsPage.includes('count-number-value')
  && posStockCountsPage.includes('bi bi-bookmark-star')
  && posStockCountsPage.includes('bi bi-calendar3')
  && posStockCountsPage.includes('bi bi-person-check')
  && posStockCountsPage.includes('bi bi-chat-left-text'),
  "React POS Stock Counts workspace must keep the compact new-count heading, both actions, inventory controls, sticky labels, colored values, and semantic field icons",
);
assert(
  posStockCountsPage.includes('bi bi-clipboard2-data')
  && posStockCountsPage.includes('bi bi-pie-chart-fill')
  && posStockCountsPage.includes('bi bi-arrow-left-right')
  && posStockCountsPage.includes('bi bi-clock-history')
  && posStockCountsPage.includes('bi bi-cash-stack'),
  "React POS Stock Counts visual semantic icons missing",
);
for (const locale of ["th", "en", "my", "lo", "km"]) {
  const visual = dict[locale]?.pos_stock?.counts?.visual;
  assert(
    visual
      && visual.kicker
      && visual.hero_description
      && visual.total_products
      && visual.progress_title
      && visual.variance_title
      && visual.history_empty_hint
      && visual.list_title
      && visual.list_description
      && visual.filter_label,
    `React POS Stock Counts visual translations missing: ${locale}`,
  );
}


assert(posProductsData.includes("export function watchRetailStockCounts")&&posProductsData.includes('tenantCollection(id, "stockCounts")'),"POS Stock Counts realtime data mapping missing");
assert(posProductsData.includes('const countId=cleanName(input.id)||`COUNT-${Date.now()}`')&&posProductsData.includes("documentId||item._documentId||productId"),"POS Stock Counts must preserve legacy count IDs and legacy Firestore product document IDs");
for(const field of ["systemQty:before","actualQty:actual","variance:difference","itemCount:lines.length","system:before","difference","countedItems:lines.length"]) assert(posProductsData.includes(field),`POS Stock Counts legacy/React history compatibility field missing: ${field}`);
assert(posProductsData.includes('type:"adjustment"')&&!posProductsData.includes('type:"count"')&&posProductsData.includes('referenceType:"stock_count"')&&posProductsData.includes("input.movementNote"),"POS Stock Counts movements must stay rules-compatible for stock role while retaining stock-count references");
assert(firestoreRules.includes("request.resource.data.type in ['adjustment', 'purchase']"),"Stock Counts rules-compatibility safeguard requires the current stock-movement role type allowance");
assert(paritySync.includes('"retail-stock-counts.css"'),"POS Stock Counts CSS must remain sourced from the legacy MASTER parity sync");
assert(posStockCountsPage.includes('"retail-barcode-scan-tools.css"'),"React POS Stock Counts must load the legacy barcode scanner parity CSS");
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/stock-counts/index.html"'),"React postbuild must sync canonical /pos/stock-counts to the React shell");
assert(firebaseHostingConfig.includes('"source": "/pos/stock-counts"')&&firebaseHostingConfig.includes('"source": "/pos/stock-counts/**"'),"Hosting must cache-bust canonical React POS Stock Counts");

const legacyPosPurchasesMaster=read("tests/fixtures/retail-pos-legacy/pos-purchases-index.html");
const legacyPosPurchaseIds=[...legacyPosPurchasesMaster.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
assert(legacyPosPurchaseIds.length===16&&legacyPosPurchaseIds.includes("purchaseForm")&&legacyPosPurchaseIds.includes("supplierName")&&legacyPosPurchaseIds.includes("purchaseLines")&&legacyPosPurchaseIds.includes("purchaseTotal")&&legacyPosPurchaseIds.includes("purchaseHistory")&&legacyPosPurchaseIds.includes("toast"),"Retail POS Purchases legacy MASTER fixture must preserve the pre-React 16-ID UI/action inventory");
for(const id of legacyPosPurchaseIds) assert(posPurchasesPage.includes(`id="${id}"`),`React POS Purchases legacy ID missing: ${id}`);
for(const id of ["scanPurchaseLineBtn","purchaseDateFrom","purchaseDateTo","purchaseThisMonth","purchaseAll","exportPurchaseCsv","purchaseCount","purchaseGrandTotal","purchaseQtyTotal","supplierCount","supplierRanking","purchaseProductRanking","posScanDialog","posScanVideo","posScanStatus"]) assert(posPurchasesPage.includes(`id="${id}"`),`React POS Purchases runtime/report ID missing: ${id}`);
assert(appRoutes.includes('import { PosPurchasesPage }')&&appRoutes.includes('path="/pos/purchases"'),"React POS Purchases route must be mounted");
assert(posPurchasesPage.includes("getRetailPosSession")&&posPurchasesPage.includes('pagePermissions.has("pos.purchases")')&&posPurchasesPage.includes("firstAllowedPosPage(posAccessProfile, roleRows)")&&posPurchasesPage.includes("/pos/login/?next="),"React POS Purchases session/page-permission parity missing");
for(const permission of ["pos.purchases.create","pos.purchases.view_cost"]) assert(posPurchasesPage.includes(permission),`React POS Purchases granular permission missing: ${permission}`);
assert(posPurchasesPage.includes('localStorage.getItem("retail_pos_roles_v1")')&&posPurchasesPage.includes("ROLE_SETTINGS_TIMEOUT_MS = 6000")&&posPurchasesPage.includes("POS_ROLE_SETTINGS_TIMEOUT"),"React POS Purchases must use cached/built-in role readiness with a bounded role-settings wait");
assert(posPurchasesPage.includes("INITIAL_DATA_TIMEOUT_MS = 10000")&&posPurchasesPage.includes("POS_PURCHASES_INITIAL_LOAD_TIMEOUT"),"React POS Purchases initial data load must not block indefinitely");
assert(posPurchasesPage.includes("watchRetailProducts")&&posPurchasesPage.includes("watchPosSuppliers")&&posPurchasesPage.includes("watchPosPurchases"),"React POS Purchases must keep realtime product/supplier/purchase watchers");
assert(posPurchasesPage.includes('t(`pos_purchasing.purchases.${key}`')&&posPurchasesPage.includes('tr("form.title")')&&posPurchasesPage.includes('tr("history.title")')&&posPurchasesPage.includes('tr("report.export_csv")'),"React POS Purchases must use the five-language pos_purchasing.purchases translation catalog");
assert(posPurchasesPage.includes('hidden={!canCreate}')&&posPurchasesPage.includes('hidden={!canViewCost}')&&posPurchasesPage.includes('currentKey="pos.purchases"'),"React POS Purchases create/cost permission visibility and shared POS shell missing");
assert(posPurchasesPage.includes('"BarcodeDetector" in window')&&posPurchasesPage.includes("BrowserMultiFormatReader")&&posPurchasesPage.includes('scannerText("not_found")')&&posPurchasesPage.includes('const [toastType, setToastType] = useState("success")'),"React POS Purchases barcode scanner/typed Toast parity missing");
assert(posPurchasesPage.includes("sweetAlert")&&posPurchasesPage.includes('tr("report.no_export_data")')&&posPurchasesPage.includes('retail-purchases-${dateFrom || "all"}-${dateTo || "all"}.csv'),"React POS Purchases CSV export/no-data warning parity missing");
assert(posPurchasesPage.includes('bi bi-truck pos-context-icon')&&posPurchasesPage.includes('bi bi-plus-lg pos-context-icon')&&posPurchasesPage.includes('bi bi-download pos-context-icon')&&posPurchasesPage.includes('bi bi-bar-chart-line pos-context-icon'),"React POS Purchases must author the semantic icons injected by the legacy runtime");
assert(posPurchasesPage.includes('"retail-purchases-visual-dashboard.css"')&&posPurchasesPage.includes('className="purchase-visual-hero"')&&posPurchasesPage.includes('className="purchase-activity-panel"')&&posPurchasesPage.includes('className="purchase-history-title"')&&posPurchasesPage.includes("const purchaseTrend = useMemo"),"React POS Purchases Purchase Control Center structure missing");
assert(posPurchasesPage.includes('canViewCost ? amountText(reportStats.grandTotal) : "—"')&&posPurchasesPage.includes('hidden={!canViewCost}')&&posPurchasesPage.includes('className="purchase-stat-card purchase-stat-value" hidden={!canViewCost}')&&posPurchasesPage.includes('<div hidden={!canViewCost}>'),"React POS Purchases visual analytics must preserve view_cost masking");
assert(posPurchasesVisualCss.includes("linear-gradient(120deg,#083b2d")&&posPurchasesVisualCss.includes(".purchase-activity-bar")&&posPurchasesVisualCss.includes(".purchase-stat-card::after")&&posPurchasesVisualCss.includes(".purchase-table td[data-label]::before")&&posPurchasesVisualCss.includes("@media(max-width:620px)"),"React POS Purchases colorful visual dashboard/responsive treatment missing");
assert(posPurchasesPage.includes('bi bi-truck')&&posPurchasesPage.includes('bi bi-box-arrow-in-down')&&posPurchasesPage.includes('bi bi-graph-up-arrow')&&posPurchasesPage.includes('bi bi-clock-history')&&posPurchasesPage.includes('bi bi-cash-stack'),"React POS Purchases visual semantic icons missing");
for(const locale of ["th","en","my","lo","km"]){const visual=dict[locale]?.pos_purchasing?.purchases?.visual;assert(visual&&visual.kicker&&visual.hero_description&&visual.catalog_ready&&visual.report_title&&visual.activity_title&&visual.history_empty_hint,`React POS Purchases visual translations missing: ${locale}`);}
assert(posPurchasingData.includes("export function watchPosSuppliers")&&posPurchasingData.includes("export function watchPosPurchases")&&posPurchasingData.includes('purchaseId||`PO-${Date.now()}`')&&posPurchasingData.includes("documentId:String(i.documentId||i._documentId||i.productId)")&&posPurchasingData.includes("Promise.all(refs.map(entry=>tx.get(entry.ref)))"),"POS Purchases data layer must preserve PO IDs, legacy product document IDs, and transaction read-before-write safety");
assert(posPurchasingData.includes("creditDays")&&posPurchasingData.includes('referenceType:"purchase"')&&posPurchasingData.includes("referenceNumber:id"),"POS Purchases data layer must preserve payable credit fields and stock-movement purchase references");
assert(posPurchaseBarcodeCss.includes(".scan-barcode-btn.scan-toolbar-btn")&&posPurchaseBarcodeCss.includes(".purchase-lines-heading #scanPurchaseLineBtn"),"React POS Purchases scanner toolbar CSS parity missing");
assert(paritySync.includes('extract_runtime_css("retail-barcode-scan-tools.js", "retail-barcode-scan-tools.css")'),"POS Purchases scanner CSS must remain sourced from the legacy runtime during parity sync");
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/purchases/index.html"'),"React postbuild must sync canonical /pos/purchases to the React shell");
assert(firebaseHostingConfig.includes('"source": "/pos/purchases"')&&firebaseHostingConfig.includes('"source": "/pos/purchases/**"'),"Hosting must cache-bust canonical React POS Purchases");

assert(appRoutes.includes('import { PosPayablesPage }')&&appRoutes.includes('path="/pos/payables"'),"React POS Payables route must be mounted");
for(const id of ["payableOutstanding","payableOpenCount","payableDueSoon","payableOverdue","payableSearch","payableStatusFilter","supplierPayableSummary","payableTableBody","payableEmpty","paymentDialog","supplierPaymentForm","paymentPurchaseId","paymentPurchaseInfo","supplierPaymentDate","supplierPaymentAmount","supplierPaymentMethod","supplierPaymentReference","supplierPaymentNote","supplierPaymentError","closePaymentDialog","cancelPaymentBtn","toast"]) assert(posPayablesPage.includes(`id="${id}"`),`React POS Payables legacy ID missing: ${id}`);
assert(posPayablesPage.includes("getRetailPosSession")&&posPayablesPage.includes('pagePermissions.has("pos.payables")')&&posPayablesPage.includes("firstAllowedPosPage(posAccessProfile, roleRows)")&&posPayablesPage.includes("/pos/login/?next="),"React POS Payables session/page-permission parity missing");
for(const permission of ["pos.payables.pay","pos.payables.view_amount"]) assert(posPayablesPage.includes(permission),`React POS Payables granular permission missing: ${permission}`);
assert(posPayablesPage.includes('localStorage.getItem("retail_pos_roles_v1")')&&posPayablesPage.includes("ROLE_SETTINGS_TIMEOUT_MS = 6000")&&posPayablesPage.includes("POS_ROLE_SETTINGS_TIMEOUT"),"React POS Payables must use cached/built-in role readiness with a bounded role-settings wait");
assert(posPayablesPage.includes("INITIAL_DATA_TIMEOUT_MS = 10000")&&posPayablesPage.includes("POS_PAYABLES_INITIAL_LOAD_TIMEOUT"),"React POS Payables initial data load must not block indefinitely");
assert(posPayablesPage.includes("watchPosPurchases")&&posPayablesPage.includes("watchPosSuppliers"),"React POS Payables must keep realtime purchase/supplier watchers");
assert(posPayablesPage.includes("purchase.creditDays ?? supplier?.creditDays ?? 0")&&posPayablesPage.includes("payments.length")&&posPayablesPage.includes("Math.max(0, total - paidAmount)")&&posPayablesPage.includes("purchase.dueDate || addDays"),"React POS Payables must preserve legacy supplier-credit/payment-history normalization");
assert(posPayablesPage.includes('t(`pos_purchasing.payables.${key}`')&&posPayablesPage.includes('tr("header.title")')&&posPayablesPage.includes('tr("payment.title")'),"React POS Payables must use the five-language pos_purchasing.payables translation catalog");
assert(posPayablesPage.includes('canViewAmount ? amountText(stats.outstanding) : "—"')&&posPayablesPage.includes('id="payableOutstanding" hidden={!canViewAmount}')&&posPayablesPage.includes('className="panel payable-supplier-panel" hidden={!canViewAmount}')&&posPayablesPage.includes('data-label={tr("columns.total")} hidden={!canViewAmount}'),"React POS Payables amount surfaces must preserve view_amount masking");
assert(posPayablesPage.includes('hidden={!canPay} onClick={() => openPayment(row)}')&&posPayablesPage.includes('setPaymentAmount(canViewAmount ? Number(row.balance || 0).toFixed(2) : "")')&&posPayablesPage.includes("recordPosPayablePayment"),"React POS Payables payment action must preserve pay permission and avoid revealing balance without view_amount");
assert(posPayablesPage.includes('"retail-payables-visual-dashboard.css"')&&posPayablesPage.includes('className="payable-visual-hero"')&&posPayablesPage.includes('className="panel payable-risk-panel"')&&posPayablesPage.includes('className="payment-dialog payable-payment-dialog"'),"React POS Payables Control Center structure missing");
assert(posPayablesVisualCss.includes("linear-gradient(120deg,#083b2d")&&posPayablesVisualCss.includes(".payable-risk-track")&&posPayablesVisualCss.includes(".payable-stat-card::after")&&posPayablesVisualCss.includes(".payable-table td[data-label]::before")&&posPayablesVisualCss.includes("#paymentDialog.payable-payment-dialog")&&posPayablesVisualCss.includes("@media(max-width:620px)"),"React POS Payables colorful visual dashboard/responsive treatment missing");
for(const locale of ["th","en","my","lo","km"]){const visual=dict[locale]?.pos_purchasing?.payables?.visual;assert(visual&&visual.kicker&&visual.hero_description&&visual.open_suppliers&&visual.risk_title&&visual.supplier_title&&visual.payment_description,`React POS Payables visual translations missing: ${locale}`);}
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/payables/index.html"'),"React postbuild must sync canonical /pos/payables to the React shell");
assert(firebaseHostingConfig.includes('"source": "/pos/payables"')&&firebaseHostingConfig.includes('"source": "/pos/payables/**"'),"Hosting must cache-bust canonical React POS Payables");


assert(appRoutes.includes('import { PosSuppliersPage }')&&appRoutes.includes('path="/pos/suppliers"'),"React POS Suppliers route must be mounted");
for(const id of ["supplierTotal","activeSupplierTotal","supplierPurchaseTotal","supplierPurchaseCount","addSupplierBtn","supplierSearch","supplierFilter","supplierGrid","supplierEmpty","supplierDialog","supplierForm","supplierDialogTitle","editingSupplierId","supplierName","supplierContact","supplierPhone","supplierEmail","supplierTaxId","supplierCreditDays","supplierAddress","supplierNote","supplierFormError","closeSupplierDialog","cancelSupplierBtn","toast"]) assert(posSuppliersPage.includes(`id="${id}"`),`React POS Suppliers legacy ID missing: ${id}`);
assert(posSuppliersPage.includes("getRetailPosSession")&&posSuppliersPage.includes('pagePermissions.has("pos.suppliers")')&&posSuppliersPage.includes("firstAllowedPosPage(posAccessProfile,roleRows)")&&posSuppliersPage.includes("/pos/login/?next="),"React POS Suppliers session/page-permission parity missing");
for(const permission of ["pos.suppliers.create","pos.suppliers.edit","pos.suppliers.delete","pos.suppliers.view_purchase"]) assert(posSuppliersPage.includes(permission),`React POS Suppliers granular permission missing: ${permission}`);
assert(posSuppliersPage.includes('localStorage.getItem("retail_pos_roles_v1")')&&posSuppliersPage.includes("ROLE_SETTINGS_TIMEOUT_MS=6000")&&posSuppliersPage.includes("POS_ROLE_SETTINGS_TIMEOUT"),"React POS Suppliers must use cached/built-in role readiness with a bounded role-settings wait");
assert(posSuppliersPage.includes("INITIAL_DATA_TIMEOUT_MS=10000")&&posSuppliersPage.includes("POS_SUPPLIERS_INITIAL_LOAD_TIMEOUT"),"React POS Suppliers initial data load must not block indefinitely");
assert(posSuppliersPage.includes("watchPosSuppliers")&&posSuppliersPage.includes("watchPosPurchases"),"React POS Suppliers must keep realtime supplier/purchase watchers");
assert(posSuppliersPage.includes('const keys=[String(purchase.supplierId||""),String(purchase.supplierName||"").trim().toLowerCase()]')&&posSuppliersPage.includes("summary.count>0")&&posSuppliersPage.includes('filter==="active"&&hasHistory')&&posSuppliersPage.includes('filter==="inactive"&&!hasHistory'),"React POS Suppliers must preserve legacy purchase-history supplier matching/filter semantics");
assert(posSuppliersPage.includes('t(`pos_purchasing.suppliers.${key}`')&&posSuppliersPage.includes('tr("header.title")')&&posSuppliersPage.includes('tr("panel.title")'),"React POS Suppliers must use the five-language pos_purchasing.suppliers translation catalog");
assert(posSuppliersPage.includes('id="supplierPurchaseTotal" hidden={!canViewPurchase}')&&posSuppliersPage.includes('id="supplierPurchaseCount" hidden={!canViewPurchase}')&&posSuppliersPage.includes('className="supplier-summary" hidden={!canViewPurchase}')&&posSuppliersPage.includes('canViewPurchase?formatNumber(stats.purchaseCount):"—"'),"React POS Suppliers purchase-derived surfaces must preserve view_purchase masking");
assert(posSuppliersPage.includes("savePosSupplier")&&posSuppliersPage.includes("deletePosSupplier")&&posSuppliersPage.includes("sweetConfirm")&&!posSuppliersPage.includes("window.confirm(")&&posSuppliersPage.includes('tr("runtime.delete_used")'),"React POS Suppliers CRUD/destructive confirmation parity missing");
assert(posSuppliersPage.includes('"retail-suppliers-visual-dashboard.css"')&&posSuppliersPage.includes('className="supplier-visual-hero"')&&posSuppliersPage.includes('className="supplier-stat-card supplier-stat-total"')&&posSuppliersPage.includes('className="supplier-dialog supplier-editor-dialog"'),"React POS Suppliers Supplier Control Center structure missing");
assert(posSuppliersVisualCss.includes("linear-gradient(120deg,#083b2d")&&posSuppliersVisualCss.includes(".supplier-stat-card::after")&&posSuppliersVisualCss.includes(".supplier-card::before")&&posSuppliersVisualCss.includes("#supplierDialog.supplier-editor-dialog")&&posSuppliersVisualCss.includes("@media(max-width:620px)"),"React POS Suppliers colorful visual dashboard/responsive treatment missing");
for(const locale of ["th","en","my","lo","km"]){const visual=dict[locale]?.pos_purchasing?.suppliers?.visual;assert(visual&&visual.kicker&&visual.hero_description&&visual.integrated&&visual.average_credit&&visual.search_label&&visual.form_description,`React POS Suppliers visual translations missing: ${locale}`);}
assert(posPurchasingData.includes("export function watchPosSuppliers")&&posPurchasingData.includes("export async function savePosSupplier")&&posPurchasingData.includes("export async function deletePosSupplier")&&posPurchasingData.includes('tenantCollection(tenantId,"suppliers")'),"POS Suppliers Firestore CRUD/realtime mapping missing");
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/suppliers/index.html"'),"React postbuild must sync canonical /pos/suppliers to the React shell");
assert(firebaseHostingConfig.includes('"source": "/pos/suppliers"')&&firebaseHostingConfig.includes('"source": "/pos/suppliers/**"'),"Hosting must cache-bust canonical React POS Suppliers");


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

const platformTenantService=read("react-app/src/data/platformTenantService.js");
for(const marker of [
  'hydrateTenantLalamoveState',
  'getDoc(doc(db, "tenants", tenantId, "settings", "lalamove"))',
  'getDoc(doc(db, "tenants", tenantId, "settings", "lalamoveWallet"))',
  'fodCentralApproved: lalamove?.fodCentralApproved === true',
  'return Promise.all(tenants.map(hydrateTenantLalamoveState))'
]) assert(platformTenantService.includes(marker),"tenant Lalamove hydration contract missing: "+marker);

const adminTenantsPage=read("react-app/src/pages/AdminTenantsPage.jsx");
assert(
  adminTenantsPage.includes('tenant.lalamove?.accountMode === "fod_central"')
  &&adminTenantsPage.includes('data-lalamove-approval={tenant.id}')
  &&adminTenantsPage.includes('setLalamoveApprovalBusy(tenant.id)')
  &&adminTenantsPage.includes('const result = await updateTenantLalamoveApproval({ tenantId: tenant.id, approved: nextApproved })')
  &&adminTenantsPage.includes('setTenants(current => current.map(item => item.id === tenant.id ? {')
  &&adminTenantsPage.includes('lalamoveApprovalBusy={lalamoveApprovalBusy === tenant.id}'),
  "Super Admin tenant page must expose a non-blocking central Lalamove approval action only for fod_central tenants"
);
const lalamoveApprovalHandler=adminTenantsPage.slice(
  adminTenantsPage.indexOf("const toggleLalamoveApproval = async tenant =>"),
  adminTenantsPage.indexOf("const refreshWallet = async tenant =>")
);
assert(
  !lalamoveApprovalHandler.includes("await loadTenantList()")
  &&lalamoveApprovalHandler.includes('setLalamoveApprovalBusy("")'),
  "Lalamove approval must update the target tenant locally without blocking on a full tenant-list reload"
);
assert(adminTenantsPage.includes("initialTenantsReady")&&adminTenantsPage.includes('profile?.role === "super_admin" && !initialTenantsReady'),"Admin Tenants full-page readiness must wait for the initial tenant list");
const initialTenantEffect=adminTenantsPage.slice(adminTenantsPage.indexOf("// Critical page data starts immediately"),adminTenantsPage.indexOf("useEffect(() => {",adminTenantsPage.indexOf("// Critical page data starts immediately")+1));
assert(initialTenantEffect.indexOf("loadTenantList();")>=0&&initialTenantEffect.indexOf("loadTenantList();")<initialTenantEffect.indexOf("backfillTenantSubscriptions"),"Admin Tenants must start tenant loading before subscription backfill");
assert(adminTenantsPage.includes("loadTenantList({ silent: true })"),"Admin Tenants backfill refresh must remain silent after initial render");
const salesReportPage=read("react-app/src/pages/AdminSalesReportPage.jsx");
const salesReportModernCss=read("react-app/public/parity/css/sales-report-modern.css");
const salesReportParityCss=read("react-app/public/parity/css/admin-sales-report-retail-pos-parity.css");
assert(salesReportModernCss.includes("width: min(1320px, 100%);"),"Sales Report desktop width contract missing");
assert(salesReportParityCss.includes("body.sales-report-workspace .sales-report-page")&&salesReportParityCss.includes("width: min(1320px, 100%);"),"Sales Report final parity bundle must preserve 1320px desktop width");
assert(
  salesReportPage.includes('className="super-admin-header-leading sales-report-header-leading"')
  &&salesReportPage.includes('className="brand sales-report-header-brand"')
  &&salesReportPage.includes('className="btn btn-dark btn-sm sales-back-link super-admin-header-back"')
  &&salesReportModernCss.includes("body.sales-report-workspace .sales-report-header-leading")
  &&salesReportModernCss.includes("flex: 0 1 auto !important;")
  &&salesReportModernCss.includes("body.sales-report-workspace .sales-back-link .app-icon::before")
  &&salesReportModernCss.includes("place-items: center !important;")
  &&salesReportModernCss.includes("vertical-align: middle !important;"),
  "Sales Report mobile header must keep Back clustered left with a vertically centered arrow"
);
assert(
  salesReportPage.includes('className="sales-summary-grid sales-kpi-grid"')
  &&salesReportPage.includes('className="sales-kpi-card sales-kpi-card--primary"')
  &&salesReportPage.includes('className="sales-kpi-card__head"')
  &&salesReportPage.includes('className="sales-kpi-card__metric"')
  &&!salesReportPage.includes('className="summary-card primary"')
  &&salesReportModernCss.includes("body.sales-report-workspace .sales-kpi-card")
  &&salesReportModernCss.includes("grid-template-columns: repeat(4, minmax(0, 1fr));")
  &&salesReportModernCss.includes("grid-template-columns: repeat(2, minmax(0, 1fr));")
  &&salesReportModernCss.includes("overflow: hidden;")
  &&salesReportModernCss.includes("font-variant-numeric: tabular-nums;"),
  "Sales Report KPI cards must use the dedicated non-overlapping responsive card system"
);
assert(
  salesReportPage.includes('className="table-scroll receipt-table-scroll"')
  &&salesReportPage.includes('data-horizontal-scroll="true"')
  &&!salesReportPage.includes("function useHorizontalScroller(ref)")
  &&!salesReportPage.includes("receiptScrollRef")
  &&!salesReportPage.includes('element.addEventListener("pointermove"')
  &&salesReportModernCss.includes("body.sales-report-workspace .receipt-table-scroll")
  &&salesReportModernCss.includes("overflow-x: auto !important;")
  &&salesReportModernCss.includes("-webkit-overflow-scrolling: touch;")
  &&salesReportModernCss.includes("overscroll-behavior-x: contain;")
  &&salesReportModernCss.includes("scrollbar-color: var(--green) transparent;")
  &&!salesReportModernCss.includes("touch-action: pan-y;")
  &&salesReportModernCss.includes("body.sales-report-workspace .receipt-table-scroll > .receipt-table")
  &&salesReportModernCss.includes("display: table !important;")
  &&salesReportModernCss.includes("width: 100% !important;")
  &&salesReportModernCss.includes("min-width: 980px !important;")
  &&salesReportModernCss.includes("max-width: none !important;")
  &&salesReportModernCss.includes("overflow: visible !important;"),
  "Sales Report receipt table must keep the wrapper as the only horizontal scroll container and override the global mobile table scroller"
);
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
assert(sharedIconsCss.includes(".owner-password-backdrop {")&&sharedIconsCss.includes(".owner-password-dialog {")&&sharedIconsCss.includes("margin: 0;")&&sharedIconsCss.includes("z-index: var(--ui-layer-modal-z, 2147483000);"),"Owner password dialog shared CSS missing from parity icons.css");
assert(
  sharedIconsCss.includes("@media (max-width: 600px) {")
  &&sharedIconsCss.includes(".owner-password-backdrop { align-items: center; justify-items: center; padding: 10px; }")
  &&!sharedIconsCss.includes(".owner-password-backdrop { align-items: end; padding: 10px; }"),
  "Owner password modal must stay vertically centered on mobile"
);
const layerCss=read("react-app/public/parity/css/ui-layer-stack.css");
assert(layerCss.includes(".owner-password-backdrop,")&&layerCss.includes("--ui-layer-modal-z: 2147483000;")&&layerCss.includes("--ui-layer-dialog-z: 2147483600;")&&layerCss.includes("--ui-layer-toast-z: 2147483647;"),"Owner password modal must remain below SweetAlert and Toast layers");
assert(cashierPage.includes("bi bi-printer app-icon")&&cashierPage.includes("bi bi-x-circle app-icon"),"Cashier order action icons must use Laravel MASTER app-icon markup");
assert(
  cashierPage.includes("function lalamoveCodAwaitingSettlement(order)")
  && cashierPage.includes("if (lalamoveCodAwaitingSettlement(order)) return true;")
  && cashierPage.includes('cashier-cod-settlement-action')
  && cashierPage.includes('patch.lalamoveCodSettlementStatus = "received";')
  && cashierPage.includes('patch.lalamoveCodSettledAt = now;')
  && staticDeliveryRuntime.includes('orderPayload.lalamoveCodEnabled = lalamoveCodEnabled;')
  && staticDeliveryRuntime.includes('orderPayload.lalamoveCodAmount = lalamoveCodEnabled ? finalTotal : 0;')
  && staticDeliveryRuntime.includes('throw new Error("LALAMOVE_COD_UNAVAILABLE")')
  && cashierPage.includes("const legacyCodBackfill = isLalamoveCod(order) && order.lalamoveCodEnabled !== true;")
  && cashierPage.includes('lalamoveCodSettlementStatus: order.lalamoveCodSettlementStatus || "pending"')
  && cashierPage.includes("CASHIER_LALAMOVE_COD_BACKFILL_ROLLBACK_FAILED"),
  "Lalamove COD must be marked at checkout and remain unpaid until completed delivery plus manual settlement confirmation",
);
for (const locale of ["th","en","my","lo","km"]) {
  const cod = dict[locale]?.cashier?.lalamove;
  for (const key of ["cod_waiting_settlement","cod_receive","cod_before_delivery","cod_settlement_confirm","cod_settlement_saved"]) {
    assert(cod?.[key], `Cashier Lalamove COD settlement translation missing: ${locale}.${key}`);
  }
}
assert(
  cashierPage.includes("const dispatchedLocked = order.lalamoveOrderId && !lalamoveDispatchFinished(order);")
  && cashierPage.includes('title={t("cashier.lalamove.local_cancel_locked")}')
  && !cashierPage.includes("PENGUIN_CASHIER_ORDER_CANCEL"),
  "Cashier must preserve the original Lalamove local-cancel lock and keep provider cancellation separate",
);
assert(
  cashierPage.includes('if (order.orderType === "takeaway")')
  && cashierPage.includes('await updateOrder(order.id, { status: "cancelled" });'),
  "Cashier takeaway cancellation must use the proven operational status-update path",
);
assert(
  (cashierPage.match(/bi bi-cash-coin app-icon/g)||[]).length===4
  &&(cashierPage.match(/cashier-payment-action/g)||[]).length===4
  &&cashierPage.includes('onClick={() => actions.pay(order)}><i className="bi bi-cash-coin app-icon"')
  &&cashierPage.includes('onClick={() => actions.payTable(sorted)}><i className="bi bi-cash-coin app-icon"')
  &&cashierRefreshCss.includes(".cashier-payment-action .bi-cash-coin.app-icon::before")
  &&cashierRefreshCss.includes("transform: translateY(0);"),
  "Cashier receive-payment actions must use the centered cash/coin icon while non-payment confirmation actions retain their semantic icons"
);
const kitchenPage=read("react-app/src/pages/KitchenPage.jsx");
const kitchenItemEditorCss=read("react-app/public/parity/css/kitchen-item-editor.css");
assert(
  kitchenPage.includes('className="kitchen-item-editor-title"')
  && kitchenPage.includes('bi bi-pencil-square app-icon')
  && kitchenPage.includes('data-close-editor disabled={busy} onClick={onClose}><i className="bi bi-x-circle app-icon"')
  && kitchenPage.includes('data-save-editor disabled={busy}') && kitchenPage.includes('bi bi-floppy app-icon'),
  "Kitchen edit-item modal must keep semantic title/cancel/save icons",
);
assert(
  kitchenPage.includes('data-cancel-item={order.id} data-item-index={index} onClick={() => onCancelItem(order, index)}><i className="bi bi-x-circle app-icon"')
  &&kitchenPage.includes('data-cancel-order={order.id} onClick={() => onCancelOrder(order)}><i className="bi bi-x-circle app-icon"')
  &&kitchenPage.includes('<span>{t("kitchen.actions.cancel_order")}</span>'),
  "Kitchen item/order cancel actions must use the same x-circle app-icon markup as Cashier"
);
assert(
  !kitchenPage.includes("cancelLalamoveDispatch")
  && kitchenPage.includes("!locked ? <button")
  && !kitchenPage.includes("PENGUIN_KITCHEN_ORDER_CANCEL"),
  "Kitchen must preserve the original active-Lalamove lock for local order cancellation",
);
assert(
  kitchenPage.includes("if (isTakeaway(order))")
  && kitchenPage.includes('status: "cancelled"')
  && kitchenPage.includes("subtotalAmount: 0")
  && kitchenPage.includes("deliveryFee: 0")
  && kitchenPage.includes("totalAmount: 0"),
  "Kitchen takeaway cancellation must use the Laravel-parity status/totals update path",
);
assert(
  kitchenItemEditorCss.includes('.kitchen-item-actions .btn[data-cancel-item],')
  &&kitchenItemEditorCss.includes('.kitchen-order-actions .btn[data-cancel-order]')
  &&kitchenItemEditorCss.includes('place-items: center !important;')
  &&kitchenItemEditorCss.includes('align-self: center !important;')
  &&kitchenItemEditorCss.includes('.bi-x-circle.app-icon::before')
  &&kitchenItemEditorCss.includes('transform: translateY(1px);'),
  "Kitchen cancel icons must keep Cashier-style vertical centering and x-circle optical alignment"
);
assert(
  cashierPage.includes('CashierOrderNotifier orders={orders} onToast={showToast} surface="cashier"')
  &&kitchenPage.includes('CashierOrderNotifier orders={orders} onToast={showToast} surface="kitchen"'),
  "Cashier/Kitchen shared order notifier mount missing",
);
assert(cashierPage.includes("CASHIER_INITIAL_LOAD_TIMEOUT")&&cashierPage.includes("watchOperationalOrders")&&!cashierPage.includes("loadOperationalSnapshot"),"Cashier must open from realtime orders and must not deadlock on the heavy snapshot");
const authProvider=read("react-app/src/auth/AuthProvider.jsx");
assert(authProvider.includes("AUTH_INITIAL_TIMEOUT_MS")&&authProvider.includes("PROFILE_TIMEOUT_MS")&&authProvider.includes("auth.authStateReady")&&authProvider.includes("resolveUser(auth.currentUser)"),"AuthProvider initial-state/profile timeout fail-safe missing");
const cashierNotifier=read("react-app/src/components/CashierOrderNotifier.jsx");
const orderAlertAudio=read("react-app/src/components/orderAlertAudio.js");
assert(
  cashierNotifier.includes('id="orderAlertButton"')
  &&cashierNotifier.includes('food_order_order_alerts_enabled_v4')
  &&cashierNotifier.includes('localStorage.setItem(ENABLED_KEY, "1")')
  &&cashierNotifier.includes("orders.filter(actualOrder)")
  &&!cashierNotifier.includes('type !== "walkin"')
  &&cashierNotifier.includes("announcementChainRef")
  &&cashierNotifier.includes('document.addEventListener("pointerdown", unlockFromInteraction, true)')
  &&cashierNotifier.includes("createOrderAlertAudioController"),
  "Cashier/Kitchen order alerts must default on, include Walk-in, unlock from staff interaction, and queue spoken alerts",
);
assert(
  orderAlertAudio.includes("มียอดสั่งซื้อใหม่")
  &&orderAlertAudio.includes('return "เดลิเวอรี่"')
  &&orderAlertAudio.includes('return "เทคอะเวย์"')
  &&orderAlertAudio.includes('return "วอล์กอิน"')
  &&orderAlertAudio.includes('return "ออเดอร์"')
  &&orderAlertAudio.includes("659.25")
  &&orderAlertAudio.includes("783.99")
  &&orderAlertAudio.includes("987.77")
  &&orderAlertAudio.includes("kanya")
  &&orderAlertAudio.includes("premwadee")
  &&orderAlertAudio.includes("utterance.rate = 0.96")
  &&orderAlertAudio.includes('utterance.lang = voice?.lang || "th-TH"'),
  "Order alert audio must keep the Waiting Queue-style melody plus natural Thai female speech with channel and amount",
);
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


/* POS Stock Movements visual control-center regression — 2026-10-05 */
assert(
  posStockMovementsPage.includes('"retail-stock-movements-visual-dashboard.css"')
  && posStockMovementsPage.includes('className="movement-visual-hero"')
  && posStockMovementsPage.includes('className="movement-activity-chart"')
  && posStockMovementsPage.includes('className="panel movement-mix-panel"')
  && posStockMovementsPage.includes("const movementTrend = useMemo")
  && posStockMovementsPage.includes("const movementMix = useMemo"),
  "React POS Stock Movements visual control-center structure missing",
);
assert(
  posStockMovementsPage.includes('canViewQuantity ? number(movementInsights.largestChange) : "—"')
  && posStockMovementsPage.includes('canViewQuantity ? number(stats.incoming + stats.outgoing) : "—"'),
  "React POS Stock Movements visual analytics must not expose quantity-derived values without view_quantity permission",
);
assert(
  posStockMovementsVisualCss.includes("linear-gradient(120deg,#073c2c")
  && posStockMovementsVisualCss.includes(".movement-activity-bar")
  && posStockMovementsVisualCss.includes(".movement-mix-track")
  && posStockMovementsVisualCss.includes(".movement-stat-card::before")
  && posStockMovementsVisualCss.includes(".movement-table tr::before")
  && posStockMovementsVisualCss.includes("@media(max-width:620px)"),
  "React POS Stock Movements colorful visual dashboard/responsive treatment missing",
);
assert(
  posStockMovementsPage.includes("MOVEMENT_ICONS")
  && posStockMovementsPage.includes('bi bi-boxes')
  && posStockMovementsPage.includes('bi bi-bar-chart-line-fill')
  && posStockMovementsPage.includes('bi bi-pie-chart-fill')
  && posStockMovementsPage.includes('bi bi-clock-history'),
  "React POS Stock Movements visual semantic icons missing",
);
for (const locale of ["th", "en", "my", "lo", "km"]) {
  const visual = dict[locale]?.pos_stock?.movements?.visual;
  assert(
    visual
      && visual.kicker
      && visual.hero_description
      && visual.active_products
      && visual.activity_title
      && visual.mix_title
      && visual.product_filter,
    `React POS Stock Movements visual translations missing: ${locale}`,
  );
}

/* POS Customers canonical React / Customer & Loyalty Control Center — 2026-10-05 */
assert(appRoutes.includes('import { PosCustomersPage }')&&appRoutes.includes('path="/pos/customers"'),"React POS Customers route must be mounted");
for(const id of ["customerTotal","activeCustomerTotal","customerSalesTotal","customerBillTotal","addCustomerBtn","customerSearch","customerFilter","customerGrid","customerEmpty","customerDialog","customerForm","customerDialogTitle","closeCustomerDialog","editingCustomerId","customerName","customerPhone","customerEmail","customerAddress","customerNote","customerFormError","cancelCustomerBtn","customerHistoryDialog","customerHistoryTitle","closeCustomerHistory","customerHistoryList","toast"]) assert(posCustomersPage.includes('id="'+id+'"'),"React POS Customers legacy ID missing: "+id);
assert(posCustomersPage.includes("getRetailPosSession")&&posCustomersPage.includes('pagePermissions.has("pos.customers")')&&posCustomersPage.includes("firstAllowedPosPage(posAccessProfile, roleRows)")&&posCustomersPage.includes("/pos/login/?next="),"React POS Customers session/page-permission parity missing");
for(const permission of ["pos.customers.create","pos.customers.edit","pos.customers.delete","pos.customers.view_history","pos.customers.view_points","pos.customers.view_sales"]) assert(posCustomersPage.includes(permission),"React POS Customers granular permission missing: "+permission);
assert(posCustomersPage.includes('localStorage.getItem("retail_pos_roles_v1")')&&posCustomersPage.includes("ROLE_SETTINGS_TIMEOUT_MS = 6000")&&posCustomersPage.includes("POS_ROLE_SETTINGS_TIMEOUT"),"React POS Customers must use cached/built-in role readiness with a bounded role-settings wait");
assert(posCustomersPage.includes("INITIAL_DATA_TIMEOUT_MS = 10000")&&posCustomersPage.includes("POS_CUSTOMERS_INITIAL_LOAD_TIMEOUT"),"React POS Customers initial data load must not block indefinitely");
assert(posCustomersPage.includes("watchPosCustomers")&&posCustomersPage.includes("watchPosSales")&&posCustomersPage.includes("watchPosLoyaltyLedger"),"React POS Customers must keep realtime customer/sale/loyalty watchers");
assert(posCustomersPage.includes('salesMap.get(String(customer?.id || ""))')&&posCustomersPage.includes('salesMap.get(String(customer?.name || "").trim().toLowerCase())')&&posCustomersPage.includes('filter === "active" && hasHistory')&&posCustomersPage.includes('filter === "inactive" && !hasHistory'),"React POS Customers must preserve legacy purchase-history matching/filter semantics");
assert(posCustomersPage.includes('saleNet = sale => Math.max(0, Number(sale?.totalAmount ?? sale?.total ?? 0) - Number(sale?.refundTotal || 0))'),"React POS Customers lifetime sales must remain net of returns/refunds");
assert(posCustomersPage.includes("pos_customers.")&&posCustomersPage.includes('tr("header.title")')&&posCustomersPage.includes('tr("history.title")')&&posCustomersPage.includes('tr("loyalty.title")'),"React POS Customers must use the five-language pos_customers catalog");
assert(posCustomersPage.includes('id="customerSalesTotal" hidden={!canViewSales}')&&posCustomersPage.includes('id="customerBillTotal" hidden={!canViewSales}')&&posCustomersPage.includes('className="customer-summary" hidden={!canViewSales}')&&posCustomersPage.includes('canViewSales ? formatNumber(stats.bills) : "—"'),"React POS Customers sales-derived surfaces must preserve view_sales masking");
assert(posCustomersPage.includes('data-loyalty-customer-id={customer.id}')&&posCustomersPage.includes('hidden={!canViewPoints}')&&posCustomersPage.includes('id="loyaltyHistoryDialog"')&&posCustomersPage.includes("watchPosLoyaltyLedger"),"React POS Customers loyalty balance/history must preserve view_points gating");
assert(posCustomersPage.includes('data-action="history"')&&posCustomersPage.includes('hidden={!canViewHistory}')&&posCustomersPage.includes('id="customerHistoryDialog"'),"React POS Customers purchase history must preserve view_history gating");
assert(posCustomersPage.includes("savePosCustomer")&&posCustomersPage.includes("deletePosCustomer")&&posCustomersPage.includes("sweetConfirm")&&!posCustomersPage.includes("window.confirm(")&&posCustomersPage.includes('tr("runtime.delete_used")'),"React POS Customers CRUD/destructive confirmation parity missing");
assert(posCustomersPage.includes('"retail-customers-visual-dashboard.css"')&&posCustomersPage.includes('className="customer-visual-hero"')&&posCustomersPage.includes('className="customer-stat-card customer-stat-total"')&&posCustomersPage.includes('className="customer-dialog customer-editor-dialog"'),"React POS Customers Customer & Loyalty Control Center structure missing");
assert(posCustomersVisualCss.includes("linear-gradient(120deg,#083b2d")&&posCustomersVisualCss.includes(".customer-stat-card::after")&&posCustomersVisualCss.includes(".customer-card::before")&&posCustomersVisualCss.includes("#customerDialog.customer-editor-dialog")&&posCustomersVisualCss.includes("@media(max-width:620px)"),"React POS Customers colorful visual dashboard/responsive treatment missing");
for(const locale of ["th","en","my","lo","km"]){const visual=dict[locale]?.pos_customers?.visual;assert(visual&&visual.kicker&&visual.hero_description&&visual.integrated&&visual.average_points&&visual.search_label&&visual.form_description&&dict[locale]?.pos_customers?.loyalty?.title,"React POS Customers visual/loyalty translations missing: "+locale);}
assert(posData.includes("export function watchPosCustomers")&&posData.includes("export async function listPosLoyaltyLedger")&&posData.includes("export function watchPosLoyaltyLedger")&&posData.includes('tenantCollection(tenantId, "loyaltyLedger")'),"POS Customers realtime customer/loyalty mapping missing");
assert(read("tools/sync-react-legacy-entrypoints.py").includes('"public/pos/customers/index.html"'),"React postbuild must sync canonical /pos/customers to the React shell");
assert(firebaseHostingConfig.includes('"source": "/pos/customers"')&&firebaseHostingConfig.includes('"source": "/pos/customers/**"'),"Hosting must cache-bust canonical React POS Customers");
