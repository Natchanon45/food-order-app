"use strict";
// Advisory simulation of Source Go merchantPaymentAccess + M7 hold approval.
// This module may NEVER authorize sales, lock orders, suspend or reinstate
// shops: original Source HMAC approval and other hold channels aren't trusted.
const source=require("./m7-source-migration-contract");
const {createHash}=require("node:crypto");
const hash=(type,value)=>{
 if(!/^[a-f0-9]{64}$/.test(value||""))
  throw Error("M7_UAT_HOLD_HASH_INVALID");
 return createHash("sha256").update("penguin-m7-uat-ledger-v1:"+type+":"+value).digest("hex");
};
const {day}=require("./m7-operational-credit-policy");
function bangkokDay(utc){
 if(!/^20\d\d-\d\d-\d\dT/.test(utc||""))
  throw Error("M7_UAT_HOLD_TIME_INVALID");
 const date=new Date(utc);
 if(!Number.isFinite(date.getTime()))throw Error("M7_UAT_HOLD_TIME_INVALID");
 const formatter=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Bangkok",
  year:"numeric",month:"2-digit",day:"2-digit"});
 const value=formatter.format(date);
 day(value);
 return value;
}
function assess(manifest,{separateLegacyOrSecurityHold=false}={}){
 const structural=source.inspect(manifest);
 if(structural.structuralIssuesDetected!==0||
    typeof separateLegacyOrSecurityHold!=="boolean")
  throw Error("M7_UAT_HOLD_SOURCE_INVALID");
 const dayOfCheck=bangkokDay(manifest.source.capturedAtUtc);
 const invoices=manifest.tables.merchant_platform_invoice_journal;
 const approvals=new Map(manifest.tables.merchant_m7_hold_policy_approvals
  .map(x=>[x.invoice_key,x]));
 const holds=new Map(manifest.tables.merchant_payment_obligation_holds
  .map(x=>[x.invoice_key,x]));
 const adjustments=manifest.tables.merchant_platform_invoice_adjustment_events;
 const entries=[];
 let unapprovedCount=0,overdueCount=0,pendingCount=0,reviewCount=0,resolvedCount=0;
 for(const inv of invoices){
  const approval=approvals.get(inv.invoice_key);
  const hold=holds.get(inv.invoice_key);
  const residual=inv.gross_cents-inv.applied_service_credit_cents-
   inv.verified_bank_paid_cents;
  let state="source_hold_approval_missing";
  if(!approval||!hold)unapprovedCount++;
  else if(hold.state==="disputed")state="disputed_hold_requires_review";
  else if(["pending_review","pending_manual_review"].includes(inv.state)){
   pendingCount++;
   state="pending_slip_never_pays_hold";
  }else if(["paid","settled_credit"].includes(inv.state)&&residual===0&&
    hold.state==="resolved"){
   state="resolved_candidate_not_approved";
   resolvedCount++;
  }else if(["waived","voided"].includes(inv.state)){
   const witness=adjustments.some(e=>e.invoice_key===inv.invoice_key&&
     ["credit_reclassified","fee_waived","void_authorized"].includes(e.event_kind)&&
     e.prior_snapshot_sha256===inv.immutable_invoice_sha256&&
     e.proposed_snapshot_sha256===inv.immutable_invoice_sha256);
   state=witness&&hold.state==="waived"?
    "waiver_candidate_not_approved":"waiver_source_audit_required";
  }else if(residual>0&&hold.state==="open"){
   state=approval.cutoff_bangkok_day<dayOfCheck?
    "overdue_candidate_no_enforcement":
    approval.cutoff_bangkok_day===dayOfCheck?
     "cutoff_hour_not_certified":"future_deadline_candidate";
   if(state==="overdue_candidate_no_enforcement")overdueCount++;
  }else state="hold_invoice_inconsistency";
  if(["waiver_source_audit_required","hold_invoice_inconsistency",
    "disputed_hold_requires_review"].includes(state))reviewCount++;
  entries.push({
   id:hash("hold",inv.invoice_key),
   state,
   kind:inv.kind,
   invoiceState:inv.state,
   reportedHoldState:hold?.state||"none",
   dueBangkokDay:inv.due_bangkok_day,
   cutoffBangkokDay:approval?.cutoff_bangkok_day||null,
   residualSourceReportedCents:residual,
   syntacticApprovalPresent:!!approval,
   signedApprovalIndependentlyAuthenticated:false,
   tenantAccessReleaseAllowed:false,
   tenantOrderGateModified:false,
  });
 }
 return Object.freeze({
  mode:"m7_uat_hold_candidate_analysis_v1",
  tenantId:manifest.tenantId,asOfBangkokDay:dayOfCheck,
  checkedInvoices:entries.length,
  unsignedOrMissingApprovalCount:unapprovedCount,
  overdueCandidateCount:overdueCount,
  pendingSlipCount:pendingCount,
  sourceHoldReviewCount:reviewCount,
  resolvedCandidateCount:resolvedCount,
  separateLegacyOrSecurityHold,
  originalSourceHmacVerified:false,
  cutoffTimeCertified:false,
  tenantCanSell:null,tenantAccessReleaseAllowed:false,
  tenantOrderGateModified:false,
  entries,
 });
}
module.exports={bangkokDay,assess};
