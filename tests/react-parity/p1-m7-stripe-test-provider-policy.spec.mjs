import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createHmac} from "node:crypto";
const require=createRequire(import.meta.url);
const p=require("../../functions/m7-stripe-test-provider-policy.js");
const record={tenantId:"tenant-source-uat",invoiceId:"2026-11-22:monthly:fixed",
  invoiceSignature:"a".repeat(64),attemptId:"abcdef12-1234-1234-1234-123456789abc",
  kind:"monthly",amountSatang:39900,currency:"THB",mode:"test",status:"checkout_ready",
  providerCheckoutCreated:true,checkoutSessionId:"cs_test_1234567890abcDEF",accountId:"acct_1234567890abcdef"};
const meta={purpose:p.PURPOSE,tenantId:record.tenantId,invoiceId:record.invoiceId,
 invoiceSignature:record.invoiceSignature,attemptId:record.attemptId,kind:record.kind};
const intent={id:"pi_1234567890abcDEF",livemode:false,status:"succeeded",currency:"thb",
  amount:record.amountSatang,amount_received:record.amountSatang,metadata:meta,
  payment_method_types:["promptpay"]};
const session={id:record.checkoutSessionId,livemode:false,mode:"payment",status:"complete",
  payment_status:"paid",currency:"thb",amount_total:record.amountSatang,
  client_reference_id:record.attemptId,metadata:meta,
  payment_method_types:["promptpay"],payment_intent:intent.id};
test("pure independent M7 provider proof requires two separate Stripe TEST objects and source-bound snapshot",()=>{
 const ok=()=>p.verifiedTestSettlement({reservation:record,session,intent,expectedAccount:record.accountId});
 assert.equal(ok(),true);
 for(const [name,change] of [
  ["status_not_checkout",{reservation:{...record,status:"reserved"}}],
  ["wrong_currency_record",{reservation:{...record,currency:"USD"}}],
  ["wrong_invoice_id",{reservation:{...record,invoiceId:"evil"}}],
  ["wrong_tenant_id",{reservation:{...record,tenantId:"../../other"}}],
  ["not_provider_created",{reservation:{...record,providerCheckoutCreated:false}}],
  ["wrong_account",{expectedAccount:"acct_0000000000000000"}],
  ["unbound_invoice",{session:{...session,metadata:{...meta,invoiceId:"other"}}}],
  ["unbound_attempt",{intent:{...intent,metadata:{...meta,attemptId:"other"}}}],
  ["wrong_immutable",{intent:{...intent,metadata:{...meta,invoiceSignature:"b".repeat(64)}}}],
  ["wrong_client_reference",{session:{...session,client_reference_id:"other"}}],
  ["wrong_session",{session:{...session,id:"cs_test_9876543210aBCDEF"}}],
  ["wrong_intent",{intent:{...intent,id:"pi_9876543210abcDEF"}}],
  ["live_mode",{intent:{...intent,livemode:true}}],
  ["not_completed",{session:{...session,status:"open"}}],
  ["not_paid",{session:{...session,payment_status:"unpaid"}}],
  ["not_received",{intent:{...intent,amount_received:0}}],
  ["wrong_amount",{intent:{...intent,amount:39901}}],
  ["wrong_currency",{session:{...session,currency:"usd"}}],
  ["card_payment",{session:{...session,payment_method_types:["card"]}}],
  ["multiple_methods",{intent:{...intent,payment_method_types:["promptpay","card"]}}],
 ])assert.equal(p.verifiedTestSettlement({reservation:record,session,intent,expectedAccount:record.accountId,...change}),false,name);
});
test("signed raw event is a hint only; rejects wrong signature/timestamp/malformed body/live mode",()=>{
 const secret="whsec_"+("A".repeat(48)),at=1763800000;
 const event={id:"evt_1234567890abcDEF",type:"checkout.session.completed",livemode:false,
  data:{object:{id:session.id,livemode:false,metadata:meta}}};
 const raw=Buffer.from(JSON.stringify(event)),signature=bytes=>"t="+at+",v1="+createHmac("sha256",secret)
   .update(at+".").update(bytes).digest("hex");
 assert.equal(p.webhookVerified(raw,signature(raw),secret,at),true);
 const hint=p.verifiedEventEnvelope({raw,header:signature(raw),secret,nowSeconds:at});
 assert.equal(hint.providerVerified,false);assert.equal(hint.settled,false);
 assert.equal(hint.attemptId,record.attemptId);
 assert.equal(p.verifiedEventEnvelope({raw,header:signature(raw),secret,nowSeconds:at+301}),null);
 assert.equal(p.verifiedEventEnvelope({raw,header:signature(raw),secret:secret+"BAD",nowSeconds:at}),null);
 assert.equal(p.verifiedEventEnvelope({raw:Buffer.from("{}"),header:signature(raw),secret,nowSeconds:at}),null);
 const wrongMetadata=Buffer.from(JSON.stringify({...event,data:{object:{
  ...event.data.object,metadata:{...meta,invoiceSignature:"invalid"}}}}));
 assert.equal(p.verifiedEventEnvelope({raw:wrongMetadata,header:signature(wrongMetadata),secret,nowSeconds:at}),null);
 const live=Buffer.from(JSON.stringify({...event,livemode:true}));
 assert.equal(p.verifiedEventEnvelope({raw:live,header:signature(live),secret,nowSeconds:at}),null);
 const wrong=Buffer.from(JSON.stringify({...event,type:"checkout.session.expired"}));
 assert.equal(p.verifiedEventEnvelope({raw:wrong,header:signature(wrong),secret,nowSeconds:at}),null);
});
