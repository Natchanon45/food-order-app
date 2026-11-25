"use strict";
const {onCall,onRequest,HttpsError}=require("./managed-email-callable");
const {defineSecret}=require("firebase-functions/params");
const {getFirestore}=require("firebase-admin/firestore");
const {createHash}=require("node:crypto");
const policy=require("./stripe-wallet-sandbox-policy");
const ledger=require("./stripe-wallet-sandbox-ledger");
const stripeKey=defineSecret("PENGUIN_STRIPE_WALLET_TEST_KEY");
const webhookKey=defineSecret("PENGUIN_STRIPE_WALLET_TEST_WEBHOOK");
const options={region:"asia-southeast1",timeoutSeconds:60,secrets:[stripeKey,webhookKey]};
const EVENT=/^evt_[A-Za-z0-9]{8,240}$/;
const INTENT=/^pi_[A-Za-z0-9]{8,240}$/;
const EVENT_TYPES=new Set(["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed","checkout.session.expired"]);
const disabled=()=>new HttpsError("failed-precondition","STRIPE_SANDBOX_DISABLED");
function settings(){
 if(process.env.FUNCTIONS_EMULATOR==="true"||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST||String(process.env.GCLOUD_PROJECT||process.env.GCP_PROJECT||"").startsWith("demo-")||process.env.PENGUIN_STRIPE_WALLET_SANDBOX_ENABLED!=="1"||process.env.PENGUIN_STRIPE_WALLET_LIVE_ENABLED==="1")return null;
 const tenantId=String(process.env.PENGUIN_STRIPE_WALLET_SANDBOX_TENANT_ID||"");
 const accountId=String(process.env.PENGUIN_STRIPE_WALLET_TEST_ACCOUNT_ID||"");
 const key=stripeKey.value(),hook=webhookKey.value();
 if(!ledger.TENANT.test(tenantId)||!policy.configurationReady(key,hook,accountId))return null;
 return {tenantId,accountId,key,hook,fingerprint:createHash("sha256").update(JSON.stringify([tenantId,accountId,key,hook])).digest("hex")};
}
async function user(auth){
 if(!auth?.uid)throw new HttpsError("unauthenticated","Authentication required");
 const p=(await getFirestore().collection("users").doc(auth.uid).get()).data();
 if(p?.active!==true)throw new HttpsError("permission-denied","Active profile required");
 return p;
}
async function merchant(auth,config){
 const p=await user(auth);
 if(!["owner","admin"].includes(p.role)||typeof p.tenantId!=="string"||!ledger.TENANT.test(p.tenantId))throw new HttpsError("permission-denied","Merchant only");
 if(config&&p.tenantId!==config.tenantId)throw new HttpsError("permission-denied","Sandbox tenant only");
 return p.tenantId;
}
async function stripe(cfg,path,{method="GET",form,idempotency}={}){
 const allowed=method==="GET"?path==="/v1/account"||path==="/v1/payment_method_configurations?limit=30"||/^\/v1\/(checkout\/sessions\/cs_test_[A-Za-z0-9]{8,240}|payment_intents\/pi_[A-Za-z0-9]{8,240}|events\/evt_[A-Za-z0-9]{8,240})$/.test(path):method==="POST"&&(path==="/v1/checkout/sessions"||/^\/v1\/checkout\/sessions\/cs_test_[A-Za-z0-9]{8,240}\/expire$/.test(path));
 if(!allowed)throw Error("STRIPE_ENDPOINT_INVALID");
 const headers={Authorization:"Bearer "+cfg.key};
 if(method==="POST")headers["Content-Type"]="application/x-www-form-urlencoded";
 if(idempotency)headers["Idempotency-Key"]=idempotency;
 const r=await fetch("https://api.stripe.com"+path,{method,headers,body:method==="POST"?form||new URLSearchParams():undefined,redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error("STRIPE_PROVIDER_UNCONFIRMED");
 return r.json();
}
const gateRef=db=>db.collection("stripeWalletSandboxControl").doc("webhook");
async function gate(db,cfg){
 return !!cfg&&(await gateRef(db).get()).data()?.fingerprint===cfg.fingerprint;
}
async function account(cfg,promptpay=false){
 if(!policy.accountVerified(await stripe(cfg,"/v1/account"),cfg.accountId))throw Error("STRIPE_ACCOUNT_MISMATCH");
 if(promptpay&&!policy.promptPayEnabled(await stripe(cfg,"/v1/payment_method_configurations?limit=30")))throw Error("STRIPE_PROMPTPAY_UNAVAILABLE");
}
function map(error){
 if(error instanceof HttpsError)return error;
 const code=String(error?.message||"");
 if(code==="SANDBOX_PERMISSION_REQUIRED")return new HttpsError("permission-denied",code);
 if(code==="SANDBOX_AMOUNT_INVALID"||code==="SANDBOX_REFERENCE_INVALID")return new HttpsError("invalid-argument",code);
 return new HttpsError("failed-precondition","STRIPE_SANDBOX_OPERATION_UNCONFIRMED");
}
async function ownHistory(db,tenantId){
 const root=db.collection("stripeWalletSandboxTenants").doc(tenantId);
 const [w,history]=await Promise.all([root.get(),root.collection("attempts").orderBy("createdAtMs","desc").limit(50).get()]);
 const row=w.data()||{};
 const pending=row.pendingReference?await root.collection("attempts").doc(row.pendingReference).get():null;
 if(row.pendingReference&&!pending.exists)throw Error("SANDBOX_PENDING_MISMATCH");
 return {balanceSatang:row.balanceSatang??0,pendingCheckout:ledger.publicAttempt(pending?.data()),items:history.docs.map(d=>ledger.publicAttempt(d.data()))};
}
exports.getPlatformStripeWalletSandboxGate=onCall(options,async request=>{
 const p=await user(request.auth);if(p.role!=="super_admin")throw new HttpsError("permission-denied","Superadmin only");
 const cfg=settings(),webhookReady=await gate(getFirestore(),cfg);
 return {ok:true,mode:"test",webhookReady,checkoutEnabled:webhookReady&&process.env.PENGUIN_STRIPE_WALLET_SANDBOX_CHECKOUT_ENABLED==="1"};
});
// Read-only history must never bind Stripe credentials (or request remote
// Secret Manager) just to display independent TEST ledger entries. Checkout
// and provider-signing operations still use their own secret-bound handlers.
exports.getPlatformStripeWalletSandboxHistory=onCall(
 {region:"asia-southeast1",timeoutSeconds:25},async request=>{
 const p=await user(request.auth);
 if(p.role!=="super_admin")throw new HttpsError("permission-denied","Superadmin only");
 const tenantId=request.data?.tenantId;
 if(typeof tenantId!=="string"||!ledger.TENANT.test(tenantId))throw new HttpsError("invalid-argument","SANDBOX_TENANT_INVALID");
 const demo=process.env.FUNCTIONS_EMULATOR==="true"||
   Boolean(process.env.FIRESTORE_EMULATOR_HOST)||Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)||
   String(process.env.GCLOUD_PROJECT||process.env.GCP_PROJECT||"").startsWith("demo-");
 const configuredTenant=String(process.env.PENGUIN_STRIPE_WALLET_SANDBOX_TENANT_ID||"");
 const viewAllowed=!demo&&process.env.PENGUIN_STRIPE_WALLET_SANDBOX_ENABLED==="1"&&
   process.env.PENGUIN_STRIPE_WALLET_LIVE_ENABLED!=="1"&&ledger.TENANT.test(configuredTenant)&&
   Boolean(String(process.env.PENGUIN_STRIPE_WALLET_TEST_ACCOUNT_ID||""));
 if(!viewAllowed||configuredTenant!==tenantId)return {
  ok:true,mode:"test",available:false,balanceSatang:null,items:[],
 };
 const history=await ownHistory(getFirestore(),tenantId);
 // Admin history is read-only; no hosted checkout links are exposed.
 return {ok:true,mode:"test",available:true,balanceSatang:history.balanceSatang,items:history.items.map(({checkoutUrl,...item})=>item)};
});
exports.getOwnStripeWalletSandbox=onCall(options,async request=>{
 const cfg=settings(),tenantId=await merchant(request.auth,null);
 if(!cfg||tenantId!==cfg.tenantId)return {ok:true,mode:"test",available:false,balanceSatang:null,pendingCheckout:null,items:[]};
 const db=getFirestore(),tenant=db.collection("tenants").doc(tenantId);
 const [t,l,history,webhookReady]=await Promise.all([tenant.get(),tenant.collection("settings").doc("lalamove").get(),ownHistory(db,tenantId),gate(db,cfg)]);
 const approved=t.data()?.active===true&&l.data()?.accountMode==="fod_central"&&l.data()?.fodCentralApproved===true;
 return {ok:true,mode:"test",available:approved&&webhookReady&&process.env.PENGUIN_STRIPE_WALLET_SANDBOX_CHECKOUT_ENABLED==="1",...history};
});
exports.createStripeWalletSandboxCheckout=onCall(options,async request=>{
 const cfg=settings(),tenantId=await merchant(request.auth,cfg),db=getFirestore();
 if(!cfg||process.env.PENGUIN_STRIPE_WALLET_SANDBOX_CHECKOUT_ENABLED!=="1"||!await gate(db,cfg))throw disabled();
 try{
  const {referenceId,amount}=request.data||{};
  const attempt=await ledger.reserve({db,tenantId,referenceId,amount,accountId:cfg.accountId,uid:request.auth.uid});
  if(attempt.status!=="created")return {ok:true,item:ledger.publicAttempt(attempt)};
  await account(cfg,true);
  const form=new URLSearchParams({mode:"payment","payment_method_types[0]":"promptpay","line_items[0][price_data][currency]":"thb","line_items[0][price_data][unit_amount]":String(attempt.amountSatang),"line_items[0][price_data][product_data][name]":"PENGUIN Lalamove Sandbox test credit","line_items[0][quantity]":"1",success_url:"https://penguin-food.web.app/admin?lalamove_stripe_return="+referenceId,cancel_url:"https://penguin-food.web.app/admin?lalamove_stripe_cancel="+referenceId});
  for(const [name,value] of Object.entries({referenceId,tenantId,purpose:ledger.PURPOSE})){
   form.set("metadata["+name+"]",value);form.set("payment_intent_data[metadata]["+name+"]",value);
  }
  const session=await stripe(cfg,"/v1/checkout/sessions",{method:"POST",form,idempotency:"penguin-wallet-test-"+tenantId+"-"+referenceId});
  const item=await ledger.attachSession({db,attempt,session});
  return {ok:true,item:ledger.publicAttempt(item)};
 }catch(error){throw map(error);}
});
async function reconcile(db,cfg,attempt,session){
 if(!ledger.validSession(attempt,session)||attempt.sessionId&&attempt.sessionId!==session.id)throw Error("SANDBOX_SESSION_MISMATCH");
 if(session.status==="complete"&&session.payment_status==="paid"){
  if(!INTENT.test(session.payment_intent||""))throw Error("SANDBOX_INTENT_INVALID");
  const intent=await stripe(cfg,"/v1/payment_intents/"+session.payment_intent);
  return ledger.settle({db,tenantId:attempt.tenantId,referenceId:attempt.referenceId,accountId:cfg.accountId,session,intent});
 }
 if(session.status==="expired"&&session.payment_status==="unpaid")return ledger.expire({db,tenantId:attempt.tenantId,referenceId:attempt.referenceId,accountId:cfg.accountId,session});
 return attempt;
}
exports.checkStripeWalletSandboxCheckout=onCall(options,async request=>{
 const cfg=settings(),tenantId=await merchant(request.auth,cfg),db=getFirestore();
 if(!cfg)throw disabled();
 try{
  const {referenceId}=request.data||{},r=ledger.refs(db,tenantId,referenceId),attempt=(await r.attempt.get()).data();
  if(!ledger.validAttempt(attempt,tenantId,referenceId,cfg.accountId))throw Error("SANDBOX_REFERENCE_INVALID");
  if(!attempt.sessionId||["verified","expired"].includes(attempt.status))return {ok:true,item:ledger.publicAttempt(attempt)};
  if(!ledger.SESSION.test(attempt.sessionId))throw Error("SANDBOX_SESSION_INVALID");
  await account(cfg);
  const session=await stripe(cfg,"/v1/checkout/sessions/"+attempt.sessionId);
  return {ok:true,item:ledger.publicAttempt(await reconcile(db,cfg,attempt,session))};
 }catch(error){throw map(error);}
});
exports.expireStripeWalletSandboxCheckout=onCall(options,async request=>{
 const cfg=settings(),tenantId=await merchant(request.auth,cfg),db=getFirestore();
 if(!cfg)throw disabled();
 try{
  const {referenceId}=request.data||{},attempt=(await ledger.refs(db,tenantId,referenceId).attempt.get()).data();
  if(!ledger.validAttempt(attempt,tenantId,referenceId,cfg.accountId)||!ledger.SESSION.test(attempt.sessionId||""))throw Error("SANDBOX_REFERENCE_INVALID");
  if(["verified","expired"].includes(attempt.status))return {ok:true,item:ledger.publicAttempt(attempt)};
  await account(cfg);
  let session=await stripe(cfg,"/v1/checkout/sessions/"+attempt.sessionId);
  if(!ledger.validSession(attempt,session))throw Error("SANDBOX_SESSION_MISMATCH");
  if(session.status==="open")session=await stripe(cfg,"/v1/checkout/sessions/"+attempt.sessionId+"/expire",{method:"POST",idempotency:"penguin-wallet-expire-"+referenceId});
  const item=await reconcile(db,cfg,attempt,session);
  if(!["verified","expired"].includes(item.status))throw Error("SANDBOX_EXPIRY_UNCONFIRMED");
  return {ok:true,item:ledger.publicAttempt(item)};
 }catch(error){throw map(error);}
});
exports.stripeWalletSandboxWebhook=onRequest(options,async(req,res)=>{
 const cfg=settings();
 if(!cfg||req.method!=="POST")return res.status(404).send("Not available");
 if(!policy.verifyWebhook(req.rawBody,req.get("stripe-signature"),cfg.hook))return res.status(400).send("Invalid signature");
 try{
  const event=JSON.parse(req.rawBody.toString("utf8"));
  if(event.livemode!==false||!EVENT.test(event.id||"")||event.account&&event.account!==cfg.accountId)return res.status(400).send("Invalid event");
  if(!EVENT_TYPES.has(event.type))return res.status(200).send("Ignored");
  await account(cfg);
  // Verify the event independently with this configured test account before
  // accepting the webhook as evidence of endpoint readiness.
  const trusted=await stripe(cfg,"/v1/events/"+event.id);
  if(trusted.id!==event.id||trusted.type!==event.type||trusted.livemode!==false||trusted.data?.object?.id!==event.data?.object?.id)throw Error("STRIPE_EVENT_MISMATCH");
  const db=getFirestore(),object=trusted.data.object;
  if(!ledger.SESSION.test(object.id||""))throw Error("STRIPE_SESSION_INVALID");
  if(object.metadata?.purpose!==ledger.PURPOSE){
   await gateRef(db).set({fingerprint:cfg.fingerprint,verifiedAtMs:Date.now()});
   return res.status(200).send("Sandbox endpoint verified");
  }
  const {tenantId,referenceId}=object.metadata;
  if(tenantId!==cfg.tenantId||!ledger.UUID.test(referenceId||""))return res.status(400).send("Invalid reference");
  const attempt=(await ledger.refs(db,tenantId,referenceId).attempt.get()).data();
  if(!ledger.validAttempt(attempt,tenantId,referenceId,cfg.accountId))throw Error("SANDBOX_REFERENCE_INVALID");
  const session=await stripe(cfg,"/v1/checkout/sessions/"+object.id);
  await reconcile(db,cfg,attempt,session);
  await gateRef(db).set({fingerprint:cfg.fingerprint,verifiedAtMs:Date.now()});
  return res.status(200).send("Accepted");
 }catch{return res.status(503).send("Verification pending");}
});
