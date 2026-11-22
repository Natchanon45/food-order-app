"use strict";
// Pure integer-satang port of Source Go merchant_service_credit_policy.go and
// merchant_service_credit_reclassification.go. NOT a money/posting service;
// callers MUST NOT treat caller booleans as bank/price/threshold authority.
const TENANT=/^[A-Za-z0-9_-]{3,160}$/;
const HEX=/^[a-f0-9]{64}$/;
const MAX=Number.MAX_SAFE_INTEGER; // Source Go maxSourceSafeCents = 9007199254740991
const CONVERT="monthly_payment_conversion";
const DAILY="delivery_daily_offset";
const MONTH="monthly_renewal_offset";
const REVERSE="monthly_renewal_reversal";
const KINDS=new Set([CONVERT,DAILY,MONTH,REVERSE]);
function fail(code){throw Error("M7_CREDIT_"+code);}
function cents(value,allowZero=false){
 if(!Number.isSafeInteger(value)||value<0||value>MAX||
    !allowZero&&value===0)fail("INVALID_INTEGER_SATANG");
 return value;
}
function day(value){
 if(typeof value!=="string"||!/^20\d\d-\d\d-\d\d$/.test(value)||
    !Number.isFinite(Date.parse(value+"T00:00:00.000Z"))||
    new Date(value+"T00:00:00.000Z").toISOString().slice(0,10)!==value)
  fail("INVALID_CYCLE");
 return value;
}
function tenant(value){
 if(!TENANT.test(value||""))fail("INVALID_TENANT");
 return value;
}
function hash(value){
 if(!HEX.test(value||""))fail("INVALID_INVOICE_REFERENCE");
 return value;
}
function chooseBilling({plan,trial,deliveryGoodsCents,thresholdCents,approvedPriceCents}){
 if(!["monthly","yearly"].includes(plan)||typeof trial!=="boolean")
  fail("BILLING_CHOICE_INVALID");
 cents(deliveryGoodsCents,true);cents(thresholdCents);cents(approvedPriceCents,true);
 const exceeded=deliveryGoodsCents>thresholdCents;
 const waived=plan==="monthly"&&(trial||exceeded);
 return Object.freeze({plan,trial,thresholdExceeded:exceeded,
  monthlyFeeWaived:waived,dailyDeliveryShareApplies:exceeded,
  membershipFeeCents:trial||waived?0:approvedPriceCents});
}
function balance(ledger){
 tenant(ledger?.tenantId);
 if(!Array.isArray(ledger.events)||ledger.events.length>1000)
  fail("EVENT_HISTORY_UNBOUNDED");
 let amount=0;
 const seen=new Set(),cycles=new Set();
 for(let i=0;i<ledger.events.length;i++){
  const e=ledger.events[i];
  if(!e||e.tenantId!==ledger.tenantId||!KINDS.has(e.kind))
   fail("EVENT_SCOPE_INVALID");
  hash(e.reference);day(e.cycleStart);cents(e.amountCents);
  const key=e.kind+":"+e.reference;
  if(seen.has(key))fail("DUPLICATE_EVENT");
  seen.add(key);
  if([CONVERT,MONTH,REVERSE].includes(e.kind)){
   const cycle=e.kind+":"+e.cycleStart;
   if(cycles.has(cycle))fail("DUPLICATE_MONTHLY_CYCLE");
   cycles.add(cycle);
  }
  if(e.kind===CONVERT){
   if(e.invoiceTotalCents!==0||amount>MAX-e.amountCents)fail("CONVERSION_OVERFLOW");
   amount+=e.amountCents;
  }else if(e.kind===REVERSE){
   cents(e.invoiceTotalCents);
   const matched=ledger.events.slice(0,i).some(p=>p.kind===MONTH&&
    p.reference===e.reference&&p.cycleStart===e.cycleStart&&
    p.amountCents===e.amountCents&&p.invoiceTotalCents===e.invoiceTotalCents);
   if(!matched||e.invoiceTotalCents<e.amountCents||
     amount>MAX-e.amountCents)fail("INVALID_REVERSAL");
   amount+=e.amountCents;
  }else{
   cents(e.invoiceTotalCents);
   if(e.invoiceTotalCents<e.amountCents||amount<e.amountCents)
    fail("OVERDRAWN");
   amount-=e.amountCents;
  }
 }
 return amount;
}
function copied(ledger,extra){
 return {tenantId:ledger.tenantId,events:[...ledger.events,...extra]};
}
function convertMonthly(ledger,grant){
 const original=balance(ledger);
 if(!grant||grant.tenantId!==ledger.tenantId||grant.plan!=="monthly"||
  grant.verifiedBankPayment!==true||grant.approvedPriceSnapshot!==true)
  fail("CONVERSION_UNVERIFIED");
 hash(grant.paidMonthlyInvoiceKey);day(grant.cycleStart);
 cents(grant.paidMonthlyCents);
 const choice=chooseBilling({plan:"monthly",trial:false,
  deliveryGoodsCents:grant.deliveryGoodsCents,
  thresholdCents:grant.thresholdCents,approvedPriceCents:grant.paidMonthlyCents});
 if(!choice.thresholdExceeded)fail("THRESHOLD_NOT_EXCEEDED");
 const event={kind:CONVERT,tenantId:ledger.tenantId,
  reference:grant.paidMonthlyInvoiceKey,cycleStart:grant.cycleStart,
  amountCents:grant.paidMonthlyCents,invoiceTotalCents:0};
 for(const entry of ledger.events){
  if(entry.kind===CONVERT&&entry.cycleStart===grant.cycleStart){
   if(Object.keys(event).every(k=>entry[k]===event[k]))return copied(ledger,[]);
   fail("CONVERSION_CONFLICT");
  }
  if(entry.kind===REVERSE&&entry.cycleStart===grant.cycleStart)
   fail("CYCLE_ALREADY_RECLASSIFIED");
 }
 if(original>MAX-grant.paidMonthlyCents)fail("OVERFLOW");
 const next=copied(ledger,[event]);balance(next);return next;
}
function applyOffset(ledger,request){
 const original=balance(ledger);
 if(!request||request.tenantId!==ledger.tenantId||
  !["delivery_daily","monthly_renewal"].includes(request.kind)||
  request.invoiceCertified!==true||request.invoiceIssued!==true)
  fail("TARGET_NOT_CERTIFIED");
 hash(request.targetInvoiceKey);day(request.cycleStart);cents(request.grossChargeCents);
 const kind=request.kind==="delivery_daily"?DAILY:MONTH;
 for(const e of ledger.events){
  if(kind===MONTH&&e.kind===MONTH&&e.cycleStart===request.cycleStart&&
     e.reference!==request.targetInvoiceKey)fail("MONTH_ALREADY_USED");
  if(e.reference===request.targetInvoiceKey){
   if(e.kind!==kind||e.cycleStart!==request.cycleStart||
      e.invoiceTotalCents!==request.grossChargeCents)fail("TARGET_REUSED");
   return {ledger:copied(ledger,[]),
    appliedCents:e.amountCents,remainingCashDueCents:request.grossChargeCents-e.amountCents,
    availableCreditCents:original,fullyCoveredByCredit:e.amountCents===request.grossChargeCents,
    reused:true};
  }
 }
 const used=Math.min(original,request.grossChargeCents);
 const outcome={appliedCents:used,
  remainingCashDueCents:request.grossChargeCents-used,
  availableCreditCents:original-used,
  fullyCoveredByCredit:used===request.grossChargeCents,reused:false};
 if(used===0)return {...outcome,ledger:copied(ledger,[])};
 const entry={kind,tenantId:ledger.tenantId,reference:request.targetInvoiceKey,
  cycleStart:request.cycleStart,amountCents:used,
  invoiceTotalCents:request.grossChargeCents};
 const next=copied(ledger,[entry]);balance(next);
 return {...outcome,ledger:next};
}
function reclassifyMonthly(ledger,input){
 balance(ledger);
 if(!input||input.tenantId!==ledger.tenantId||
  input.monthlyInvoiceFullyPaid!==true||
  input.approvedPriceSnapshot!==true)
  fail("RECLASSIFICATION_SOURCE_UNVERIFIED");
 hash(input.paidMonthlyInvoiceKey);day(input.cycleStart);
 cents(input.monthlyGrossCents);
 cents(input.paidByBankCents,true);
 if(input.paidByBankCents>input.monthlyGrossCents||
    input.paidByBankCents>0&&input.bankPaymentVerified!==true)
  fail("RECLASSIFICATION_BANK_UNVERIFIED");
 if(!chooseBilling({plan:"monthly",trial:false,
  deliveryGoodsCents:input.cycleDeliveryGoodsCents,
  thresholdCents:input.thresholdCents,
  approvedPriceCents:input.monthlyGrossCents}).thresholdExceeded)
   fail("RECLASSIFICATION_THRESHOLD_NOT_EXCEEDED");
 let spent=0,grantFound=false,reversed=false;
 for(const e of ledger.events.filter(e=>e.cycleStart===input.cycleStart)){
  if(e.kind===MONTH){
   if(e.reference!==input.paidMonthlyInvoiceKey||
      e.invoiceTotalCents!==input.monthlyGrossCents)fail("WRONG_MONTH_INVOICE");
   spent=e.amountCents;
  }
  if(e.kind===CONVERT){
   if(e.reference!==input.paidMonthlyInvoiceKey||
      e.amountCents!==input.paidByBankCents)fail("DUPLICATE_CONVERSION");
   grantFound=true;
  }
  if(e.kind===REVERSE){
   if(e.reference!==input.paidMonthlyInvoiceKey)fail("DUPLICATE_CONVERSION");
   reversed=true;
  }
 }
 if(spent+input.paidByBankCents!==input.monthlyGrossCents)
  fail("RECLASSIFICATION_NOT_FULLY_SETTLED");
 if((grantFound||reversed)&&
   (grantFound!==(input.paidByBankCents>0)||
    reversed!==(spent>0)))
  fail("PARTIAL_RECLASSIFICATION");
 if(grantFound||reversed)return copied(ledger,[]);
 const added=[];
 if(input.paidByBankCents>0)added.push({
  kind:CONVERT,tenantId:ledger.tenantId,reference:input.paidMonthlyInvoiceKey,
  cycleStart:input.cycleStart,amountCents:input.paidByBankCents,invoiceTotalCents:0,
 });
 if(spent>0)added.push({
  kind:REVERSE,tenantId:ledger.tenantId,reference:input.paidMonthlyInvoiceKey,
  cycleStart:input.cycleStart,amountCents:spent,invoiceTotalCents:input.monthlyGrossCents,
 });
 const next=copied(ledger,added);balance(next);return next;
}
function carryForward(ledger,nextCycle){
 day(nextCycle);
 if(ledger?.events?.some(e=>nextCycle<e.cycleStart))fail("BACKDATED_ROLLOVER");
 return balance(ledger);
}
function invoiceResidual({kind,grossCents,appliedCreditCents,verifiedBankPaidCents,status}){
 if(!["monthly","yearly","delivery_daily"].includes(kind))fail("INVOICE_KIND_INVALID");
 cents(grossCents);cents(appliedCreditCents,true);cents(verifiedBankPaidCents,true);
 if(kind==="yearly"&&appliedCreditCents>0||
   appliedCreditCents+verifiedBankPaidCents>grossCents)
  fail("INVOICE_MONEY_CONFLICT");
 const due=grossCents-appliedCreditCents-verifiedBankPaidCents;
 if(["paid","settled_credit"].includes(status)&&due!==0)
  fail("PAID_WITH_REMAINING_DEBT");
 if(["issued","pending_review","pending_manual_review","rejected"].includes(status)&&due===0)
  fail("UNPAID_WITH_ZERO_DEBT");
 if(!["paid","settled_credit","issued","pending_review","pending_manual_review",
  "rejected","waived","voided"].includes(status))
  fail("INVOICE_STATUS_INVALID");
 return {grossCents,appliedCreditCents,verifiedBankPaidCents,
  bankCashDueCents:due,fullySettled:due===0};
}
module.exports={CONVERT,DAILY,MONTH,REVERSE,MAX,cents,day,tenant,hash,
 chooseBilling,balance,convertMonthly,applyOffset,reclassifyMonthly,
 carryForward,invoiceResidual};
