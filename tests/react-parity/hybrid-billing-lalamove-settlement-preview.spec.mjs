import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {reconcileLalamoveCodEvidence,previewHybridLalamoveCodSettlement}=
 require("../../functions/hybrid-billing-lalamove-settlement-preview.js");
const now=new Date("2026-10-20T13:00:00Z");
const tenantId="tenant-cod-settlement-001",orderId="order-cod-settlement-001";
const reviewerUid="super-cod-settlement-001";
const a="a".repeat(64),b="b".repeat(64),c="c".repeat(64),
 d="d".repeat(64),e="e".repeat(64),f="f".repeat(64),g="1".repeat(64);
function fixture(){
 const order={orderType:"delivery",deliveryProvider:"lalamove",paymentMethod:"cod",
   lalamoveCodEnabled:true,paymentStatus:"unpaid",totalAmount:1550,
   lalamoveOrderId:"LL-ORDER-SETTLEMENT-001"};
 const deliveryProof={tenantId,orderId,providerOrderId:order.lalamoveOrderId,
   accountScopeSha256:a,providerEvidenceSha256:e,eventHash:f,
   deliveryVerified:true,codSettlementVerified:false,bankReconciled:false,
   status:"delivery_verified_settlement_pending"};
 const provider={source:"authenticated_lalamove_remittance_lookup",authenticated:true,
   tenantId,orderId,providerOrderId:order.lalamoveOrderId,
   accountScopeSha256:a,market:"TH",currency:"THB",settlementStatus:"PAID_OUT",
   batchPayout:false,orderCount:1,collectedCodCents:155000,
   feeCents:500,remittedCents:154500,recipientAccountSha256:b,
   transferReferenceSha256:c,evidenceSha256:d,
   paidOutAt:new Date(now.getTime()-120000),checkedAt:now};
 const bank={source:"independent_bank_credit_record",authenticated:true,
   tenantId,orderId,status:"POSTED",currency:"THB",recipientConfirmed:true,
   recipientAccountSha256:b,transferReferenceSha256:c,evidenceSha256:g,
   creditedCents:154500,postedAt:new Date(now.getTime()-60000),checkedAt:now};
 return {tenantId,orderId,order,deliveryProof,provider,bank,
  accountScopeSha256:a,recipientAccountSha256:b,now};
}
test("two independent trusted proof fixtures match only in an advisory result; never mark paid",()=>{
 const f=fixture();
 const out=reconcileLalamoveCodEvidence(f);
 assert.equal(out.collectedCodCents,155000);
 assert.equal(out.providerFeeCents,500);
 assert.equal(out.matchedBankCreditCents,154500);
 assert.match(out.evidencePairDigest,/^[a-f0-9]{64}$/);
 assert.equal(out.settlementCertified,false);
 assert.equal(out.canMarkPaid,false);
 assert.equal(out.canIssueInvoice,false);
 assert.equal(out.coverageCertified,false);
 assert.equal(out.paymentChanged,false);
 assert.equal(f.order.paymentStatus,"unpaid");
 assert.equal(out.evidencePairDigest,reconcileLalamoveCodEvidence(f).evidencePairDigest);
});
test("reject delivery-completed-only, provider advice, recycled bank proof, wrong scope and money mismatch",()=>{
 const cases=[
   f=>{f.deliveryProof.codSettlementVerified=true;},
   f=>{f.deliveryProof.status="COMPLETED";},
   f=>{f.order.paymentStatus="paid";},
   f=>{f.provider.authenticated=false;},
   f=>{f.provider.settlementStatus="COMPLETED";},
   f=>{f.provider.batchPayout=true;},
   f=>{f.provider.orderCount=2;},
   f=>{f.provider.collectedCodCents=155001;},
   f=>{f.provider.remittedCents=154501;},
   f=>{f.provider.tenantId="different-tenant";},
   f=>{f.provider.accountScopeSha256="9".repeat(64);},
   f=>{f.provider.recipientAccountSha256="8".repeat(64);},
   f=>{f.provider.transferReferenceSha256="0".repeat(64);},
   f=>{f.provider.checkedAt=new Date(now.getTime()-20*60*1000);},
   f=>{f.bank.source="provider_claimed_bank_credit";},
   f=>{f.bank.authenticated=false;},
   f=>{f.bank.status="PENDING";},
   f=>{f.bank.recipientConfirmed=false;},
   f=>{f.bank.creditedCents=154499;},
   f=>{f.bank.recipientAccountSha256="9".repeat(64);},
   f=>{f.bank.transferReferenceSha256="8".repeat(64);},
   f=>{f.bank.evidenceSha256=f.provider.evidenceSha256;},
   f=>{f.bank.postedAt=new Date(now.getTime()-180000);},
   f=>{f.bank.checkedAt=new Date(now.getTime()-20*60*1000);}
 ];
 for(const change of cases){
   const f=fixture();change(f);
   assert.throws(()=>reconcileLalamoveCodEvidence(f),
     /HYBRID_LALAMOVE_INDEPENDENT_SETTLEMENT_PROOFS_REQUIRED/);
 }
});
function fakeDb(role="super_admin"){
 const f=fixture(),store=new Map([
  ["tenants/"+tenantId,{billingPolicyVersion:"hybrid_v1",
    hybridBillingEnabled:true,active:true,
    lalamoveAccountScopeSha256:a,lalamoveCodRecipientAccountSha256:b}],
  ["users/"+reviewerUid,{role,active:true}],
  ["tenants/"+tenantId+"/orders/"+orderId,f.order],
  ["tenants/"+tenantId+"/hybridLalamoveCodCompletionProof/"+orderId,
   f.deliveryProof]
 ]);
 let writes=0;
 const ref=path=>({
   get:async()=>{const value=store.get(path);return {
    exists:value!==undefined,data:()=>value};},
   collection:name=>({doc:id=>ref(path+"/"+name+"/"+id)}),
   set:()=>{writes++;throw Error("UNEXPECTED_WRITE");},
   update:()=>{writes++;throw Error("UNEXPECTED_WRITE");},
   create:()=>{writes++;throw Error("UNEXPECTED_WRITE");}
 });
 return {db:{collection:name=>({doc:id=>ref(name+"/"+id)})},
   f,store,get writes(){return writes;}};
}
test("server-only lookup preview authorizes Super Admin and leaves Order + proof unchanged",async()=>{
 const x=fakeDb();
 let providerCalls=0,bankCalls=0;
 const result=await previewHybridLalamoveCodSettlement({
  db:x.db,tenantId,orderId,reviewerUid,now,
  resolveProviderRemittance:async context=>{
    providerCalls++;assert.equal(context.recipientAccountSha256,b);
    return x.f.provider;
  },
  resolveIndependentBankCredit:async context=>{
    bankCalls++;assert.equal(context.accountScopeSha256,a);
    return x.f.bank;
  }
 });
 assert.equal(result.canMarkPaid,false);
 assert.equal(x.writes,0);
 assert.equal(providerCalls,1);
 assert.equal(bankCalls,1);
 assert.equal(x.store.get("tenants/"+tenantId+"/orders/"+orderId).paymentStatus,"unpaid");
 const locked=fakeDb("cashier");
 await assert.rejects(previewHybridLalamoveCodSettlement({
   db:locked.db,tenantId,orderId,reviewerUid,now,
   resolveProviderRemittance:async()=>{throw Error("ADAPTER_SHOULD_NOT_RUN");},
   resolveIndependentBankCredit:async()=>{throw Error("ADAPTER_SHOULD_NOT_RUN");}
 }),/HYBRID_LALAMOVE_SETTLEMENT_SUPER_ADMIN_REQUIRED/);
 assert.equal(locked.writes,0);
});
test("candidate is unexported and has zero Firestore financial mutation paths",()=>{
 const index=readFileSync("functions/index.js","utf8");
 const source=readFileSync("functions/hybrid-billing-lalamove-settlement-preview.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-lalamove-settlement-preview/);
 assert.doesNotMatch(source,/tx\.update\(|tx\.create\(|runTransaction\(|paymentStatus:\s*"paid"/);
 assert.match(source,/canMarkPaid:false/);
});
