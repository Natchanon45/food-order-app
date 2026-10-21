import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {reconcileHybridLalamoveCodBatch,previewHybridLalamoveCodBatch}=
 require("../../functions/hybrid-billing-lalamove-batch-preview.js");
const a="a".repeat(64),b="b".repeat(64),c="c".repeat(64),
 d="d".repeat(64),e="e".repeat(64),f="f".repeat(64);
const now=new Date("2026-10-21T08:00:00Z");
const tenantId="tenant-phase3ag-batch-110",batchId="batch-phase3ag-110";
const id1="order-phase3ag-a-110",id2="order-phase3ag-b-110";
function row(orderId,providerOrderId,total){
 return {orderId,order:{orderType:"delivery",deliveryProvider:"lalamove",
  paymentMethod:"cod",lalamoveCodEnabled:true,paymentStatus:"unpaid",
  lalamoveOrderId:providerOrderId,totalAmount:total},
  deliveryProof:{tenantId,orderId,providerOrderId,
   accountScopeSha256:a,providerEvidenceSha256:e,eventHash:f,
   deliveryVerified:true,codSettlementVerified:false,bankReconciled:false,
   status:"delivery_verified_settlement_pending"}};
}
function fixture(){
 const orders=[row(id1,"LL-BATCH-001",500),row(id2,"LL-BATCH-002",300)];
 const allocations=[
  {orderId:id1,providerOrderId:"LL-BATCH-001",collectedCodCents:50000,
   feeCents:1000,remittedCents:49000},
  {orderId:id2,providerOrderId:"LL-BATCH-002",collectedCodCents:30000,
   feeCents:500,remittedCents:29500}
 ];
 const provider={source:"authenticated_lalamove_batch_remittance_lookup",
  authenticated:true,tenantId,batchId,market:"TH",currency:"THB",
  status:"PAID_OUT",batchPayout:true,orderCount:2,allocations,
  accountScopeSha256:a,recipientAccountSha256:b,transferReferenceSha256:c,
  evidenceSha256:d,checkedAt:now,
  paidOutAt:new Date(now.getTime()-120000),
  collectedCodCents:80000,feeCents:1500,remittedCents:78500};
 const bank={source:"independent_bank_posted_credit_lookup",
  authenticated:true,tenantId,status:"POSTED",currency:"THB",
  recipientConfirmed:true,recipientAccountSha256:b,bankAccountScopeSha256:b,
  transferReferenceSha256:c,evidenceSha256:e,
  creditedCents:78500,checkedAt:now,postedAt:new Date(now.getTime()-60000)};
 return {tenantId,orders,provider,bank,accountScopeSha256:a,
  recipientAccountSha256:b,now};
}
test("Phase3AG 2-order independent batch proof shape matches one bank posted credit and never marks paid",()=>{
 const f=fixture();
 const x=reconcileHybridLalamoveCodBatch(f);
 assert.equal(x.orderCount,2);
 assert.equal(x.collectedCodCents,80000);
 assert.equal(x.providerFeeCents,1500);
 assert.equal(x.matchedPostedCreditCents,78500);
 assert.equal(x.allocations.length,2);
 assert.match(x.witnessDigest,/^[a-f0-9]{64}$/);
 assert.equal(x.canMarkPaid,false);assert.equal(x.sourceAttested,false);
 assert.equal(x.canIssueInvoice,false);assert.equal(x.coverageCertified,false);
 assert.equal(x.independentProviderConnected,false);
 assert.equal(f.orders[0].order.paymentStatus,"unpaid");
 assert.equal(f.orders[1].order.paymentStatus,"unpaid");
 const reversed=fixture();
 reversed.provider.allocations.reverse();
 reversed.orders.reverse();
 assert.equal(x.witnessDigest,reconcileHybridLalamoveCodBatch(reversed).witnessDigest);
});
test("Phase3AG reject missing/duplicate allocations, duplicate provider order, unknown order and incorrect order gross",()=>{
 const changes=[
  f=>f.provider.allocations.pop(),
  f=>f.provider.allocations[1].orderId=id1,
  f=>f.provider.allocations[1].providerOrderId="LL-BATCH-001",
  f=>f.provider.allocations[1].orderId="order-not-in-batch-110",
  f=>f.provider.allocations[0].collectedCodCents=49999,
  f=>f.orders[1].order.totalAmount=400,
  f=>f.orders[0].order.paymentStatus="paid",
  f=>f.orders[0].deliveryProof.deliveryVerified=false,
  f=>f.orders[0].deliveryProof.codSettlementVerified=true,
  f=>f.orders[1].deliveryProof.accountScopeSha256=c,
  f=>f.orders[0].order.lalamoveOrderId="SPOOF",
 ];
 for(const modify of changes){
  const x=fixture();modify(x);
  assert.throws(()=>reconcileHybridLalamoveCodBatch(x),
   /HYBRID_LALAMOVE_BATCH_INDEPENDENT_POSTED_CREDIT_REQUIRED/);
 }
});
test("Phase3AG reject unbalanced fee, payout, posted credit and forged source",()=>{
 const changes=[
  f=>f.provider.feeCents=1499,
  f=>f.provider.remittedCents=78499,
  f=>f.provider.allocations[1].feeCents=31000,
  f=>f.provider.allocations[1].remittedCents=28000,
  f=>f.bank.creditedCents=78501,
  f=>f.bank.status="PENDING",
  f=>f.provider.status="COMPLETED",
  f=>f.provider.authenticated=false,
  f=>f.bank.authenticated=false,
  f=>f.bank.evidenceSha256=d,
  f=>f.bank.transferReferenceSha256=a,
  f=>f.bank.recipientAccountSha256=a,
  f=>f.bank.postedAt=new Date(now.getTime()-150000),
  f=>f.bank.checkedAt=new Date(now.getTime()-1000000),
  f=>f.provider.batchPayout=false,
 ];
 for(const modify of changes){
  const x=fixture();modify(x);
  assert.throws(()=>reconcileHybridLalamoveCodBatch(x),
   /HYBRID_LALAMOVE_BATCH_INDEPENDENT_POSTED_CREDIT_REQUIRED/);
 }
});
test("Phase3AG bounded batch and strict amount precision fail closed",()=>{
 const a=fixture();a.orders=[a.orders[0]];
 assert.throws(()=>reconcileHybridLalamoveCodBatch(a),/HYBRID_LALAMOVE_BATCH_INDEPENDENT_POSTED_CREDIT_REQUIRED/);
 const b=fixture();b.orders[1].order.totalAmount=300.001;
 assert.throws(()=>reconcileHybridLalamoveCodBatch(b),/HYBRID_LALAMOVE_BATCH_INDEPENDENT_POSTED_CREDIT_REQUIRED/);
 const c=fixture();c.orders[1].order.totalAmount=0;
 assert.throws(()=>reconcileHybridLalamoveCodBatch(c),/HYBRID_LALAMOVE_BATCH_INDEPENDENT_POSTED_CREDIT_REQUIRED/);
});
test("Phase3AG orchestration rejects unknown client input and requires server-owned proof resolvers",async()=>{
 await assert.rejects(previewHybridLalamoveCodBatch({
   db:{},tenantId,batchId,orderIds:[id1,id1],
   reviewerUid:"super-phase3ag-110",
   resolveProviderBatch:async()=>({}),resolveIndependentBankCredit:async()=>({})
 }),/HYBRID_LALAMOVE_BATCH_BAD_REQUEST/);
 await assert.rejects(previewHybridLalamoveCodBatch({
   db:{},tenantId,batchId,orderIds:[id1,id2],
   reviewerUid:"super-phase3ag-110"
 }),/HYBRID_LALAMOVE_BATCH_BAD_REQUEST/);
 const index=readFileSync("functions/index.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-lalamove-batch-preview|previewHybridLalamoveCodBatch/);
});
