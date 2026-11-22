"use strict";
const stripe=require("./m7-stripe-test-provider-policy");
const shadow=require("./m7-stripe-test-shadow-policy");
const invoice=require("./m7-stripe-test-reservation-policy");
const {defineSecret}=require("firebase-functions/params");
// These are NOT the Lalamove Wallet Stripe Sandbox secrets.
const stripeSecret=defineSecret("PENGUIN_M7_STRIPE_TEST_KEY");
const hookSecret=defineSecret("PENGUIN_M7_STRIPE_TEST_WEBHOOK");
function config(env=process.env,key=stripeSecret.value(),hook=hookSecret.value(),stage="checkout"){
 const ready=stage==="ingress"?shadow.ingressGate(env):shadow.gate(env);
 return shadow.secrets(ready,key,hook,String(env.PENGUIN_M7_STRIPE_TEST_ACCOUNT_ID||""));
}
const PATH={
 account:"/v1/account",
 methods:"/v1/payment_method_configurations?limit=30",
 checkout:"/v1/checkout/sessions",
};
function safePath(path,method){
 if(method==="GET"&&
  (path===PATH.account||path===PATH.methods||
   /^\/v1\/events\/evt_[A-Za-z0-9_]{8,240}$/.test(path)||
   /^\/v1\/checkout\/sessions\/cs_test_[A-Za-z0-9_]{8,240}$/.test(path)||
   /^\/v1\/payment_intents\/pi_[A-Za-z0-9_]{8,240}$/.test(path)||
   /^\/v1\/charges\/ch_[A-Za-z0-9_]{8,240}$/.test(path)||
   /^\/v1\/disputes\/dp_[A-Za-z0-9_]{8,240}$/.test(path)))return true;
 return method==="POST"&&path===PATH.checkout;
}
async function request(cfg,path,{method="GET",form,idempotency,fetcher=fetch}={}){
 if(!cfg||!stripe.TEST.test(cfg.key||"")||!safePath(path,method)||
  method==="POST"&&(!(form instanceof URLSearchParams)||!invoice.UUID.test(idempotency?.slice(-36)||"")))
  throw Error("M7_STRIPE_TEST_PROVIDER_ARGUMENTS_INVALID");
 const headers={Authorization:"Bearer "+cfg.key};
 if(method==="POST")headers["Content-Type"]="application/x-www-form-urlencoded";
 if(idempotency)headers["Idempotency-Key"]=idempotency;
 const response=await fetcher("https://api.stripe.com"+path,{
  method,headers,body:method==="POST"?form:undefined,redirect:"error",
  signal:AbortSignal.timeout(12000),
 });
 if(!response.ok)throw Error("M7_STRIPE_TEST_PROVIDER_UNCONFIRMED");
 const contentLength=Number(response.headers?.get?.("content-length")||0);
 if(contentLength>131072)throw Error("M7_STRIPE_TEST_PROVIDER_RESPONSE_TOO_LARGE");
 const body=await response.text();
 if(body.length>131072)throw Error("M7_STRIPE_TEST_PROVIDER_RESPONSE_TOO_LARGE");
 try{return JSON.parse(body);}catch{throw Error("M7_STRIPE_TEST_PROVIDER_RESPONSE_INVALID");}
}
async function verifyAccount(cfg,fetcher=request){
 const account=await fetcher(cfg,PATH.account);
 if(!shadow.accountVerified(account,cfg.accountId))throw Error("M7_STRIPE_TEST_ACCOUNT_UNVERIFIED");
 const methods=await fetcher(cfg,PATH.methods);
 if(!shadow.promptPayVerified(methods))throw Error("M7_STRIPE_TEST_PROMPTPAY_UNAVAILABLE");
 return true;
}
function returnOrigin(cfg,env=process.env){
 const origin=String(env.PENGUIN_M7_STRIPE_TEST_RETURN_ORIGIN||"");
 if(origin!=="https://"+cfg.project+".web.app"&&origin!=="https://"+cfg.project+".firebaseapp.com")
  throw Error("M7_STRIPE_TEST_RETURN_ORIGIN_INVALID");
 return origin;
}
function checkoutForm(cfg,row,env=process.env){
 if(!cfg||!row||row.tenantId!==cfg.tenantId||
    !invoice.UUID.test(row.attemptId||"")||!invoice.HEX.test(row.invoiceSignature||"")||
    !Number.isSafeInteger(row.amountSatang)||row.amountSatang<1000||row.amountSatang>99999999||
    !["monthly","delivery_daily"].includes(row.kind))
  throw Error("M7_STRIPE_TEST_QUOTE_INVALID");
 const home=returnOrigin(cfg,env),meta={
  purpose:stripe.PURPOSE,tenantId:row.tenantId,invoiceId:row.invoiceId,
  invoiceSignature:row.invoiceSignature,attemptId:row.attemptId,kind:row.kind,
 };
 const form=new URLSearchParams({
  mode:"payment",
  "payment_method_types[0]":"promptpay",
  "line_items[0][price_data][currency]":"thb",
  "line_items[0][price_data][unit_amount]":String(row.amountSatang),
  "line_items[0][price_data][product_data][name]":
   row.kind==="monthly"?"PENGUIN UAT M7 Monthly Invoice — TEST":"PENGUIN UAT M7 Delivery Share — TEST",
  "line_items[0][quantity]":"1",
  success_url:home+"/reports/revenue-share?m7TestReturn="+encodeURIComponent(row.attemptId),
  cancel_url:home+"/reports/revenue-share?m7TestCancel="+encodeURIComponent(row.attemptId),
  client_reference_id:row.attemptId,
  locale:"th",
 });
 for(const [key,value] of Object.entries(meta)){
  form.set("metadata["+key+"]",value);
  form.set("payment_intent_data[metadata]["+key+"]",value);
 }
 return form;
}
module.exports={stripeSecret,hookSecret,config,PATH,safePath,request,
 verifyAccount,returnOrigin,checkoutForm};
