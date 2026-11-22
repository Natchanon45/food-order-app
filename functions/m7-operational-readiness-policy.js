"use strict";
// Read-only source-to-Firestore gap map, not a banking or credit registry.
// A 'paid' Firestore status cannot authenticate Go's real bank-cash journal.
const {satang,validInvoiceId}=require("./hybrid-billing-payment-policy");
const credit=require("./m7-operational-credit-policy");
const M7_BANK_SOURCE="SOURCE_M7_BANK_JOURNAL_NOT_MIGRATED";
const M7_CREDIT_SOURCE="SOURCE_M7_CREDIT_ACCOUNT_EVENTS_NOT_MIGRATED";
const M7_HOLD_SOURCE="SOURCE_M7_SIGNED_HOLD_APPROVAL_NOT_MIGRATED";
const M7_INVOICE_SOURCE="SOURCE_M7_IMMUTABLE_INVOICE_JOURNAL_NOT_MIGRATED";
const M7_SALES_SOURCE="SOURCE_M7_CLOSED_SALES_THRESHOLD_NOT_CERTIFIED";
const M7_GAPS=Object.freeze([M7_INVOICE_SOURCE,M7_BANK_SOURCE,
 M7_CREDIT_SOURCE,M7_HOLD_SOURCE,M7_SALES_SOURCE]);
const EXTRA=Object.freeze({
 INVOICE_INVALID:"FIREBASE_INVOICE_IMMUTABLE_FIELDS_INVALID",
 PAYMENT_ATTEMPTS_PRESENT:"FIREBASE_PAYMENT_REVIEW_NOT_BANK_STATEMENT",
 PAID_WITHOUT_MATCHING_REVIEW:"FIREBASE_PAID_WITHOUT_REVIEW_EVIDENCE",
 MULTIPLE_PAYMENT_ATTEMPTS:"FIREBASE_PAYMENT_ATTEMPT_HISTORY_REQUIRES_REVIEW",
 PENDING_PAYMENT:"FIREBASE_PENDING_PAYMENT_UNSETTLED",
 ADJUSTMENTS_PRESENT:"FIREBASE_ADJUSTMENT_CROSSCHECK_REQUIRED",
 TEST_SHADOW_PRESENT:"STRIPE_TEST_SHADOW_NOT_OPERATIONAL_BANK_CASH",
 HISTORY_TRUNCATED:"FIRESTORE_FINANCE_READ_INCOMPLETE",
 SEPARATE_HOLD:"SEPARATE_TENANT_HOLD_BLOCKS_AUTOMATIC_RELEASE",
 LEGACY_SUSPENSION:"LEGACY_SUSPENSION_REQUIRES_INDEPENDENT_REVIEW",
 CREDIT_FIELDS_PRESENT:"FIREBASE_CREDIT_FIELDS_WITHOUT_SOURCE_JOURNAL",
});
const ALL=new Set([...M7_GAPS,...Object.values(EXTRA)]);
function sourceKind(invoice){
 if(invoice?.kind==="fixed_monthly"&&invoice.id?.endsWith(":monthly:fixed"))
  return "monthly";
 if(["delivery_threshold","delivery_daily"].includes(invoice?.kind)&&
    invoice.id?.includes(":delivery:"))return "delivery_daily";
 return "unknown";
}
function invoiceCents(invoice,tenantId,invoiceId){
 try{
  validInvoiceId(invoiceId);
  if(!invoice||invoice.id!==invoiceId||
     invoice.tenantId!==tenantId||invoice.version!=="hybrid-invoice-v1"||
     !/^[a-f0-9]{64}$/.test(invoice.signature||"")||
     sourceKind(invoice)==="unknown"||
     !["issued","rejected","pending_review","paid"].includes(invoice.status))
   return null;
  const amount=satang(invoice.amount);
  return amount<=credit.MAX?amount:null;
 }catch{return null;}
}
function hasForeignSuspension(tenant){
 return tenant?.revenueShareSuspended===true||
  tenant?.active===false&&tenant?.hybridBillingSuspended!==true||
  ["expired","suspended"].includes(String(tenant?.subscriptionStatus||"").toLowerCase())||
  !!String(tenant?.suspensionReason||"").trim()&&
   !["hybrid_billing","hybrid_unpaid"].includes(
     String(tenant?.suspensionReason||"").trim().toLowerCase());
}
function assessInvoice({tenantId,tenant,invoiceId,invoice,
 attempts=[],reviews={},adjustments=[],shadows=[],partialHistory=false}={}){
 credit.tenant(tenantId);
 if(!Array.isArray(attempts)||!Array.isArray(adjustments)||
    !Array.isArray(shadows)||attempts.length>200||adjustments.length>200||
    shadows.length>200||typeof reviews!=="object"||reviews===null)
  throw Error("M7_FINANCE_READ_INPUT_INVALID");
 const blockers=new Set(M7_GAPS);
 let grossCents=invoiceCents(invoice,tenantId,invoiceId);
 if(grossCents===null)blockers.add(EXTRA.INVOICE_INVALID);
 const kind=grossCents===null?"unknown":sourceKind(invoice);
 const selected=attempts.filter(a=>a?.invoiceId===invoiceId);
 const adj=adjustments.filter(a=>a?.invoiceId===invoiceId);
 const shadowRows=shadows.filter(a=>a?.invoiceId===invoiceId);
 let recordedCents=0;
 if(selected.length)blockers.add(EXTRA.PAYMENT_ATTEMPTS_PRESENT);
 if(selected.length>1)blockers.add(EXTRA.MULTIPLE_PAYMENT_ATTEMPTS);
 if(selected.some(a=>a?.status==="pending_review"||
   a?.status==="pending_manual_review"))
  blockers.add(EXTRA.PENDING_PAYMENT);
 if(adj.length)blockers.add(EXTRA.ADJUSTMENTS_PRESENT);
 if(shadowRows.length)blockers.add(EXTRA.TEST_SHADOW_PRESENT);
 if(partialHistory)blockers.add(EXTRA.HISTORY_TRUNCATED);
 if(hasForeignSuspension(tenant))blockers.add(EXTRA.SEPARATE_HOLD);
 if(tenant?.hybridBillingSuspended===true)blockers.add(EXTRA.LEGACY_SUSPENSION);
 if(invoice&&creditFields(invoice))blockers.add(EXTRA.CREDIT_FIELDS_PRESENT);
 const paid=selected.filter(a=>a?.status==="paid");
 if(invoice?.status==="paid"||paid.length){
  const a=paid.length===1?paid[0]:null;
  const id=String(a?.id||"");
  const review=Object.hasOwn(reviews,id)?reviews[id]:null;
  const valid=!!a&&!!review&&grossCents!==null&&selected.length===1&&
    a.tenantId===tenantId&&a.invoiceId===invoiceId&&
    a.invoiceSignature===invoice.signature&&invoice.status==="paid"&&
    invoice.paidAttemptId===id&&review.tenantId===tenantId&&
    review.invoiceId===invoiceId&&review.attemptId===id&&
    review.resultStatus==="paid"&&review.action==="approve"&&
    review.reviewerId===a.reviewedBy&&
    typeof review.reviewerId==="string"&&review.reviewerId.length>=3&&
    (review.bankVerified===true&&a.verification?.bankVerified===true||
     review.verifiedExternally===true&&typeof review.note==="string"&&
     review.note.trim().length>=20)&&
    (a.amount===invoice.amount);
  if(valid)recordedCents=grossCents;
  else blockers.add(EXTRA.PAID_WITHOUT_MATCHING_REVIEW);
 }
 // Even a valid Firestore Superadmin review is NOT independently verified
 // SOURCE bank cash and never counts toward original Go credit/hold authority.
 return Object.freeze({
  invoiceId,kind,firebaseStatus:["issued","rejected","pending_review","paid"].includes(invoice?.status)
    ?invoice.status:"needs_review",
  grossCentsFromFirebase:grossCents,
  firebaseRecordedOnlyCents:recordedCents,
  sourceBankVerifiedCents:null,sourceServiceCreditAppliedCents:null,
  remainingBankCashDueCents:null,sourceCreditBalanceCents:null,
  sourceOperationalPaid:false,independentBankCashConfirmed:false,
  ledgerCoverageVerified:false,creditPostingAllowed:false,
  invoicePaidWriterAuthorized:false,tenantAccessReleaseAllowed:false,
  stripeTestShadowCount:shadowRows.length,blockerCodes:[...blockers].sort(),
 });
}
function creditFields(record){
 const keys=["appliedServiceCreditCents","appliedServiceCredit",
 "appliedCreditCents","creditApplied","serviceCreditApplied",
 "verifiedBankPaidCents","verifiedBankPaidAmount"];
 return keys.some(k=>{
  const val=record[k];
  return val!==undefined&&val!==null&&val!==false&&val!==0&&val!=="0"&&val!=="";
 });
}
function report({tenantId,tenant,documents=[],attempts=[],
 reviews={},adjustments=[],shadows=[],partialHistory=false}={}){
 credit.tenant(tenantId);
 if(!tenant||tenant.active!==true&&tenant.active!==false||
  !Array.isArray(documents)||documents.length>30)
  throw Error("M7_FINANCE_READ_TENANT_INVALID");
 const ids=new Set();
 const invoices=documents.map(row=>{
  if(!row||typeof row.id!=="string"||ids.has(row.id))
   throw Error("M7_FINANCE_READ_DUPLICATE_INVOICE");
  ids.add(row.id);
  return assessInvoice({tenantId,tenant,invoiceId:row.id,invoice:row,
   attempts,reviews,adjustments,shadows,partialHistory});
 });
 return Object.freeze({
  ok:true,mode:"m7_source_finance_gap_read_only",tenantId,
  currency:"THB",periodAndSourceJournalCoverageVerified:false,
  bankStatementSourceAuthenticated:false,sourceCreditLedgerMigrated:false,
  sourceSignedHoldApprovalsMigrated:false,
  canPostOperationalInvoicePaid:false,canApplyServiceCredit:false,
  canReleaseTenant:false,realCashReceivedNotProven:true,
  stripeTestShadowIsBankCash:false,writesPerformed:false,
  scanBounded:true,partialHistory,invoiceCount:invoices.length,invoices,
 });
}
module.exports={M7_GAPS,EXTRA,ALL,sourceKind,invoiceCents,creditFields,
 hasForeignSuspension,assessInvoice,report};
