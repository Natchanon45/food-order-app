"use strict";
// Synthetic, balanced double-entry SOURCE EXPORT PROJECTION.
// Financial labels intentionally say 'unverified' and 'advisory'.
// These are NOT payments and are NOT permitted in operational accounts.
const {createHash}=require("node:crypto");
const MAX=Number.MAX_SAFE_INTEGER;
const HEX=/^[a-f0-9]{64}$/;
const VERSION="m7_uat_unverified_double_entry_journal_v1";
const ACCOUNTS=Object.freeze({
 GROSS:"export_gross_invoice_advisory_dr",
 CREDIT:"export_applied_credit_unverified_cr",
 BANK:"export_bank_cash_reported_unverified_cr",
 RESIDUAL:"export_remaining_receivable_uncertified_cr",
});
const fail=code=>{throw Error("M7_UAT_JOURNAL_"+code);};
const digest=s=>createHash("sha256").update(s).digest("hex");
function build(rows,manifestDigest){
 if(!Array.isArray(rows)||rows.length>60||!HEX.test(manifestDigest||""))
  fail("BOUNDS");
 let totalDebit=0,totalCredit=0;
 const legs=[],seen=new Set();
 let previous=digest("m7-uat-financial-journal-genesis-v1:"+manifestDigest);
 for(const r of [...rows].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  if(!r||!HEX.test(r.id||"")||seen.has(r.id)||
    !["monthly","yearly","delivery_daily"].includes(r.kind))
   fail("INVOICE_SCOPE_OR_DUPLICATE");
  seen.add(r.id);
  const values=[r.grossCents,r.appliedCreditCents,
   r.sourceBankReportedCents,r.arithmeticResidualCents];
  if(values.some(n=>!Number.isSafeInteger(n)||n<0||n>MAX)||
    values[0]===0||values[1]+values[2]+values[3]!==values[0])
   fail("UNBALANCED_INVOICE");
  const credits=[
   [ACCOUNTS.CREDIT,values[1]],
   [ACCOUNTS.BANK,values[2]],
   [ACCOUNTS.RESIDUAL,values[3]],
  ].filter(([,amount])=>amount>0);
  const before=totalDebit;
  if(totalDebit>MAX-values[0]||totalCredit>MAX-values[0])fail("TOTAL_OVERFLOW");
  totalDebit+=values[0];totalCredit+=values[0];
  const content=JSON.stringify({invoiceDigest:r.id,kind:r.kind,
   status:r.state,values});
  const entryDigest=digest("m7-uat-financial-journal-entry-v1:"+
   previous+":"+content);
  const common={invoiceDigest:r.id,kind:r.kind,
   previousDigest:previous,entryDigest,
   sourceBankAuthenticated:false,operationalPosting:false};
  legs.push({...common,account:ACCOUNTS.GROSS,
   debitCents:values[0],creditCents:0});
  for(const [account,amount] of credits)
   legs.push({...common,account,debitCents:0,creditCents:amount});
  previous=entryDigest;
  if(totalDebit-before!==values[0])fail("IMBALANCED_SUM");
 }
 return Object.freeze({
  version:VERSION,manifestDigest,
  entryCount:seen.size,legCount:legs.length,
  totalDebitCents:totalDebit,totalCreditCents:totalCredit,
  closedDigest:previous,
  sourceBankAuthenticated:false,creditLiabilityCertified:false,
  operationalPostingAllowed:false,
  balancedProjectionOnly:true,
  legs:Object.freeze(legs),
 });
}
function verify(journal,rows,manifestDigest){
 if(!journal||journal.version!==VERSION||journal.manifestDigest!==manifestDigest||
    journal.sourceBankAuthenticated!==false||
    journal.creditLiabilityCertified!==false||
    journal.operationalPostingAllowed!==false||
    journal.balancedProjectionOnly!==true)
  fail("UNTRUSTED_VIEW");
 const expected=build(rows,manifestDigest);
 if(JSON.stringify(journal)!==JSON.stringify(expected))
  fail("INTEGRITY_CHANGED");
 return true;
}
module.exports={VERSION,ACCOUNTS,build,verify};
