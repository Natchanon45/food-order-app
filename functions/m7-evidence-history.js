"use strict";
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore}=require("firebase-admin/firestore");
const policy=require("./m7-evidence-history-policy");
const REGION="asia-southeast1";
const options={region:REGION,timeoutSeconds:45};
const INVOICE=/^20\d{2}-\d{2}-\d{2}:(?:delivery:(?:trigger|20\d{2}-\d{2}-\d{2})|monthly:fixed)$/;
const ID=/^[A-Za-z0-9_-]{3,160}$/;
const invalid=()=>new HttpsError("invalid-argument","M7_EVIDENCE_HISTORY_FILTER_INVALID");
async function actor(db,auth){
 const uid=auth?.uid;
 if(typeof uid!=="string"||!ID.test(uid))throw new HttpsError("unauthenticated","Sign-in required");
 const profile=(await db.collection("users").doc(uid).get()).data();
 if(!profile||profile.active!==true)throw new HttpsError("permission-denied","Active user required");
 return profile;
}
function selection(input){
 try{return policy.filters(input);}catch{throw invalid();}
}
async function history(db,tenantId,filter){
 if(!ID.test(tenantId))throw invalid();
 const tenantRef=db.collection("tenants").doc(tenantId);
 const tenant=await tenantRef.get();
 if(!tenant.exists)throw new HttpsError("not-found","Tenant not found");
 const name=String(tenant.data()?.name||tenantId).slice(0,120);
 const [hybrid,share]=await Promise.all([
  tenantRef.collection("hybridBillingPaymentAttempts").orderBy("submittedAt","desc").limit(201).get(),
  filter.kind==="platform"?Promise.resolve(null):
   tenantRef.collection("revenueSharePayments").orderBy("createdAt","desc").limit(201).get(),
 ]);
 const attempts=hybrid?.docs.slice(0,200)||[],legacy=share?.docs.slice(0,200)||[];
 const rows=[];
 const valid=attempts.filter(d=>INVOICE.test(String(d.data().invoiceId||"")));
 // Bound to 200 x 2 correlated documents and avoid a cross-tenant scan.
 const readRefs=valid.flatMap(d=>[
  tenantRef.collection("hybridBillingInvoices").doc(d.data().invoiceId),
  tenantRef.collection("hybridBillingPaymentEvents").doc(d.id+"-review"),
 ]);
 const related=readRefs.length?await db.getAll(...readRefs):[];
 const joins=new Map(valid.map((d,i)=>[d.id,{
  invoice:related[i*2]?.data()||null,review:related[i*2+1]?.data()||null,
 }]));
 for(const doc of attempts){
  const record=doc.data()||{},linked=joins.get(doc.id)||{};
  const row=policy.normalizeHybrid({tenantId,tenantName:name,attemptId:doc.id,
   attempt:record,invoice:linked.invoice,review:linked.review});
  if(row)rows.push(row);
 }
 for(const doc of legacy){
  const row=policy.normalizeShare({tenantId,tenantName:name,paymentId:doc.id,payment:doc.data()||{}});
  if(row)rows.push(row);
 }
 const truncated=(hybrid?.size||0)>200||(share?.size||0)>200;
 return {...policy.project(rows,filter,{truncated}),tenantId,
  boundedRead:true,maxPerSource:200,authenticated:true,readOnly:true};
}
exports.getOwnM7FinanceEvidenceHistory=onCall(options,async request=>{
 const db=getFirestore(),profile=await actor(db,request.auth);
 if(!["owner","admin"].includes(profile.role)||typeof profile.tenantId!=="string"||
    !ID.test(profile.tenantId))throw new HttpsError("permission-denied","Tenant finance admin only");
 // Reject any caller-supplied tenant selector even if it matches the
 // authenticated store. It makes cross-tenant replay attempts non-canonical.
 if(request.data&&Object.hasOwn(request.data,"tenantId"))throw invalid();
 const filter=selection(request.data);
 return history(db,profile.tenantId,filter);
});
exports.getPlatformM7FinanceEvidenceHistory=onCall(options,async request=>{
 const db=getFirestore(),profile=await actor(db,request.auth);
 if(profile.role!=="super_admin")throw new HttpsError("permission-denied","Superadmin only");
 const tenantId=request.data?.tenantId;
 if(typeof tenantId!=="string")throw invalid();
 const filter=selection(request.data);
 if(!tenantId)return {...policy.project([],filter),tenantId:"",
  selectTenant:true,boundedRead:true,maxPerSource:200,authenticated:true,readOnly:true};
 return history(db,tenantId,filter);
});
exports._privateForTests={actor,selection,history,INVOICE};
