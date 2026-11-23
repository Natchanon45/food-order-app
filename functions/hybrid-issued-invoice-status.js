"use strict";
// Actual Firebase Hybrid issued-invoice READ module; not a M7 Source cash
// confirmation. Use the same read-only Firestore transaction for the page,
// linked payment attempt and immutable reviewer event.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore}=require("firebase-admin/firestore");
const policy=require("./hybrid-issued-invoice-status-policy");
const opts={region:"asia-southeast1",timeoutSeconds:60,
 memory:"256MiB"};
const fail=(code,message)=>{throw new HttpsError(code,message);};
async function readPage({db,auth,data,scope="merchant"}){
 const uid=auth?.uid;
 if(!uid||!policy.TENANT.test(uid))
  fail("unauthenticated","HYBRID_INVOICE_LOGIN_REQUIRED");
 let selectors,selectedTenant;
 try{
  if(scope==="platform"){
   if(!data||Object.keys(data).some(k=>!
      ["tenantId","cursor","limit"].includes(k))||
      !policy.TENANT.test(data.tenantId||""))
    throw Error("BAD_PLATFORM_SCOPE");
   selectedTenant=data.tenantId;
   const {tenantId,...rest}=data;
   selectors=policy.validateRequest(rest);
  }else if(scope==="merchant"){
   selectors=policy.validateRequest(data);
  }else throw Error("BAD_API_SCOPE");
 }catch{
  fail("invalid-argument","HYBRID_INVOICE_INVALID_PAGE");
 }
 const user=await db.collection("users").doc(uid).get();
 const profile=user.data();
 if(!user.exists||profile?.active===false||
   scope==="platform"&&profile.role!=="super_admin"||
   scope==="merchant"&&(!policy.ROLES.has(profile.role)||
     !policy.TENANT.test(profile.tenantId||"")))
  fail("permission-denied","HYBRID_INVOICE_ROLE_NOT_ALLOWED");
 const tenantId=scope==="platform"?selectedTenant:profile.tenantId;
 const root=db.collection("tenants").doc(tenantId);
 const result=await db.runTransaction(async tx=>{
  const [actor,tenant]=await Promise.all([
   tx.get(db.collection("users").doc(uid)),tx.get(root)]);
  const p=actor.data();
  if(p?.active===false||!actor.exists||
    scope==="platform"&&p.role!=="super_admin"||
    scope==="merchant"&&(!policy.ROLES.has(p.role)||
      p.tenantId!==tenantId)||
    !tenant.exists)
   fail("permission-denied","HYBRID_INVOICE_TENANT_SCOPE_CHANGED");
  let q=root.collection("hybridBillingInvoices").orderBy("date","desc");
  if(selectors.cursor){
   const cursorSnap=await tx.get(root.collection("hybridBillingInvoices")
    .doc(selectors.cursor));
   if(!cursorSnap.exists||cursorSnap.data()?.tenantId!=null&&
     cursorSnap.data().tenantId!==tenantId)
    fail("failed-precondition","HYBRID_INVOICE_CURSOR_EXPIRED");
   q=q.startAfter(cursorSnap);
  }
  const query=await tx.get(q.limit(selectors.limit+1));
  const docs=query.docs.slice(0,selectors.limit);
  const related=docs.map(doc=>{
   const invoice=doc.data()||{};
   const id=invoice.status==="pending_review"?invoice.pendingAttemptId:
    invoice.status==="paid"?invoice.paidAttemptId:
    invoice.status==="rejected"?invoice.latestAttemptId:null;
   if(typeof id!=="string"||!/^[a-zA-Z0-9_-]{16,80}$/.test(id))
    return {doc,invoice,attemptRef:null,reviewRef:null};
   return {doc,invoice,
    attemptRef:root.collection("hybridBillingPaymentAttempts").doc(id),
    reviewRef:root.collection("hybridBillingPaymentEvents").doc(id+"-review")};
  });
  // Only financial record ids anchored to a matching selected Invoice are
  // followed. Read-only transaction gives a consistent snapshot.
  const allRefs=related.flatMap(x=>x.attemptRef?
    [x.attemptRef,x.reviewRef]:[]);
  const found=await Promise.all(allRefs.map(ref=>tx.get(ref)));
  const byPath=new Map(found.map((snap,i)=>[allRefs[i].path,snap]));
  const items=related.map(({doc,invoice,attemptRef,reviewRef})=>{
   const attempt=attemptRef&&byPath.get(attemptRef.path);
   const review=reviewRef&&byPath.get(reviewRef.path);
   try{return policy.present({tenantId,invoiceId:doc.id,invoice,
    attempt:attempt?.exists?attempt.data():null,
    review:review?.exists?review.data():null});}
   catch{
    // Stored invoice has unsafe/tampered fields, not an authoritative bill.
    // Fail closed as a page rather than rendering an untrusted amount.
    fail("failed-precondition","HYBRID_INVOICE_RECORD_NEEDS_REVIEW");
   }
  });
  return {ok:true,source:"firebase_hybrid_issued_ledger",
   mode:"issued_invoice_read_only",tenantId,
   currency:"THB",items,
   hasMore:query.size>selectors.limit,
   cursor:docs.length&&query.size>selectors.limit?docs.at(-1).id:null,
   operationalBankReconciled:false,
   financialPostingEnabled:false,
   paymentSubmissionEnabled:false,
   tenantAccessChanged:false,
   writesPerformed:false};
 });
 return result;
}
exports.getOwnHybridIssuedInvoiceStatusPage=onCall(opts,async request=>
 readPage({db:getFirestore(),auth:request.auth,data:request.data}));
exports.getPlatformHybridIssuedInvoiceStatusPage=onCall(opts,async request=>
 readPage({db:getFirestore(),auth:request.auth,data:request.data,
  scope:"platform"}));
exports._privateForTests={readPage};
