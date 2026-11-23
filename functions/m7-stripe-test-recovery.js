"use strict";
// Explicit Superadmin-only recovery for a previously sent, ambiguous TEST
// Checkout POST. Scan/read first; bind only an independently re-read SINGLE
// open unpaid session, transactionally. No Stripe POST, new attempt or Paid.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {randomUUID}=require("node:crypto");
const {validInvoiceId}=require("./hybrid-billing-payment-policy");
const invoice=require("./m7-stripe-test-reservation-policy");
const stripe=require("./m7-stripe-test-provider-policy");
const shadow=require("./m7-stripe-test-shadow-policy");
const ledger=require("./m7-stripe-test-shadow-ledger");
const adapter=require("./m7-stripe-test-provider-adapter");
const policy=require("./m7-stripe-test-recovery-policy");
const {actor}=require("./m7-stripe-test-shadow-history")._privateForTests;
const options={region:"asia-southeast1",timeoutSeconds:80,
 secrets:[adapter.stripeSecret,adapter.hookSecret]};
const error=(code,message)=>new HttpsError(code,message);
function config(env=process.env){
 const scope=shadow.ingressGate(env);
 return scope?adapter.config(env,adapter.stripeSecret.value(),adapter.hookSecret.value(),"ingress"):null;
}
function input(data,withSession=false){
 const keys=withSession?["tenantId","invoiceId","attemptId","sessionId"]:
  ["tenantId","invoiceId","attemptId"];
 if(!data||typeof data!=="object"||Array.isArray(data)||
  Object.keys(data).length!==keys.length||
  Object.keys(data).some(x=>!keys.includes(x))||
  !invoice.TENANT.test(data.tenantId||"")||
  !invoice.UUID.test(data.attemptId||"")||
  withSession&&!stripe.SESSION.test(data.sessionId||""))
  throw error("invalid-argument","M7_TEST_RECOVERY_INPUT_INVALID");
 try{validInvoiceId(data.invoiceId);}catch{
  throw error("invalid-argument","M7_TEST_RECOVERY_INVOICE_INVALID");
 }
 return data;
}
async function readActor(db,auth,config,tenantId){
 const user=await actor(db,auth);
 if(user.role!=="super_admin")
  throw error("permission-denied","M7_TEST_SUPERADMIN_REQUIRED");
 if(!config||tenantId!==config.tenantId)
  throw error("failed-precondition","M7_TEST_RECOVERY_NOT_AVAILABLE");
 return user;
}
async function trusted(db,config,data){
 const r=ledger.refs(db,data.tenantId,data.invoiceId,data.attemptId);
 const [tenant,attempt,lock,invoiceRow,recovery,settlement]=await Promise.all([
  r.tenant.get(),r.attempt.get(),r.lock.get(),r.invoice.get(),
  r.tenant.collection("m7StripeTestRecoveryAudits").doc(data.attemptId).get(),
  r.settlement.get(),
 ]);
 const row=attempt.data(),l=lock.data();
 if(tenant.data()?.active!==true||!policy.validConfig(config,row)||
    row.invoiceId!==data.invoiceId||row.attemptId!==data.attemptId||
    l?.attemptId!==row.attemptId||l.status!=="provider_requesting"||
    l.accountId!==config.accountId||l.providerFingerprint!==config.fingerprint||
    l.providerCheckoutCreated!==false||l.checkoutSessionId!==""||
    l.checkoutUrl!==""||l.settled!==false||
    l.invoiceSignature!==row.invoiceSignature||
    l.amountSatang!==row.amountSatang||l.kind!==row.kind||
    recovery.exists||settlement.exists)throw error("failed-precondition",
      "M7_TEST_RECOVERY_IMMUTABLE_CONFLICT");
 let quote;
 try{quote=invoice.quote(invoiceRow.data(),data.invoiceId,config.tenantId);}catch{
  throw error("failed-precondition","M7_TEST_RECOVERY_INVOICE_CHANGED");
 }
 if(quote.amountSatang!==row.amountSatang||
    quote.invoiceSignature!==row.invoiceSignature||
    quote.kind!==row.kind)throw error("failed-precondition","M7_TEST_RECOVERY_QUOTE_CHANGED");
 return {r,row};
}
async function review({db,auth,config,data,read=adapter.request,
 verify=adapter.verifyAccount,now=Date.now()}){
 input(data,false);
 await readActor(db,auth,config,data.tenantId);
 const {row}=await trusted(db,config,data);
 let report;
 try{
  await verify(config,read);
  report=await policy.scan({config,row,read,now});
 }catch{
  report=policy.publicReport(row,"scan_incomplete");
 }
 return {...report,readOnly:true,needsSuperadminConfirmation:report.matchedSingleOpen};
}
async function bind({db,auth,config,data,read=adapter.request,
 verify=adapter.verifyAccount,now=Date.now()}){
 input(data,true);
 await readActor(db,auth,config,data.tenantId);
 const {r,row}=await trusted(db,config,data);
 let scanned,session;
 try{
  await verify(config,read);
  scanned=await policy.scan({config,row,read,now});
  if(scanned.status!=="single_open"||scanned.sessionId!==data.sessionId)
    throw Error("NOT_EXACT_SINGLE_OPEN");
  session=await read(config,"/v1/checkout/sessions/"+data.sessionId);
  const window=policy.windowFor(row,now);
  if(!window||!policy.validSession(row,session)||
    session.created<window.gte||session.created>window.lte||
    policy.status(session)!=="open_unpaid"||
    !shadow.checkoutSession(row,session))
   throw Error("SESSION_NOT_OPEN_UNPAID");
 }catch{
  throw error("failed-precondition","M7_TEST_RECOVERY_PROVIDER_UNCONFIRMED");
 }
 const reviewId=randomUUID(),audit=r.tenant
  .collection("m7StripeTestRecoveryAudits").doc(data.attemptId);
 return db.runTransaction(async tx=>{
  const adminRef=db.collection("users").doc(auth.uid);
  const [operator,tenant,inv,l,a,paid,previous,manual,adjustments]=await Promise.all([
   tx.get(adminRef),tx.get(r.tenant),tx.get(r.invoice),tx.get(r.lock),
   tx.get(r.attempt),tx.get(r.settlement),tx.get(audit),
   tx.get(r.manual),tx.get(r.adjustments),
  ]);
  if(operator.data()?.active!==true||operator.data()?.role!=="super_admin")
   throw error("permission-denied","M7_TEST_RECOVERY_OPERATOR_CHANGED");
  const old=a.data(),lock=l.data(),invoiceRow=inv.data();
  if(tenant.data()?.active!==true||previous.exists||paid.exists||
    !policy.validConfig(config,old)||
    old.attemptId!==data.attemptId||
    old.invoiceId!==data.invoiceId||
    old.invoiceSignature!==row.invoiceSignature||
    old.amountSatang!==row.amountSatang||
    old.providerRequestedAt?.toMillis?.()!==row.providerRequestedAt?.toMillis?.()||
    lock?.attemptId!==old.attemptId||
    lock.status!=="provider_requesting"||
    lock.accountId!==config.accountId||
    lock.providerFingerprint!==config.fingerprint||
    lock.providerCheckoutCreated!==false||
    lock.checkoutSessionId!==""||lock.checkoutUrl!==""||
    lock.settled!==false||
    lock.invoiceSignature!==old.invoiceSignature||
    lock.amountSatang!==old.amountSatang||
    !manual.empty||!adjustments.empty)
   throw error("failed-precondition","M7_TEST_RECOVERY_SNAPSHOT_CHANGED");
  let quote;
  try{quote=invoice.quote(invoiceRow,data.invoiceId,config.tenantId);}catch{
   throw error("failed-precondition","M7_TEST_RECOVERY_INVOICE_CHANGED");
  }
  if(quote.amountSatang!==old.amountSatang||
     quote.invoiceSignature!==old.invoiceSignature||
     quote.kind!==old.kind)
   throw error("failed-precondition","M7_TEST_RECOVERY_QUOTE_CHANGED");
  // Recovery of the same already-created provider TEST Session, not a POST.
  const patch={status:"checkout_ready",providerCheckoutCreated:true,
   checkoutSessionId:session.id,checkoutUrl:session.url,
   recoveryStatus:"reviewed_existing_session",
   recoveryReviewId:reviewId,updatedAt:FieldValue.serverTimestamp()};
  tx.create(audit,{tenantId:old.tenantId,invoiceId:old.invoiceId,
   attemptId:old.attemptId,reviewId,sessionId:session.id,
   invoiceSignature:old.invoiceSignature,amountSatang:old.amountSatang,
   accountId:config.accountId,providerFingerprint:config.fingerprint,
   operatorUid:auth.uid,scanPages:scanned.scannedPages,
   status:"reviewed_existing_session",providerSessionWasOpenUnpaid:true,
   createdStripeSession:false,operationalInvoicePaid:false,
   serviceCreditChanged:false,mode:"test_recovery",
   reviewedAt:FieldValue.serverTimestamp()});
  tx.update(r.attempt,patch);
  tx.update(r.lock,patch);
  return {ok:true,mode:"test",status:"checkout_ready",
   invoiceId:old.invoiceId,attemptId:old.attemptId,
   existingSessionReattached:true,createdStripeSession:false,
   canCreateNewCheckout:false,operationalInvoicePaid:false,
   serviceCreditChanged:false};
 });
}
exports.reviewPlatformM7StripeTestRecovery=onCall(options,async request=>{
 const config= configForCall();
 return review({db:getFirestore(),auth:request.auth,config,data:request.data});
});
exports.bindPlatformM7StripeTestRecovery=onCall(options,async request=>{
 const config= configForCall();
 return bind({db:getFirestore(),auth:request.auth,config,data:request.data});
});
function configForCall(){
 const configured=config();
 if(!configured)throw error("failed-precondition","M7_TEST_RECOVERY_DISABLED");
 return configured;
}
exports._privateForTests={config,input,readActor,trusted,review,bind};
