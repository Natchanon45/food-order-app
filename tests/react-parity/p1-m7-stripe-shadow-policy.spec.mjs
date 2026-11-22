import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const shadow=require("../../functions/m7-stripe-test-shadow-policy.js");
const adapter=require("../../functions/m7-stripe-test-provider-adapter.js");
const history=require("../../functions/m7-stripe-test-shadow-history.js");
const provider=require("../../functions/m7-stripe-test-provider-policy.js");
const env={
 GCLOUD_PROJECT:"penguin-m7-private-uat",
 PENGUIN_M7_STRIPE_TEST_PROJECT_ID:"penguin-m7-private-uat",
 PENGUIN_M7_STRIPE_TEST_TENANT_ID:"tenant-private-uat123",
 PENGUIN_M7_STRIPE_TEST_RESERVATIONS_ENABLED:"1",
 PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED:"1",
 PENGUIN_M7_STRIPE_TEST_SHADOW_LEDGER_ENABLED:"1",
 PENGUIN_M7_STRIPE_TEST_SETTLEMENT_ENABLED:"0",
 PENGUIN_M7_STRIPE_TEST_RETURN_ORIGIN:"https://penguin-m7-private-uat.web.app",
};
const key="sk_test_"+("A".repeat(48)),hook="whsec_"+("B".repeat(48)),accountId="acct_1234567890abcdef";
const cfg=shadow.secrets(shadow.gate(env),key,hook,accountId);
const row={tenantId:cfg.tenantId,invoiceId:"2026-11-22:monthly:fixed",
 kind:"monthly",invoiceSignature:"a".repeat(64),
 attemptId:"abcdef12-1234-1234-1234-123456789abc",
 amountSatang:39900,status:"reserved",attemptNo:1,mode:"test",currency:"THB"};
test("project UAT, test-only Stripe key, active checkout and post-disable receipt ingress are separate",()=>{
 assert.equal(shadow.gate(env).tenantId,cfg.tenantId);
 assert.equal(shadow.ingressGate({...env,PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED:"0"}).tenantId,cfg.tenantId);
 assert.equal(shadow.gate({...env,PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED:"0"}),null);
 assert.equal(shadow.auditGate({...env,PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED:"0",
  PENGUIN_M7_STRIPE_TEST_SHADOW_LEDGER_ENABLED:"0"}).tenantId,cfg.tenantId);
 for(const patch of [
  {GCLOUD_PROJECT:"penguin-food",PENGUIN_M7_STRIPE_TEST_PROJECT_ID:"penguin-food"},
  {GCLOUD_PROJECT:"demo-penguin-hybrid",PENGUIN_M7_STRIPE_TEST_PROJECT_ID:"demo-penguin-hybrid"},
  {PENGUIN_M7_STRIPE_TEST_PROJECT_ID:"other-project"},
  {FUNCTIONS_EMULATOR:"true"},{FIRESTORE_EMULATOR_HOST:"127.0.0.1:18080"},
  {PENGUIN_M7_STRIPE_TEST_SETTLEMENT_ENABLED:"1"},
  {PENGUIN_M7_STRIPE_LIVE_ENABLED:"1"},
  {PENGUIN_M7_STRIPE_TEST_SHADOW_LEDGER_ENABLED:"0"},
 ])assert.equal(shadow.ingressGate({...env,...patch}),null,JSON.stringify(patch));
 const configured={...env,PENGUIN_M7_STRIPE_TEST_ACCOUNT_ID:accountId};
 assert.ok(adapter.config(configured,key,hook,"checkout"));
 const stopped={...configured,PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED:"0"};
 assert.equal(adapter.config(stopped,key,hook,"checkout"),null);
 assert.ok(adapter.config(stopped,key,hook,"ingress"));
 assert.equal(adapter.config({...stopped,PENGUIN_M7_STRIPE_TEST_SHADOW_LEDGER_ENABLED:"0"},key,hook,"ingress"),null);
 assert.equal(shadow.secrets(shadow.gate(env),"sk_live_"+("A".repeat(48)),hook,accountId),null);
 assert.equal(shadow.secrets(shadow.gate(env),key,"not_webhook_secret",accountId),null);
 assert.equal(shadow.secrets(shadow.gate(env),key,hook,"acct_wrong"),null);
 assert.ok(cfg.fingerprint.length===64);
});
test("Stripe TEST Checkout form uses exact UAT origin + server amount and both metadata scopes",()=>{
 const form=adapter.checkoutForm(cfg,row,env);
 assert.equal(form.get("line_items[0][price_data][unit_amount]"),"39900");
 assert.equal(form.get("payment_method_types[0]"),"promptpay");
 assert.equal(form.get("metadata[purpose]"),provider.PURPOSE);
 assert.equal(form.get("payment_intent_data[metadata][purpose]"),provider.PURPOSE);
 assert.equal(form.get("metadata[invoiceSignature]"),row.invoiceSignature);
 assert.equal(form.get("payment_intent_data[metadata][invoiceSignature]"),row.invoiceSignature);
 assert.equal(form.get("client_reference_id"),row.attemptId);
 assert.equal(form.get("success_url"),env.PENGUIN_M7_STRIPE_TEST_RETURN_ORIGIN+
  "/reports/revenue-share?m7TestReturn="+row.attemptId);
 assert.throws(()=>adapter.checkoutForm(cfg,row,{
  ...env,PENGUIN_M7_STRIPE_TEST_RETURN_ORIGIN:"https://penguin-food.web.app"}),/RETURN_ORIGIN_INVALID/);
 assert.throws(()=>adapter.checkoutForm(cfg,{...row,amountSatang:39901.5},env),/QUOTE_INVALID/);
 assert.throws(()=>adapter.checkoutForm(cfg,{...row,tenantId:"other-tenant"},env),/QUOTE_INVALID/);
 assert.equal(adapter.safePath("/v1/checkout/sessions","POST"),true);
 assert.equal(adapter.safePath("/v1/charges","POST"),false);
 assert.equal(adapter.safePath("/v1/refunds","POST"),false);
 assert.equal(adapter.safePath("/v1/customers","GET"),false);
 assert.equal(adapter.safePath("/v1/payment_intents/pi_1234567890abcdef","GET"),true);
});
test("any partially paid or credit-applied invoice cannot get a full-price TEST quote",()=>{
 const p=require("../../functions/m7-stripe-test-reservation-policy.js");
 const invoice={id:row.invoiceId,tenantId:row.tenantId,kind:"fixed_monthly",
  signature:row.invoiceSignature,version:"hybrid-invoice-v1",status:"issued",amount:399};
 assert.equal(p.quote(invoice,row.invoiceId,tenantIdDummy()).amountSatang,39900);
 for(const field of p.PREPAID_FIELDS){
  assert.throws(()=>p.quote({...invoice,[field]:field==="hasPendingAdjustment"?true:1},
   row.invoiceId,row.tenantId),/INVOICE_UNPAYABLE/,field);
 }
 function tenantIdDummy(){return row.tenantId;}
});
test("independent account / payment method verification is test-only",()=>{
 assert.equal(shadow.accountVerified({id:accountId,country:"TH",charges_enabled:true,livemode:false},accountId),true);
 assert.equal(shadow.accountVerified({id:accountId,country:"TH",charges_enabled:true,livemode:true},accountId),false);
 assert.equal(shadow.accountVerified({id:accountId,country:"US",charges_enabled:true,livemode:false},accountId),false);
 assert.equal(shadow.promptPayVerified({data:[{active:true,promptpay:{
  available:true,display_preference:{value:"on"}}}]}),true);
 assert.equal(shadow.promptPayVerified({data:[{active:true,promptpay:{
  available:false,display_preference:{value:"off"}}}]}),false);
 const safe="https://checkout.stripe.com/c/pay/cs_test_1234567890abc";
 assert.equal(shadow.safeCheckoutURL(safe),safe);
 assert.equal(shadow.safeCheckoutURL("https://checkout.stripe.com.evil.com/c/pay/abc"),"");
 assert.equal(shadow.safeCheckoutURL("javascript:alert(1)"),"");
});
test("Superadmin history downgrade: missing/mismatched settlement is needs_review, never Paid",()=>{
 const recorded={...row,status:"verified_test",providerCheckoutCreated:true,
  checkoutSessionId:"cs_test_1234567890abcdef",intentId:"pi_1234567890abcdef",
  accountId,createdAt:{toDate:()=>new Date("2026-11-22T07:00:00.000Z")}};
 const settlement={status:"verified_test_shadow",providerVerified:true,operationalInvoicePaid:false,
  mode:"test_shadow",tenantId:cfg.tenantId,invoiceId:row.invoiceId,
  attemptId:row.attemptId,invoiceSignature:row.invoiceSignature,
  amountSatang:row.amountSatang,currency:"THB",intentId:recorded.intentId,
  sessionId:recorded.checkoutSessionId,accountId,proofDigest:"b".repeat(64)};
 const v=history._privateForTests.view;
 assert.equal(v(recorded,settlement).status,"provider_test_verified");
 assert.equal(v(recorded,settlement).operationalSettlementEnabled,false);
 assert.equal(v(recorded,null).status,"needs_review");
 assert.equal(v(recorded,{...settlement,amountSatang:39901}).status,"needs_review");
 assert.equal(v(recorded,{...settlement,accountId:"acct_9876543210abcdef"}).status,"needs_review");
 assert.equal(v({...recorded,invoiceSignature:"c".repeat(64)},settlement).status,"needs_review");
 assert.equal(v(recorded,{...settlement,operationalInvoicePaid:true}).status,"needs_review");
});

test("fixed-origin provider transport cannot post refunds, arbitrary Stripe endpoints or live credentials",async()=>{
 let calls=0;
 const expected={id:"cs_test_transport123456",mode:"payment",livemode:false};
 const mock=async(url,options)=>{
  calls++;
  assert.equal(url,"https://api.stripe.com/v1/checkout/sessions");
  assert.equal(options.method,"POST");
  assert.equal(options.redirect,"error");
  assert.equal(options.headers.Authorization,"Bearer "+key);
  assert.equal(options.headers["Idempotency-Key"],"penguin-m7-test-"+row.attemptId);
  return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(expected)};
 };
 const output=await adapter.request(cfg,"/v1/checkout/sessions",{
  method:"POST",form:adapter.checkoutForm(cfg,row,env),
  idempotency:"penguin-m7-test-"+row.attemptId,fetcher:mock});
 assert.equal(output.id,expected.id);assert.equal(calls,1);
 for(const [path,method] of [["/v1/refunds","POST"],
  ["/v1/charges","GET"],["/v1/balance","GET"],
  ["/v1/checkout/sessions","PUT"],["/v1/customers","DELETE"]]){
  await assert.rejects(adapter.request(cfg,path,{
   method,form:adapter.checkoutForm(cfg,row,env),
   idempotency:"penguin-m7-test-"+row.attemptId,
   fetcher:async()=>{throw Error("MUST_NOT_CONTACT_PROVIDER")},
  }),/PROVIDER_ARGUMENTS_INVALID/,path);
 }
 assert.equal(calls,1);
 await assert.rejects(adapter.request({...cfg,key:"sk_live_"+("C".repeat(48))},
  "/v1/account",{fetcher:async()=>{throw Error("MUST_NOT_CONTACT_LIVE_PROVIDER")}}),
  /PROVIDER_ARGUMENTS_INVALID/);
});
