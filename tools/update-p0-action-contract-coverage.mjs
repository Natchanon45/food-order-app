import fs from "node:fs";

const file = "react-app/migration/parity-verification-matrix.json";
const matrix = JSON.parse(fs.readFileSync(file, "utf8"));

const getRoute = route => {
  const row = matrix.routes.find(item => item.route === route);
  if (!row) throw new Error(`ROUTE_NOT_FOUND:${route}`);
  return row;
};
const getAction = (route, id) => {
  const row = getRoute(route);
  const action = row.actionInventory.find(item => item.id === id);
  if (!action) throw new Error(`ACTION_NOT_FOUND:${route}:${id}`);
  return action;
};
const note = (route, text) => {
  const row = getRoute(route);
  row.notes ||= [];
  if (!row.notes.includes(text)) row.notes.push(text);
};
const markDataContract = (route, id, fields = {}) => {
  Object.assign(getAction(route, id), { dataVerification: "partial", ...fields });
};
const markAllDataContracts = (route, id, fields = {}) => {
  const actions = getRoute(route).actionInventory.filter(item => item.id === id);
  if (!actions.length) throw new Error(`ACTION_NOT_FOUND:${route}:${id}`);
  actions.forEach(action => Object.assign(action, { dataVerification: "partial", ...fields }));
};
const markNoData = (route, id, fields = {}) => {
  Object.assign(getAction(route, id), { dataVerification: "not_applicable", ...fields });
};
const markAllNoData = (route, id, fields = {}) => {
  const actions = getRoute(route).actionInventory.filter(item => item.id === id);
  if (!actions.length) throw new Error(`ACTION_NOT_FOUND:${route}:${id}`);
  actions.forEach(action => Object.assign(action, { dataVerification: "not_applicable", ...fields }));
};

markDataContract("/cashier/waiting-queue", "waitingSyncBtn", {
  expectedDataMutation: "Flush queued Waiting Queue operations through syncWaitingQueueOutbox for the active tenant.",
});
markDataContract("/cashier/waiting-queue", "saveWaitingQueueBtn", {
  expectedDataMutation: "Create a tenant-scoped Waiting Queue record through createWaitingQueue.",
});
markDataContract("/cashier/waiting-queue", "confirmWaitingSeatBtn", {
  expectedDataMutation: "Seat the selected queue/table through seatWaitingQueue transaction.",
});
markDataContract("/cashier/waiting-queue", "data-queue-action", {
  expectedDataMutation: "Transition/recall tenant Waiting Queue state through transitionWaitingQueue or recallWaitingQueue.",
});
for (const id of ["openWaitingDisplayBtn", "copyWaitingTicketLinkBtn", "printWaitingTicketBtn"]) {
  markNoData("/cashier/waiting-queue", id);
}
for (const id of [
  "/", "button-2", "addWaitingQueueBtn", "closeWaitingQueueDialog", "cancelWaitingQueueDialog",
  "closeWaitingTicketDialog", "cancelWaitingTicketDialog", "closeWaitingSeatDialog", "cancelWaitingSeatDialog", "data-wq-footer-credit",
]) {
  markAllNoData("/cashier/waiting-queue", id, { expectedDataMutation: "none; navigation, locale, modal open/close, or external credit link." });
}
markAllNoData("/cashier/waiting-queue", "button-3", { expectedDataMutation: "none; locale switch only." });
note("/cashier/waiting-queue", "ACTION_CONTRACT: create/sync/transition/recall/seat handlers are statically bound to Waiting Queue core services; runtime Firestore verification remains pending.");

{
  const source = getRoute("/cashier/waiting-queue");
  const target = getRoute("/waiting-queue");
  for (const targetAction of target.actionInventory) {
    const sourceAction = source.actionInventory.find(item => item.id === targetAction.id && item.label === targetAction.label);
    if (!sourceAction) continue;
    targetAction.dataVerification = sourceAction.dataVerification;
    targetAction.expectedDataMutation = sourceAction.expectedDataMutation;
    if (sourceAction.actorRole !== "pending") targetAction.actorRole = sourceAction.actorRole;
  }
  note("/waiting-queue", "ACTION_CONTRACT: shares WaitingQueuePage/core behavior with /cashier/waiting-queue; runtime Firestore verification remains pending.");
}

markDataContract("/waiting-queue/customer", "waitingCustomerConfirmArrival", {
  expectedDataMutation: 'Public queue response becomes "on_the_way" through transaction-safe updatePublicCustomerResponse.',
});
markDataContract("/waiting-queue/customer", "waitingCustomerCancelQueue", {
  expectedDataMutation: 'Public queue response becomes "cancel_requested" through transaction-safe updatePublicCustomerResponse.',
});
markNoData("/waiting-queue/customer", "waitingCustomerNotification", {
  expectedDataMutation: "Browser Notification permission only.",
});
markNoData("/waiting-queue/customer", "waitingCustomerOrderLink", {
  expectedDataMutation: "none",
});
note("/waiting-queue/customer", "ACTION_CONTRACT: customer arrival/cancel responses are restricted to allowed public response values and use a Firestore transaction; runtime emulator verification remains pending.");

for (const id of [
  "t:platform.cards.tenants.title", "t:platform.cards.owners.title", "t:platform.cards.contact.title", "t:platform.cards.pricing.title",
  "t:platform.branding.choose_file", "t:platform.branding.clear",
  "clearPlatformGoogleMapsBrowserApiKey", "clearPlatformGoogleRoutesApiKey", "clearPlatformGoogleVisionApiKey",
  "clearPlatformSlip2GoSecret", "clearPlatformLalamoveApiKey", "clearPlatformLalamoveApiSecret",
]) {
  markAllNoData("/platform", id, { expectedDataMutation: "none; navigation or local form/file state only until Save." });
}
for (const id of ["savePlatformBrandingButton", "savePlatformGoogleApiButton", "savePlatformSlipVerificationButton", "savePlatformLalamoveButton"]) {
  markAllDataContracts("/platform", id, { actorRole: "super_admin", expectedDataMutation: "Persist platform configuration through the mapped super_admin-protected callable/storage flow." });
}
for (const id of ["testPlatformSlip2GoButton", "testPlatformLalamoveButton", "registerPlatformLalamoveWebhookButton"]) {
  markAllDataContracts("/platform", id, { actorRole: "super_admin", expectedDataMutation: "Invoke the mapped super_admin-protected external/test/webhook callable; runtime response verification remains pending." });
}
note("/platform", "ACTION_CONTRACT: branding, Google API, slip verification, Lalamove save/test/webhook mappings and server super_admin guard pass; runtime callable/storage E2E remains pending.");

for (const id of ["t:platform_contact.header.back", "reloadContactButton", "reloadGoogleLoginSettings", "validateGoogleLoginSettings"]) {
  markAllNoData("/platform/contact", id, { expectedDataMutation: "none; navigation, reload, or client-side validation." });
}
for (const id of ["saveContactButton", "saveGoogleLoginSettings"]) {
  markAllDataContracts("/platform/contact", id, { actorRole: "super_admin", expectedDataMutation: "Write __platform__ scoped settings to platformSettings under Firestore super_admin rules." });
}
note("/platform/contact", "ACTION_CONTRACT: Contact and Google Customer Login writes are __platform__ scoped and protected by Firestore superAdminRole rules; runtime Firestore E2E remains pending.");

for (const id of ["t:platform_owners.header.back", "data-owner-close", "data-owner-action"]) {
  markAllNoData("/platform/owners", id, { expectedDataMutation: "none; navigation or owner modal state only." });
}
markAllDataContracts("/platform/owners", "ownerSubmitButton", { actorRole: "super_admin", expectedDataMutation: "Create or update the tenant owner through createTenantOwner/updateTenantOwner callables." });
note("/platform/owners", "ACTION_CONTRACT: owner create/update handlers map to tenant-admin callables with assertSuperAdmin; runtime Auth/Firestore E2E remains pending.");

for (const id of ["t:platform.pricing.back", "pricingReset"]) {
  markAllNoData("/platform/pricing", id, { expectedDataMutation: "none; navigation or local reset only." });
}
markAllDataContracts("/platform/pricing", "pricingSave", { actorRole: "super_admin", expectedDataMutation: "Persist normalized subscription pricing through updateSubscriptionPricing callable." });
note("/platform/pricing", "ACTION_CONTRACT: pricing load/save callables and server assertSuperAdmin guard pass; runtime callable E2E remains pending.");

markDataContract("/super-admin/saas-setup", "refreshMigration", {
  actorRole: "super_admin",
  expectedDataMutation: "Read-only inspection through inspectLegacySaasMigration callable.",
});
markDataContract("/super-admin/saas-setup", "startMigration", {
  actorRole: "super_admin",
  expectedDataMutation: "Server-side prepare/collection/settings/finalize migration sequence; server checks super_admin and overwrite semantics.",
});
markNoData("/super-admin/saas-setup", "t:saas_setup.header.back", { expectedDataMutation: "none" });
note("/super-admin/saas-setup", "ACTION_CONTRACT: SaaS migration remains server-side behind super_admin callable authorization; runtime callable E2E remains pending.");

markDataContract("/admin/tenants", "createTenantButton", {
  actorRole: "super_admin",
  expectedDataMutation: "Create or update tenant using createTenant/updateTenant callable based on edit state.",
});
markDataContract("/admin/tenants", "saveRevenueShareButton", {
  actorRole: "super_admin",
  expectedDataMutation: "Update tenant revenue-share configuration through updateTenantRevenueShare callable.",
});
markDataContract("/admin/tenants", "rejectRevenueSharePayment", {
  actorRole: "super_admin",
  expectedDataMutation: "Reject revenue-share payment through reviewRevenueSharePayment with required note.",
});
markDataContract("/admin/tenants", "data-delete-tenant", {
  actorRole: "super_admin",
  expectedDataMutation: "Delete tenant through deleteTenant callable after confirmation.",
});
markDataContract("/admin/tenants", "data-subscription-action", {
  actorRole: "super_admin",
  expectedDataMutation: "Update subscription status/expiry/plan through updateTenantSubscription callable.",
});
for (const id of ["refreshTenantSalesButton", "refreshRevenueShareReview"]) {
  markNoData("/admin/tenants", id, { expectedDataMutation: "Read-only refresh." });
}
for (const id of [
  "t:admin_tenants.header.back", "openTenantCreateButton",
  "t:admin_tenants.report.periods.daily", "t:admin_tenants.report.periods.monthly", "t:admin_tenants.report.periods.yearly", "t:admin_tenants.report.periods.custom",
  "t:admin_tenants.review.statuses.pending", "t:admin_tenants.review.statuses.approved", "t:admin_tenants.review.statuses.rejected", "t:admin_tenants.review.statuses.all",
  "data-close-tenant-dialog", "data-close-share-dialog", "data-close-review-dialog", "data-close-wallet-dialog", "data-close-wallet-slip-dialog", "data-close-slip-dialog",
  "route:tenant-storefront", "data-edit-tenant", "data-share-tenant", "data-lalamove-wallet", "data-review-view-slip", "t:admin_tenants.wallet.view_slip",
]) {
  markAllNoData("/admin/tenants", id, { expectedDataMutation: "none; navigation, filtering, dialog control, or read-only view." });
}
for (const id of ["data-unlock-revenue-share", "data-lalamove-approval", "data-wallet-topup-approve", "data-wallet-topup-reject", "data-review-approve", "data-review-reject"]) {
  markAllDataContracts("/admin/tenants", id, { actorRole: "super_admin", expectedDataMutation: "Server-side tenant/review state mutation through the mapped callable after the required confirmation/prompt." });
}
markAllDataContracts("/admin/tenants", "data-subscription-action", {
  actorRole: "super_admin",
  expectedDataMutation: "Subscription status/expiry/plan mutation through updateTenantSubscription callable.",
});
note("/admin/tenants", "ACTION_CONTRACT: tenant create/edit/share/reconcile/delete/review/subscription/Lalamove service mappings pass static regression contract; runtime callable E2E remains pending.");

for (const id of [
  "t:quick_order.entry.button", "t:cashier.takeaway_tools.waiting_queue", "showTakeawayQr", "openTakeawayOrder", "copyTakeawayUrl",
  "t:cashier.lalamove.delivery_details", "t:cashier.lalamove.tracking", "t:cashier.payment.view_slip", "t:cashier.payment.loading_slip",
  "t:cashier.lalamove.dispatched", "t:cashier.common.print", "t:cashier.payment.paid_short", "data-close-takeaway-qr", "copyTakeawayQrUrl", "data-open-takeaway-page",
]) {
  markAllNoData("/cashier", id, { expectedDataMutation: "none; navigation, print, QR, clipboard, or read-only display action." });
}
for (const id of ["data-lalamove-cancel", "data-lalamove-quote", "data-lalamove-refresh", "data-lalamove-place", "data-payment-id", "t:cashier.actions.cancel_all", "data-pickup-call", "data-pickup-done", "data-walkin-assign", "data-table-payment"]) {
  markAllDataContracts("/cashier", id, { expectedDataMutation: "Tenant-scoped order/table/Lalamove state mutation through the handler and operational service protected by the P0 action contract." });
}
note("/cashier", "ACTION_CONTRACT: payment, table payment, cancel, pickup, walk-in assignment, table move, and Lalamove handlers are bound to tenant-scoped operational services/callables; runtime write E2E remains pending.");

matrix.updatedAt = "2026-09-29";
fs.writeFileSync(file, JSON.stringify(matrix, null, 2) + "\n");
console.log("P0 action-contract coverage metadata updated.");
