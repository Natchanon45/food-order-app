"use strict";
// Reconciliation is READ-ONLY until an explicit Superadmin bind action.
// No new provider POST, no financial settlement, no automatic retry.
const invoice=require("./m7-stripe-test-reservation-policy");
const stripe=require("./m7-stripe-test-provider-policy");
const shadow=require("./m7-stripe-test-shadow-policy");
const MAX_PAGES=5;
const PAGE_LIMIT=100;
const RETAIN_MS=48*60*60*1000; // do not conclude absence after old/unbounded scans
const START_SKEW_SECONDS=120;
const FUTURE_SECONDS=3600;
function requestedMs(row){
 const stamp=row?.providerRequestedAt;
 const ms=typeof stamp?.toMillis==="function"?stamp.toMillis():
  typeof stamp==="number"?stamp:null;
 return Number.isSafeInteger(ms)&&ms>1700000000000&&ms<Date.now()+60000?ms:0;
}
function validConfig(cfg,row,{allowExpired=false}={}){
 const stateOk=allowExpired?
  row?.status==="expired_test"&&row.providerCheckoutCreated===true&&
  stripe.SESSION.test(row.checkoutSessionId||"")&&row.checkoutUrl===""&&
  row.settled===false&&row.providerClosureVerified===false:
  row?.status==="provider_requesting"&&row.providerCheckoutCreated===false&&
  row.checkoutSessionId===""&&row.checkoutUrl===""&&row.settled===false;
 return !!cfg&&invoice.TENANT.test(cfg.tenantId||"")&&
  stripe.ACCOUNT.test(cfg.accountId||"")&&
  !!row&&row.tenantId===cfg.tenantId&&row.accountId===cfg.accountId&&
  row.providerFingerprint===cfg.fingerprint&&
  stateOk&&row.mode==="test"&&
  invoice.UUID.test(row.attemptId||"")&&
  invoice.HEX.test(row.invoiceSignature||"")&&
  Number.isSafeInteger(row.amountSatang)&&
  row.amountSatang>=1000&&row.amountSatang<=99999999&&
  ["monthly","delivery_daily"].includes(row.kind);
}
function windowFor(row,now=Date.now()){
 const ms=requestedMs(row);
 if(!ms||!Number.isSafeInteger(now)||now<ms||now-ms>RETAIN_MS)return null;
 return {gte:Math.floor(ms/1000)-START_SKEW_SECONDS,
  lte:Math.min(Math.floor(now/1000),Math.floor(ms/1000)+FUTURE_SECONDS)};
}
function listPath(window,cursor=""){
 if(!window||!Number.isSafeInteger(window.gte)||!Number.isSafeInteger(window.lte)||
    window.gte>window.lte||cursor&&!stripe.SESSION.test(cursor))
  throw Error("M7_TEST_RECOVERY_LIST_ARGUMENTS_INVALID");
 const p=new URLSearchParams({limit:String(PAGE_LIMIT),
  "created[gte]":String(window.gte),"created[lte]":String(window.lte)});
 if(cursor)p.set("starting_after",cursor);
 return "/v1/checkout/sessions?"+p.toString();
}
function matchReference(row,session){
 return session?.client_reference_id===row.attemptId||
  session?.metadata?.attemptId===row.attemptId;
}
function validSession(row,session){
 if(session?.object!=="checkout.session"||
    !stripe.SESSION.test(session?.id||"")||
    !Number.isSafeInteger(session.created)||session.created<0||
    session.livemode!==false||session.mode!=="payment"||
    session.currency!=="thb"||session.amount_total!==row.amountSatang||
    session.client_reference_id!==row.attemptId||
    !stripe.metadata(session.metadata,row)||
    !Array.isArray(session.payment_method_types)||
    session.payment_method_types.length!==1||
    session.payment_method_types[0]!=="promptpay"||
    !["open","complete","expired"].includes(session.status)||
    !["paid","unpaid","no_payment_required"].includes(session.payment_status))
   return false;
 return true;
}
function status(session){
 if(session.status==="open"&&session.payment_status==="unpaid"&&
    !session.payment_intent&&shadow.safeCheckoutURL(session.url))
  return "open_unpaid";
 if(session.status==="complete"&&session.payment_status==="paid")
  return "provider_paid_wait_webhook";
 if(session.status==="expired"&&session.payment_status==="unpaid")
  return "provider_expired_unpaid";
 if(session.status==="complete"&&session.payment_status==="unpaid")
  return "provider_failed_unpaid";
 return "needs_review";
}
function publicReport(row,code,sessionId="",scanned=0){
 const valid=new Set(["single_open","already_paid_wait_webhook",
  "already_expired","already_failed","not_found_uncertain",
  "ambiguous","mismatch","scan_incomplete","requires_review"]);
 if(!valid.has(code))throw Error("M7_TEST_RECOVERY_REPORT_INVALID");
 const showId=code==="single_open"&&stripe.SESSION.test(sessionId||"")?sessionId:"";
 return {ok:true,mode:"test",tenantId:row.tenantId,invoiceId:row.invoiceId,
  attemptId:row.attemptId,amountSatang:row.amountSatang,currency:"THB",
  status:code,sessionId:showId,matchedSingleOpen:code==="single_open",
  scannedPages:scanned,canCreateNewCheckout:false,canSettleInvoice:false,
  bankPaid:false,serviceCreditChanged:false,checkoutCreatedByThisReview:false};
}
async function scan({config,row,read,now=Date.now(),allowExpired=false}){
 if(!validConfig(config,row,{allowExpired})||typeof read!=="function")
  return publicReport(row,"requires_review");
 const window=windowFor(row,now);
 if(!window)return publicReport(row,"scan_incomplete");
 let cursor="",pages=0,matched=[],suspect=false,complete=false;
 const seen=new Set();
 for(let i=0;i<MAX_PAGES;i++){
  const payload=await read(config,listPath(window,cursor));
  pages++;
  if(payload?.object!=="list"||typeof payload.has_more!=="boolean"||
      !Array.isArray(payload.data)||payload.data.length>PAGE_LIMIT||
      payload.data.some(x=>!stripe.SESSION.test(x?.id||"")))
   return publicReport(row,"scan_incomplete","",pages);
  for(const session of payload.data){
   if(seen.has(session.id))return publicReport(row,"scan_incomplete","",pages);
   seen.add(session.id);
   if(!matchReference(row,session))continue;
   if(!validSession(row,session)||session.created<window.gte||
       session.created>window.lte){suspect=true;continue;}
   matched.push(session);
   if(matched.length>1)return publicReport(row,"ambiguous","",pages);
  }
  if(!payload.has_more){complete=true;break;}
  if(!payload.data.length)return publicReport(row,"scan_incomplete","",pages);
  cursor=payload.data[payload.data.length-1].id;
 }
 if(!complete)return publicReport(row,"scan_incomplete","",pages);
 if(suspect)return publicReport(row,"mismatch","",pages);
 if(matched.length===0)return publicReport(row,"not_found_uncertain","",pages);
 const match=matched[0],state=status(match);
 // A closure review must scan all pages and find exactly the *already
 // persisted* Stripe Session ID, not merely a similar attempt reference.
 if(allowExpired&&match.id!==row.checkoutSessionId)
  return publicReport(row,"mismatch","",pages);
 const reportStatus={
  open_unpaid:"single_open",provider_paid_wait_webhook:"already_paid_wait_webhook",
  provider_expired_unpaid:"already_expired",provider_failed_unpaid:"already_failed",
 }[state]||"requires_review";
 return publicReport(row,reportStatus,match.id,pages);
}
module.exports={MAX_PAGES,PAGE_LIMIT,RETAIN_MS,requestedMs,validConfig,
 windowFor,listPath,matchReference,validSession,status,publicReport,scan};
