// READ-ONLY canonical-activation calendar contract for Superadmin tenant cards.
// Calendar facts from tenants.first_activated_on never certify enrollment
// pricing, bank transfer, invoices or collection entitlement.
const day=(s)=>{
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const date=new Date(s+"T12:00:00Z");
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===s;
};
export function normalizeTenantActivationCalendar(raw){
 if(!raw || typeof raw!=="object" || Array.isArray(raw) ||
    raw.source!=="tenants.first_activated_on" ||
    !["activation_missing","before_activation","free_first_month","post_trial"].includes(raw.status) ||
    !day(raw.asOfBangkokDay) ||
    raw.financiallyCertified!==false || raw.canIssueRealInvoice!==false ||
    raw.canSettleMoney!==false || raw.canReleaseTenant!==false)
  throw Error("TENANT_ACTIVATION_CALENDAR_UNTRUSTED");
 const plan=raw.planCode;
 if(plan!==null && plan!=="monthly"&&plan!=="yearly")
  throw Error("TENANT_ACTIVATION_PLAN_UNKNOWN");
 const keys=["firstActivatedOn","trialStartDay","trialEndDay","deliveryCycleStartDay",
   "deliveryCycleEndDay","nextResetDay","yearlyPaidTermStartDay","yearlyPaidTermEndDay"];
 for(const k of keys)if(raw[k]!==null && !day(raw[k]))
  throw Error("TENANT_ACTIVATION_DATE_INVALID");
 if(raw.status==="activation_missing"){
  if(keys.some(k=>raw[k]!==null))throw Error("TENANT_ACTIVATION_UNEXPECTED_DATA");
 }else{
  if(!raw.firstActivatedOn||raw.trialStartDay!==raw.firstActivatedOn||
      !raw.trialEndDay||raw.trialEndDay<raw.trialStartDay)
   throw Error("TENANT_ACTIVATION_INCOMPLETE");
  if(raw.status==="before_activation"){
   if(raw.asOfBangkokDay>=raw.firstActivatedOn || raw.deliveryCycleStartDay!==null ||
      raw.deliveryCycleEndDay!==null ||raw.nextResetDay!==null)
    throw Error("TENANT_ACTIVATION_FUTURE_CYCLE");
  }else{
   if(!raw.deliveryCycleStartDay||!raw.deliveryCycleEndDay||!raw.nextResetDay||
      raw.deliveryCycleStartDay>raw.asOfBangkokDay||
      raw.deliveryCycleEndDay<raw.asOfBangkokDay||
      raw.nextResetDay<=raw.deliveryCycleEndDay||
      raw.deliveryCycleStartDay<raw.firstActivatedOn)
    throw Error("TENANT_ACTIVATION_CYCLE_INVALID");
   if(raw.status==="free_first_month"&&raw.asOfBangkokDay>raw.trialEndDay)
    throw Error("TENANT_ACTIVATION_TRIAL_INVALID");
   if(raw.status==="post_trial"&&raw.asOfBangkokDay<=raw.trialEndDay)
    throw Error("TENANT_ACTIVATION_TRIAL_INVALID");
  }
 }
 if(plan!=="yearly" && (raw.yearlyPaidTermStartDay!==null||raw.yearlyPaidTermEndDay!==null))
  throw Error("TENANT_ACTIVATION_YEARLY_UNEXPECTED");
 if(raw.yearlyPaidTermStartDay!==null &&
   (!raw.yearlyPaidTermEndDay||raw.yearlyPaidTermStartDay>raw.yearlyPaidTermEndDay))
  throw Error("TENANT_ACTIVATION_YEARLY_INVALID");
 return raw;
}
export function tenantCalendarLabel(dayValue,locale){
 if(!dayValue)return "—";
 if(!day(dayValue))return "—";
 // UI-only dd/mm/yyyy, with the Buddhist year for Thai locale to match
 // the existing Superadmin calendar. API/SQL still use canonical ISO days.
 const [y,m,d]=dayValue.split("-");
 const year=(locale||"th-TH").toLowerCase().startsWith("th")
  ?String(Number(y)+543):y;
 return d+"/"+m+"/"+year;
}
