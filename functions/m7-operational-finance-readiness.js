"use strict";
// Server-read-only UAT source-to-Firebase M7 finance gap inspection.
// Explicitly NOT operational cash posting, Service Credit, payment
// verification, invoice mutation or tenant suspension/recovery.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore}=require("firebase-admin/firestore");
const {actor}=require("./m7-stripe-test-shadow-history")._privateForTests;
const {ingressGate}=require("./m7-stripe-test-shadow-policy");
const policy=require("./m7-operational-readiness-policy");
const {tenant}=require("./m7-operational-credit-policy");
const opts={region:"asia-southeast1",timeoutSeconds:45};
const fail=(code,message)=>new HttpsError(code,message);
function input(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||
    Object.keys(data).length!==1||typeof data.tenantId!=="string")
  throw fail("invalid-argument","M7_FINANCE_READINESS_SELECTOR_INVALID");
 try{tenant(data.tenantId);}catch{
  throw fail("invalid-argument","M7_FINANCE_READINESS_TENANT_INVALID");
 }
 return data.tenantId;
}
function gate(env=process.env){
 const allowed=ingressGate(env);
 // Bank/credit posting never activated by the Stripe TEST pilot flag.
 return allowed?.tenantId||"";
}
async function inspect({db,auth,data,allowedTenant=gate()}){
 const tenantId=input(data);
 const uid=auth?.uid;
 if(!uid)throw fail("unauthenticated","Sign-in required");
 const user=await actor(db,auth);
 if(user.role!=="super_admin")throw fail("permission-denied","Superadmin required");
 if(!allowedTenant||allowedTenant!==tenantId)
  throw fail("failed-precondition","M7_FINANCE_READINESS_UAT_ONLY");
 const tenantRef=db.collection("tenants").doc(tenantId);
 const [tenantSnap,docs,attemptSnap,adjustSnap,shadowSnap]=await Promise.all([
  tenantRef.get(),
  tenantRef.collection("hybridBillingInvoices").orderBy("date","desc").limit(31).get(),
  tenantRef.collection("hybridBillingPaymentAttempts").limit(201).get(),
  tenantRef.collection("hybridBillingAdjustments").limit(201).get(),
  tenantRef.collection("m7StripeTestReservations").limit(201).get(),
 ]);
 if(!tenantSnap.exists)throw fail("not-found","Tenant not found");
 const selected=docs.docs.slice(0,30).map(x=>({...(x.data()||{}),id:x.id}));
 const attempts=attemptSnap.docs.slice(0,200).map(x=>({...(x.data()||{}),id:x.id}));
 const adjustments=adjustSnap.docs.slice(0,200).map(x=>x.data()||{});
 const shadows=shadowSnap.docs.slice(0,200).map(x=>x.data()||{});
 const ids=new Set(selected.map(x=>x.id));
 const paid=attempts.filter(x=>x.status==="paid"&&ids.has(x.invoiceId));
 const ref=paid.map(row=>tenantRef.collection("hybridBillingPaymentEvents")
  .doc(row.id+"-review"));
 const events=ref.length?await db.getAll(...ref):[];
 const reviews=Object.create(null);
 for(let i=0;i<paid.length;i++)reviews[paid[i].id]=events[i]?.data()||null;
 const partialHistory=docs.size>30||attemptSnap.size>200||
  adjustSnap.size>200||shadowSnap.size>200;
 const result=policy.report({tenantId,tenant:tenantSnap.data(),
  documents:selected,attempts,reviews,adjustments,shadows,partialHistory});
 // Only pre-approved diagnostic field names are present in result.
 // Deliberately avoid attaching user/payment/receipt/bank/stripe objects.
 return {...result,authenticated:true,superadminOnly:true};
}
exports.getPlatformM7OperationalFinanceReadiness=onCall(opts,async request=>{
 return inspect({db:getFirestore(),auth:request.auth,data:request.data});
});
exports._privateForTests={input,gate,inspect};
