"use strict";
// P1.2e: independent source-aligned access evidence TRIAGE ONLY.
// Firestore tenant flags and SHA digests are never a signed Go M7 approval,
// real bank statement, or permission to grant/restore a storefront.
const {createHash}=require("node:crypto");
const TENANT=/^[A-Za-z0-9_-]{4,128}$/;
const REASONS=Object.freeze({
 TENANT_INACTIVE:"TENANT_INACTIVE",
 MANUAL_SECURITY_SUSPENSION:"MANUAL_SECURITY_SUSPENSION",
 LEGACY_MEMBERSHIP_SUSPENDED:"LEGACY_MEMBERSHIP_SUSPENDED",
 LEGACY_MEMBERSHIP_EXPIRED:"LEGACY_MEMBERSHIP_EXPIRED",
 LEGACY_DELIVERY_SHARE_HOLD:"LEGACY_DELIVERY_SHARE_HOLD",
 HYBRID_BILLING_HOLD:"HYBRID_BILLING_HOLD",
 M7_RECORDED_HOLD_UNVERIFIED:"M7_RECORDED_HOLD_UNVERIFIED",
 M7_FINANCE_REVIEW_REQUIRED:"M7_FINANCE_REVIEW_REQUIRED",
 TEST_OVERRIDE_METADATA_ONLY:"TEST_OVERRIDE_METADATA_ONLY",
 TEST_OVERRIDE_MALFORMED:"TEST_OVERRIDE_MALFORMED",
 FINANCIAL_STATE_UNKNOWN:"FINANCIAL_STATE_UNKNOWN",
 TENANT_SLUG_INDEX_MISSING:"TENANT_SLUG_INDEX_MISSING",
 TENANT_SLUG_INDEX_CONFLICT:"TENANT_SLUG_INDEX_CONFLICT",
 MEMBERSHIP_EXPIRY_MISSING:"MEMBERSHIP_EXPIRY_MISSING",
 MEMBERSHIP_GRACE_INVALID:"MEMBERSHIP_GRACE_INVALID",
 MEMBERSHIP_STATUS_UNKNOWN:"MEMBERSHIP_STATUS_UNKNOWN",
 ORIGINAL_ACTIVATION_UNVERIFIED:"ORIGINAL_ACTIVATION_UNVERIFIED",
});
const CODE_SET=new Set(Object.values(REASONS));
const SOURCE_GAPS=Object.freeze([
 "GO_SIGNED_HOLD_APPROVAL_NOT_AVAILABLE",
 "SOURCE_IMMUTABLE_INVOICE_JOURNAL_NOT_AVAILABLE",
 "INDEPENDENT_BANK_STATEMENT_NOT_AVAILABLE",
 "SOURCE_CREDIT_LEDGER_NOT_AVAILABLE",
 "SOURCE_MANUAL_SECURITY_HOLD_LEDGER_NOT_AVAILABLE",
]);
const CRITICAL=new Set([
 REASONS.TENANT_INACTIVE,REASONS.MANUAL_SECURITY_SUSPENSION,
 REASONS.LEGACY_MEMBERSHIP_SUSPENDED,REASONS.LEGACY_MEMBERSHIP_EXPIRED,
 REASONS.LEGACY_DELIVERY_SHARE_HOLD,REASONS.HYBRID_BILLING_HOLD,
 REASONS.M7_RECORDED_HOLD_UNVERIFIED,
]);
const UNSAFE=new Set([
 REASONS.FINANCIAL_STATE_UNKNOWN,REASONS.TEST_OVERRIDE_MALFORMED,
 REASONS.TENANT_SLUG_INDEX_MISSING,REASONS.TENANT_SLUG_INDEX_CONFLICT,
 REASONS.MEMBERSHIP_GRACE_INVALID,REASONS.MEMBERSHIP_STATUS_UNKNOWN,
 REASONS.MEMBERSHIP_EXPIRY_MISSING,
 REASONS.ORIGINAL_ACTIVATION_UNVERIFIED,
 REASONS.M7_FINANCE_REVIEW_REQUIRED,
]);
function fail(code){const err=new Error(code);err.code=code;throw err;}
function asMillis(value){
 if(value==null||value==="")return null;
 let d;
 if(value instanceof Date)d=value;
 else if(typeof value?.toDate==="function")d=value.toDate();
 else if(typeof value==="string")d=new Date(value);
 else if(typeof value==="object" && Number.isFinite(value.seconds))
   d=new Date(value.seconds*1000);
 else return null;
 return Number.isFinite(d?.getTime?.())?d.getTime():null;
}
function iso(value){const n=asMillis(value);return n===null?null:new Date(n).toISOString();}
function sanitizedState(input){
 if(!input||typeof input!=="object"||Array.isArray(input))
  fail("TENANT_ACCESS_EVIDENCE_TENANT_INVALID");
 return {
  active:input.active===true?true:input.active===false?false:null,
  slug:String(input.slug||""),
  subscriptionStatus:String(input.subscriptionStatus||"").trim().toLowerCase(),
  subscriptionExpiresAt:iso(input.subscriptionExpiresAt),
  gracePeriodDays:input.gracePeriodDays??3,
  firstActivatedAt:iso(input.firstActivatedAt),
  trialStartsAt:iso(input.trialStartsAt),
  onboardingRequired:input.onboardingRequired===true,
  ownerConfigured:typeof input.ownerUid==="string"&&input.ownerUid.trim().length>0,
  suspensionReason:String(input.suspensionReason||"").trim(),
  revenueShareSuspended:input.revenueShareSuspended===true,
  hybridBillingSuspended:input.hybridBillingSuspended===true,
  m7FinanceAccessStatus:String(input.m7FinanceAccessStatus||"").trim(),
  m7FinanceAccessReason:String(input.m7FinanceAccessReason||"").trim(),
  m7AdminTestOverrideMode:String(input.m7AdminTestOverrideMode||"auto").trim(),
 };
}
function inspect({tenantId,tenant,slugIndex=null,now=new Date()}={}){
 if(!TENANT.test(tenantId||""))fail("TENANT_ACCESS_EVIDENCE_ID_INVALID");
 if(!Number.isFinite(now?.getTime?.()))fail("TENANT_ACCESS_EVIDENCE_CLOCK_INVALID");
 const state=sanitizedState(tenant);
 const flags=new Set();
 const add=code=>flags.add(code);
 if(state.active!==true)add(REASONS.TENANT_INACTIVE);
 if(state.onboardingRequired||!state.ownerConfigured||!state.firstActivatedAt||
   !state.trialStartsAt)add(REASONS.ORIGINAL_ACTIVATION_UNVERIFIED);
 const recognizedStatus=["active","trialing","grace","suspended",
   "expired","past_due","cancelled"].includes(state.subscriptionStatus);
 if(!recognizedStatus)add(REASONS.MEMBERSHIP_STATUS_UNKNOWN);
 if(["suspended","expired","past_due","cancelled"].includes(
   state.subscriptionStatus))add(REASONS.LEGACY_MEMBERSHIP_SUSPENDED);
 const grace=state.gracePeriodDays;
 if(!Number.isInteger(grace)||grace<0||grace>30)
  add(REASONS.MEMBERSHIP_GRACE_INVALID);
 if(state.subscriptionExpiresAt===null){
  add(REASONS.MEMBERSHIP_EXPIRY_MISSING);
 }else if(Number.isInteger(grace)&&grace>=0&&grace<=30&&
  now.getTime()>Date.parse(state.subscriptionExpiresAt)+grace*86400000){
  add(REASONS.LEGACY_MEMBERSHIP_EXPIRED);
 }
 if(state.suspensionReason&&
   !["hybrid_billing","hybrid_unpaid"].includes(state.suspensionReason.toLowerCase()))
  add(REASONS.MANUAL_SECURITY_SUSPENSION);
 if(state.revenueShareSuspended)add(REASONS.LEGACY_DELIVERY_SHARE_HOLD);
 if(state.hybridBillingSuspended)add(REASONS.HYBRID_BILLING_HOLD);
 if(state.m7FinanceAccessStatus==="suspended")
  add(REASONS.M7_RECORDED_HOLD_UNVERIFIED);
 else if(state.m7FinanceAccessStatus==="review_required")
  add(REASONS.M7_FINANCE_REVIEW_REQUIRED);
 else if(state.m7FinanceAccessStatus!=="not_suspended"&&
    state.m7FinanceAccessStatus!=="clear"&&
    state.m7FinanceAccessStatus!=="")
  add(REASONS.FINANCIAL_STATE_UNKNOWN);
 if(!["auto","allow","suspend"].includes(state.m7AdminTestOverrideMode))
  add(REASONS.TEST_OVERRIDE_MALFORMED);
 else if(state.m7AdminTestOverrideMode!=="auto")
  add(REASONS.TEST_OVERRIDE_METADATA_ONLY);
 if(!slugIndex) add(REASONS.TENANT_SLUG_INDEX_MISSING);
 else if(slugIndex.tenantId!==tenantId||
   slugIndex.active!==state.active||
   String(slugIndex.subscriptionStatus||"").trim().toLowerCase()!==
     state.subscriptionStatus||
   iso(slugIndex.subscriptionExpiresAt)!==state.subscriptionExpiresAt||
   (slugIndex.gracePeriodDays??3)!==state.gracePeriodDays)
  add(REASONS.TENANT_SLUG_INDEX_CONFLICT);
 const reasons=[...flags].sort();
 // No unverified tenant/slug/TEST status grants any selling permission.
 const stateCode=reasons.some(code=>UNSAFE.has(code))?"review_required":
  reasons.some(code=>CRITICAL.has(code))?"recorded_restriction":
   "no_recorded_restriction_unverified";
 const basis={tenantId,state,slugIndex:slugIndex?{
  tenantId:String(slugIndex.tenantId||""),
  active:slugIndex.active===true?true:slugIndex.active===false?false:null,
  subscriptionStatus:String(slugIndex.subscriptionStatus||""),
  subscriptionExpiresAt:iso(slugIndex.subscriptionExpiresAt),
  gracePeriodDays:slugIndex.gracePeriodDays??3,
 }:null,reasons};
 const snapshotDigest=createHash("sha256").update(
  JSON.stringify(basis)).digest("hex");
 return Object.freeze({
  ok:true,readOnly:true,
  mode:"p12e_source_access_evidence_triage",
  tenantId, snapshotDigest,state:stateCode,
  reasonCodes:reasons,sourceProofGaps:[...SOURCE_GAPS],
  recordedM7State:state.m7FinanceAccessStatus||"not_recorded",
  testOverrideRecorded:state.m7AdminTestOverrideMode,
  tenantSlugCoherent:slugIndex!==null&&
    !reasons.includes(REASONS.TENANT_SLUG_INDEX_CONFLICT),
  sourceOriginalHoldSignatureVerified:false,
  independentBankCashVerified:false,
  originalInvoiceJournalCertified:false,
  sourceCreditLedgerCertified:false,
  financialBalanceKnown:false,
  certifiedOpenInvoiceCount:null,
  certifiedOutstandingCents:null,
  canSell:null,canReleaseTenant:false,canSettleMoney:false,
  canIssueInvoice:false,canApplyCredit:false,
  writesPerformed:false,
 });
}
module.exports={TENANT,REASONS,CODE_SET,SOURCE_GAPS,
 sanitizedState,asMillis,iso,inspect};
