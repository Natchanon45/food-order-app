"use strict";
// Phase3AE SOURCE-ONLY, UNEXPORTED and DEMO-EMULATOR-ONLY.
// Captures an immutable *candidate witness* of a sealed day, NOT a certified
// invoice, provider payment, global Admin SDK fence or legal financial close.
const {createHash}=require("node:crypto");
const {FieldValue}=require("firebase-admin/firestore");
const {dateKey}=require("./hybrid-billing-core");
const {previewHybridJournalManifest,readFenceVersions}=
  require("./hybrid-billing-manifest-preview");
const {assertHybridEpochDemoOptIn,REGISTRY_DIGEST}=
  require("./hybrid-billing-writer-epoch-candidate");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const SHA=/^[a-f0-9]{64}$/;
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
function validDay(s){
 if(typeof s!=="string"||!DAY.test(s))return false;
 const d=new Date(s+"T00:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function safeMoney(n){
 return Number.isSafeInteger(n)&&n>=0&&n<=1000000000000;
}
function identity(tenantId,day){
 if(!ID.test(String(tenantId||""))||!validDay(day))
   throw Error("HYBRID_DEMO_DAY_MANIFEST_BAD_REQUEST");
}
function dayRef(t,day){
 return t.collection("hybridBillingDayCutoffCandidates").doc(day);
}
function manifestRef(t,day){
 return t.collection("hybridBillingDayManifestCandidates").doc(day);
}
function checkSealed(epoch,dayState,day){
 if(!epoch||epoch.registryDigest!==REGISTRY_DIGEST
   ||epoch.epoch!==1||epoch.status!=="open"
   ||epoch.candidateOnly!==true||epoch.coverageCertified!==false
   ||epoch.canIssueInvoice!==false||epoch.dayCutoffDemoDate!==day
   ||epoch.dayCutoffCandidateOnly!==true
   ||!dayState||dayState.day!==day||dayState.status!=="sealed"
   ||dayState.candidateOnly!==true||dayState.coverageCertified!==false
   ||dayState.canIssueInvoice!==false)
    throw Error("HYBRID_DEMO_DAY_MANIFEST_DAY_NOT_SEALED");
}
async function readCutoff(t,day){
 const [e,d]=await Promise.all([
  t.collection("hybridBillingEpochCandidates").doc("active").get(),
  dayRef(t,day).get()
 ]);
 checkSealed(e.exists?e.data():null,d.exists?d.data():null,day);
 return {epochRevision:e.updateTime?.toMillis(),dayRevision:d.updateTime?.toMillis()};
}
function validSourceEvent(id,event,tenantId){
 if(!event||event.tenantId!==tenantId
   ||typeof event.orderId!=="string"||!ID.test(event.orderId)
   ||!validDay(event.sourceDay)||event.currency!=="THB"
   ||!Number.isSafeInteger(event.shard)||event.shard<0||event.shard>=16
   ||!ID.test(event.actorUid||""))return false;
 const at=event.source==="hybrid_refund_bank_verified_server"
   ?event.refundAt:event.paidAt;
 if(typeof at?.toDate!=="function"||dateKey(at.toDate())!==event.sourceDay)
   return false;
 if(id==="cod-"+event.orderId
   &&event.source==="hybrid_cod_cashier_server")
    return safeMoney(event.grossCents)&&safeMoney(event.merchandiseCents)
      &&event.paidAt?.toMillis?.()!==undefined;
 if(id==="bank-"+event.orderId
   &&event.source==="hybrid_promptpay_bank_verified_server")
    return safeMoney(event.grossCents)&&safeMoney(event.merchandiseCents)
      &&SHA.test(event.referenceHash||"")&&SHA.test(event.evidenceSha256||"")
      &&event.paidAt?.toMillis?.()!==undefined;
 if(id==="refund-"+event.orderId
   &&event.source==="hybrid_refund_bank_verified_server")
    return safeMoney(event.refundCents)&&event.refundCents>0
      &&SHA.test(event.referenceHash||"")&&SHA.test(event.evidenceSha256||"")
      &&event.refundAt?.toMillis?.()!==undefined;
 if(id.startsWith("refundpart-"+event.orderId+"-")
   &&event.source==="hybrid_refund_bank_verified_server")
    return Number.isSafeInteger(event.sequence)&&event.sequence>=2
      &&id==="refundpart-"+event.orderId+"-"+String(event.sequence).padStart(6,"0")
      &&safeMoney(event.refundCents)&&event.refundCents>0
      &&SHA.test(event.referenceHash||"")&&SHA.test(event.evidenceSha256||"")
      &&SHA.test(event.digest||"")&&event.refundAt?.toMillis?.()!==undefined;
 return false;
}
function eventWitness(id,event){
 return [id,event.tenantId,event.orderId,event.source,event.shard,event.sourceDay,
  event.actorUid,event.currency,event.grossCents??null,
  event.merchandiseCents??null,event.refundCents??null,
  event.sequence??null,event.referenceHash??null,event.evidenceSha256??null,
  event.previousDigest??null,event.digest??null,
  event.paidAt?.toMillis?.()??null,event.refundAt?.toMillis?.()??null];
}
async function scanCandidateDayEvents({tenantRef,tenantId,day,pageSize,maxPages}){
 const col=tenantRef.collection("hybridBillingReceiptEvents");
 let after=null,hasMore=true,pages=0,totalEvents=0,dayEvents=0;
 let paymentCount=0,refundCount=0,dayGrossCents=0,dayRefundCents=0;
 const pageDigests=[];
 for(;pages<maxPages&&hasMore;pages++){
  let q=col.orderBy("__name__").limit(pageSize+1);
  if(after)q=q.startAfter(after);
  const snap=await q.get();
  if(!snap||!Array.isArray(snap.docs)||snap.docs.length>pageSize+1)
    throw Error("HYBRID_DEMO_DAY_MANIFEST_SCAN_INCOMPLETE");
  const docs=snap.docs.slice(0,pageSize);
  const witness=[];
  for(const d of docs){
   const event=d.data();
   if(!validSourceEvent(d.id,event,tenantId))
     throw Error("HYBRID_DEMO_DAY_MANIFEST_UNVERIFIED_EVENT");
   totalEvents++;
   if(event.sourceDay===day){
    dayEvents++;
    if(event.source==="hybrid_refund_bank_verified_server"){
      refundCount++;
      dayRefundCents+=event.refundCents;
    }else{
      paymentCount++;
      dayGrossCents+=event.grossCents;
    }
    if(!Number.isSafeInteger(dayGrossCents)||!Number.isSafeInteger(dayRefundCents))
      throw Error("HYBRID_DEMO_DAY_MANIFEST_OVERFLOW");
    witness.push(eventWitness(d.id,event));
   }
  }
  pageDigests.push(hash([after,docs.at(-1)?.id??null,witness]));
  hasMore=snap.docs.length>pageSize;
  after=hasMore?docs.at(-1)?.id:null;
  if(hasMore&&!after)throw Error("HYBRID_DEMO_DAY_MANIFEST_SCAN_INCOMPLETE");
 }
 if(hasMore)throw Error("HYBRID_DEMO_DAY_MANIFEST_PAGE_LIMIT");
 return {totalEvents,dayEvents,paymentCount,refundCount,dayGrossCents,
  dayRefundCents,eventPages:pages,
  eventsDigest:hash(["hybrid_day_events_candidate_v1",tenantId,day,pageDigests])};
}
async function previewHybridSealedDayManifestCandidate({
 db,tenantId,day,pageSize=100,maxPages=100
}={}){
 assertHybridEpochDemoOptIn(true);
 identity(tenantId,day);
 if(!db||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>200
  ||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>100)
   throw Error("HYBRID_DEMO_DAY_MANIFEST_BAD_REQUEST");
 const t=db.collection("tenants").doc(tenantId);
 const before=await readCutoff(t,day);
 const journal=await previewHybridJournalManifest({
  db,tenantId,pageSize,maxPages
 });
 if(journal.issueCount!==0)
   throw Error("HYBRID_DEMO_DAY_MANIFEST_UNRECONCILED");
 const events=await scanCandidateDayEvents({
  tenantRef:t,tenantId,day,pageSize,maxPages
 });
 const fenceSum=journal.fenceVersions.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(fenceSum)||events.totalEvents!==fenceSum)
   throw Error("HYBRID_DEMO_DAY_MANIFEST_EVENT_FENCE_MISMATCH");
 const after=await readCutoff(t,day);
 if(before.dayRevision!==after.dayRevision
   ||before.epochRevision!==after.epochRevision)
   throw Error("HYBRID_DEMO_DAY_MANIFEST_DAY_CHANGED");
 const finalFences=await readFenceVersions(t);
 if(finalFences.some((v,i)=>v!==journal.fenceVersions[i]))
   throw Error("HYBRID_DEMO_DAY_MANIFEST_WRITER_RACE");
 return {tenantId,day,...events,scannedPaidOrders:journal.scanned,
  journalRootDigest:journal.rootDigest,journalFenceVersions:journal.fenceVersions,
  candidateDigest:hash(["hybrid_day_manifest_candidate_v1",tenantId,day,
   journal.rootDigest,journal.fenceVersions,events.eventsDigest,
   events.dayEvents,events.dayGrossCents,events.dayRefundCents]),
  sourceCompletenessProven:false,immutableFinancialDayManifest:false,
  coverageCertified:false,canIssueInvoice:false};
}
// Permanent candidate snapshot is CREATE-ONLY; it cannot certify real money.
// Transaction rechecks epoch and day revisions, the same 16 fences and
// already-created candidate ID, then creates a one-time witness.
async function freezeHybridSealedDayManifestCandidate({
 db,tenantId,day,reviewerUid,pageSize=100,maxPages=100
}={}){
 assertHybridEpochDemoOptIn(true);
 identity(tenantId,day);
 if(!db||!ID.test(String(reviewerUid||"")))
  throw Error("HYBRID_DEMO_DAY_MANIFEST_BAD_REQUEST");
 const witness=await previewHybridSealedDayManifestCandidate({
  db,tenantId,day,pageSize,maxPages
 });
 const t=db.collection("tenants").doc(tenantId);
 const e=t.collection("hybridBillingEpochCandidates").doc("active");
 const d=dayRef(t,day),m=manifestRef(t,day);
 const user=db.collection("users").doc(reviewerUid);
 return db.runTransaction(async tx=>{
  const [tenant,actor,epoch,daySnap,existing]=await Promise.all([
   tx.get(t),tx.get(user),tx.get(e),tx.get(d),tx.get(m)
  ]);
  if(!actor.exists||actor.data()?.role!=="super_admin"
    ||actor.data()?.active!==true)
    throw Error("HYBRID_DEMO_DAY_MANIFEST_SUPER_ADMIN_REQUIRED");
  if(!tenant.exists||tenant.data()?.billingPolicyVersion!=="hybrid_v1"
    ||tenant.data()?.hybridBillingEnabled!==true)
    throw Error("HYBRID_DEMO_DAY_MANIFEST_NOT_HYBRID");
  checkSealed(epoch.data(),daySnap.data(),day);
  if(existing.exists)throw Error("HYBRID_DEMO_DAY_MANIFEST_ALREADY_FROZEN");
  const current=await Promise.all(Array.from({length:16},(_,i)=>
   tx.get(t.collection("hybridBillingReceiptFences").doc(
    "shard-"+String(i).padStart(2,"0")))));
  for(let i=0;i<16;i++){
   const version=current[i].exists?current[i].data()?.version:0;
   if(version!==witness.journalFenceVersions[i])
    throw Error("HYBRID_DEMO_DAY_MANIFEST_WRITER_RACE");
  }
  tx.create(m,{...witness,reviewerUid,candidateOnly:true,
    frozenAt:FieldValue.serverTimestamp()});
  return {...witness,frozen:true};
 });
}
// Always re-preview before reporting equality; bypassing Admin writers may
// later invalidate source/journal integrity even after this candidate freeze.
async function recheckHybridFrozenDayManifestCandidate({
 db,tenantId,day,pageSize=100,maxPages=100
}={}){
 assertHybridEpochDemoOptIn(true);
 identity(tenantId,day);
 if(!db)throw Error("HYBRID_DEMO_DAY_MANIFEST_BAD_REQUEST");
 const t=db.collection("tenants").doc(tenantId),ref=manifestRef(t,day);
 const prior=await ref.get();
 if(!prior.exists||prior.data()?.candidateOnly!==true
   ||prior.data()?.coverageCertified!==false
   ||prior.data()?.canIssueInvoice!==false)
   throw Error("HYBRID_DEMO_DAY_MANIFEST_NOT_FROZEN");
 const candidate=await previewHybridSealedDayManifestCandidate({
  db,tenantId,day,pageSize,maxPages
 });
 const after=await ref.get();
 if(!after.exists||after.updateTime?.toMillis()!==prior.updateTime?.toMillis()
   ||candidate.candidateDigest!==prior.data()?.candidateDigest)
   throw Error("HYBRID_DEMO_DAY_MANIFEST_CHANGED_AFTER_FREEZE");
 return {...candidate,unchanged:true,sourceCompletenessProven:false,
  immutableFinancialDayManifest:false,coverageCertified:false,canIssueInvoice:false};
}
module.exports={previewHybridSealedDayManifestCandidate,
 freezeHybridSealedDayManifestCandidate,recheckHybridFrozenDayManifestCandidate};
