import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const fail = message => {
  console.error(`P0 action contract: FAIL — ${message}`);
  process.exit(1);
};
const requireAll = (name, source, needles) => {
  for (const needle of needles) {
    if (!source.includes(needle)) fail(`${name} missing contract: ${needle}`);
  }
};

const adminPage = read("react-app/src/pages/AdminPage.jsx");
const adminData = read("react-app/src/data/adminData.js");
const adminQrPage = read("react-app/src/pages/AdminQrPage.jsx");
const revenueSharePage = read("react-app/src/pages/RevenueShareReportPage.jsx");
const revenueShareData = read("react-app/src/data/revenueShareReportData.js");
const adminUsersPage = read("react-app/src/pages/AdminUsersPage.jsx");
const adminStaff = read("react-app/src/data/adminStaff.js");
const staffAdminFunction = read("functions/staff-admin.js");
const quickOrderPage = read("react-app/src/pages/QuickOrderPage.jsx");
const quickOrderCss = read("react-app/public/parity/css/quick-order.css");
const cashierReceiptPage = read("react-app/src/pages/CashierReceiptPage.jsx");
const cashierTableQrPage = read("react-app/src/pages/CashierTableQrPage.jsx");
const cashier = read("react-app/src/pages/CashierPage.jsx");
const operational = read("react-app/src/data/operationalData.js");
const waiting = read("react-app/src/pages/WaitingQueuePage.jsx");
const waitingCore = read("react-app/src/data/waitingQueueCore.js");
const waitingCustomer = read("react-app/src/pages/WaitingQueueCustomerPage.jsx");
const tenants = read("react-app/src/pages/AdminTenantsPage.jsx");
const tenantService = read("react-app/src/data/platformTenantService.js");
const platformPage = read("react-app/src/pages/PlatformPage.jsx");
const platformSettingsService = read("react-app/src/data/platformSettingsService.js");
const platformBrandingService = read("react-app/src/data/platformBrandingService.js");
const platformContactPage = read("react-app/src/pages/PlatformContactPage.jsx");
const platformContactService = read("react-app/src/data/platformContactService.js");
const platformOwnersPage = read("react-app/src/pages/PlatformOwnersPage.jsx");
const platformPricingPage = read("react-app/src/pages/PlatformPricingPage.jsx");
const subscriptionPricing = read("react-app/src/data/subscriptionPricing.js");
const platformSettingsFunction = read("functions/platform-settings.js");
const tenantAdminFunction = read("functions/tenant-admin.js");
const subscriptionPricingFunction = read("functions/subscription-pricing.js");
const firestoreRules = read("firestore.rules");
const saasPage = read("react-app/src/pages/SaasSetupPage.jsx");
const saasService = read("react-app/src/data/saasMigrationService.js");
const saasFunction = read("functions/saas-migration.js");

requireAll("Admin settings/menu/table actions", adminPage, [
  "await saveAdminStoreSettings(tenant.id, payload)",
  "await saveAdminMenu(tenant.id, {",
  "await saveAdminTable(tenant.id, {",
  "await deleteAdminMenu(tenant.id, menu.id)",
  "await deleteAdminTable(tenant.id, table.id)",
  "await saveAdminCategoryOrder(tenant.id, order)",
  "await saveAdminMenuOrder(tenant.id, next.category, next.ids)",
  "await updateTenantLalamoveSettings({",
  "await testTenantLalamoveConnection()",
  "await submitTenantLalamoveWalletTopup(tenant.id, amount, walletTopupFile)",
  "await deleteTenantLalamoveWalletTopup(item.id)",
]);
requireAll("Admin tenant data scoping", adminData, [
  'doc(db, "tenants", requireTenantId(tenantId), collectionName, String(id))',
  "tenantId: requireTenantId(tenantId)",
  "shopId: requireTenantId(tenantId)",
  "await setDoc(ref, payload, { merge: true })",
  "await batch.commit()",
  'callAdminFunction("updateTenantLalamoveSettings"',
  'callAdminFunction("testTenantLalamoveConnection"',
  'callAdminFunction("submitTenantLalamoveWalletTopup"',
  'callAdminFunction("deleteTenantLalamoveWalletTopup"',
]);
requireAll("Admin QR is read/print only", adminQrPage, [
  "subscribeActiveTables(",
  "window.print()",
  "qrDataUrl(",
]);

requireAll("Revenue share submit/read actions", revenueSharePage, [
  "await submitRevenueSharePayment(tenant.id, periodPayload, slip)",
  "await getRevenueShareSlipUrl(item.slip.path)",
  "loadAccess()",
  "loadHistory();",
  "if (access?.enabled) loadReport();",
  "setInitialAccessReady(true)",
  "setInitialReportReady(true)",
]);
requireAll("Revenue share storage/callable", revenueShareData, [
  'const slipPath = `tenants/${id}/revenue-share-slips/${paymentId}/${fileName}`',
  "await uploadBytes(target, file",
  'call("submitTenantRevenueSharePayment"',
  "await deleteObject(target)",
]);

requireAll("Admin Users actions", adminUsersPage, [
  "await createStaffUser({",
  "await updateStaffUser(user.uid, {",
  'if (profile.role !== "owner") return <Navigate',
]);
requireAll("Admin Users callable mappings", adminStaff, [
  'call("listTenantStaff")',
  'call("createTenantStaff"',
  'call("updateTenantStaff"',
]);
requireAll("Admin Users server role guard", staffAdminFunction, [
  'const STAFF_MANAGER_ROLES = new Set(["owner", "super_admin"])' ,
  'throw new HttpsError("permission-denied", "Staff management permission required")',
]);

requireAll("Quick Order write actions", quickOrderPage, [
  "await saveQuickOrderHeldBill(tenant.id, {",
  'await releaseQuickOrderHeldBill(tenant.id, row.id, "resume")',
  'await releaseQuickOrderHeldBill(tenant.id, row.id, "delete")',
  "const result = await createWalkInOrder(tenant.id, payload)",
  "await updateCustomerDisplay(tenant.id, displayId, snapshot)",
  "const previous = await recoverOrder(pendingOrderId.current)",
]);
requireAll("Quick Order operational persistence", operational, [
  "export async function updateCustomerDisplay(tenantId, displayId, payload = {})",
  "export async function saveQuickOrderHeldBill(tenantId, bill)",
  'export async function releaseQuickOrderHeldBill(tenantId, id, disposition = "resume"',
]);
requireAll("Quick Order payment dialog button icons", quickOrderPage, [
  'id="quickCashCancel"',
  'bi bi-x-circle app-icon',
  'id="quickCashConfirm"',
  'bi bi-cash-coin app-icon',
  'id="quickPaymentNoReceipt"',
  'bi bi-plus-circle app-icon',
  'id="quickPaymentPrintReceipt"',
  'bi bi-printer app-icon',
]);
requireAll("Quick Order payment dialog icon alignment", quickOrderCss, [
  ".quick-cash-dialog-actions .btn,",
  ".quick-payment-result-actions .btn {",
  "gap: 7px;",
  "align-self: center;",
  "vertical-align: 0;",
]);
requireAll("Quick Order menu card overlay layout", quickOrderPage, [
  'className="quick-menu-copy"',
  'className="quick-menu-name"',
  'className="quick-menu-category"',
  'className="quick-menu-price-badge"',
]);
requireAll("Quick Order menu card overlay styling", quickOrderCss, [
  ".quick-menu-copy {",
  "justify-content: space-between;",
  "font-size: .74rem;",
  "font-size: .59rem;",
  "background: rgba(255, 255, 255, .76);",
  "max-width: 48%;",
]);
requireAll("Cashier receipt is print-only", cashierReceiptPage, [
  "window.print()",
]);
requireAll("Cashier Table QR actions", cashierTableQrPage, [
  "await updateOperationalTable(tenant.id, table.id, {",
  "await assignWalkInTable(tenant.id, order.id, targetCode)",
  "await getOperationalTable(tenant.id, table.id)",
  "sweetConfirm(",
]);

requireAll("Cashier payment", cashier, [
  'paymentStatus: "paid"',
  'await updateOrder(order.id, patch)',
  "printOrder(printWindow, order.id)",
]);
requireAll("Cashier table payment", cashier, [
  "await Promise.all(payable.map(order =>",
  "updateOperationalOrder(tenant.id, order.id, patch)",
  "settleTableSession(tenant.id, rounds[0].id)",
  "CASHIER_TABLE_SETTLEMENT_AFTER_PAYMENT_FAILED",
  "printTable(printWindow, rounds)",
]);
requireAll("Cashier cancellation", cashier, [
  "const cancelOrder = async order =>",
  "await cancelOperationalOrder(tenant.id, order.id)",
  'status: "cancelled"',
  "sweetConfirm(",
]);
requireAll("Cashier pickup", cashier, [
  'pickupStatus: "called"',
  'pickupStatus: "picked_up"',
  'status: "paid", paymentStatus: "paid"',
]);
requireAll("Cashier table/walk-in operations", cashier, [
  "assignWalkInTable(tenant.id, order.id, tableCode)",
  "moveTableSession(tenant.id",
]);
requireAll("Cashier Hero primary actions", cashier, [
  'className="cashier-hero-actions"',
  'className="btn cashier-hero-order-btn"',
  'className="btn cashier-hero-order-btn cashier-hero-queue-btn"',
  'href={cashierRoute("/quick-order")}',
  'href={cashierRoute("/waiting-queue")}',
]);
if (cashier.includes('className="btn btn-primary" href={cashierRoute("/waiting-queue")}')) {
  fail("Waiting Queue must not remain inside the Takeaway tools action bar");
}
requireAll("Cashier Hero mobile paired actions", read("react-app/public/parity/css/cashier-refresh.css"), [
  ".cashier-hero-actions {",
  "flex-wrap: nowrap;",
  ".cashier-hero-queue-btn {",
  "font-size: 10.75px;",
  "@media (max-width: 360px) {",
  "flex: 0 0 100%;",
  "margin-left: auto;",
]);
requireAll("Cashier Takeaway tools mobile single row", read("react-app/public/parity/css/cashier-refresh.css"), [
  ".cashier-action-bar {",
  "display: flex;",
  "justify-content: space-between;",
  ".cashier-action-title {",
  "flex: 1 1 auto;",
  ".cashier-actions {",
  "flex: 0 0 auto;",
  "flex: 0 0 40px;",
  ".cashier-action-title span {",
  "display: none;",
]);
requireAll("Cashier Lalamove actions", cashier, [
  "quoteLalamoveDispatch(tenant.id, order.id)",
  "placeLalamoveDispatch(tenant.id, order.id",
  "refreshLalamoveDispatch(tenant.id, order.id)",
  "cancelLalamoveDispatch(tenant.id, order.id)",
]);

requireAll("Operational tenant scoping", operational, [
  'doc(db, "tenants", requireTenantId(tenantId), collectionName, String(id))',
  "tenantId: requireTenantId(tenantId)",
  "shopId: requireTenantId(tenantId)",
]);
requireAll("Operational soft cancellation", operational, [
  "export async function cancelOperationalOrder(tenantId, orderId, extra = {})",
  'status: "cancelled"',
  "cancelledByUid",
  "cancelledByEmail",
]);
for (const fn of [
  "quoteTenantLalamoveDispatch",
  "placeTenantLalamoveDispatch",
  "refreshTenantLalamoveDispatch",
  "cancelTenantLalamoveDispatch",
  "createWalkInOrder",
  "assignWalkInTable",
  "moveTableSession",
]) {
  if (!operational.includes(`"${fn}"`)) fail(`operational callable mapping missing ${fn}`);
}

requireAll("Waiting Queue staff actions", waiting, [
  "createWaitingQueue({",
  "syncWaitingQueueOutbox(tenant.id",
  "transitionWaitingQueue(queue.id, toStatus",
  "recallWaitingQueue(queue.id",
  "seatWaitingQueue(seat.id, selectedSeatTable",
]);
requireAll("Waiting Queue public customer actions", waitingCustomer, [
  'updatePublicCustomerResponse(token, "on_the_way")',
  'updatePublicCustomerResponse(token, "cancel_requested")',
  'confirmIcon: "check-circle"',
  'cancelIcon: "arrow-left"',
]);
requireAll("Waiting Queue public response safety", waitingCore, [
  'new Set(["on_the_way", "cancel_requested"])',
  "runWaitingQueueTransaction(async transaction =>",
  "transaction.get(ref)",
  "customerResponse: response",
]);
requireAll("Waiting Queue seating transaction", waitingCore, [
  "export async function seatWaitingQueue",
  "runWaitingQueueTransaction(async transaction =>",
]);

requireAll("Admin tenant create/edit/share actions", tenants, [
  "if (editing) await updateTenant(payload)",
  "else await createTenant(payload)",
  "await updateTenantRevenueShare({",
  "await reconcileRevenueShare(tenantId ? { tenantId } : {})",
]);
requireAll("Admin tenant destructive/review actions", tenants, [
  "await deleteTenant({ tenantId: tenant.id })",
  'reviewRevenueSharePayment({ tenantId: item.tenant.id, paymentId: item.id, action: "approve" })',
  'action: "reject"',
  "await unlockTenantRevenueShare({ tenantId: tenant.id })",
  "const result = await updateTenantLalamoveApproval({ tenantId: tenant.id, approved: nextApproved })",
  "await reviewTenantLalamoveWalletTopup({",
  "const result = await updateTenantSubscription(payload)",
]);
for (const fn of [
  "createTenant",
  "updateTenant",
  "updateTenantRevenueShare",
  "reconcileRevenueShare",
  "deleteTenant",
  "reviewRevenueSharePayment",
  "unlockTenantRevenueShare",
  "updateTenantLalamoveApproval",
  "reviewTenantLalamoveWalletTopup",
  "updateTenantSubscription",
]) {
  if (!tenantService.includes(`call("${fn}"`)) fail(`platformTenantService callable mapping missing ${fn}`);
}

requireAll("Platform console actions", platformPage, [
  "await savePlatformBranding({ files: brandingFiles, clear: brandingClear })",
  "await savePlatformGoogleApis({",
  "await savePlatformSlipVerification({",
  "await testPlatformSlipVerification()",
  "await savePlatformLalamove({",
  "await testPlatformLalamove()",
  "await registerPlatformLalamoveWebhook({ url: webhookUrl })",
]);
for (const fn of [
  "getPlatformGoogleApis", "updatePlatformGoogleApis",
  "getPlatformSlipVerification", "updatePlatformSlipVerification", "testPlatformSlipVerification",
  "getPlatformLalamove", "updatePlatformLalamove", "testPlatformLalamove", "registerPlatformLalamoveWebhook",
]) {
  if (!platformSettingsService.includes(`call("${fn}"`)) fail(`platformSettingsService callable mapping missing ${fn}`);
}
requireAll("Platform branding storage/callable", platformBrandingService, [
  'httpsCallable(functions, "getPlatformBranding")',
  'httpsCallable(functions, "updatePlatformBranding")',
  'const path = `platform-branding/${PREFIX[kind]}-',
  "await uploadBytes(ref(storage, path), file",
  "deleteObject(ref(storage, path)).catch",
]);
requireAll("Platform settings server guard", platformSettingsFunction, [
  'profile.role !== "super_admin"',
  'exports.updatePlatformBranding = onCall',
  'exports.updatePlatformGoogleApis = onCall',
  'exports.updatePlatformSlipVerification = onCall',
  'exports.updatePlatformLalamove = onCall',
  'exports.registerPlatformLalamoveWebhook = onCall',
]);

requireAll("Platform contact actions", platformContactPage, [
  "await savePublicContact(data)",
  "await saveGoogleCustomerLogin(data)",
  "loadContact({ announce: true })",
  "loadGoogle({ announce: true })",
  "validateGoogleNow",
]);
requireAll("Platform contact scoped writes", platformContactService, [
  'tenantId: "__platform__"',
  'setDoc(doc(db, "platformSettings", id), value, { merge: false })',
  'saveSetting("publicContact", contact)',
  'saveSetting("googleCustomerLogin"',
]);
requireAll("Platform contact Firestore rules", firestoreRules, [
  "settingId == 'publicContact'",
  "settingId == 'googleCustomerLogin'",
  "&& superAdminRole()",
  "request.resource.data.get('tenantId', '') == '__platform__'",
]);

requireAll("Platform owner actions", platformOwnersPage, [
  "await updateTenantOwner({ tenantId: selected.id, displayName: displayName.trim() })",
  "await createTenantOwner({",
  "setCustomValidity",
]);
for (const fn of ["createTenantOwner", "updateTenantOwner"]) {
  if (!tenantService.includes(`call("${fn}"`)) fail(`platform owner callable mapping missing ${fn}`);
}
requireAll("Platform owner server guard", tenantAdminFunction, [
  "exports.createTenantOwner = onCall",
  "exports.updateTenantOwner = onCall",
  "await assertSuperAdmin(request.auth)",
]);

requireAll("Platform pricing action", platformPricingPage, [
  "const data = await saveAdminSubscriptionPricing(config)",
  "pricingReset",
  "pricingSave",
]);
requireAll("Platform pricing callable", subscriptionPricing, [
  'httpsCallable(functions, "getSubscriptionPricing")',
  'httpsCallable(functions, "updateSubscriptionPricing")',
]);
requireAll("Platform pricing server guard", subscriptionPricingFunction, [
  "exports.getSubscriptionPricing = onCall",
  "exports.updateSubscriptionPricing = onCall",
  "await assertSuperAdmin(request.auth)",
]);

requireAll("SaaS Setup UI/service", saasPage, [
  "inspectLegacyData()",
  "migrateLegacyStore({",
  "overwrite,",
]);
requireAll("SaaS Setup callables", saasService, [
  'httpsCallable(functions, "inspectLegacySaasMigration")',
  'httpsCallable(functions, "migrateLegacySaasStore")',
  'action: "prepare"',
  'action: "collection"',
  'action: "settings"',
  'action: "finalize"',
]);
requireAll("SaaS Setup server authorization", saasFunction, [
  'profile.role !== "super_admin"',
  'throw new HttpsError("permission-denied"',
  'db.collection("shops").doc(SOURCE_SHOP_ID)',
  'db.collection("tenants").doc(TARGET_TENANT.id)',
]);

console.log("P0 action contract: PASS");
console.log("Covered: Cashier, Waiting Queue staff/customer, Admin Tenants, SaaS Setup");
