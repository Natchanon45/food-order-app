"use strict";
// M7 MariaDB -> Firebase structural reconciliation, NO FINANCIAL WRITES.
// Input snapshots are untrusted read-only exports. Even "zero issues" is
// NOT bank proof, signed source certification, or production clearance.
const {createHash}=require("node:crypto");
const credit=require("./m7-operational-credit-policy");
const VERSION="m7-source-migration-preflight-v1";
const SOURCE_SCHEMA_SHA256="1b104bf624ce96997c577e3ccc78880bf8fec3e0b9ae108e492d77317afa3eb6";
const HOLD_SCHEMA_SHA256="54777f521fc6de90739ff4ece48980291840f477ec6b9ccaa4b438c62e01a31c";
const SOURCE_COMMIT="03d2aaeeaf56f4c0d63a51d19bf7ebbcc63d62fd";
const TABLES=Object.freeze([
 "merchant_platform_invoice_journal",
 "merchant_platform_invoice_adjustment_events",
 "merchant_service_credit_accounts",
 "merchant_service_credit_conversions",
 "merchant_service_credit_events",
 "merchant_platform_payment_attempts",
 "merchant_platform_bank_reference_claims",
 "merchant_payment_obligation_holds",
 "merchant_payment_hold_events",
 "merchant_m7_hold_policy_approvals",
]);
const LIMITS={rowsPerTable:250,totalRows:1000,bytes:512000};
const SHA=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ID=/^[A-Za-z0-9_-]{3,160}$/;
const STATES=new Set(["issued","pending_review","pending_manual_review","rejected",
 "paid","settled_credit","waived","voided"]);
const KIND=new Set(["monthly","yearly","delivery_daily"]);
const EVENT=new Set([credit.CONVERT,credit.REVERSE,credit.DAILY,credit.MONTH]);
const ISSUE_CODES=Object.freeze([
 "SCHEMA_SOURCE_NOT_AUTHENTICATED","SOURCE_SNAPSHOT_COUNTS_MISMATCH",
 "INVOICE_SCOPE_OR_STRUCTURE_INVALID","INVOICE_DUPLICATE_KEY",
 "INVOICE_MONEY_INCONSISTENT","INVOICE_DATE_OR_POLICY_INVALID",
 "ADJUSTMENT_ORIGINAL_INVOICE_MISSING","ADJUSTMENT_AUDIT_INVALID",
 "CREDIT_ACCOUNT_INVALID","CREDIT_EVENT_SEQUENCE_OR_BALANCE_MISMATCH",
 "CREDIT_EVENT_ORIGINAL_INVOICE_MISSING","CREDIT_EVENT_OVERDRAW",
 "CREDIT_CONVERSION_INCONSISTENT","CREDIT_EVENT_CONVERSION_MISSING",
 "CREDIT_INVOICE_OFFSET_MISMATCH","CREDIT_YEARLY_OFFSET_FORBIDDEN",
 "PAYMENT_ORIGINAL_INVOICE_MISSING","PAYMENT_AMOUNT_OR_STATE_MISMATCH",
 "PAYMENT_DUPLICATE_SLIP_HASH","PAYMENT_PROOF_NOT_INDEPENDENT",
 "SOURCE_BANK_PAID_PAYMENT_PROOF_NOT_EXPORTED",
 "BANK_REFERENCE_CLAIM_ORPHAN","BANK_REFERENCE_CLAIM_DUPLICATE",
 "BANK_REFERENCE_CLAIMS_GLOBAL_COVERAGE_UNKNOWN",
 "HOLD_ORIGINAL_INVOICE_MISSING","HOLD_MONEY_OR_STATE_INCONSISTENT",
 "HOLD_EVENT_ORPHAN","HOLD_APPROVAL_ORIGINAL_INVOICE_MISSING",
 "HOLD_APPROVAL_POLICY_INVALID","HOLD_RELEASE_CANNOT_BE_CERTIFIED",
 "FIREBASE_CROSS_LEDGER_CONFLICT_NOT_EVALUATED",
]);
const CODES=new Set(ISSUE_CODES);
const fail=(code)=>{throw Error("M7_SOURCE_MIGRATION_"+code)};
function iso(s){
 return typeof s==="string"&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(s)&&
  Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s.slice(0,10);
}
function day(s){
 return typeof s==="string"&&/^20\d\d-\d\d-\d\d$/.test(s)&&
   Number.isFinite(Date.parse(s+"T00:00:00Z"))&&
   new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
}
function uint(n,{zero=true}={}){
 return Number.isSafeInteger(n)&&n>= (zero?0:1);
}
function rowFor(tenantId,obj,required,optional=[]){
 return obj&&typeof obj==="object"&&!Array.isArray(obj)&&
  obj.tenant_id===tenantId&&
  required.every(k=>Object.hasOwn(obj,k))&&
  Object.keys(obj).every(k=>k==="tenant_id"||required.includes(k)||optional.includes(k));
}
function shape(manifest){
 if(!manifest||typeof manifest!=="object"||Array.isArray(manifest)||
    Object.keys(manifest).sort().join(",")!=="source,tables,tenantId,version"||
    manifest.version!==VERSION||!ID.test(manifest.tenantId||""))
  fail("TOP_LEVEL_INVALID");
 const source=manifest.source;
 if(!source||typeof source!=="object"||Array.isArray(source)||
  Object.keys(source).sort().join(",")!==
  "capturedAtUtc,holdSchemaSha256,inventory,operatorAttestedReadOnly,sourceCommit,sourceSchemaSha256"||
  source.sourceCommit!==SOURCE_COMMIT||
  source.sourceSchemaSha256!==SOURCE_SCHEMA_SHA256||
  source.holdSchemaSha256!==HOLD_SCHEMA_SHA256||
  !iso(source.capturedAtUtc)||
  source.operatorAttestedReadOnly!==true)
  fail("SOURCE_SCHEMA_REVISION_INVALID");
 if(!manifest.tables||typeof manifest.tables!=="object"||
  Array.isArray(manifest.tables)||
  Object.keys(manifest.tables).sort().join(",")!==[...TABLES].sort().join(",")||
  !source.inventory||typeof source.inventory!=="object"||
  Object.keys(source.inventory).sort().join(",")!==[...TABLES].sort().join(","))
  fail("SOURCE_TABLE_INVENTORY_INVALID");
 let total=0;
 for(const name of TABLES){
  const records=manifest.tables[name];
  const advertised=source.inventory[name];
  if(!Array.isArray(records)||records.length>LIMITS.rowsPerTable||
    !uint(advertised)||advertised>Number.MAX_SAFE_INTEGER)
   fail("SOURCE_TABLE_BOUNDS_INVALID");
  for(const row of records){
   if(!row||typeof row!=="object"||Array.isArray(row)||
      Object.keys(row).length>36||
      Object.keys(row).some(k=>/password|token|secret|private_slip_path|bank_account|account_number|email|phone|reviewer_note|source_reason|encrypted_config|access_key/i.test(k)))
    fail("SOURCE_RAW_PRIVATE_FIELDS_FORBIDDEN");
  }
  total+=records.length;
  if(total>LIMITS.totalRows)fail("SOURCE_TOTAL_BOUNDS_INVALID");
 }
 if(Buffer.byteLength(JSON.stringify(manifest),"utf8")>LIMITS.bytes)
  fail("SOURCE_PAYLOAD_LIMIT");
 return total;
}
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==="object")
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
function digest(manifest){
 const clone={version:manifest.version,tenantId:manifest.tenantId,
  source:manifest.source,
  tables:Object.fromEntries(TABLES.map(t=>[t,
   [...manifest.tables[t]].map(canonical).sort((a,b)=>
    JSON.stringify(a).localeCompare(JSON.stringify(b)))]))};
 return createHash("sha256").update(JSON.stringify(canonical(clone))).digest("hex");
}
function inspect(manifest){
 const total=shape(manifest);
 const {tenantId,tables,source}=manifest;
 const issues=new Set(["SCHEMA_SOURCE_NOT_AUTHENTICATED",
  "BANK_REFERENCE_CLAIMS_GLOBAL_COVERAGE_UNKNOWN",
  "HOLD_RELEASE_CANNOT_BE_CERTIFIED","FIREBASE_CROSS_LEDGER_CONFLICT_NOT_EVALUATED"]);
 const add=code=>{if(!CODES.has(code))fail("UNKNOWN_ISSUE");issues.add(code)};
 const rows=t=>tables[t];
 const byKey=(table,key,issue)=>{
  const map=new Map();
  for(const row of rows(table)){
   const val=row?.[key];
   if(typeof val!=="string"||!val||map.has(val))add(issue);
   else map.set(val,row);
  }
  return map;
 };
 for(const table of TABLES)
  if(rows(table).length!==source.inventory[table])
   add("SOURCE_SNAPSHOT_COUNTS_MISMATCH");

 const invoices=byKey(TABLES[0],"invoice_key","INVOICE_DUPLICATE_KEY");
 const invoiceIds=new Set();
 const offsetByInvoice=new Map();
 for(const r of rows(TABLES[0])){
  if(invoiceIds.has(r.id))add("INVOICE_DUPLICATE_KEY");
  invoiceIds.add(r.id);
  if(!rowFor(tenantId,r,["id","invoice_key","kind","policy_version",
   "source_snapshot_sha256","immutable_invoice_sha256",
   "approved_beneficiary_sha256","cycle_start_day","cycle_end_day",
   "business_day","due_bangkok_day","gross_cents",
   "applied_service_credit_cents","verified_bank_paid_cents","currency",
   "state","certified_by"],["approved_pricing_sha256",
   "suspend_from_bangkok_day","last_version"])||
    !UUID.test(r.id||"")||!SHA.test(r.invoice_key||"")||
    !KIND.has(r.kind)||!ID.test(r.certified_by||"")||
    !SHA.test(r.source_snapshot_sha256||"")||
    !SHA.test(r.immutable_invoice_sha256||"")||
    !SHA.test(r.approved_beneficiary_sha256||""))
   add("INVOICE_SCOPE_OR_STRUCTURE_INVALID");
  if(!day(r.cycle_start_day)||!day(r.cycle_end_day)||
   !day(r.business_day)||!day(r.due_bangkok_day)||
   r.cycle_end_day<r.cycle_start_day||
   r.business_day<r.cycle_start_day||
   r.business_day>r.cycle_end_day||
   r.suspend_from_bangkok_day!=null&&!day(r.suspend_from_bangkok_day)||
   r.approved_pricing_sha256!=null&&!SHA.test(r.approved_pricing_sha256)||
   !String(r.policy_version||"").trim()||
   r.last_version!=null&&(!uint(r.last_version,{zero:false})||r.last_version>1000000))
   add("INVOICE_DATE_OR_POLICY_INVALID");
  if(!uint(r.gross_cents,{zero:false})||
   !uint(r.applied_service_credit_cents)||
   !uint(r.verified_bank_paid_cents)||
   r.currency!=="THB"||!STATES.has(r.state)||
   r.applied_service_credit_cents+r.verified_bank_paid_cents>r.gross_cents||
   r.kind==="yearly"&&r.applied_service_credit_cents>0)
   add("INVOICE_MONEY_INCONSISTENT");
  else{
   const due=r.gross_cents-r.applied_service_credit_cents-r.verified_bank_paid_cents;
   if(["paid","settled_credit"].includes(r.state)&&due!==0||
    ["issued","pending_review","pending_manual_review","rejected"].includes(r.state)&&due===0)
    add("INVOICE_MONEY_INCONSISTENT");
  }
 }
 const conversions=byKey(TABLES[3],"id","CREDIT_CONVERSION_INCONSISTENT");
 const cycles=new Set(),convertedInvoices=new Set();
 for(const c of rows(TABLES[3])){
  if(!rowFor(tenantId,c,["id","cycle_start_date","paid_monthly_invoice_id",
   "approved_monthly_price_cents","paid_by_bank_cents",
   "used_previous_credit_cents","signed_delivery_goods_cents",
   "signed_delivery_threshold_cents","source_invoice_digest","certified_by"])||
    !UUID.test(c.id||"")||!SHA.test(c.paid_monthly_invoice_id||"")||
    !SHA.test(c.source_invoice_digest||"")||!day(c.cycle_start_date)||
    !uint(c.approved_monthly_price_cents,{zero:false})||
    !uint(c.paid_by_bank_cents)||!uint(c.used_previous_credit_cents)||
    !uint(c.signed_delivery_goods_cents)||!uint(c.signed_delivery_threshold_cents,{zero:false})||
    c.paid_by_bank_cents+c.used_previous_credit_cents!==c.approved_monthly_price_cents||
    c.signed_delivery_goods_cents<=c.signed_delivery_threshold_cents||
    cycles.has(c.cycle_start_date)||convertedInvoices.has(c.paid_monthly_invoice_id))
   add("CREDIT_CONVERSION_INCONSISTENT");
  cycles.add(c.cycle_start_date);
  convertedInvoices.add(c.paid_monthly_invoice_id);
  const inv=invoices.get(c.paid_monthly_invoice_id);
  if(!inv||inv.kind!=="monthly"||inv.state!=="waived"||
    inv.gross_cents!==c.approved_monthly_price_cents||
    inv.verified_bank_paid_cents!==c.paid_by_bank_cents||
    inv.applied_service_credit_cents!==c.used_previous_credit_cents||
    inv.source_snapshot_sha256!==c.source_invoice_digest||
    inv.cycle_start_day!==c.cycle_start_date)
   add("CREDIT_CONVERSION_INCONSISTENT");
 }
 const accounts=rows(TABLES[2]);
 if(accounts.length>1||
  accounts.length===0&&(rows(TABLES[3]).length||rows(TABLES[4]).length)||
  accounts.length===1&&(!rowFor(tenantId,accounts[0],
   ["balance_cents","sequence_no"])||
  !uint(accounts[0]?.balance_cents)||!uint(accounts[0]?.sequence_no)))
  add("CREDIT_ACCOUNT_INVALID");
 const events=rows(TABLES[4]);
 const eventSeq=new Set(),eventIds=new Set(),seenCredit=new Set();
 let creditBalance=0,creditReplayGood=true;
 for(const e of [...events].sort((a,b)=>(a.account_sequence_no||0)-(b.account_sequence_no||0))){
  const valid=rowFor(tenantId,e,["id","account_sequence_no","event_type",
   "reference_invoice_id","cycle_start_date","amount_cents",
   "verified_source_digest","actor_id"],["target_invoice_gross_cents","conversion_id"])&&
   UUID.test(e.id||"")&&uint(e.account_sequence_no,{zero:false})&&
   EVENT.has(e.event_type)&&SHA.test(e.reference_invoice_id||"")&&
   SHA.test(e.verified_source_digest||"")&&
   day(e.cycle_start_date)&&uint(e.amount_cents,{zero:false});
  if(!valid||eventSeq.has(e.account_sequence_no)||
    seenCredit.has(e.event_type+":"+e.reference_invoice_id)||
    eventIds.has(e.id)||
    e.account_sequence_no!==eventSeq.size+1)
   creditReplayGood=false;
  eventSeq.add(e.account_sequence_no);
  eventIds.add(e.id);
  seenCredit.add(e.event_type+":"+e.reference_invoice_id);
  const inv=invoices.get(e.reference_invoice_id);
  if(!inv)add("CREDIT_EVENT_ORIGINAL_INVOICE_MISSING");
  const conv=e.conversion_id?conversions.get(e.conversion_id):null;
  if([credit.CONVERT,credit.REVERSE].includes(e.event_type)){
   if(!conv||conv.paid_monthly_invoice_id!==e.reference_invoice_id||
     conv.cycle_start_date!==e.cycle_start_date||
     (e.event_type===credit.CONVERT&&e.amount_cents!==conv.paid_by_bank_cents||
      e.event_type===credit.REVERSE&&e.amount_cents!==conv.used_previous_credit_cents))
     add("CREDIT_EVENT_CONVERSION_MISSING");
  }else{
   if(e.conversion_id!=null||
      e.verified_source_digest!==inv?.source_snapshot_sha256||
      !uint(e.target_invoice_gross_cents,{zero:false})||
      !inv||inv.kind!==(e.event_type===credit.DAILY?"delivery_daily":"monthly")||
      e.target_invoice_gross_cents!==inv?.gross_cents||
      e.cycle_start_date!==inv?.cycle_start_day)
    add("CREDIT_INVOICE_OFFSET_MISMATCH");
   offsetByInvoice.set(e.reference_invoice_id,
    (offsetByInvoice.get(e.reference_invoice_id)||0)+e.amount_cents);
  }
  if(inv?.kind==="yearly")add("CREDIT_YEARLY_OFFSET_FORBIDDEN");
  const increase=[credit.CONVERT,credit.REVERSE].includes(e.event_type);
  if(increase){
   if(creditBalance>Number.MAX_SAFE_INTEGER-e.amount_cents)
    creditReplayGood=false;
   else creditBalance+=e.amount_cents;
  }else{
   if(creditBalance<e.amount_cents)creditReplayGood=false;
   else creditBalance-=e.amount_cents;
  }
 }
 if(!creditReplayGood||
   accounts.length===1&&(accounts[0]?.sequence_no!==events.length||
     accounts[0]?.balance_cents!==creditBalance))
  add("CREDIT_EVENT_SEQUENCE_OR_BALANCE_MISMATCH");
 for(const inv of invoices.values()){
  if(uint(inv.applied_service_credit_cents)&&
     (offsetByInvoice.get(inv.invoice_key)||0)!==inv.applied_service_credit_cents)
   add("CREDIT_INVOICE_OFFSET_MISMATCH");
 }
 for(const conv of conversions.values()){
  const list=events.filter(x=>x.conversion_id===conv.id);
  if(conv.paid_by_bank_cents>0&&!list.some(x=>x.event_type===credit.CONVERT)||
    conv.used_previous_credit_cents>0&&!list.some(x=>x.event_type===credit.REVERSE))
   add("CREDIT_EVENT_CONVERSION_MISSING");
 }
 for(const x of rows(TABLES[1])){
  if(!rowFor(tenantId,x,["id","invoice_key","event_kind",
    "prior_snapshot_sha256","proposed_snapshot_sha256",
    "authorization_sha256","event_digest","actor_id"])||
    !UUID.test(x.id||"")||!SHA.test(x.event_digest||"")||
    !SHA.test(x.prior_snapshot_sha256||"")||
    !SHA.test(x.proposed_snapshot_sha256||"")||
    !SHA.test(x.authorization_sha256||"")||
    !["correction_requested","approved_adjustment","void_authorized",
       "fee_waived","credit_reclassified","issued","payment_verified",
       "payment_rejected"].includes(x.event_kind)||
    !ID.test(x.actor_id||""))
   add("ADJUSTMENT_AUDIT_INVALID");
  if(!invoices.has(x.invoice_key))add("ADJUSTMENT_ORIGINAL_INVOICE_MISSING");
 }
 const attempts=byKey(TABLES[5],"id","PAYMENT_AMOUNT_OR_STATE_MISMATCH");
 const seenSlip=new Set();
 for(const a of attempts.values()){
  const inv=invoices.get(a.invoice_key);
  if(!inv)add("PAYMENT_ORIGINAL_INVOICE_MISSING");
  if(!rowFor(tenantId,a,["id","invoice_key","invoice_kind",
   "immutable_invoice_snapshot_sha256","approved_beneficiary_sha256",
   "gross_cents","applied_service_credit_cents","bank_cash_due_cents",
   "slip_sha256","source","state"],["independent_bank_statement_sha256",
   "owner_review_evidence_sha256","decision_sha256"])||
    !UUID.test(a.id||"")||!SHA.test(a.slip_sha256||"")||
    !SHA.test(a.immutable_invoice_snapshot_sha256||"")||
    !SHA.test(a.approved_beneficiary_sha256||"")||
    !["slip2go","superadmin_manual"].includes(a.source)||
    !["pending_provider","pending_manual_review","rejected","approved"].includes(a.state)||
    !uint(a.gross_cents,{zero:false})||
    !uint(a.applied_service_credit_cents)||
    !uint(a.bank_cash_due_cents,{zero:false})||
    a.bank_cash_due_cents!==a.gross_cents-a.applied_service_credit_cents||
    a.invoice_kind!==inv?.kind||a.gross_cents!==inv?.gross_cents||
    a.immutable_invoice_snapshot_sha256!==inv?.immutable_invoice_sha256||
    a.approved_beneficiary_sha256!==inv?.approved_beneficiary_sha256)
   add("PAYMENT_AMOUNT_OR_STATE_MISMATCH");
  if(seenSlip.has(a.slip_sha256))add("PAYMENT_DUPLICATE_SLIP_HASH");
  seenSlip.add(a.slip_sha256);
  if(a.state==="approved"&&
     !SHA.test(a.independent_bank_statement_sha256||"")&&
     !SHA.test(a.owner_review_evidence_sha256||""))
   add("PAYMENT_PROOF_NOT_INDEPENDENT");
  if(a.independent_bank_statement_sha256&&a.owner_review_evidence_sha256)
   add("PAYMENT_PROOF_NOT_INDEPENDENT");
 }
 for(const inv of invoices.values()){
  if(uint(inv.verified_bank_paid_cents,{zero:false})&&
     ![...attempts.values()].some(a=>a.invoice_key===inv.invoice_key&&
       a.state==="approved"&&
       a.bank_cash_due_cents>=inv.verified_bank_paid_cents))
    add("SOURCE_BANK_PAID_PAYMENT_PROOF_NOT_EXPORTED");
 }
 const claimRefs=new Set();
 for(const b of rows(TABLES[6])){
  // Original SQL bank reference claim is a GLOBAL table WITHOUT tenant_id.
  // Tenant identity is proven only through the referenced payment attempt.
  if(!b||typeof b!=="object"||Object.keys(b).some(k=>
     !["ref_sha256","payment_attempt_id","invoice_key"].includes(k))||
    !Object.hasOwn(b,"payment_attempt_id")||
    !Object.hasOwn(b,"invoice_key")||
    !SHA.test(b.ref_sha256||"")||claimRefs.has(b.ref_sha256))
   add("BANK_REFERENCE_CLAIM_DUPLICATE");
  claimRefs.add(b.ref_sha256);
  const a=attempts.get(b.payment_attempt_id);
  if(!a||a.invoice_key!==b.invoice_key)add("BANK_REFERENCE_CLAIM_ORPHAN");
 }
 const holds=byKey(TABLES[7],"id","HOLD_MONEY_OR_STATE_INCONSISTENT");
 const holdsByInvoice=new Set();
 for(const h of holds.values()){
  const inv=invoices.get(h.invoice_key);
  if(!inv)add("HOLD_ORIGINAL_INVOICE_MISSING");
  if(holdsByInvoice.has(h.invoice_key))add("HOLD_MONEY_OR_STATE_INCONSISTENT");
  holdsByInvoice.add(h.invoice_key);
  if(!rowFor(tenantId,h,["id","invoice_key","obligation_kind",
   "cycle_start","due_bangkok_date","suspend_from_bangkok_date",
   "gross_cents","applied_service_credit_cents",
   "verified_bank_paid_cents","approved_financial_snapshot_sha256","state"])||
    !UUID.test(h.id||"")||!SHA.test(h.approved_financial_snapshot_sha256||"")||
    !["open","resolved","waived","disputed"].includes(h.state)||
    !day(h.cycle_start)||!day(h.due_bangkok_date)||
    !day(h.suspend_from_bangkok_date)||
    h.obligation_kind!==inv?.kind||h.gross_cents!==inv?.gross_cents||
    h.applied_service_credit_cents!==inv?.applied_service_credit_cents||
    h.verified_bank_paid_cents!==inv?.verified_bank_paid_cents||
    !uint(h.gross_cents,{zero:false})||
    !uint(h.applied_service_credit_cents)||!uint(h.verified_bank_paid_cents)||
    h.applied_service_credit_cents+h.verified_bank_paid_cents>h.gross_cents)
   add("HOLD_MONEY_OR_STATE_INCONSISTENT");
 }
 const holdEventIds=new Set();
 for(const e of rows(TABLES[8])){
  if(!rowFor(tenantId,e,["id","hold_id","invoice_key","action",
   "actor_id","event_sha256"])||!UUID.test(e.id||"")||
    !SHA.test(e.event_sha256||"")||
    !["opened","payment_verified","credit_applied","review_pending",
     "review_rejected","waived","resolved","reopened","disputed"].includes(e.action)||
    holdEventIds.has(e.id))
   add("HOLD_EVENT_ORPHAN");
  holdEventIds.add(e.id);
  const h=holds.get(e.hold_id);
  if(!h||h.invoice_key!==e.invoice_key)add("HOLD_EVENT_ORPHAN");
 }
 const holdApprovalInvoices=new Set();
 for(const a of rows(TABLES[9])){
  const inv=invoices.get(a.invoice_key);
  if(!inv)add("HOLD_APPROVAL_ORIGINAL_INVOICE_MISSING");
  if(!rowFor(tenantId,a,["invoice_key","immutable_invoice_sha256",
   "cutoff_bangkok_day","due_bangkok_day","policy_version",
   "approved_by","approval_sha256"])||
    !SHA.test(a.approval_sha256||"")||
    !SHA.test(a.immutable_invoice_sha256||"")||
    a.immutable_invoice_sha256!==inv?.immutable_invoice_sha256||
    !day(a.cutoff_bangkok_day)||!day(a.due_bangkok_day)||
    a.cutoff_bangkok_day<a.due_bangkok_day||
    a.due_bangkok_day!==inv?.due_bangkok_day||
    a.policy_version!=="m7-finance-hold-v1"||
    holdApprovalInvoices.has(a.invoice_key))
   add("HOLD_APPROVAL_POLICY_INVALID");
  holdApprovalInvoices.add(a.invoice_key);
 }
 const issueCodes=[...issues].sort();
 const counts=Object.fromEntries(TABLES.map(t=>[t,tables[t].length]));
 return Object.freeze({
  ok:true,mode:VERSION,tenantId,sourceSchemaSha256:SOURCE_SCHEMA_SHA256,
  manifestDigest:digest(manifest),
  sourceRecordCounts:counts,totalRows:total,
  sourceInventorySelfReported:true,snapshotConsistencyIndependentlyVerified:false,
  independentBankSourceAuthenticated:false,
  globalBankReferenceCoverageVerified:false,
  sourceSignatureIndependentlyVerified:false,
  structuralIssuesDetected:issueCodes.filter(x=>![
   "SCHEMA_SOURCE_NOT_AUTHENTICATED",
   "BANK_REFERENCE_CLAIMS_GLOBAL_COVERAGE_UNKNOWN",
   "HOLD_RELEASE_CANNOT_BE_CERTIFIED",
   "FIREBASE_CROSS_LEDGER_CONFLICT_NOT_EVALUATED"].includes(x)).length,
  issueCodes,missingOperationalProof:true,
  verifiedBankPaidCents:null,verifiedServiceCreditBalanceCents:null,
  outstandingDebtCents:null,operationalInvoicePaid:false,
  operationalCreditPostingAllowed:false,tenantAccessReleaseAllowed:false,
  operationalPromotionAllowed:false,writesPerformed:false,
 });
}
module.exports={VERSION,TABLES,LIMITS,SOURCE_SCHEMA_SHA256,HOLD_SCHEMA_SHA256,
 SOURCE_COMMIT,ISSUE_CODES,shape,digest,inspect};
