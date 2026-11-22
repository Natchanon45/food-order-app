import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const policy=require("../../functions/m7-stripe-test-closure-policy.js");
const recovery=require("../../functions/m7-stripe-test-recovery-policy.js");
const now=Date.now(),requestAt=now-80*60000;
const config={tenantId:"test-closure-uat-tenant",accountId:"acct_1234567890abcdef",
 fingerprint:"a".repeat(64)};
const row={tenantId:config.tenantId,invoiceId:"2026-11-22:monthly:fixed",
 attemptId:"abcdef12-1234-1234-1234-123456789abc",
 invoiceSignature:"b".repeat(64),amountSatang:39900,kind:"monthly",
 currency:"THB",mode:"test",attemptNo:1,status:"expired_test",
 providerCheckoutCreated:true,
 checkoutSessionId:"cs_test_1234567890abcdef",
 checkoutUrl:"",settled:false,providerClosureVerified:false,
 lifecycleLastEventId:"evt_1234567890abcdef",
 accountId:config.accountId,providerFingerprint:config.fingerprint,
 providerRequestedAt:{toMillis:()=>requestAt}};
const lock={...row};
const life={mode:"test_shadow_lifecycle",status:"expired_test",
 eventType:"checkout.session.expired",eventId:row.lifecycleLastEventId,
 sessionId:row.checkoutSessionId,tenantId:row.tenantId,
 invoiceId:row.invoiceId,attemptId:row.attemptId,
 invoiceSignature:row.invoiceSignature,amountSatang:row.amountSatang,
 accountId:config.accountId,providerVerifiedUnpaid:true,
 invoicePaid:false,canRetry:false,auditedAtMs:now-55*60000};
const claim={mode:"test_shadow_lifecycle",tenantId:row.tenantId,
 invoiceId:row.invoiceId,attemptId:row.attemptId,
 sessionId:row.checkoutSessionId};
const session={object:"checkout.session",id:row.checkoutSessionId,
 created:Math.floor(requestAt/1000)+5,
 expires_at:Math.floor(now/1000)-65*60,
 livemode:false,status:"expired",payment_status:"unpaid",
 mode:"payment",currency:"thb",amount_total:39900,
 metadata:{purpose:"penguin_m7_invoice_test",tenantId:row.tenantId,
  invoiceId:row.invoiceId,invoiceSignature:row.invoiceSignature,
  attemptId:row.attemptId,kind:row.kind},
 client_reference_id:row.attemptId,payment_method_types:["promptpay"],
 payment_intent:null};
test("reviewed closure requires signed terminal audit, original TEST event claim and >=30min cooldown",()=>{
 assert.equal(policy.validLocal(row,lock,life,claim,config,now),true);
 assert.equal(policy.MIN_COOLDOWN_MS,1800000);
 for(const [r,l,a,c] of [
  [{...row,status:"payment_failed_test"},lock,life,claim],
  [row,{...lock,providerClosureVerified:true},life,claim],
  [row,lock,{...life,providerVerifiedUnpaid:false},claim],
  [row,lock,{...life,eventType:"checkout.session.async_payment_failed"},claim],
  [row,lock,{...life,auditedAtMs:now-10*60000},claim],
  [row,lock,life,{...claim,sessionId:"cs_test_9876543210abcdef"}],
  [row,lock,{...life,invoiceSignature:"f".repeat(64)},claim],
  [row,lock,life,{...claim,mode:"fake"}],
 ])assert.equal(policy.validLocal(r,l,a,c,config,now),false);
});
test("only complete TEST expired, NO intent, exact existing session + 30m after expires_at",()=>{
 assert.equal(policy.exactExpired(row,session,now),true);
 for(const variant of [
  {...session,payment_status:"paid"},
  {...session,payment_intent:"pi_1234567890abcdef"},
  {...session,status:"complete"},
  {...session,status:"open"},
  {...session,object:"payment_intent"},
  {...session,livemode:true},
  {...session,id:"cs_test_9876543210abcdef"},
  {...session,amount_total:39901},
  {...session,expires_at:Math.floor(now/1000)-5*60},
  {...session,metadata:{...session.metadata,invoiceId:"2026-11-23:monthly:fixed"}},
 ])assert.equal(policy.exactExpired(row,variant,now),false);
 assert.equal(policy.exactExpired(row,session,now-100*60000),false);
});
test("bounded paginated history scan must match precisely the already-locked Session ID",async()=>{
 const list=async(_config,path)=>({
  object:"list",data:session.created&&path.startsWith("/v1/checkout/sessions?")?
    [session]:[],has_more:false});
 const result=await recovery.scan({config,row,read:list,now,allowExpired:true});
 assert.equal(result.status,"already_expired");
 assert.equal(result.canCreateNewCheckout,false);
 const different=async()=>({object:"list",data:[{
  ...session,id:"cs_test_9876543210abcdef"}],has_more:false});
 const untrusted=await recovery.scan({config,row,read:different,now,allowExpired:true});
 assert.equal(untrusted.status,"mismatch");
 assert.equal(untrusted.canCreateNewCheckout,false);
 const failed=await recovery.scan({config,row:{...row,status:"payment_failed_test"},
  read:list,now,allowExpired:true});
 assert.equal(failed.status,"requires_review");
});
