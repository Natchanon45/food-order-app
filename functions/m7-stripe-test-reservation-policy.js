"use strict";
// Isolated Stripe M7 quote reservation. No provider request or customer
// charge. Settlement is deliberately disconnected until the full M7
// accounting/credit conversion and signed webhook writer is available.
const {createHash}=require("node:crypto");
const {LEDGER_VERSION}=require("./hybrid-billing-ledger");
const {validInvoiceId,satang}=require("./hybrid-billing-payment-policy");
const TENANT=/^[A-Za-z0-9_-]{3,160}$/;
const HEX=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const MAX_ATTEMPTS=25;
const PREPAID_FIELDS=["appliedServiceCreditCents","appliedServiceCredit",
 "appliedServiceCreditAmount","appliedCreditCents","appliedCredit",
 "creditAppliedCents","creditApplied","serviceCreditApplied",
 "serviceCreditAmount","serviceCreditUsed","bankPaidCents",
 "bankPaidAmount","verifiedBankPaidCents","verifiedBankCashCents",
 "verifiedBankPaidAmount","paidAmount","prepaidCents",
 "hasUnresolvedCorrection","hasPendingAdjustment","pendingPaymentReview"];
function anyPrepaid(invoice){
 return PREPAID_FIELDS.some(k=>{
  const v=invoice?.[k];
  return v!==undefined&&v!==null&&v!==false&&v!==0&&v!=="0"&&v!=="";
 });
}
function testTenant(env=process.env){
 const p=String(env.GCLOUD_PROJECT||env.GCP_PROJECT||env.GOOGLE_CLOUD_PROJECT||"");
 const tenantId=String(env.PENGUIN_M7_STRIPE_TEST_TENANT_ID||"");
 if(!p||p==="penguin-food"||p==="penguin-food-prod"||
    p==="penguin-food-production"||p.startsWith("demo-")||
    p!==env.PENGUIN_M7_STRIPE_TEST_PROJECT_ID||
    !/(?:^|[-_])(?:uat|test)(?:$|[-_])/i.test(p)||
    env.FUNCTIONS_EMULATOR==="true"||env.FIRESTORE_EMULATOR_HOST||
    env.FIREBASE_AUTH_EMULATOR_HOST||
    env.PENGUIN_M7_STRIPE_TEST_RESERVATIONS_ENABLED!=="1"||
    env.PENGUIN_M7_STRIPE_TEST_SETTLEMENT_ENABLED==="1"||
    env.PENGUIN_M7_STRIPE_LIVE_ENABLED==="1"||
    !TENANT.test(tenantId))return "";
 return tenantId;
}
function invoiceKey(id){
 validInvoiceId(id);return id;
}
function quote(invoice,id,tenantId){
 invoiceKey(id);
 if(!invoice||typeof invoice!=="object"||invoice.id!==id||
    invoice.version!==LEDGER_VERSION||invoice.tenantId!=null&&invoice.tenantId!==tenantId||
    !HEX.test(invoice.signature||"")||!["issued","rejected"].includes(invoice.status)||
    invoice.paidAttemptId||invoice.pendingAttemptId||
    anyPrepaid(invoice))throw Error("M7_STRIPE_TEST_INVOICE_UNPAYABLE");
 const cents=satang(invoice.amount);
 if(cents<1000||cents>99999999)throw Error("M7_STRIPE_TEST_AMOUNT_OUT_OF_RANGE");
 const kind=invoice.kind==="fixed_monthly"?"monthly":
   ["delivery_threshold","delivery_daily"].includes(invoice.kind)?"delivery_daily":"";
 if(!kind||kind==="monthly"&&!id.endsWith(":monthly:fixed")||
    kind==="delivery_daily"&&!id.includes(":delivery:"))throw Error("M7_STRIPE_TEST_KIND_MISMATCH");
 return Object.freeze({tenantId,invoiceId:id,invoiceSignature:invoice.signature,amountSatang:cents,kind,
  currency:"THB",mode:"test"});
}
function lockId(tenantId,invoiceId){
 return createHash("sha256").update("m7-stripe-test-quote-v1:"+tenantId+":"+invoiceId).digest("hex");
}
function validatePrior(prior,tenantId,invoiceId,expected){
 if(!prior||prior.tenantId!==tenantId||prior.invoiceId!==invoiceId||
    prior.invoiceSignature!==expected.invoiceSignature||prior.amountSatang!==expected.amountSatang||
    prior.kind!==expected.kind||prior.mode!=="test"||
    !UUID.test(prior.attemptId||"")||!Number.isSafeInteger(prior.attemptNo)||
    prior.attemptNo<1||prior.attemptNo>MAX_ATTEMPTS)return false;
 return true;
}
function publicQuote(record){
 if(!record)return null;
 return {invoiceId:record.invoiceId,kind:record.kind,amountSatang:record.amountSatang,
  currency:"THB",mode:"test",attemptId:record.attemptId,attemptNo:record.attemptNo,
  status:record.status,providerCheckoutCreated:false,checkoutUrl:"",settled:false,
  checkoutEnabled:false,settlementEnabled:false};
}
function blockOriginalAttempts(docs){
 if(!Array.isArray(docs)||docs.length>MAX_ATTEMPTS)throw Error("M7_STRIPE_TEST_MANUAL_PROOF_HISTORY_UNAVAILABLE");
 for(const item of docs){
  const s=item.status;
  if(!["rejected"].includes(s))throw Error("M7_STRIPE_TEST_EXISTING_FINANCE_PROOF");
 }
}
module.exports={TENANT,HEX,UUID,MAX_ATTEMPTS,PREPAID_FIELDS,anyPrepaid,
 testTenant,invoiceKey,quote,lockId,
 validatePrior,publicQuote,blockOriginalAttempts};
