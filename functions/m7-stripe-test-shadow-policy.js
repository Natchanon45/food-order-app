"use strict";
// M7 TEST provider-facing gate. No operational finance/hold/service-credit
// writer is reachable from this module. Test money has zero real value.
const invoice=require("./m7-stripe-test-reservation-policy");
const stripe=require("./m7-stripe-test-provider-policy");
const {createHash}=require("node:crypto");
const LIVE=new Set(["penguin-food","penguin-food-prod","penguin-food-production"]);
function auditGate(env=process.env){
 const project=String(env.GCLOUD_PROJECT||env.GCP_PROJECT||env.GOOGLE_CLOUD_PROJECT||"");
 const tenant=String(env.PENGUIN_M7_STRIPE_TEST_TENANT_ID||"");
 if(!project||LIVE.has(project)||project.startsWith("demo-")||
    !/(?:^|[-_])(?:uat|test)(?:$|[-_])/i.test(project)||
    project!==env.PENGUIN_M7_STRIPE_TEST_PROJECT_ID||!invoice.TENANT.test(tenant)||
    env.FUNCTIONS_EMULATOR==="true"||env.FIRESTORE_EMULATOR_HOST||
    env.FIREBASE_AUTH_EMULATOR_HOST||env.PENGUIN_M7_STRIPE_LIVE_ENABLED==="1")
  return null;
 return {project,tenantId:tenant};
}
// Keep accepting independently signed TEST receipts after the Checkout
// button is disabled, provided the isolated shadow-ledger verification gate
// remains enabled. Otherwise a TEST payment may be stranded mid-flight.
function ingressGate(env=process.env){
 const scope=auditGate(env);
 return scope&&env.PENGUIN_M7_STRIPE_TEST_RESERVATIONS_ENABLED==="1"&&
    env.PENGUIN_M7_STRIPE_TEST_SHADOW_LEDGER_ENABLED==="1"&&
    env.PENGUIN_M7_STRIPE_TEST_SETTLEMENT_ENABLED!=="1"?scope:null;
}
function gate(env=process.env){
 const scope=ingressGate(env);
 return scope&&env.PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED==="1"?scope:null;
}
function secrets(cfg,key,hook,accountId){
 if(!cfg||!stripe.TEST.test(key||"")||!stripe.HOOK.test(hook||"")||
    !stripe.ACCOUNT.test(accountId||""))return null;
 return {tenantId:cfg.tenantId,project:cfg.project,key,hook,accountId,
  fingerprint:createHash("sha256").update(JSON.stringify([cfg.project,cfg.tenantId,key,hook,accountId])).digest("hex")};
}
function accountVerified(row,accountId){
 return stripe.ACCOUNT.test(accountId||"")&&row?.id===accountId&&row.livemode===false&&
  row.country==="TH"&&row.charges_enabled===true;
}
function promptPayVerified(rows){
 return Array.isArray(rows?.data)&&rows.data.some(c=>c.active===true&&
  c.promptpay?.available===true&&c.promptpay?.display_preference?.value==="on");
}
function checkoutSession(record,response){
 if(!record||!stripe.SESSION.test(response?.id||"")||!invoice.TENANT.test(record.tenantId||"")||
   !stripe.metadata(response.metadata,record)||
   response.livemode!==false||response.mode!=="payment"||response.currency!=="thb"||
   response.status!=="open"||response.payment_status!=="unpaid"||
   response.amount_total!==record.amountSatang||
   response.client_reference_id!==record.attemptId||
   !Array.isArray(response.payment_method_types)||
   response.payment_method_types.length!==1||response.payment_method_types[0]!=="promptpay")return false;
 try{
  const url=new URL(response.url||"");
  return url.protocol==="https:"&&url.hostname==="checkout.stripe.com"&&
   !url.username&&!url.password&&!url.port&&/^\/(c|g)\/pay\//.test(url.pathname);
 }catch{return false;}
}
function safeCheckoutURL(raw){
 try{
  const url=new URL(raw||"");
  return url.protocol==="https:"&&url.hostname==="checkout.stripe.com"&&
    !url.port&&!url.username&&!url.password&&/^\/(c|g)\/pay\//.test(url.pathname)?url.href:"";
 }catch{return "";}
}
function publicAttempt(row,{includeURL=false}={}){
 if(!row)return null;
 const url=includeURL&&row.status==="checkout_ready"&&
  row.providerCheckoutCreated===true&&stripe.SESSION.test(row.checkoutSessionId||"")
  ?safeCheckoutURL(row.checkoutUrl):"";
 return {attemptId:row.attemptId,invoiceId:row.invoiceId,amountSatang:row.amountSatang,
  currency:"THB",kind:row.kind,status:row.status,mode:"test",
  providerVerified:row.status==="verified_test",invoicePaid:false,
  operationalSettlementEnabled:false,checkoutUrl:url,
  attemptNo:row.attemptNo||1};
}
module.exports={auditGate,ingressGate,gate,secrets,accountVerified,promptPayVerified,
 checkoutSession,safeCheckoutURL,publicAttempt};
