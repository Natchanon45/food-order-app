import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const require=createRequire(import.meta.url);
const operational=require(path.join(root,"functions/operational-orders.js"));
const lalamoveLifecycle=require(path.join(root,"functions/lalamove-order-lifecycle.js"));
const test=operational.__test;
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

assert.deepEqual(Object.keys(operational).sort(),["assignWalkInTable","createWalkInOrder","moveTableSession","releaseQuickOrderHeldBill"]);
assert.equal(test.queueNumber(3),"Q003");
assert.equal(test.queueNumber(1012),"Q1012");
assert.equal(test.bangkokDateKey(new Date("2026-09-27T17:30:00Z")),"2026-09-28");

const priced=test.priceItems(
  [{menuId:"coffee",qty:2,note:"หวานน้อย"}],
  new Map([["coffee",{id:"coffee",name:"ลาเต้เย็น",price:85,active:true}]])
);
assert.equal(priced.total,170);
assert.equal(priced.items[0].name,"ลาเต้เย็น");
assert.equal(priced.items[0].price,85);
assert.equal(priced.items[0].qty,2);

assert.equal(test.tableAvailable({active:true,status:"available",orderToken:""}),true);
assert.equal(test.tableAvailable({active:false,status:"available"}),false);
assert.equal(test.tableAvailable({active:true,status:"occupied",orderToken:""}),false);
assert.equal(test.tableAvailable({active:true,status:"occupied",walkInOrderId:"walkin-a"}, "walkin-a"),true);
assert.equal(test.tableAvailable({active:true,status:"occupied",walkInOrderId:"walkin-a"}, "walkin-b"),false);
assert.equal(test.tableAvailable({active:true,status:"available",orderToken:"qr-token"}),false);

const completionAt="2026-10-03T03:00:00.000Z";
assert.deepEqual(
  lalamoveLifecycle.lalamoveCompletionPatch({
    lalamoveOrderStatus:"COMPLETED",
    status:"ready",
    paymentStatus:"paid",
    paymentMethod:"promptpay",
  },"COMPLETED",completionAt),
  {
    lalamoveCompletedAt:completionAt,
    status:"paid",
    completedAt:completionAt,
  },
  "prepaid Lalamove completion must close the operational order",
);
const codCompletion=lalamoveLifecycle.lalamoveCompletionPatch({
  lalamoveOrderStatus:"COMPLETED",
  status:"ready",
  paymentStatus:"unpaid",
  paymentMethod:"cod",
  lalamoveCodEnabled:true,
},"COMPLETED",completionAt);
assert.equal(codCompletion.status,"completed","COD delivery completion must close fulfillment without implying payment settlement");
assert.equal(codCompletion.completedAt,completionAt);
assert.equal(codCompletion.lalamoveCodDeliveryCompletedAt,completionAt);
assert.equal(codCompletion.lalamoveCodSettlementStatus,"pending");
assert.equal(Object.hasOwn(codCompletion,"paymentStatus"),false,"COD completion must not mark merchant payment settled");
assert.equal(Object.hasOwn(codCompletion,"paidAt"),false,"COD completion must not create a merchant paid timestamp");
assert.deepEqual(
  lalamoveLifecycle.lalamoveCompletionPatch({
    lalamoveOrderStatus:"COMPLETED",
    status:"ready",
    paymentStatus:"unpaid",
    paymentMethod:"cash",
  },"COMPLETED",completionAt),
  {lalamoveCompletedAt:completionAt},
  "unexpected unpaid non-COD delivery must not be financially closed",
);
assert.deepEqual(lalamoveLifecycle.lalamoveCompletionPatch({status:"ready"},"ON_GOING",completionAt),{});
assert.equal(lalamoveLifecycle.lalamoveCompletionNeedsRepair({
  lalamoveOrderStatus:"COMPLETED",status:"ready",paymentStatus:"paid",
}),true);
assert.equal(lalamoveLifecycle.lalamoveCompletionNeedsRepair({
  lalamoveOrderStatus:"COMPLETED",status:"paid",paymentStatus:"paid",
  lalamoveCompletedAt:completionAt,completedAt:completionAt,
}),false);
assert.equal(lalamoveLifecycle.lalamoveCompletionNeedsRepair({
  lalamoveOrderStatus:"COMPLETED",status:"completed",paymentStatus:"unpaid",
  paymentMethod:"cod",lalamoveCodEnabled:true,
  lalamoveCompletedAt:completionAt,completedAt:completionAt,
  lalamoveCodDeliveryCompletedAt:completionAt,lalamoveCodSettlementStatus:"pending",
}),false);

const functionSource=read("functions/operational-orders.js");
for(const marker of [
  'orderType: "walkin"', 'orderSource: "cashier_walkin"', 'paymentStatus: "paid"',
  'tx.create(orderRef, order)', 'nextQueue(tx, db, tenantId)', 'claimedTablePatch',
  'existingBeforeValidation.exists', 'return { item, idempotent: true }',
  'exports.releaseQuickOrderHeldBill', 'HELD_BILL_OPERATION_ID_INVALID',
  'releaseOperationId: operationId', 'HELD_BILL_ALREADY_RELEASED'
]) assert.ok(functionSource.includes(marker),`function contract missing: ${marker}`);

const bootstrap=read("functions/bootstrap.js");
assert.ok(bootstrap.includes('require("./operational-orders")'),"operational functions not exported");

const adapter=read("react-app/src/data/operationalData.js");
for(const marker of [
  'loadOperationalSnapshot', 'watchOperationalOrders', 'watchOperationalTables',
  'watchQuickOrderHeldBills', 'createWalkInCallable', 'assignWalkInTableCallable', 'moveTableSessionCallable',
  'source: "quick_order"', 'HELD_BILL_SOURCE_MISMATCH'
]) assert.ok(adapter.includes(marker),`React data adapter missing: ${marker}`);

const lalamoveDispatch=read("functions/lalamove-dispatch.js");
for(const marker of [
  'exports.quotePublicLalamoveDelivery',
  'async function publicStorefrontLalamoveContext',
  'LALAMOVE_NOT_ENABLED_FOR_TENANT',
  'const account = await accountFor(tenantRef)',
  'accountMode: String(context.account.mode || "disabled")',
  'accountEnvironment: String(context.account.credentials?.environment || "sandbox")'
]) assert.ok(lalamoveDispatch.includes(marker),"public Lalamove quotation contract missing: "+marker);
for(const marker of [
  'const approved = pub.fodCentralApproved === true;',
  'ready: approved && verified && prefixesValid(environment, apiKey, apiSecret)',
  'throw new HttpsError("failed-precondition", "LALAMOVE_ACCOUNT_NOT_READY")'
]) assert.ok(lalamoveDispatch.includes(marker),"central Lalamove approval gate missing: "+marker);
for(const marker of [
  'lalamoveCompletionPatch(context.order, current.status, nowIso)',
  'lalamoveCompletionNeedsRepair(context.order)',
  'cached: true, repaired: true'
]) assert.ok(lalamoveDispatch.includes(marker),"Lalamove completion close/repair contract missing: "+marker);

const lalamoveWebhook=read("functions/lalamove-webhook.js");
for(const marker of [
  'lalamoveCompletionPatch(current, status, nowIso())',
  'lalamoveCompletionNeedsRepair(current)',
  'return json(res, 200, { ok: true, repaired: true })'
]) assert.ok(lalamoveWebhook.includes(marker),"Lalamove webhook completion contract missing: "+marker);

const cashierSource=read("react-app/src/pages/CashierPage.jsx");
assert.ok(cashierSource.includes('if (isWaitingQueuePlaceholder(order) || order.status === "cancelled") return false;'),"Cashier cancelled-order terminal guard missing");
assert.ok(cashierSource.includes('if (lalamoveCodAwaitingSettlement(order)) return true;'),"Cashier completed COD settlement exception missing");
assert.ok(cashierSource.includes('if (order.status === "completed" || lalamoveDeliveryCompleted(order)) return false;'),"Cashier completed-order terminal guard missing");
assert.ok(cashierSource.includes('normalizedOrders.filter(lalamoveCompletionStale)'),"Cashier stale-completed repair scan missing");
assert.ok(cashierSource.includes('refreshLalamoveDispatch(tenant.id, orderId)'),"Cashier stale-completed repair callable missing");
const kitchenSource=read("react-app/src/pages/KitchenPage.jsx");
assert.ok(kitchenSource.includes('ACTIVE_STATUSES.has(order.status) && !lalamoveDeliveryCompleted(order)'),"Kitchen stale-completed Lalamove guard missing");
assert.ok(kitchenSource.includes('orders.filter(lalamoveCompletionStale)'),"Kitchen stale-completed repair scan missing");
assert.ok(kitchenSource.includes('refreshLalamoveDispatch(tenant.id, orderId)'),"Kitchen stale-completed repair callable missing");
const notifierSource=read("react-app/src/components/CashierOrderNotifier.jsx");
assert.ok(notifierSource.includes('new Set(["paid", "completed", "cancelled", "deleted", "voided"])'),"Notifier terminal-order guard missing");

const lalamoveWallet=read("functions/tenant-lalamove-wallet.js");
for(const marker of [
  'platformApiKeyConfigured: centralApproved && Boolean(platform.apiKey)',
  'platformApiKeyMasked: centralApproved ? mask(platform.apiKey) : ""',
  'platformApiSecretConfigured: centralApproved && Boolean(platform.apiSecret)',
  'platformApiSecretMasked: centralApproved ? mask(platform.apiSecret) : ""'
]) assert.ok(lalamoveWallet.includes(marker),"central masked credential exposure contract missing: "+marker);
for(const marker of [
  'const topupAllowed = tenantStatus.accountMode === "fod_central" && tenantStatus.fodCentralApproved === true;',
  'if (account.accountMode !== "fod_central" || account.fodCentralApproved !== true)',
  'throw new HttpsError("permission-denied", "FOD_WALLET_TOPUP_NOT_ALLOWED")'
]) assert.ok(lalamoveWallet.includes(marker),"central wallet approval gate missing: "+marker);

const rules=read("firestore.rules");
assert.ok(rules.includes("match /heldBills/{heldBillId}"),"heldBills rules missing");
assert.ok(rules.includes("validHeldBill(tenantId)"),"heldBills validation missing");

console.log("Operational orders contract: PASS");
