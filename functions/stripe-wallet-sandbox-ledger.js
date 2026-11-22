"use strict";
// All collections here are intentionally separate from the operational wallet.
// Integer satang only; no application checkout can spend this balance.
const { verifiedSandboxPayment, safeCheckoutURL } = require("./stripe-wallet-sandbox-policy");
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const SESSION=/^cs_test_[A-Za-z0-9]{8,240}$/;
const TENANT=/^[A-Za-z0-9_-]{1,128}$/;
const PURPOSE="penguin_lalamove_wallet_sandbox";
const RETRY_MS=20*60*60*1000;
const fail=code=>{throw Error(code);};
function refs(db,tenantId,referenceId){
 if(typeof tenantId!=="string"||typeof referenceId!=="string"||!TENANT.test(tenantId)||!UUID.test(referenceId))fail("SANDBOX_REFERENCE_INVALID");
 const root=db.collection("stripeWalletSandboxTenants").doc(tenantId);
 return {root,attempt:root.collection("attempts").doc(referenceId),ledger:root.collection("ledger").doc(referenceId)};
}
function amountSatang(value){
 if(typeof value!=="string"||!/^\d{1,6}(\.\d{1,2})?$/.test(value))fail("SANDBOX_AMOUNT_INVALID");
 const [whole,decimal=""]=value.split(".");
 const n=Number(whole)*100+Number(decimal.padEnd(2,"0"));
 if(!Number.isSafeInteger(n)||n<1000||n>99999999)fail("SANDBOX_AMOUNT_INVALID");
 return n;
}
function validSession(attempt,session){
 return SESSION.test(session?.id||"")&&session.livemode===false&&session.mode==="payment"&&session.currency==="thb"&&session.amount_total===attempt.amountSatang&&session.metadata?.referenceId===attempt.referenceId&&session.metadata?.tenantId===attempt.tenantId&&session.metadata?.purpose===PURPOSE&&Array.isArray(session.payment_method_types)&&session.payment_method_types.length===1&&session.payment_method_types[0]==="promptpay";
}
function validAttempt(row,tenantId,referenceId,accountId){
 return row?.tenantId===tenantId&&row.referenceId===referenceId&&row.accountId===accountId&&row.mode==="test"&&Number.isSafeInteger(row.amountSatang)&&row.amountSatang>=1000&&row.amountSatang<=99999999;
}
function publicAttempt(row){
 if(!row)return null;
 return {referenceId:row.referenceId,amountSatang:row.amountSatang,status:row.status,createdAt:new Date(row.createdAtMs).toISOString(),checkoutUrl:row.status==="checkout_ready"?safeCheckoutURL(row.checkoutUrl):""};
}
async function reserve({db,tenantId,referenceId,amount,accountId,uid,now=Date.now()}){
 const value=amountSatang(amount),r=refs(db,tenantId,referenceId);
 return db.runTransaction(async tx=>{
  // Recheck active role and approved central mode in same reservation transaction.
  const [user,tenant,settings,wallet,attempt]=await Promise.all([
   tx.get(db.collection("users").doc(uid)),tx.get(db.collection("tenants").doc(tenantId)),
   tx.get(db.collection("tenants").doc(tenantId).collection("settings").doc("lalamove")),tx.get(r.root),tx.get(r.attempt)]);
  const u=user.data(),s=settings.data();
  if(u?.active!==true||u.tenantId!==tenantId||!["owner","admin"].includes(u.role)||!tenant.exists||tenant.data()?.active!==true||s?.accountMode!=="fod_central"||s.fodCentralApproved!==true)fail("SANDBOX_PERMISSION_REQUIRED");
  const w=wallet.data()||{},old=attempt.data();
  if(attempt.exists){
   if(!validAttempt(old,tenantId,referenceId,accountId)||old.amountSatang!==value)fail("SANDBOX_REFERENCE_CONFLICT");
   if(old.status==="created"&&(w.pendingReference!==referenceId||now-old.createdAtMs>RETRY_MS||now<old.createdAtMs))fail("SANDBOX_REVIEW_REQUIRED");
   return old;
  }
  if(w.pendingReference)fail("SANDBOX_PENDING_EXISTS");
  const next={tenantId,referenceId,accountId,amountSatang:value,mode:"test",status:"created",createdAtMs:now,createdBy:uid};
  tx.create(r.attempt,next);tx.set(r.root,{mode:"test",pendingReference:referenceId},{merge:true});
  return next;
 });
}
async function attachSession({db,attempt,session}){
 if(!validSession(attempt,session))fail("SANDBOX_SESSION_MISMATCH");
 const url=safeCheckoutURL(session.url);
 if(session.status!=="open"||!url)fail("SANDBOX_SESSION_NOT_OPEN");
 const r=refs(db,attempt.tenantId,attempt.referenceId);
 return db.runTransaction(async tx=>{
  const [w,a]=await Promise.all([tx.get(r.root),tx.get(r.attempt)]),old=a.data();
  if(!validAttempt(old,attempt.tenantId,attempt.referenceId,attempt.accountId)||old.amountSatang!==attempt.amountSatang)fail("SANDBOX_REFERENCE_CONFLICT");
  if(old.sessionId&&old.sessionId!==session.id)fail("SANDBOX_SESSION_CONFLICT");
  if(old.status!=="created")return old;
  if(w.data()?.pendingReference!==attempt.referenceId)fail("SANDBOX_PENDING_MISMATCH");
  const patch={sessionId:session.id,checkoutUrl:url,status:"checkout_ready"};
  tx.update(r.attempt,patch);return {...old,...patch};
 });
}
async function settle({db,tenantId,referenceId,accountId,session,intent,now=Date.now()}){
 const r=refs(db,tenantId,referenceId);
 return db.runTransaction(async tx=>{
  const [w,a,l]=await Promise.all([tx.get(r.root),tx.get(r.attempt),tx.get(r.ledger)]);
  const old=a.data(),wallet=w.data()||{};
  if(!validAttempt(old,tenantId,referenceId,accountId)||!validSession(old,session)||old.sessionId&&old.sessionId!==session.id)fail("SANDBOX_SESSION_MISMATCH");
  // A signed callback may arrive after provider creation but before session attachment.
  const bound={...old,sessionId:session.id};
  if(!verifiedSandboxPayment({attempt:bound,session,intent,expectedAccount:accountId}))fail("SANDBOX_PROOF_INVALID");
  const claim=db.collection("stripeWalletSandboxIntentClaims").doc(intent.id);
  const c=await tx.get(claim);
  if(old.status==="verified"){
   if(!l.exists||l.data()?.intentId!==intent.id||l.data()?.amountSatang!==old.amountSatang||c.data()?.tenantId!==tenantId||c.data()?.referenceId!==referenceId)fail("SANDBOX_LEDGER_CONFLICT");
   return old;
  }
  if(!["created","checkout_ready"].includes(old.status)||wallet.pendingReference!==referenceId||l.exists||c.exists)fail("SANDBOX_LEDGER_CONFLICT");
  const before=wallet.balanceSatang??0,after=before+old.amountSatang;
  if(!Number.isSafeInteger(before)||before<0||!Number.isSafeInteger(after))fail("SANDBOX_BALANCE_INVALID");
  tx.create(claim,{tenantId,referenceId,mode:"test"});
  tx.create(r.ledger,{tenantId,referenceId,intentId:intent.id,sessionId:session.id,amountSatang:old.amountSatang,balanceBeforeSatang:before,balanceAfterSatang:after,mode:"test",createdAtMs:now});
  tx.set(r.root,{mode:"test",balanceSatang:after,pendingReference:null},{merge:true});
  const patch={sessionId:session.id,intentId:intent.id,status:"verified",checkoutUrl:"",verifiedAtMs:now};
  tx.update(r.attempt,patch);return {...old,...patch};
 });
}
async function expire({db,tenantId,referenceId,accountId,session}){
 const r=refs(db,tenantId,referenceId);
 return db.runTransaction(async tx=>{
  const [w,a]=await Promise.all([tx.get(r.root),tx.get(r.attempt)]),old=a.data();
  if(!validAttempt(old,tenantId,referenceId,accountId)||!validSession(old,session)||old.sessionId&&old.sessionId!==session.id||session.status!=="expired"||session.payment_status!=="unpaid")fail("SANDBOX_EXPIRY_UNCONFIRMED");
  if(old.status==="expired")return old;
  if(!["created","checkout_ready"].includes(old.status)||w.data()?.pendingReference!==referenceId)fail("SANDBOX_EXPIRY_CONFLICT");
  const patch={sessionId:session.id,status:"expired",checkoutUrl:""};
  tx.update(r.attempt,patch);tx.set(r.root,{pendingReference:null},{merge:true});return {...old,...patch};
 });
}
module.exports={refs,amountSatang,validSession,validAttempt,publicAttempt,reserve,attachSession,settle,expire,UUID,TENANT,SESSION,PURPOSE};
