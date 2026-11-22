"use strict";
// Merchant-facing CURRENT Firebase Hybrid invoice status, not Source M7 SQL.
// Proof is derived from server-owned invoice, attempt and immutable reviewer
// event; an unverified local 'paid' flag is NEVER reported as verified cash.
const {satang,validInvoiceId,validId}=require("./hybrid-billing-payment-policy");
const {LEDGER_VERSION}=require("./hybrid-billing-ledger");
const SHA=/^[a-f0-9]{64}$/;
const TENANT=/^[A-Za-z0-9_-]{3,160}$/;
const ROLES=new Set(["owner","admin"]);
function validateId(id){try{validInvoiceId(id);return true;}catch{return false;}}
function timestamp(v){
 const x=typeof v?.toDate==="function"?v.toDate():v instanceof Date?v:null;
 return x&&Number.isFinite(x.getTime())?x.toISOString():"";
}
function safeDay(value){
 if(typeof value!=="string"||!/^20\d\d-\d\d-\d\d$/.test(value))return "";
 const d=new Date(value+"T00:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?value:"";
}
function validAmount(value){
 try{return satang(value);}catch{return null;}
}
function validAttemptId(value){
 try{validId(value,"ATTEMPT_ID");return true;}catch{return false;}
}
function evidenceMatch({tenantId,invoice,attemptId,attempt}){
 return validAttemptId(attemptId)&&attempt?.id===attemptId&&
  attempt.tenantId===tenantId&&attempt.invoiceId===invoice.id&&
  attempt.invoiceSignature===invoice.signature&&
  validAmount(attempt.amount)===validAmount(invoice.amount)&&
  typeof attempt.submittedBy==="string"&&
  TENANT.test(attempt.submittedBy)&&
  !!timestamp(attempt.submittedAt);
}
function reviewMatch({tenantId,invoice,attemptId,attempt,review,status}){
 if(!review||review.tenantId!==tenantId||review.invoiceId!==invoice.id||
    review.attemptId!==attemptId||
    review.reviewerId!==attempt.reviewedBy||
    !TENANT.test(review.reviewerId||"")||
    !timestamp(review.reviewedAt)||!timestamp(attempt.reviewedAt))
  return false;
 if(status==="paid"){
  return review.action==="approve"&&review.resultStatus==="paid"&&
   attempt.status==="paid"&&
   ((review.bankVerified===true&&attempt.verification?.bankVerified===true)||
    (review.verifiedExternally===true&&
     typeof review.note==="string"&&review.note.trim().length>=20));
 }
 return review.action==="reject"&&review.resultStatus==="rejected"&&
  attempt.status==="rejected"&&
  typeof review.note==="string"&&review.note.trim().length>=6;
}
function present({tenantId,invoiceId,invoice,attempt=null,review=null}){
 if(!TENANT.test(tenantId||"")||!validateId(invoiceId))
  throw Error("HYBRID_INVOICE_BAD_SELECTOR");
 const raw=invoice||{};
 const amountCents=validAmount(raw.amount);
 const expectedKind=invoiceId.endsWith(":monthly:fixed")?"fixed_monthly":
  invoiceId.endsWith(":delivery:trigger")?"delivery_threshold":"delivery_daily";
 if(raw.id!==invoiceId||raw.tenantId!=null&&raw.tenantId!==tenantId||
    raw.version!==LEDGER_VERSION||!SHA.test(raw.signature||"")||
    raw.kind!==expectedKind||!safeDay(raw.date)||amountCents===null)
  throw Error("HYBRID_INVOICE_CORRUPT_IMMUTABLE_RECORD");
 const status=raw.status;
 let paymentStatus="needs_review",reviewEvidence="unconfirmed";
 const selectedId=status==="pending_review"?raw.pendingAttemptId:
   status==="paid"?raw.paidAttemptId:
   status==="rejected"?raw.latestAttemptId:null;
 if(status==="issued"){
  if(!raw.pendingAttemptId&&!raw.paidAttemptId&&!raw.latestAttemptId){
   paymentStatus="not_submitted";reviewEvidence="none";
  }
 }else if(["pending_review","paid","rejected"].includes(status)){
  if(evidenceMatch({tenantId,invoice:raw,attemptId:selectedId,attempt})&&
      raw.latestAttemptId===selectedId){
   if(status==="pending_review"&&attempt.status==="pending_review"&&
     !raw.paidAttemptId&&!review){
    paymentStatus="pending_review";reviewEvidence="submitted_not_approved";
   }else if(status==="paid"&&!raw.pendingAttemptId&&
     reviewMatch({tenantId,invoice:raw,attemptId:selectedId,attempt,review,status})){
    paymentStatus="recorded_paid";reviewEvidence="server_review_recorded";
   }else if(status==="rejected"&&!raw.pendingAttemptId&&!raw.paidAttemptId&&
     reviewMatch({tenantId,invoice:raw,attemptId:selectedId,attempt,review,status})){
    paymentStatus="rejected";reviewEvidence="server_review_rejected";
   }
  }
 }
 const displayStatus=paymentStatus==="not_submitted"?"issued":
    paymentStatus==="recorded_paid"?"paid":
    paymentStatus==="pending_review"?"pending_review":
    paymentStatus==="rejected"?"rejected":"needs_review";
 // A matching Firebase reviewer event is not original M7 bank proof.
 return Object.freeze({
  id:invoiceId,date:raw.date,kind:raw.kind,amount:amountCents/100,
  currency:"THB",paymentStatus,displayStatus,
  reviewEvidence,issuerSource:"firebase_hybrid_issued_ledger",
  invoiceAmountCents:amountCents,
  sourceM7BankReconciled:false,independentBankStatementVerified:false,
  operationalCashSettled:false,
  canSubmitPayment:false,canReleaseShop:false,
  canPrepareLocalFile:paymentStatus==="not_submitted"||paymentStatus==="rejected",
  // No internal source signature, reviewer UID, proof refs, slip paths or bank text.
 });
}
function validateRequest(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).some(k=>!["cursor","limit"].includes(k)))
  throw Error("HYBRID_INVOICE_INVALID_REQUEST");
 const limit=data.limit??20;
 if(!Number.isSafeInteger(limit)||limit<1||limit>30)
  throw Error("HYBRID_INVOICE_INVALID_LIMIT");
 const cursor=data.cursor??null;
 if(cursor!==null&&!validateId(cursor))
  throw Error("HYBRID_INVOICE_INVALID_CURSOR");
 return {limit,cursor};
}
module.exports={TENANT,ROLES,timestamp,safeDay,evidenceMatch,reviewMatch,
 present,validateRequest};
