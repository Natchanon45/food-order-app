"use strict";
// Real Stripe TEST checkout against a dedicated UAT project and immutable
// Invoice reservation. The signed webhook posts to a SHADOW TEST ledger only.
// No production-finance or wallet writer is imported here.
const {onCall,onRequest,HttpsError}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const reservation=require("./m7-stripe-test-reservation");
const invoicePolicy=require("./m7-stripe-test-reservation-policy");
const stripe=require("./m7-stripe-test-provider-policy");
const shadow=require("./m7-stripe-test-shadow-policy");
const ledger=require("./m7-stripe-test-shadow-ledger");
const lifecycle=require("./m7-stripe-test-lifecycle-policy");
const lifecycleLedger=require("./m7-stripe-test-lifecycle-ledger");
const risk=require("./m7-stripe-test-risk-policy");
const riskLedger=require("./m7-stripe-test-risk-ledger");
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
async function webhookTerminal({db,config,raw,header,read=adapter.request}){
 const hint=lifecycle.verifiedEnvelope({raw,header,secret:config?.hook});
 if(!config||!hint||hint.tenantId!==config.tenantId)
  throw Error("M7_TEST_TERMINAL_EVENT_UNTRUSTED");
 const event=await read(config,"/v1/events/"+hint.eventId);
 if(event?.id!==hint.eventId||event.type!==hint.type||event.livemode!==false||
    event.account&&event.account!==config.accountId||
    event.data?.object?.id!==hint.sessionId||
    event.data.object.livemode!==false||
    event.data.object.metadata?.tenantId!==hint.tenantId||
    event.data.object.metadata?.invoiceId!==hint.invoiceId||
    event.data.object.metadata?.attemptId!==hint.attemptId||
    event.data.object.metadata?.invoiceSignature!==hint.invoiceSignature||
    event.data.object.metadata?.kind!==hint.kind||
    event.data.object.metadata?.purpose!==stripe.PURPOSE)
  throw Error("M7_TEST_TERMINAL_EVENT_MISMATCH");
 const session=await read(config,"/v1/checkout/sessions/"+hint.sessionId);
 if(session?.id!==hint.sessionId)throw Error("M7_TEST_TERMINAL_SESSION_MISMATCH");
 const intent=session.payment_intent
  ?await read(config,"/v1/payment_intents/"+session.payment_intent):null;
 const r=ledger.refs(db,hint.tenantId,hint.invoiceId,hint.attemptId);
 const record=(await r.attempt.get()).data();
 if(!record||record.tenantId!==hint.tenantId||
    record.attemptId!==hint.attemptId||
    record.accountId!==config.accountId||
    record.providerFingerprint!==config.fingerprint)
  throw Error("M7_TEST_TERMINAL_RESERVATION_MISMATCH");
 if(!lifecycle.terminalUnpaid(hint.type,record,session,intent))
  throw Error("M7_TEST_TERMINAL_PROVIDER_PROOF_INVALID");
 return lifecycleLedger.record({db,config,eventId:hint.eventId,
  eventType:hint.type,attempt:record,session,intent});
}
async function webhookRisk({db,config,raw,header,read=adapter.request}){
 const hint=risk.envelope({raw,header,secret:config?.hook});
 if(!config||!hint)throw Error("M7_TEST_RISK_EVENT_UNTRUSTED");
 const event=await read(config,"/v1/events/"+hint.eventId);
 if(event?.id!==hint.eventId||event.type!==hint.eventType||
    event.livemode!==false||event.account&&event.account!==config.accountId||
    event.data?.object?.id!==hint.objectId||
    event.data.object.object!==(hint.eventType==="charge.refunded"?"charge":"dispute")||
    event.data.object.livemode!==false)
  throw Error("M7_TEST_RISK_EVENT_MISMATCH");
 const dispute=hint.eventType==="charge.dispute.created"
  ?await read(config,"/v1/disputes/"+hint.objectId):null;
 const chargeId=dispute?.charge||hint.objectId;
 if(!risk.CHARGE.test(chargeId||""))throw Error("M7_TEST_RISK_CHARGE_INVALID");
 const charge=await read(config,"/v1/charges/"+chargeId);
 const evidence=risk.evidence({hint,event,charge,dispute});
 if(!evidence)throw Error("M7_TEST_RISK_PROVIDER_EVIDENCE_INVALID");
 const claim=(await db.collection("m7StripeTestIntentClaims")
  .doc(evidence.intentId).get()).data();
 if(!claim||claim.tenantId!==config.tenantId||
    !stripe.SESSION.test(claim.sessionId||""))
  throw Error("M7_TEST_RISK_INTENT_NOT_IN_M7_LEDGER");
 const [session,intent]=await Promise.all([
  read(config,"/v1/checkout/sessions/"+claim.sessionId),
  read(config,"/v1/payment_intents/"+evidence.intentId),
 ]);
 return riskLedger.record({db,config,riskEvidence:evidence,session,intent});
}
async function inspect({db,auth,config,invoiceId,read=adapter.request}){
 if(!config)throw err("failed-precondition","M7_TEST_INSPECTION_DISABLED");
 const r=await loadReserved(db,auth,config,invoiceId);
 const record=(await r.attempt.get()).data();
 if(!record||record.tenantId!==config.tenantId||
    record.invoiceId!==invoiceId||record.accountId!==config.accountId||
    record.providerFingerprint!==config.fingerprint)
  throw err("failed-precondition","M7_TEST_INSPECTION_BOUNDARY_MISMATCH");
 if(record.status==="provider_requesting"&&!record.checkoutSessionId)
  return lifecycle.publicInspection(record,"provider_request_uncertain");
 if(["expired_test","payment_failed_test"].includes(record.status)){
  const audit=stripe.EVENT.test(record.lifecycleLastEventId||"")
    ?(await r.tenant.collection("m7StripeTestLifecycleAudits")
       .doc(record.lifecycleLastEventId).get()).data():null;
  const state=history._privateForTests.view(record,null,audit).status;
  return lifecycle.publicInspection(record,
   state==="expired_test"?"provider_expired_unpaid":
   state==="payment_failed_test"?"provider_failed_unpaid":"needs_review");
 }
 if(record.status==="verified_test"){
  const settled=(await r.settlement.get()).data();
  const riskProof=stripe.EVENT.test(record.riskEventId||"")
    ?(await r.tenant.collection("m7StripeTestRiskAudits").doc(record.riskEventId).get()).data():null;
  const v=history._privateForTests.view(record,settled,null,riskProof);
  return lifecycle.publicInspection(record,
    ["provider_test_refund_review","provider_test_dispute_review"].includes(v.status)
      ?"provider_risk_review":v.providerVerified?"already_recorded_test":"needs_review");
 }
 if(record.status!=="checkout_ready"||
    !stripe.SESSION.test(record.checkoutSessionId||""))
  return lifecycle.publicInspection(record,"needs_review");
 // GET only. No mutation/settlement on browser polling. A paid return page
 // is not a payment proof, even if provider independently reports success.
 let state="needs_review";
 try{
  const session=await read(config,"/v1/checkout/sessions/"+record.checkoutSessionId);
  const intent=session.payment_intent&&stripe.INTENT.test(session.payment_intent)
   ?await read(config,"/v1/payment_intents/"+session.payment_intent):null;
  state=lifecycle.inspect(record,session,intent);
 }catch{
  state="needs_review";
 }
 return lifecycle.publicInspection(record,state);
}
exports.getOwnM7StripeTestCheckoutStatus=onCall(opts,async request=>{
 canonical(request.data||{},[]);
 const config=cfg("ingress");
 if(!config)return {ok:true,available:false,mode:"test",checkoutEnabled:false,
  shadowLedgerEnabled:false,operationalSettlementEnabled:false,items:[]};
 const checkoutEnabled=!!cfg();
 const db=getFirestore(),tenantId=await merchant(db,request.auth);
 if(tenantId!==config.tenantId)throw err("permission-denied","M7_STRIPE_TEST_TENANT_DENIED");
 const snapshots=await db.collection("tenants").doc(tenantId)
  .collection("m7StripeTestReservations").orderBy("createdAt","desc").limit(50).get();
 const refs=snapshots.docs.map(x=>db.collection("tenants").doc(tenantId)
  .collection("m7StripeTestSettlements").doc(x.id));
 const proofs=refs.length?await db.getAll(...refs):[];
 const auditRefs=snapshots.docs.map(doc=>{
  const row=doc.data();
  return ["expired_test","payment_failed_test"].includes(row.status)&&
    stripe.EVENT.test(row.lifecycleLastEventId||"")
    ?db.collection("tenants").doc(tenantId)
      .collection("m7StripeTestLifecycleAudits").doc(row.lifecycleLastEventId):null;
 });
 const auditDocuments=auditRefs.filter(Boolean);
 const auditFound=auditDocuments.length?await db.getAll(...auditDocuments):[];
 let auditIndex=0;
 const riskRefs=snapshots.docs.map(doc=>{
  const row=doc.data();
  return ["refund_review","dispute_review"].includes(row.riskStatus)&&
    stripe.EVENT.test(row.riskEventId||"")
    ?db.collection("tenants").doc(tenantId)
       .collection("m7StripeTestRiskAudits").doc(row.riskEventId):null;
 });
 const riskDocs=riskRefs.filter(Boolean);
 const riskFound=riskDocs.length?await db.getAll(...riskDocs):[];
 let riskIndex=0;
 const closureRefs=snapshots.docs.map(doc=>{
  const a=doc.data();
  return a.status==="expired"&&a.closureAuditId===a.attemptId&&
    invoicePolicy.UUID.test(a.attemptId||"")
    ?db.collection("tenants").doc(tenantId)
      .collection("m7StripeTestClosureAudits").doc(a.attemptId):null;
 });
 const closureDocs=closureRefs.filter(Boolean);
 const closureFound=closureDocs.length?await db.getAll(...closureDocs):[];
 let closureIndex=0;
 const items=snapshots.docs.map((doc,i)=>{
  const row=doc.data(),item=shadow.publicAttempt(row,{includeURL:true});
  let audit=null;
  if(auditRefs[i])audit=auditFound[auditIndex++]?.data();
  const riskProof=riskRefs[i]?riskFound[riskIndex++]?.data():null;
  const closureProof=closureRefs[i]?closureFound[closureIndex++]?.data():null;
  const certified=history._privateForTests.view(row,proofs[i]?.data(),
    audit,riskProof,closureProof);
  if(["verified_test","expired_test","payment_failed_test","expired"].includes(row.status)){
   item.status=certified.status;
   item.providerVerified=certified.providerVerified;
   item.checkoutUrl="";
  }
  return item;
 });
 return {ok:true,available:true,mode:"test",checkoutEnabled,
  shadowLedgerEnabled:true,operationalSettlementEnabled:false,items};
});
exports.inspectOwnM7StripeTestCheckout=onCall(opts,async request=>{
 canonical(request.data||{},["invoiceId"]);
 if(typeof request.data?.invoiceId!=="string")
  throw err("invalid-argument","M7_TEST_INSPECTION_INVOICE_INVALID");
 try{invoicePolicy.invoiceKey(request.data.invoiceId);}
 catch{throw err("invalid-argument","M7_TEST_INSPECTION_INVOICE_INVALID");}
 const config=cfg("ingress");
 if(!config)throw err("failed-precondition","M7_TEST_INSPECTION_DISABLED");
 return inspect({db:getFirestore(),auth:request.auth,config,invoiceId:request.data.invoiceId});
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
 const paid=["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(payload?.type);
 const terminal=lifecycle.EVENTS.has(payload?.type);
 const adverse=risk.EVENTS.has(payload?.type);
 if(!paid&&!terminal&&!adverse)return res.status(200).send("Ignored");
 try{
  const params={db:getFirestore(),config,raw:req.rawBody,
   header:req.get("stripe-signature")};
  const result=paid?await webhook(params):
   terminal?await webhookTerminal(params):await webhookRisk(params);
  return res.status(200).json({received:true,providerVerified:paid,
   providerVerifiedUnpaid:terminal,requiresRiskReview:adverse,
   alreadySettled:paid?result.alreadySettled:false,
   alreadyAudited:terminal?result.reused:adverse?result.alreadyAudited:false,
   operationalInvoicePaid:false,canRetry:false});
 }catch{
  // Stripe may retry; immutable event/intent claims make retries idempotent.
  return res.status(503).send("M7 TEST shadow verification requires review");
 }
});
exports._privateForTests={cfg,begin,attach,checkout,webhook,
 webhookTerminal,webhookRisk,inspect};
