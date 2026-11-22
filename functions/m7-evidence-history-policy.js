"use strict";
// A read-only Firestore evidence projection, NOT Stripe M7 checkout history.
// The source marks verified only after an immutable Stripe settlement matching
// the invoice and bank-paid cash. Firebase does not have that record yet.
const ID=/^[A-Za-z0-9_-]{3,160}$/;
const STATUSES=new Set(["all","pending","recorded","rejected","needs_review"]);
const KINDS=new Set(["all","platform","delivery_daily"]);
const SOURCE="firebase_m7_finance_evidence_not_stripe_settlements";
const MAX=200;
const safeMoney=n=>{
 if(typeof n!=="number"||!Number.isFinite(n)||n<=0)return null;
 const cents=Math.round(n*100);
 return cents<=100000000000&&Number.isSafeInteger(cents)&&Math.abs(n*100-cents)<0.00001?cents:null;
};
function utcIso(value){
 const date=typeof value?.toDate==="function"?value.toDate():
  value instanceof Date?value:null;
 if(!date||!Number.isFinite(date.getTime()))return "";
 return date.toISOString();
}
function bangkokDay(iso){
 if(!iso)return "";
 const time=Date.parse(iso);if(!Number.isFinite(time))return "";
 const d=new Date(time+7*60*60*1000);
 return d.toISOString().slice(0,10);
}
function dayValid(s){
 if(s==="")return true;
 if(typeof s!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s))return false;
 const day=new Date(s+"T00:00:00.000Z");
 return Number.isFinite(day.getTime())&&day.toISOString().slice(0,10)===s;
}
function filters(data={}){
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("M7_EVIDENCE_FILTER_INVALID");
 const status=data.status??"all",kind=data.kind??"all",start=data.start??"",end=data.end??"";
 if(!STATUSES.has(status)||!KINDS.has(kind)||!dayValid(start)||!dayValid(end)||start&&end&&start>end)
  throw Error("M7_EVIDENCE_FILTER_INVALID");
 return {status,kind,start,end};
}
function normalizeHybrid({tenantId,tenantName,attemptId,attempt,invoice,review}){
 const id=String(attemptId||"");
 if(!ID.test(id))return null;
 const amountCents=safeMoney(attempt.amount);
 const submittedAt=utcIso(attempt.submittedAt||attempt.createdAt);
 const updatedAt=utcIso(attempt.updatedAt)||submittedAt;
 const invoiceId=String(attempt.invoiceId||"").slice(0,130);
 const own=attempt.id===id&&attempt.tenantId===tenantId&&
  !!submittedAt&&(invoice?.tenantId==null||invoice.tenantId===tenantId)&&
  invoice?.version==="hybrid-invoice-v1"&&invoice?.id===invoiceId&&
  /^[a-f0-9]{64}$/.test(String(invoice.signature||""))&&
  attempt.invoiceSignature===invoice.signature&&
  amountCents!==null&&safeMoney(invoice.amount)===amountCents;
 const independentlyReviewed=(review?.bankVerified===true&&attempt.verification?.bankVerified===true)||
  (review?.verifiedExternally===true&&typeof review.note==="string"&&review.note.trim().length>=20);
 const paid=own&&independentlyReviewed&&attempt.status==="paid"&&invoice.status==="paid"&&
  invoice.paidAttemptId===id&&review?.tenantId===tenantId&&
  review.invoiceId===invoiceId&&review.attemptId===id&&review.resultStatus==="paid"&&
  review.action==="approve"&&!!utcIso(review.reviewedAt)&&
  review.reviewerId===attempt.reviewedBy&&
  typeof review.reviewerId==="string"&&review.reviewerId.length>=3;
 const rejected=own&&attempt.status==="rejected"&&review?.tenantId===tenantId&&
  review.attemptId===id&&review.resultStatus==="rejected"&&
  review.action==="reject"&&typeof review.note==="string"&&
  review.note.trim().length>=6&&!!utcIso(review.reviewedAt);
 const pending=own&&attempt.status==="pending_review"&&invoice.status==="pending_review"&&
  invoice.pendingAttemptId===id;
 const status=paid?"recorded":rejected?"rejected":pending?"pending":"needs_review";
 const invoiceKind=invoiceId.includes(":monthly:")?"platform":
   invoiceId.includes(":delivery:")?"delivery_daily":"platform";
 return {paymentId:id,tenantId,tenantName,invoiceKey:invoiceId,invoiceKind,
  sourceKind:"hybrid_invoice_proof",status,amountCents,recordedCents:paid?amountCents:0,
  verifiedStripeCents:0,stripeSettled:false,bankSettlementVerified:false,
  createdAt:submittedAt,updatedAt,evidenceSource:"hybrid_firestore_attempt_and_review"};
}
function normalizeShare({tenantId,tenantName,paymentId,payment}){
 const id=String(paymentId||"");
 if(!ID.test(id))return null;
 const amountCents=safeMoney(payment.platformAmountDue??payment.revenueShareAmount);
 const submitted=utcIso(payment.createdAt||payment.submittedAt);
 const updated=utcIso(payment.updatedAt)||submitted;
 const status=amountCents===null||!submitted?"needs_review":
  payment.status==="pending"?"pending":
  payment.status==="rejected"?"rejected":
  payment.status==="approved"&&typeof payment.reviewedBy==="string"&&
   payment.reviewedBy.length>=3?"recorded":"needs_review";
 return {paymentId:id,tenantId,tenantName,invoiceKey:String(payment.periodStart||"").slice(0,10)+
  (payment.periodEnd&&payment.periodEnd!==payment.periodStart?" – "+String(payment.periodEnd||"").slice(0,10):""),
  invoiceKind:"delivery_daily",sourceKind:"legacy_delivery_revenue_share",status,
  amountCents,recordedCents:status==="recorded"?amountCents:0,
  verifiedStripeCents:0,stripeSettled:false,bankSettlementVerified:false,
  createdAt:submitted,updatedAt:updated,evidenceSource:"revenue_share_firestore_record"};
}
function matches(row,f){
 if(f.status!=="all"&&row.status!==f.status)return false;
 if(f.kind!=="all"&&row.invoiceKind!==f.kind)return false;
 const day=bangkokDay(row.createdAt);
 if(f.start&&day<f.start)return false;
 if(f.end&&day>f.end)return false;
 return true;
}
function project(rows,f,{truncated=false}={}){
 const filtered=rows.filter(row=>row&&matches(row,f));
 filtered.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.tenantId.localeCompare(b.tenantId)||
  a.paymentId.localeCompare(b.paymentId));
 return {source:SOURCE,currency:"THB",settlementSourceAvailable:false,
  items:filtered.slice(0,MAX),hasMore:truncated||filtered.length>MAX};
}
module.exports={SOURCE,ID,MAX,filters,utcIso,bangkokDay,dayValid,safeMoney,normalizeHybrid,normalizeShare,matches,project};
