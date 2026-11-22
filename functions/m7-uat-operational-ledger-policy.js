"use strict";
// The UAT "operational" ledger is an UNTRUSTED financial shadow simulation.
// It never authenticates a bank, certifies Source signatures or mutates shop
// invoices/holds. Calculations are integer satang and deterministic.
const {createHash}=require("node:crypto");
const source=require("./m7-source-migration-contract");
const {cents}=require("./m7-operational-credit-policy");
const holdPolicy=require("./m7-uat-financial-hold-policy");
const journalPolicy=require("./m7-uat-financial-journal-policy");
const MODE="m7_uat_untrusted_financial_shadow_v1";
const MAX_INVOICES=60;
const MAX_BANK_CLAIMS=60;
const H=/^[a-f0-9]{64}$/;
const issueCodes=Object.freeze([
 "SOURCE_ORIGIN_NOT_INDEPENDENTLY_VERIFIED",
 "BANK_BALANCE_IS_EXPORTED_NOT_BANK_AUTHENTICATED",
 "SERVICE_CREDIT_IS_EXPORTED_NOT_OPERATIONAL_LIABILITY",
 "HOLDS_NOT_SIGNED_WITH_TRUSTED_SOURCE_SECRET",
 "HISTORICAL_REFUNDS_AND_CROSS_TENANT_CLAIMS_UNVERIFIED",
 "FIREBASE_REAL_INVOICE_SETTLEMENT_NOT_MIGRATED",
]);
const hash=(type,value)=>{
 if(!H.test(value||""))throw Error("M7_UAT_LEDGER_BAD_SOURCE_HASH");
 return createHash("sha256").update("penguin-m7-uat-ledger-v1:"+type+":"+value).digest("hex");
};
const fail=(c)=>{throw Error("M7_UAT_LEDGER_"+c);};
function plan(manifest){
 const inspection=source.inspect(manifest);
 if(inspection.structuralIssuesDetected!==0)
  fail("SOURCE_INTEGRITY_INCOMPLETE");
 const tables=manifest.tables;
 const invoices=tables.merchant_platform_invoice_journal;
 const bankClaims=tables.merchant_platform_bank_reference_claims;
 if(invoices.length>MAX_INVOICES||bankClaims.length>MAX_BANK_CLAIMS)
  fail("ATOMIC_DOCUMENT_LIMIT");
 const uniqueInvoice=new Set(),uniqueBank=new Set();
 let grossSatang=0,creditSatang=0,bankReportedSatang=0,
   remainingSatang=0,paidCount=0,unpaidCount=0,waivedCount=0,
   pendingCount=0,holdCount=0,unapprovedHoldCount=0;
 const rows=[];
 const holdByKey=new Map(tables.merchant_payment_obligation_holds
   .map(x=>[x.invoice_key,x]));
 const approvals=new Map(tables.merchant_m7_hold_policy_approvals
   .map(x=>[x.invoice_key,x]));
 for(const i of invoices){
  cents(i.gross_cents);cents(i.applied_service_credit_cents,true);
  cents(i.verified_bank_paid_cents,true);
  const remaining=i.gross_cents-i.applied_service_credit_cents-
    i.verified_bank_paid_cents;
  if(remaining<0||remaining>Number.MAX_SAFE_INTEGER)fail("NEGATIVE_RESIDUAL");
  const key=hash("invoice",i.invoice_key);
  if(uniqueInvoice.has(key))fail("DUPLICATE_INVOICE");
  uniqueInvoice.add(key);
  const hold=holdByKey.get(i.invoice_key);
  const approval=approvals.get(i.invoice_key);
  const status=i.state;
  const dueForReview=["issued","pending_review","pending_manual_review",
    "rejected"].includes(status)?remaining:0;
  const waived=["waived","voided"].includes(status);
  if(status==="paid"||status==="settled_credit")paidCount++;
  if(dueForReview>0)unpaidCount++;
  if(waived)waivedCount++;
  if(["pending_review","pending_manual_review"].includes(status))pendingCount++;
  if(hold){
   holdCount++;
   if(!approval)unapprovedHoldCount++;
  }
  for(const [keyName,value] of [
   ["gross",i.gross_cents],["credit",i.applied_service_credit_cents],
   ["bank",i.verified_bank_paid_cents],["due",dueForReview]]){
   if(!Number.isSafeInteger(value)||value<0)fail("AMOUNT_CORRUPT");
   const current={
    gross:grossSatang,credit:creditSatang,
    bank:bankReportedSatang,due:remainingSatang
   }[keyName];
   if(current>Number.MAX_SAFE_INTEGER-value)fail("SUMMARY_OVERFLOW");
   if(keyName==="gross")grossSatang+=value;
   if(keyName==="credit")creditSatang+=value;
   if(keyName==="bank")bankReportedSatang+=value;
   if(keyName==="due")remainingSatang+=value;
  }
  rows.push(Object.freeze({
   id:key,kind:i.kind,cycleStart:i.cycle_start_day,
   businessDay:i.business_day,dueDay:i.due_bangkok_day,
   state:i.state,grossCents:i.gross_cents,
   appliedCreditCents:i.applied_service_credit_cents,
   sourceBankReportedCents:i.verified_bank_paid_cents,
   arithmeticResidualCents:remaining,
   unpaidForReviewCents:dueForReview,
   hasHoldRecord:!!hold,holdState:hold?.state||"none",
   hasSyntacticHoldApproval:!!approval,
   sourceSignatureVerified:false,bankMoneyAuthenticated:false,
   operationalInvoicePaid:false,releaseAuthorized:false,
  }));
 }
 const bankKeys=bankClaims.map(b=>hash("bank",b.ref_sha256));
 for(const key of bankKeys){
  if(uniqueBank.has(key))fail("DUPLICATE_BANK_CLAIM");
  uniqueBank.add(key);
 }
 const account=tables.merchant_service_credit_accounts;
 if(account.length>1)fail("CREDIT_ACCOUNT_NONUNIQUE");
 const balance=account.length?account[0].balance_cents:0;
 cents(balance,true);
 const holdCandidateSummary=holdPolicy.assess(manifest);
 const financialItems=rows.sort((a,b)=>a.id.localeCompare(b.id));
 const unverifiedDoubleEntryJournal=journalPolicy.build(
  financialItems,inspection.manifestDigest);
 const shadow={
  mode:MODE,tenantId:manifest.tenantId,
  sourceManifestDigest:inspection.manifestDigest,
  sourceSchemaSha256:source.SOURCE_SCHEMA_SHA256,
  currency:"THB",invoiceCount:rows.length,
  sourceGrossCents:grossSatang,
  sourceCreditAppliedCents:creditSatang,
  sourceBankReportedCents:bankReportedSatang,
  sourceUnpaidForReviewCents:remainingSatang,
  sourceCreditAccountReportedCents:balance,
  sourceCreditEventCount:tables.merchant_service_credit_events.length,
  sourcePaymentAttemptCount:tables.merchant_platform_payment_attempts.length,
  sourceBankReferenceCount:bankClaims.length,
  sourceOpenOrPendingDebtCount:unpaidCount,
  sourcePaidOrCreditSettledCount:paidCount,
  sourceWaivedOrVoidedCount:waivedCount,
  sourcePendingPaymentCount:pendingCount,
  sourceHoldRecordCount:holdCount,
  sourceHoldWithoutApprovalCount:unapprovedHoldCount,
  holdCandidateSummary,
  unverifiedDoubleEntryJournal,
  financialItems,
  issueCodes,
  sourceIdentityNotAttested:true,
  bankStatementSourceAuthenticated:false,
  bankCashOperationallyVerified:false,
  serviceCreditOperationallyAvailable:false,
  billingInvoicesMutated:false,tenantAccessMutated:false,
  testStripeShadowCountedAsBankCash:false,
  payoutOrRefundPerformed:false,
  financialPostingAuthorized:false,operationalReleaseAuthorized:false,
  financialShadowOnly:true,
 };
 return Object.freeze({
  shadow:Object.freeze(shadow),
  bankClaimIds:Object.freeze([...uniqueBank].sort()),
  invoiceClaimIds:Object.freeze([...uniqueInvoice].sort()),
 });
}
function digestShadow(shadow){
 const canonical={
  mode:shadow.mode,tenantId:shadow.tenantId,
  sourceManifestDigest:shadow.sourceManifestDigest,
  sourceSchemaSha256:shadow.sourceSchemaSha256,
  currency:shadow.currency,invoiceCount:shadow.invoiceCount,
  sourceGrossCents:shadow.sourceGrossCents,
  sourceCreditAppliedCents:shadow.sourceCreditAppliedCents,
  sourceBankReportedCents:shadow.sourceBankReportedCents,
  sourceUnpaidForReviewCents:shadow.sourceUnpaidForReviewCents,
  sourceCreditAccountReportedCents:shadow.sourceCreditAccountReportedCents,
  sourceCreditEventCount:shadow.sourceCreditEventCount,
  sourcePaymentAttemptCount:shadow.sourcePaymentAttemptCount,
  sourceBankReferenceCount:shadow.sourceBankReferenceCount,
  sourceOpenOrPendingDebtCount:shadow.sourceOpenOrPendingDebtCount,
  sourcePaidOrCreditSettledCount:shadow.sourcePaidOrCreditSettledCount,
  sourceWaivedOrVoidedCount:shadow.sourceWaivedOrVoidedCount,
  sourcePendingPaymentCount:shadow.sourcePendingPaymentCount,
  sourceHoldRecordCount:shadow.sourceHoldRecordCount,
  sourceHoldWithoutApprovalCount:shadow.sourceHoldWithoutApprovalCount,
  holdCandidateSummary:shadow.holdCandidateSummary,
  unverifiedDoubleEntryJournal:shadow.unverifiedDoubleEntryJournal,
  financialItems:shadow.financialItems,
  issueCodes:shadow.issueCodes,
 };
 return createHash("sha256").update("penguin-m7-uat-shadow-summary-v1:"+
  JSON.stringify(canonical)).digest("hex");
}
function safeView(shadow){
 if(shadow?.mode!==MODE||shadow.financialShadowOnly!==true||
    shadow.financialPostingAuthorized!==false||
    shadow.operationalReleaseAuthorized!==false||
    shadow.billingInvoicesMutated!==false||
    shadow.tenantAccessMutated!==false||
    shadow.bankStatementSourceAuthenticated!==false||
    shadow.bankCashOperationallyVerified!==false||
    shadow.serviceCreditOperationallyAvailable!==false||
    shadow.testStripeShadowCountedAsBankCash!==false||
    shadow.payoutOrRefundPerformed!==false||
    shadow.holdCandidateSummary?.tenantAccessReleaseAllowed!==false||
    shadow.holdCandidateSummary?.tenantOrderGateModified!==false||
    shadow.holdCandidateSummary?.originalSourceHmacVerified!==false||
    shadow.unverifiedDoubleEntryJournal?.operationalPostingAllowed!==false||
    !Array.isArray(shadow.financialItems)||
    shadow.financialItems.length>MAX_INVOICES||
    shadow.financialItems.some(item=>
      !H.test(item.id||"")||item.operationalInvoicePaid!==false||
      item.bankMoneyAuthenticated!==false||item.releaseAuthorized!==false))
  fail("UNTRUSTED_SHADOW_VIEW");
 try{journalPolicy.verify(shadow.unverifiedDoubleEntryJournal,
    shadow.financialItems,shadow.sourceManifestDigest);}
 catch{fail("UNTRUSTED_SHADOW_JOURNAL");}
 return shadow;
}
module.exports={MODE,MAX_INVOICES,MAX_BANK_CLAIMS,issueCodes,hash,plan,digestShadow,safeView};
