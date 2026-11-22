"use strict";
// Real Stripe TEST checkout against a dedicated UAT project and immutable
// Invoice reservation. The signed webhook posts to a SHADOW TEST ledger only.
// No production-finance or wallet writer is imported here.
const {onCall,onRequest,HttpsError}=require("firebase-functions/v2/https");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const reservation=require("./m7-stripe-test-reservation");
const invoicePolicy=require("./m7-stripe-test-reservation-policy");
const stripe=require("./m7-stripe-test-provider-policy");
const shadow=require("./m7-stripe-test-shadow-policy");
const ledger=require("./m7-stripe-test-shadow-ledger");
const history=require("./m7-stripe-test-shadow-history");
const adapter=require("./m7-stripe-test-provider-adapter");
const opts={region:"asia-southeast1",timeoutSeconds:60,
 secrets:[adapter.stripeSecret,adapter.hookSecret]};
const err=(code,message)=>new HttpsError(code,message);
const canonical=reservation._privateForTests.canonical;
const privateRefs=reservation._privateForTests.refs;
const merchant=reservation._privateForTests.merchant;
function cfg(stage="checkout"){
 const scope=stage==="ingress"?shadow.ingressGate():shadow.gate();
 return scope?adapter.config(process.env,adapter.stripeSecret.value(),
  adapter.hookSecret.value(),stage):null;
}
const requireTest=()=>{const c=cfg();if(!c)throw err("failed-precondition","M7_STRIPE_TEST_CHECKOUT_DISABLED");return c;};
async function loadReserved(db,auth,config,invoiceId){
 // Same canonical server invoice used at the quote transaction. Never allow
 // an arbitrary reservation ID or client amount as input.
 const tenantId=await merchant(db,auth);
 if(tenantId!==config.tenantId)throw err("permission-denied","M7_STRIPE_TEST_TENANT_DENIED");
 const r=privateRefs(db,tenantId,invoiceId);
 const lock=(await r.lock.get()).data();
 if(!lock||lock.invoiceId!==invoiceId||
    !invoicePolicy.UUID.test(lock.attemptId||""))throw err("not-found","M7_STRIPE_TEST_RESERVATION_MISSING");
 return {...r,lockData:lock,attempt:r.tenant.collection("m7StripeTestReservations").doc(lock.attemptId)};
}
async function begin({db,auth,config,invoiceId}){
 const r=await loadReserved(db,auth,config,invoiceId);
 return db.runTransaction(async tx=>{
  const user=db.collection("users").doc(auth.uid);
  const [u,t,inv,lock,attempt,manual,adjust]=await Promise.all([
   tx.get(user),tx.get(r.tenant),tx.get(r.invoice),tx.get(r.lock),
   tx.get(r.attempt),tx.get(r.tenant.collection("hybridBillingPaymentAttempts")
    .where("invoiceId","==",invoiceId).limit(26)),
   tx.get(r.tenant.collection("hybridBillingAdjustments")
    .where("invoiceId","==",invoiceId).limit(1)),
  ]);
  if(u.data()?.active!==true||!["owner","admin"].includes(u.data()?.role)||
     u.data()?.tenantId!==config.tenantId||t.data()?.active!==true)
   throw err("permission-denied","M7_STRIPE_TEST_ROLE_CHANGED");
  const a=attempt.data(),l=lock.data(),invoice=inv.data();
  let q;
  try{
   q=invoicePolicy.quote(invoice,invoiceId,config.tenantId);
   invoicePolicy.blockOriginalAttempts(manual.docs.map(x=>x.data()));
   if(!adjust.empty)throw Error("M7_TEST_PENDING_ADJUSTMENT");
  }catch{throw err("failed-precondition","M7_STRIPE_TEST_INVOICE_CHANGED");}
  if(!a||!l||l.attemptId!==a.attemptId||l.attemptNo!==a.attemptNo||
     a.invoiceId!==invoiceId||a.tenantId!==config.tenantId||
     l.invoiceSignature!==q.invoiceSignature||
     a.invoiceSignature!==q.invoiceSignature||
     l.amountSatang!==q.amountSatang||a.amountSatang!==q.amountSatang||
     l.kind!==q.kind||a.kind!==q.kind||a.mode!=="test")
   throw err("failed-precondition","M7_STRIPE_TEST_QUOTE_INVALID");
  if(a.status==="checkout_ready"&&l.status==="checkout_ready"&&
     a.accountId===config.accountId&&a.providerFingerprint===config.fingerprint&&
     stripe.SESSION.test(a.checkoutSessionId||"")&&
     invoicePolicy.UUID.test(a.attemptId)&&
     /^https:\/\/checkout\.stripe\.com\/(?:c|g)\/pay\//.test(a.checkoutUrl||""))
   return {kind:"ready",attempt:a};
  if(a.status==="verified_test"&&l.status==="verified_test")
   return {kind:"verified",attempt:a};
  if(a.status==="provider_requesting"&&l.status==="provider_requesting"&&
     a.providerFingerprint===config.fingerprint&&a.accountId===config.accountId)
   return {kind:"pending",attempt:a};
  if(a.status!=="reserved"||l.status!=="reserved"||
     a.providerCheckoutCreated!==false||a.checkoutSessionId!==""||
     a.checkoutUrl!==""||a.settled!==false||
     l.providerCheckoutCreated===true||l.checkoutSessionId||l.checkoutUrl||
     l.settled)throw err("failed-precondition","M7_STRIPE_TEST_PRIOR_PROVIDER_STATE_REVIEW");
  const patch={status:"provider_requesting",accountId:config.accountId,
   providerFingerprint:config.fingerprint,providerRequestedAt:FieldValue.serverTimestamp(),
   updatedAt:FieldValue.serverTimestamp()};
  tx.update(r.lock,patch);tx.update(r.attempt,patch);
  return {kind:"create",attempt:{...a,...patch}};
 });
}
async function attach({db,config,attempt,session}){
 if(!shadow.checkoutSession(attempt,session))
  throw Error("M7_STRIPE_TEST_SESSION_UNCONFIRMED");
 const r=privateRefs(db,config.tenantId,attempt.invoiceId,attempt.attemptId);
 return db.runTransaction(async tx=>{
  const [inv,l,a]=await Promise.all([tx.get(r.invoice),tx.get(r.lock),tx.get(r.attempt)]);
  const old=a.data(),lock=l.data(),invoice=inv.data();
  if(!old||!lock||!invoice||
     old.accountId!==config.accountId||old.providerFingerprint!==config.fingerprint||
     old.amountSatang!==attempt.amountSatang||old.invoiceSignature!==invoice.signature||
     lock.attemptId!==attempt.attemptId||lock.invoiceSignature!==invoice.signature)
   throw Error("M7_STRIPE_TEST_SESSION_BINDING_CHANGED");
  if(old.status==="verified_test"&&lock.status==="verified_test")
   return old; // webhook settled before checkout response arrived
  if(old.status==="checkout_ready"&&lock.status==="checkout_ready"&&
     old.checkoutSessionId===session.id&&old.checkoutUrl===session.url)return old;
  if(old.status!=="provider_requesting"||lock.status!=="provider_requesting"||
     old.providerCheckoutCreated!==false||old.checkoutSessionId||old.checkoutUrl)
   throw Error("M7_STRIPE_TEST_SESSION_REQUIRES_REVIEW");
  const expected=invoicePolicy.quote(invoice,attempt.invoiceId,config.tenantId);
  if(expected.amountSatang!==attempt.amountSatang||
     expected.invoiceSignature!==attempt.invoiceSignature)throw Error("M7_STRIPE_TEST_INVOICE_CHANGED");
  const patch={status:"checkout_ready",providerCheckoutCreated:true,
   checkoutSessionId:session.id,checkoutUrl:session.url,
   updatedAt:FieldValue.serverTimestamp()};
  tx.update(r.attempt,patch);tx.update(r.lock,patch);
  return {...old,...patch};
 });
}
async function checkout({db,auth,config,invoiceId,
  verify=adapter.verifyAccount,request=adapter.request}){
 if(!config||!shadow.secrets({project:config.project,tenantId:config.tenantId},
    config.key,config.hook,config.accountId))
  throw err("failed-precondition","M7_STRIPE_TEST_CHECKOUT_DISABLED");
 // The public callable separately enforces the exact project + feature gate
 // via requireTest() before entering this internal transaction adapter.
 // Verify the exact Stripe TEST account before placing an invoice into the
 // provider_requesting state. A failed account preflight leaves the original
 // quote reserved and safely retryable; no provider charge was attempted.
 try{
  adapter.returnOrigin(config); // Misconfigured UAT callback must not reserve a provider request.
  await verify(config,request);
 }catch{throw err("failed-precondition","M7_STRIPE_TEST_ACCOUNT_NOT_READY");}
 let stage=await begin({db,auth,config,invoiceId});
 if(stage.kind==="ready")return {ok:true,providerStatus:"checkout_ready",reused:true,
  item:shadow.publicAttempt(stage.attempt,{includeURL:true}),
  invoicePaid:false,operationalSettlementEnabled:false};
 if(stage.kind==="verified")return {ok:true,providerStatus:"verified_test",reused:true,
  item:shadow.publicAttempt(stage.attempt),invoicePaid:false,operationalSettlementEnabled:false};
 if(stage.kind==="pending")return {ok:true,providerStatus:"provider_requesting",
  requiresReview:true,item:shadow.publicAttempt(stage.attempt),
  invoicePaid:false,operationalSettlementEnabled:false};
 try{
  const form=adapter.checkoutForm(config,stage.attempt);
  const session=await request(config,adapter.PATH.checkout,{
   method:"POST",form,idempotency:"penguin-m7-test-"+stage.attempt.attemptId});
  if(!shadow.checkoutSession(stage.attempt,session))
   throw Error("M7_STRIPE_TEST_PROVIDER_SESSION_MISMATCH");
  const saved=await attach({db,config,attempt:stage.attempt,session});
  return {ok:true,providerStatus:saved.status,reused:false,
   item:shadow.publicAttempt(saved,{includeURL:true}),
   invoicePaid:false,operationalSettlementEnabled:false};
 }catch{
  // The provider request may have succeeded even if the response was lost.
  // Do not retry a new charge; require webhook or reviewed reconciliation.
  throw err("failed-precondition","M7_STRIPE_TEST_CHECKOUT_UNCONFIRMED_REVIEW_REQUIRED");
 }
}
async function webhook({db,config,raw,header,read=adapter.request}){
 const hint=stripe.verifiedEventEnvelope({raw,header,secret:config?.hook});
 if(!config||!hint||hint.tenantId!==config.tenantId)
  throw Error("M7_STRIPE_TEST_WEBHOOK_UNTRUSTED");
 const event=await read(config,"/v1/events/"+hint.eventId);
 if(event.id!==hint.eventId||event.livemode!==false||
    event.type!=="checkout.session.completed"&&event.type!=="checkout.session.async_payment_succeeded"||
    event.data?.object?.id!==hint.sessionId||
    event.account&&event.account!==config.accountId)
  throw Error("M7_STRIPE_TEST_EVENT_RETRIEVAL_MISMATCH");
 const trusted=event.data.object;
 if(trusted.metadata?.tenantId!==hint.tenantId||
    trusted.metadata?.invoiceId!==hint.invoiceId||
    trusted.metadata?.attemptId!==hint.attemptId||
    trusted.metadata?.purpose!==stripe.PURPOSE)throw Error("M7_STRIPE_TEST_EVENT_METADATA_MISMATCH");
 const session=await read(config,"/v1/checkout/sessions/"+hint.sessionId);
 if(session.id!==hint.sessionId||!stripe.INTENT.test(session.payment_intent||""))
  throw Error("M7_STRIPE_TEST_SESSION_UNCONFIRMED");
 const intent=await read(config,"/v1/payment_intents/"+session.payment_intent);
 const r=privateRefs(db,hint.tenantId,hint.invoiceId,hint.attemptId);
 const reservationDoc=await r.attempt.get(),attempt=reservationDoc.data();
 if(!attempt||attempt.attemptId!==hint.attemptId||attempt.tenantId!==hint.tenantId)
  throw Error("M7_STRIPE_TEST_RESERVATION_NOT_FOUND");
 // This writer is TEST-only and never promotes the operational invoice.
 return ledger.settle({db,config,eventId:hint.eventId,reservation:attempt,session,intent});
}
exports.getOwnM7StripeTestCheckoutStatus=onCall(opts,async request=>{
 canonical(request.data||{},[]);
 const config=cfg();
 if(!config)return {ok:true,available:false,mode:"test",checkoutEnabled:false,
  shadowLedgerEnabled:false,operationalSettlementEnabled:false,items:[]};
 const db=getFirestore(),tenantId=await merchant(db,request.auth);
 if(tenantId!==config.tenantId)throw err("permission-denied","M7_STRIPE_TEST_TENANT_DENIED");
 const snapshots=await db.collection("tenants").doc(tenantId)
  .collection("m7StripeTestReservations").orderBy("createdAt","desc").limit(50).get();
 const refs=snapshots.docs.map(x=>db.collection("tenants").doc(tenantId)
  .collection("m7StripeTestSettlements").doc(x.id));
 const proofs=refs.length?await db.getAll(...refs):[];
 const items=snapshots.docs.map((doc,i)=>{
  const row=doc.data(),item=shadow.publicAttempt(row,{includeURL:true});
  if(row.status==="verified_test"){
   const certified=history._privateForTests.view(row,proofs[i]?.data());
   item.status=certified.providerVerified?"provider_test_verified":"needs_review";
   item.providerVerified=certified.providerVerified;
   item.checkoutUrl="";
  }
  return item;
 });
 return {ok:true,available:true,mode:"test",checkoutEnabled:true,
  shadowLedgerEnabled:true,operationalSettlementEnabled:false,items};
});
exports.createOwnM7StripeTestCheckout=onCall(opts,async request=>{
 canonical(request.data||{},["invoiceId"]);
 const config=requireTest();
 if(typeof request.data?.invoiceId!=="string")throw err("invalid-argument","M7_STRIPE_TEST_INVOICE_ID_INVALID");
 try{invoicePolicy.invoiceKey(request.data.invoiceId);}catch{throw err("invalid-argument","M7_STRIPE_TEST_INVOICE_ID_INVALID");}
 return checkout({db:getFirestore(),auth:request.auth,config,invoiceId:request.data.invoiceId});
});
exports.m7StripeTestShadowWebhook=onRequest(opts,async(req,res)=>{
 const config=cfg("ingress");
 if(!config||req.method!=="POST")return res.status(404).send("Not available");
 if(!Buffer.isBuffer(req.rawBody)||!stripe.webhookVerified(req.rawBody,req.get("stripe-signature"),config.hook))
  return res.status(400).send("Invalid signature");
 let payload;
 try{payload=JSON.parse(req.rawBody.toString("utf8"));}catch{return res.status(400).send("Invalid event");}
 if(!["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(payload?.type))
  return res.status(200).send("Ignored");
 try{
  const result=await webhook({db:getFirestore(),config,raw:req.rawBody,
   header:req.get("stripe-signature")});
  return res.status(200).json({received:true,providerVerified:true,
   alreadySettled:result.alreadySettled,operationalInvoicePaid:false});
 }catch{
  // Stripe may retry; immutable event/intent claims make retries idempotent.
  return res.status(503).send("M7 TEST shadow verification requires review");
 }
});
exports._privateForTests={cfg,begin,attach,checkout,webhook};
