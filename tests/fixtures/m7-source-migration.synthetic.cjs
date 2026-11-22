"use strict";
// All IDs, hashes and amounts in this fixture are fictional, not source data.
const contract=require("../../functions/m7-source-migration-contract.js");
const H=c=>c.repeat(64);
const uuid=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const T="tenant-m7-fixture-uat";
function invoice(n,kind,cycle,gross,applied,bank,state){
 const invKey=H(String(n));
 return {tenant_id:T,id:uuid(n),invoice_key:invKey,kind,
 policy_version:"m7-finance-v1",source_snapshot_sha256:H("a"),
 immutable_invoice_sha256:H("b"),approved_beneficiary_sha256:H("c"),
 approved_pricing_sha256:H("d"),cycle_start_day:cycle,
 cycle_end_day:kind==="monthly"?"2026-11-17":"2026-12-17",
 business_day:cycle,due_bangkok_day:cycle,
 suspend_from_bangkok_day:cycle,gross_cents:gross,
 applied_service_credit_cents:applied,verified_bank_paid_cents:bank,
 currency:"THB",state,certified_by:"source-operator",
 last_version:2};
}
function fixture(){
 const monthlyA=invoice(1,"monthly","2026-10-18",50000,0,50000,"waived");
 const dailyB=invoice(2,"delivery_daily","2026-10-18",15220,15220,0,"settled_credit");
 const monthlyC=invoice(3,"monthly","2026-11-18",50000,34780,0,"issued");
 monthlyC.cycle_end_day="2026-12-17";
 const convId=uuid(4);
 const conversion={tenant_id:T,id:convId,cycle_start_date:"2026-10-18",
  paid_monthly_invoice_id:monthlyA.invoice_key,
  approved_monthly_price_cents:50000,paid_by_bank_cents:50000,
  used_previous_credit_cents:0,signed_delivery_goods_cents:1000001,
  signed_delivery_threshold_cents:1000000,
  source_invoice_digest:H("a"),certified_by:"source-operator"};
 const ce=(n,type,ref,cycle,amount,fields={})=>({
  tenant_id:T,id:uuid(n),account_sequence_no:n-4,
  event_type:type,reference_invoice_id:ref,
  cycle_start_date:cycle,amount_cents:amount,
  verified_source_digest:H("a"),actor_id:"source-operator",...fields});
 const attemptId=uuid(8),holdId=uuid(9);
 const attempts=[{tenant_id:T,id:attemptId,invoice_key:monthlyA.invoice_key,
  invoice_kind:"monthly",immutable_invoice_snapshot_sha256:H("b"),
  approved_beneficiary_sha256:H("c"),gross_cents:50000,
  applied_service_credit_cents:0,bank_cash_due_cents:50000,
  slip_sha256:H("e"),source:"slip2go",state:"approved",
  independent_bank_statement_sha256:H("f")}];
 const tables={
  merchant_platform_invoice_journal:[monthlyA,dailyB,monthlyC],
  merchant_platform_invoice_adjustment_events:[{
   tenant_id:T,id:uuid(11),invoice_key:monthlyA.invoice_key,
   event_kind:"credit_reclassified",prior_snapshot_sha256:H("b"),
   proposed_snapshot_sha256:H("b"),authorization_sha256:H("d"),
   event_digest:H("e"),actor_id:"source-operator"}],
  merchant_service_credit_accounts:[{
   tenant_id:T,balance_cents:0,sequence_no:3}],
  merchant_service_credit_conversions:[conversion],
  merchant_service_credit_events:[
   ce(5,"monthly_payment_conversion",monthlyA.invoice_key,
     "2026-10-18",50000,{conversion_id:convId}),
   ce(6,"delivery_daily_offset",dailyB.invoice_key,
     "2026-10-18",15220,{target_invoice_gross_cents:15220}),
   ce(7,"monthly_renewal_offset",monthlyC.invoice_key,
     "2026-11-18",34780,{target_invoice_gross_cents:50000}),
  ],
  merchant_platform_payment_attempts:attempts,
  merchant_platform_bank_reference_claims:[{
   ref_sha256:H("e"),payment_attempt_id:attemptId,
   invoice_key:monthlyA.invoice_key}],
  merchant_payment_obligation_holds:[{
   tenant_id:T,id:holdId,invoice_key:monthlyC.invoice_key,
   obligation_kind:"monthly",cycle_start:"2026-11-18",
   due_bangkok_date:"2026-11-18",suspend_from_bangkok_date:"2026-11-18",
   gross_cents:50000,applied_service_credit_cents:34780,
   verified_bank_paid_cents:0,
   approved_financial_snapshot_sha256:H("b"),state:"open"}],
  merchant_payment_hold_events:[{
   tenant_id:T,id:uuid(10),hold_id:holdId,
   invoice_key:monthlyC.invoice_key,action:"opened",
   actor_id:"source-operator",event_sha256:H("f")}],
  merchant_m7_hold_policy_approvals:[{
   tenant_id:T,invoice_key:monthlyC.invoice_key,
   immutable_invoice_sha256:H("b"),
   cutoff_bangkok_day:"2026-11-19",due_bangkok_day:"2026-11-18",
   policy_version:"m7-finance-hold-v1",
   approved_by:"source-operator",approval_sha256:H("f")}],
 };
 return {
  version:contract.VERSION,tenantId:T,
  source:{
   sourceCommit:contract.SOURCE_COMMIT,
   sourceSchemaSha256:contract.SOURCE_SCHEMA_SHA256,
   holdSchemaSha256:contract.HOLD_SCHEMA_SHA256,
   capturedAtUtc:"2026-11-22T00:00:00.000Z",
   operatorAttestedReadOnly:true,
   inventory:Object.fromEntries(contract.TABLES.map(x=>[x,tables[x].length])),
  },tables,
 };
}
module.exports={fixture,H,uuid,T};
