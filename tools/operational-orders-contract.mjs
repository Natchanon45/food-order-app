import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const require=createRequire(import.meta.url);
const operational=require(path.join(root,"functions/operational-orders.js"));
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

const rules=read("firestore.rules");
assert.ok(rules.includes("match /heldBills/{heldBillId}"),"heldBills rules missing");
assert.ok(rules.includes("validHeldBill(tenantId)"),"heldBills validation missing");

console.log("Operational orders contract: PASS");
