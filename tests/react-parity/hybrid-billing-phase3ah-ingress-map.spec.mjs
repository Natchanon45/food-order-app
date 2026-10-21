// Phase3AH static ingress contract. A tripwire, NOT an exhaustive Admin SDK
// proof. Unknown dynamic/import/rest/browser routes remain release blockers.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";

const file=n=>readFileSync("functions/"+n,"utf8");
test("Phase3AH exported Hybrid modules remain settings or read-only preview only",()=>{
 const index=file("index.js");
 const referenced=[...index.matchAll(/(?:require\(["']\.\/(hybrid-billing-[^"']+)["']\))/g)]
  .map(m=>m[1]).sort();
 assert.deepEqual(referenced,["hybrid-billing-preview","hybrid-billing-settings"]);
 const exports=[...index.matchAll(/exports\.([A-Za-z0-9_]*Hybrid[A-Za-z0-9_]*)\s*=/g)]
  .map(m=>m[1]).sort();
 assert.deepEqual(exports,[
  "getHybridBillingSettings","getPublicHybridBillingSettings",
  "getTenantHybridBillingPreview","updateHybridBillingSettings"
 ].sort());
 for(const name of [
  "hybrid-billing-demo-batch-reservation",
  "hybrid-billing-lalamove-batch-preview",
  "hybrid-billing-demo-late-exception",
  "hybrid-billing-demo-day-manifest",
  "hybrid-billing-demo-enforced-writer",
  "hybrid-billing-cod-payment","hybrid-billing-promptpay-payment",
  "hybrid-billing-refund-reversal","hybrid-billing-multi-refund"
 ])assert.ok(!index.includes(name),"FINANCE_CANDIDATE_EXPORTED: "+name);
});
test("Phase3AH known deployed Delivery paid writer entrypoints enforce same-tx tenant policy",()=>{
 const body=file("delivery-slip.js");
 const routes=[
  body.slice(body.indexOf("exports.finalizeDeliveryPaymentSlip"),body.indexOf("exports.approveDeliveryPaymentReview")),
  body.slice(body.indexOf("exports.approveDeliveryPaymentReview"),body.indexOf("exports.notifyKitchenDeliveryAdmitted"))
 ];
 for(const [i,route] of routes.entries()){
  assert.ok(route.includes("db.runTransaction(async tx =>"),"TX_REQUIRED: "+i);
  assert.ok(route.includes("tx.get(tenantRef)"),"TENANT_READ_IN_PAID_TX_REQUIRED: "+i);
  assert.equal((route.match(/legacyDeliveryPaidWriterAllowed\(/g)||[]).length,1,"LEGACY_GUARD_REQUIRED: "+i);
  const guard=route.indexOf("legacyDeliveryPaidWriterAllowed(");
  const paid=route.indexOf('paymentStatus: "paid"');
  assert.ok(guard>=0&&paid>guard,"GUARD_MUST_PRECEDE_PAID_WRITE: "+i);
  assert.ok(route.includes("HYBRID_TRUSTED_JOURNAL_WRITER_REQUIRED"),"DENY_HYBRID_REQUIRED: "+i);
 }
 const guard=file("hybrid-billing-legacy-payment-guard.js");
 for(const marker of ["billingPolicyVersion === \"hybrid_v1\"",
   "hybridBillingEnabled === true","hybridReceiptJournalCoverageReady === true",
   "hybridReceiptJournalMode !== undefined"])
  assert.ok(guard.includes(marker),"MISSING_HYBRID_GUARD_MARKER: "+marker);
});
test("Phase3AH walk-in Paid creator stays non-Delivery and public Delivery creator never accepts Paid",()=>{
 const pos=file("operational-orders.js"),publicSubmit=file("public-delivery-submit.js");
 const paid=pos.indexOf('paymentStatus: "paid"');
 assert.ok(paid>=0&&pos.lastIndexOf('orderType: "walkin"',paid)>0);
 assert.ok(pos.slice(paid,paid+800).includes("tx.create(orderRef, order)"));
 assert.ok(publicSubmit.includes("delete safeOrder.paymentStatus"));
 assert.ok(publicSubmit.includes('orderType: "delivery"'));
 assert.ok(publicSubmit.includes('"pending_verification" : "unpaid"'));
 assert.ok(!/paymentStatus\s*:\s*["']paid["']/.test(publicSubmit));
 const backup=file("retail-pos-backup.js");
 const full=backup.slice(backup.indexOf("const FULL_COLLECTIONS"),backup.indexOf("const SCOPED_COLLECTIONS"));
 assert.ok(!full.includes('"orders"'));
});
test("Phase3AH no new deployed top-level paymentStatus paid literal without explicit source review",()=>{
 const expected=new Map([["delivery-slip.js",2],["operational-orders.js",1]]);
 const actual=new Map();
 for(const name of readdirSync("functions").filter(s=>s.endsWith(".js")&&!s.startsWith("hybrid-billing-"))){
  const count=[...file(name).matchAll(/\bpaymentStatus\s*:\s*["']paid["']/g)].length;
  if(count)actual.set(name,count);
 }
 assert.deepEqual([...actual].sort(),[...expected].sort());
 // Textual source inventory cannot prove computed field names, REST imports,
 // client transactions, Cloud Admin SDK, external imports or migrations.
});
