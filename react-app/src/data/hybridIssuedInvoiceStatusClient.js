import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";

// Merchant's issued-invoice workspace. No direct raw Firestore invoice,
// reviewer note or verification object escapes into React.
const VALID=/^20\d{2}-\d{2}-\d{2}:(?:delivery:(?:trigger|20\d{2}-\d{2}-\d{2})|monthly:fixed)$/;
const STATES=new Set(["issued","pending_review","paid","rejected","needs_review"]);
const EVIDENCE=new Set(["not_submitted","pending_review","recorded_paid","rejected","needs_review"]);
const KINDS=new Set(["fixed_monthly","delivery_daily","delivery_threshold"]);
export function checkIssuedInvoicePage(payload,tenantId){
 if(payload?.ok!==true||payload.source!=="firebase_hybrid_issued_ledger"||
    payload.mode!=="issued_invoice_read_only"||
    payload.tenantId!==tenantId||payload.currency!=="THB"||
    payload.operationalBankReconciled!==false||
    payload.financialPostingEnabled!==false||
    payload.paymentSubmissionEnabled!==false||
    payload.tenantAccessChanged!==false||
    payload.writesPerformed!==false||
    typeof payload.hasMore!=="boolean"||
    !Array.isArray(payload.items)||payload.items.length>30||
    payload.hasMore&&(!VALID.test(payload.cursor||""))||
    !payload.hasMore&&payload.cursor!==null)
  throw Error("HYBRID_ISSUED_INVOICE_UNTRUSTED_PAGE");
 const seen=new Set();
 const items=payload.items.map(v=>{
  if(!v||!VALID.test(v.id||"")||seen.has(v.id)||
     !STATES.has(v.displayStatus)||
     !EVIDENCE.has(v.paymentStatus)||
     !KINDS.has(v.kind)||v.currency!=="THB"||
     typeof v.amount!=="number"||!Number.isFinite(v.amount)||
     v.amount<=0||!Number.isSafeInteger(v.invoiceAmountCents)||
     Math.round(v.amount*100)!==v.invoiceAmountCents||
     v.sourceM7BankReconciled!==false||
     v.independentBankStatementVerified!==false||
     v.operationalCashSettled!==false||
     v.canSubmitPayment!==false||v.canReleaseShop!==false||
     v.issuerSource!=="firebase_hybrid_issued_ledger"||
     typeof v.date!=="string"||
     !/^20\d\d-\d\d-\d\d$/.test(v.date)||
     v.canPrepareLocalFile!==(v.paymentStatus==="not_submitted"||
       v.paymentStatus==="rejected"))
   throw Error("HYBRID_ISSUED_INVOICE_UNTRUSTED_ITEM");
  seen.add(v.id);
  return {
   id:v.id,date:v.date,kind:v.kind,amount:v.amount,
   currency:v.currency,status:v.displayStatus,
   displayStatus:v.displayStatus,paymentStatus:v.paymentStatus,
   canPrepareLocalFile:v.canPrepareLocalFile,
   sourceM7BankReconciled:false,operationalCashSettled:false,
  };
 });
 return {items,cursor:payload.cursor||null,hasMore:payload.hasMore,
  source:payload.source,bankCashNotCertified:true};
}
export async function listOwnIssuedHybridInvoices({cursor=null,pageSize=20,
 expectedTenantId=""}={}){
 if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>30||
    cursor!==null&&!VALID.test(cursor))
  throw Error("HYBRID_ISSUED_INVOICE_BAD_SELECTOR");
 const request={limit:pageSize,...cursor?{cursor}:{}};
 const {data}=await httpsCallable(functions,
  "getOwnHybridIssuedInvoiceStatusPage")(request);
 if(!data?.tenantId||!/^[A-Za-z0-9_-]{3,160}$/.test(data.tenantId)||
    expectedTenantId&&data.tenantId!==expectedTenantId)
  throw Error("HYBRID_ISSUED_INVOICE_BAD_TENANT");
 return checkIssuedInvoicePage(data,data.tenantId);
}
export async function listPlatformIssuedHybridInvoices(tenantId,{
 cursor=null,pageSize=20}={}){
 if(!/^[A-Za-z0-9_-]{3,160}$/.test(tenantId||"")||
    !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>30||
    cursor!==null&&!VALID.test(cursor))
  throw Error("HYBRID_ISSUED_INVOICE_BAD_SELECTOR");
 const {data}=await httpsCallable(functions,
  "getPlatformHybridIssuedInvoiceStatusPage")({
   tenantId,limit:pageSize,...cursor?{cursor}:{},
  });
 return checkIssuedInvoicePage(data,tenantId);
}
