import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {validateSignedLalamoveCompletion,validateLalamoveProviderLookup,
 recordHybridLalamoveCodCompletionCandidate}=
 require("../../functions/hybrid-billing-lalamove-cod-verification.js");
const credentials={apiKey:"pk_test_demo_lalamove_only",apiSecret:"sk_test_demo_hmac_secret"};
const at=new Date("2026-10-20T12:30:00Z");
function event(change={}){
 const payload={apiKey:credentials.apiKey,
   timestamp:Math.trunc(at.getTime()/1000),
   eventId:"LL-COMPLETE-EVENT-TEST-0001",eventType:"ORDER_STATUS_CHANGED",
   data:{order:{orderId:"LL-TEST-ORDER-0001",status:"COMPLETED"}}};
 const mixed={...payload,...change};
 const raw=String(mixed.timestamp)+"\r\nPOST\r\n/api/lalamove/webhook\r\n\r\n"+
   JSON.stringify(mixed.data);
 mixed.signature=createHmac("sha256",credentials.apiSecret).update(raw).digest("hex");
 return mixed;
}
test("signed Lalamove COMPLETED event verifies HMAC + freshness, never proves payment",()=>{
 const e=event();
 const actual=validateSignedLalamoveCompletion({payload:e,credentials,now:at});
 assert.equal(actual.providerOrderId,"LL-TEST-ORDER-0001");
 assert.match(actual.eventHash,/^[a-f0-9]{64}$/);
 const bad={...e,signature:"0".repeat(64)};
 assert.throws(()=>validateSignedLalamoveCompletion({payload:bad,credentials,now:at}),
   /WEBHOOK_SIGNATURE_INVALID/);
 assert.throws(()=>validateSignedLalamoveCompletion({payload:event({eventType:"WALLET_BALANCE_CHANGED"}),
   credentials,now:at}),/SIGNED_COMPLETION_REQUIRED/);
 assert.throws(()=>validateSignedLalamoveCompletion({payload:event({data:{order:{orderId:"LL-TEST-ORDER-0001",status:"PICKED_UP"}}}),
   credentials,now:at}),/SIGNED_COMPLETION_REQUIRED/);
 assert.throws(()=>validateSignedLalamoveCompletion({payload:e,credentials,
   now:new Date(at.getTime()+20*60*1000)}),/WEBHOOK_EXPIRED/);
 assert.throws(()=>validateSignedLalamoveCompletion({payload:e,credentials:{
   ...credentials,apiSecret:"another-secret"},now:at}),/WEBHOOK_SIGNATURE_INVALID/);
});
test("fresh authenticated provider query must independently match account scope and status",()=>{
 const lookup={source:"authenticated_lalamove_order_lookup",authenticated:true,
   tenantId:"tenant-lalamove-unit-001",orderId:"LL-TEST-ORDER-0001",
   status:"COMPLETED",market:"TH",accountScopeSha256:"a".repeat(64),
   evidenceSha256:"b".repeat(64),checkedAt:at};
 const options={lookup,tenantId:lookup.tenantId,providerOrderId:lookup.orderId,
    accountScopeSha256:lookup.accountScopeSha256,now:at};
 assert.deepEqual(validateLalamoveProviderLookup(options),{evidenceSha256:"b".repeat(64)});
 for(const fake of [{...lookup,authenticated:false},
   {...lookup,status:"CANCELED"},{...lookup,accountScopeSha256:"f".repeat(64)},
   {...lookup,tenantId:"wrong-tenant"}, {...lookup,checkedAt:new Date(at.getTime()-20*60*1000)}]){
    assert.throws(()=>validateLalamoveProviderLookup({...options,lookup:fake}),
      /AUTHENTICATED_ORDER_LOOKUP_REQUIRED/);
 }
});
test("candidate stays unexported and cannot touch bank COD settlement or paidAt",async()=>{
 const idx=readFileSync("functions/index.js","utf8");
 const cod=readFileSync("functions/hybrid-billing-cod-payment.js","utf8");
 const src=readFileSync("functions/hybrid-billing-lalamove-cod-verification.js","utf8");
 assert.doesNotMatch(idx,/hybrid-billing-lalamove-cod-verification/);
 assert.match(cod,/HYBRID_COD_LALAMOVE_PROVIDER_SETTLEMENT_REQUIRED/);
 assert.doesNotMatch(src,/tx\.update\(oref|paymentStatus:\s*"paid"|paidAt:\s*serverTimestamp/);
 await assert.rejects(recordHybridLalamoveCodCompletionCandidate({
  db:{},tenantId:"tenant-lalamove-unit-001",orderId:"order-lalamove-unit-001",
  reviewerUid:"super-lalamove-unit-001",payload:event(),credentials,now:at
 }),/PROVIDER_ADAPTER_REQUIRED/);
});
