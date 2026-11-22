"use strict";
// Advisory only: Source MariaDB invoice keys and Firebase Hybrid invoice IDs
// use DIFFERENT authorities and snapshot digests. A derived candidate is NOT
// a migration mapping, bank proof, Service Credit, or payment confirmation.
const {satang}=require("./hybrid-billing-payment-policy");
const contract=require("./m7-source-migration-contract");
const MAX_FIREBASE=200;
const CODES=Object.freeze([
 "SOURCE_TO_FIREBASE_IDS_NOT_AUTHENTICATED",
 "FIREBASE_INVOICE_SCAN_TRUNCATED",
 "FIREBASE_INVOICE_CANDIDATE_MISSING",
 "FIREBASE_INVOICE_AMOUNT_DRIFT",
 "FIREBASE_INVOICE_SCOPE_OR_SIGNATURE_INVALID",
 "FIREBASE_INVOICE_STATUS_DRIFT",
 "FIREBASE_INVOICE_HAS_UNMIGRATED_CREDIT",
 "FIREBASE_EXTRA_INVOICE_NEEDS_REVIEW",
 "SOURCE_YEARLY_HAS_NO_FIREBASE_EQUIVALENT",
 "SOURCE_CREDIT_ORIGIN_NOT_FIREBASE_PROVEN",
]);
function candidateId(source){
 if(source?.kind==="monthly")
  return source.cycle_start_day+":monthly:fixed";
 if(source?.kind==="delivery_daily")
  return source.cycle_start_day+":delivery:"+source.business_day;
 return null;
}
function normalizedTarget(row,tenantId){
 if(!row||typeof row!=="object"||
    row.tenantId!==tenantId||
    row.version!=="hybrid-invoice-v1"||
    !/^[a-f0-9]{64}$/.test(row.signature||"")||
    !["fixed_monthly","delivery_daily","delivery_threshold"].includes(row.kind)||
    !["issued","pending_review","paid","rejected"].includes(row.status))
  return null;
 try{return {...row,amountCents:satang(row.amount)};}catch{return null;}
}
function compare(manifest,docs=[],{truncated=false}={}){
 const base=contract.inspect(manifest);
 if(!Array.isArray(docs)||docs.length>MAX_FIREBASE+1)
  throw Error("M7_SOURCE_FIREBASE_CANDIDATE_UNBOUNDED");
 const issues=new Set(["SOURCE_TO_FIREBASE_IDS_NOT_AUTHENTICATED"]);
 const seen=new Map(),used=new Set();
 for(const doc of docs.slice(0,MAX_FIREBASE)){
  const id=String(doc?.id||"");
  if(!id||seen.has(id))issues.add("FIREBASE_INVOICE_SCOPE_OR_SIGNATURE_INVALID");
  else seen.set(id,doc);
 }
 let matchedStructure=0,missing=0,conflicts=0,unsupported=0;
 for(const source of manifest.tables.merchant_platform_invoice_journal){
  const targetId=candidateId(source);
  if(!targetId){
   unsupported++;
   issues.add("SOURCE_YEARLY_HAS_NO_FIREBASE_EQUIVALENT");
   continue;
  }
  const item=seen.get(targetId);
  if(!item){
   missing++;
   issues.add("FIREBASE_INVOICE_CANDIDATE_MISSING");
   continue;
  }
  used.add(targetId);
  const target=normalizedTarget(item,manifest.tenantId);
  const expectedKind=source.kind==="monthly"?"fixed_monthly":"delivery_daily";
  if(!target||target.kind!==expectedKind){
   conflicts++;
   issues.add("FIREBASE_INVOICE_SCOPE_OR_SIGNATURE_INVALID");
   continue;
  }
  if(target.amountCents!==source.gross_cents){
   conflicts++;
   issues.add("FIREBASE_INVOICE_AMOUNT_DRIFT");
   continue;
  }
  // A matching amount is only a candidate. Source may already include
  // credit/bank cash that the Firebase Hybrid status does not know.
  matchedStructure++;
  if(["paid","settled_credit"].includes(source.state)&&target.status!=="paid"||
     source.state==="waived"&&target.status==="paid"||
     target.status==="paid"&&!["paid","waived","settled_credit"].includes(source.state))
   issues.add("FIREBASE_INVOICE_STATUS_DRIFT");
  if(source.applied_service_credit_cents>0||
    source.state==="waived")
   issues.add("SOURCE_CREDIT_ORIGIN_NOT_FIREBASE_PROVEN");
  const keys=["appliedCreditCents","appliedServiceCreditCents",
   "verifiedBankPaidCents","serviceCreditApplied"];
  if(keys.some(k=>item[k]!==undefined&&item[k]!==null&&
     item[k]!==0&&item[k]!==false&&item[k]!=="0"))
   issues.add("FIREBASE_INVOICE_HAS_UNMIGRATED_CREDIT");
 }
 let extras=0;
 for(const id of seen.keys())
  if(!used.has(id))extras++;
 if(extras)issues.add("FIREBASE_EXTRA_INVOICE_NEEDS_REVIEW");
 if(truncated||docs.length>MAX_FIREBASE)
  issues.add("FIREBASE_INVOICE_SCAN_TRUNCATED");
 const issueCodes=[...issues].sort();
 return Object.freeze({
  mode:"m7_source_firebase_candidate_mapping_read_only",
  tenantId:manifest.tenantId,sourceSnapshotDigest:base.manifestDigest,
  sourceInvoiceCount:manifest.tables.merchant_platform_invoice_journal.length,
  inspectedFirebaseInvoices:Math.min(docs.length,MAX_FIREBASE),
  matchingAmountAndKindCandidates:matchedStructure,
  missingFirebaseInvoiceCandidates:missing,conflictingInvoiceCandidates:conflicts,
  unrepresentableSourceYearlyInvoices:unsupported,
  extraFirebaseInvoiceCandidates:extras,
  issueCodes,
  exactSourceToFirebaseSnapshotProven:false,
  mappingOnlyAdvisory:true,crossChannelBankClaimsVerified:false,
  originalSourceProofAuthenticated:false,
  financialMutationAllowed:false,tenantReleaseAllowed:false,
 });
}
module.exports={MAX_FIREBASE,CODES,candidateId,normalizedTarget,compare};
