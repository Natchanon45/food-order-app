import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const p=require("../../functions/m7-operational-credit-policy");
const tid="tenant-parity",id=s=>s.repeat(64);
const origin=()=>({tenantId:tid,events:[]});
const grant=(cycle="2026-10-18",goods=1304400)=>({
 tenantId:tid,plan:"monthly",cycleStart:cycle,
 paidMonthlyInvoiceKey:id("a"),paidMonthlyCents:50000,
 deliveryGoodsCents:goods,thresholdCents:1000000,
 verifiedBankPayment:true,approvedPriceSnapshot:true});
const offset=(reference,charge,kind="delivery_daily",cycle="2026-10-18")=>({
 tenantId:tid,targetInvoiceKey:id(reference),grossChargeCents:charge,
 kind,cycleStart:cycle,invoiceCertified:true,invoiceIssued:true});
test("Go Source merchantChooseBilling trial/yearly/monthly 1,000,000-satang threshold exact",()=>{
 const cases=[
  ["monthly",true,0,0,false,true],
  ["monthly",true,1000000,0,false,true],
  ["monthly",true,1000001,0,true,true],
  ["monthly",false,1000000,50000,false,false],
  ["monthly",false,1000001,0,true,true],
  ["yearly",true,1000001,0,true,false],
  ["yearly",false,0,500000,false,false],
  ["yearly",false,1000001,500000,true,false],
 ];
 for(const [plan,trial,goods,expected,share,waive] of cases){
  const result=p.chooseBilling({plan,trial,deliveryGoodsCents:goods,
   thresholdCents:1000000,approvedPriceCents:plan==="yearly"?500000:50000});
  assert.equal(result.membershipFeeCents,expected);
  assert.equal(result.dailyDeliveryShareApplies,share);
  assert.equal(result.monthlyFeeWaived,waive);
 }
});
test("Go Source 500.00 credit, daily 152.20 / 100.00 / 300.00 exact satang, idempotent",()=>{
 let ledger=p.convertMonthly(origin(),grant());
 assert.equal(p.balance(ledger),50000);
 const duplicate=p.convertMonthly(ledger,grant());
 assert.equal(duplicate.events.length,1);
 for(const [ref,charge,used,due,after] of [
  ["b",15220,15220,0,34780],["c",10000,10000,0,24780],
  ["d",30000,24780,5220,0],
 ]){
  const request=offset(ref,charge),out=p.applyOffset(ledger,request);
  assert.equal(out.appliedCents,used);
  assert.equal(out.remainingCashDueCents,due);
  assert.equal(out.availableCreditCents,after);
  assert.equal(p.balance(out.ledger),after);
  const again=p.applyOffset(out.ledger,request);
  assert.equal(again.reused,true);
  assert.equal(again.appliedCents,used);
  assert.equal(again.ledger.events.length,out.ledger.events.length);
  ledger=out.ledger;
 }
 assert.equal(p.carryForward(ledger,"2026-11-18"),0);
 assert.deepEqual(p.balance(origin()),0);
});
test("Go Source rollover is not a new grant; monthly renewal uses remaining credit",()=>{
 let ledger=p.convertMonthly(origin(),grant("2026-10-18",1000001));
 ledger=p.applyOffset(ledger,offset("b",15220)).ledger;
 for(let i=0;i<3;i++)assert.equal(p.carryForward(ledger,"2026-11-18"),34780);
 const result=p.applyOffset(ledger,offset("c",50000,"monthly_renewal","2026-11-18"));
 assert.equal(result.appliedCents,34780);
 assert.equal(result.remainingCashDueCents,15220);
 assert.equal(result.availableCreditCents,0);
 assert.equal(p.balance(result.ledger),0);
 assert.throws(()=>p.carryForward(ledger,"2026-10-01"),/BACKDATED_ROLLOVER/);
});
test("Go Source paid monthly from existing credit PLUS verified bank restores both, never refund cash",()=>{
 const source=p.convertMonthly(origin(),grant("2026-10-18",1304400));
 const fromCredit=p.applyOffset(source,offset("b",20000,"monthly_renewal","2026-11-18")).ledger;
 assert.equal(p.balance(fromCredit),30000);
 const input={tenantId:tid,cycleStart:"2026-11-18",
  paidMonthlyInvoiceKey:id("b"),monthlyGrossCents:20000,
  paidByBankCents:0,cycleDeliveryGoodsCents:1000001,
  thresholdCents:1000000,monthlyInvoiceFullyPaid:true,
  bankPaymentVerified:false,approvedPriceSnapshot:true};
 const restored=p.reclassifyMonthly(fromCredit,input);
 assert.equal(restored.events.at(-1).kind,p.REVERSE);
 assert.equal(restored.events.at(-1).amountCents,20000);
 assert.equal(p.balance(restored),50000);
 assert.equal(p.reclassifyMonthly(restored,input).events.length,restored.events.length);
 // Bank portion + prior credit portion must reconstruct exact gross.
 const fresh=p.convertMonthly(origin(),grant("2026-10-18",1304400));
 const earlier=p.applyOffset(fresh,offset("d",10000,"delivery_daily","2026-10-18")).ledger;
 const partial=p.applyOffset(earlier,offset("c",50000,"monthly_renewal","2026-11-18")).ledger;
 const mixed=p.reclassifyMonthly(partial,{...input,paidMonthlyInvoiceKey:id("c"),
  monthlyGrossCents:50000,paidByBankCents:10000,bankPaymentVerified:true});
 assert.deepEqual(mixed.events.slice(-2).map(x=>x.kind),[p.CONVERT,p.REVERSE]);
 assert.equal(p.balance(mixed),50000);
 assert.equal(p.reclassifyMonthly(mixed,{...input,paidMonthlyInvoiceKey:id("c"),
  monthlyGrossCents:50000,paidByBankCents:10000,bankPaymentVerified:true}).events.length,
  mixed.events.length);
});
test("Go Source invalid proof, overdraw, cross-tenant, yearly, duplicate cycle and forged reversal fail-closed",()=>{
 for(const invalid of [
  {...grant(),plan:"yearly"},{...grant(),verifiedBankPayment:false},
  {...grant(),approvedPriceSnapshot:false},
  {...grant(),deliveryGoodsCents:1000000},
  {...grant(),tenantId:"foreign"},
 ]){
  assert.throws(()=>p.convertMonthly(origin(),invalid),/M7_CREDIT_/);
 }
 assert.throws(()=>p.applyOffset(origin(),offset("c",20000,"yearly")),/TARGET_NOT_CERTIFIED/);
 assert.equal(p.applyOffset(origin(),offset("c",20000)).remainingCashDueCents,20000);
 const ledger=p.convertMonthly(origin(),grant());
 const monthly=p.applyOffset(ledger,offset("b",12000,"monthly_renewal")).ledger;
 assert.throws(()=>p.applyOffset(monthly,offset("c",1000,"monthly_renewal")),/MONTH_ALREADY_USED/);
 assert.throws(()=>p.applyOffset(monthly,offset("b",11999,"monthly_renewal")),/TARGET_REUSED/);
 assert.throws(()=>p.balance({tenantId:tid,events:[{
  kind:p.REVERSE,tenantId:tid,reference:id("b"),cycleStart:"2026-10-18",
  amountCents:100,invoiceTotalCents:300,
 }]}),/INVALID_REVERSAL/);
 assert.throws(()=>p.reclassifyMonthly(monthly,{tenantId:tid,cycleStart:"2026-10-18",
  paidMonthlyInvoiceKey:id("b"),monthlyGrossCents:12000,paidByBankCents:2000,
  cycleDeliveryGoodsCents:1000001,thresholdCents:1000000,
  monthlyInvoiceFullyPaid:true,bankPaymentVerified:false,
  approvedPriceSnapshot:true}),/BANK_UNVERIFIED/);
 assert.throws(()=>p.balance({tenantId:tid,events:[{
  kind:p.DAILY,tenantId:tid,reference:id("d"),cycleStart:"2026-10-18",
  amountCents:1000,invoiceTotalCents:1000,
 }]}),/OVERDRAWN/);
});
test("source invoice gross = credit applied + bank paid + cash due; yearly cannot use credit",()=>{
 const input={kind:"monthly",grossCents:50000,
  appliedCreditCents:34780,verifiedBankPaidCents:0,status:"issued"};
 assert.deepEqual(p.invoiceResidual(input),{
  grossCents:50000,appliedCreditCents:34780,
  verifiedBankPaidCents:0,bankCashDueCents:15220,fullySettled:false});
 const fully=p.invoiceResidual({...input,verifiedBankPaidCents:15220,status:"paid"});
 assert.equal(fully.bankCashDueCents,0);
 assert.equal(fully.fullySettled,true);
 assert.throws(()=>p.invoiceResidual({...input,kind:"yearly"}),/MONEY_CONFLICT/);
 assert.throws(()=>p.invoiceResidual({...input,status:"paid"}),/PAID_WITH_REMAINING_DEBT/);
 assert.throws(()=>p.invoiceResidual({...input,verifiedBankPaidCents:15221}),/MONEY_CONFLICT/);
 assert.throws(()=>p.invoiceResidual({...input,grossCents:5.15}),/INVALID_INTEGER_SATANG/);
});
