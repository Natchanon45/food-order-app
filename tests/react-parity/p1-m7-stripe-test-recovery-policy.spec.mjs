import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const p=require("../../functions/m7-stripe-test-recovery-policy.js");
const adapter=require("../../functions/m7-stripe-test-provider-adapter.js");
const time=Date.now(),created=Math.floor(time/1000)-10;
const cfg={tenantId:"tenant-m7-uat-1234",accountId:"acct_1234567890abcdef",
 fingerprint:"a".repeat(64)};
const row={tenantId:cfg.tenantId,invoiceId:"2026-11-22:monthly:fixed",
 amountSatang:39900,invoiceSignature:"b".repeat(64),kind:"monthly",
 currency:"THB",mode:"test",attemptId:"abcdef12-1234-1234-1234-123456789abc",
 accountId:cfg.accountId,providerFingerprint:cfg.fingerprint,
 status:"provider_requesting",providerCheckoutCreated:false,
 checkoutSessionId:"",checkoutUrl:"",settled:false,
 providerRequestedAt:{toMillis:()=>time-10000}};
const meta={purpose:"penguin_m7_invoice_test",tenantId:row.tenantId,
 invoiceId:row.invoiceId,invoiceSignature:row.invoiceSignature,
 attemptId:row.attemptId,kind:row.kind};
const matching={id:"cs_test_1234567890abcDEF",object:"checkout.session",
 created,metadata:meta,
 client_reference_id:row.attemptId,amount_total:row.amountSatang,
 currency:"thb",mode:"payment",livemode:false,status:"open",
 payment_status:"unpaid",url:"https://checkout.stripe.com/c/pay/cs_test_1234567890abcDEF",
 payment_method_types:["promptpay"],payment_intent:null};
function listResponse(rows,has_more=false){
 return {object:"list",data:rows,has_more};
}
test("bounded paginated real Checkout Sessions list endpoint is GET-only, never creates/refunds",()=>{
 const range=p.windowFor(row,time);
 const path=p.listPath(range);
 assert.match(path,/^\/v1\/checkout\/sessions\?limit=100&created%5Bgte%5D=\d+&created%5Blte%5D=\d+$/);
 assert.equal(adapter.safePath(path,"GET"),true);
 assert.equal(adapter.safePath(path,"POST"),false);
 assert.equal(adapter.safePath(path+"&bogus=yes","GET"),false);
 assert.equal(adapter.safePath("/v1/checkout/sessions?limit=500","GET"),false);
 assert.equal(adapter.safePath(p.listPath(range,matching.id),"GET"),true);
 assert.equal(adapter.safePath("/v1/refunds","POST"),false);
 assert.ok(p.windowFor({...row,providerRequestedAt:{toMillis:()=>time-3*24*60*60*1000}},time)===null);
});
test("single exact TEST session survives two pages; no results never authorizes retry",async()=>{
 const read=async(_cfg,path)=>{
  assert.equal(adapter.safePath(path,"GET"),true);
  const cursor=new URLSearchParams(path.split("?")[1]).get("starting_after");
  return cursor?listResponse([matching]):listResponse([{
   id:"cs_test_9876543210abcDEF",created,metadata:{purpose:"another"},
   client_reference_id:"other"}],true);
 };
 const report=await p.scan({config:cfg,row,read,now:time});
 assert.equal(report.status,"single_open");
 assert.equal(report.scannedPages,2);
 assert.equal(report.sessionId,matching.id);
 assert.equal(report.canCreateNewCheckout,false);
 assert.equal(report.canSettleInvoice,false);
 const missing=await p.scan({config:cfg,row,read:async()=>listResponse([]),now:time});
 assert.equal(missing.status,"not_found_uncertain");
 assert.equal(missing.matchedSingleOpen,false);
 assert.equal(missing.sessionId,"");
});
test("ambiguous/invalid/unbounded/malformed Stripe provider data is fail-closed",async()=>{
 const run=async list=>p.scan({config:cfg,row,read:async()=>list,now:time});
 assert.equal((await run(listResponse([matching,{
  ...matching,id:"cs_test_9999999999abcDEF"}]))).status,"ambiguous");
 assert.equal((await run(listResponse([{...matching,amount_total:39901}]))).status,"mismatch");
 assert.equal((await run(listResponse([matching],true))).status,"scan_incomplete");
 assert.equal((await run({object:"fake_list",data:[matching],has_more:false})).status,"scan_incomplete");
 assert.equal((await run(listResponse([matching,matching]))).status,"scan_incomplete");
 assert.equal((await run(listResponse(Array(101).fill(matching)))).status,"scan_incomplete");
 assert.equal((await p.scan({config:cfg,row:{...row,accountId:"acct_9876543210abcdef"},
  read:async()=>{throw Error("MUST_NOT_FETCH")},now:time})).status,"requires_review");
 assert.equal(p.status({...matching,status:"complete",payment_status:"paid"}),"provider_paid_wait_webhook");
 assert.equal(p.status({...matching,status:"expired",payment_status:"unpaid"}),"provider_expired_unpaid");
 assert.equal(p.status({...matching,status:"complete",payment_status:"unpaid"}),"provider_failed_unpaid");
 assert.equal(p.status({...matching,status:"open",payment_status:"unpaid",payment_intent:"pi_1234567890abcDEF"}),"needs_review");
});
