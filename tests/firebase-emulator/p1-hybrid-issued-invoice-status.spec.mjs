import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
const source=createRequire(import.meta.url)("../../functions/hybrid-issued-invoice-status.js");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
   !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
 throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore();
const id="actual-hybrid-invoices-"+randomUUID().replace(/-/g,"").slice(0,12);
const other="foreign-hybrid-invoices-"+randomUUID().replace(/-/g,"").slice(0,12);
const ownerId="owner-"+randomUUID(),adminId="admin-"+randomUUID(),
 cashierId="cashier-"+randomUUID(),inactiveId="inactive-"+randomUUID(),
 foreignOwner="foreign-"+randomUUID(),superId="super-"+randomUUID();
const t=db.collection("tenants").doc(id);
const invoiceId="2026-11-18:monthly:fixed";
const paidId="2026-11-19:delivery:2026-11-18";
const pendingId="2026-11-20:delivery:2026-11-19";
const rejectedId="2026-11-21:monthly:fixed";
const corruptId="2026-11-22:monthly:fixed";
const signature="a".repeat(64),stamp=Timestamp.fromDate(new Date("2026-11-20T12:00:00.000Z"));
const auth=uid=>({uid});
const read=(uid=ownerId,data={})=>source._privateForTests.readPage({
 db,auth:auth(uid),data});
async function saveInvoice(docId,patch={}){
 await t.collection("hybridBillingInvoices").doc(docId).set({
  id:docId,version:"hybrid-invoice-v1",tenantId:id,
  kind:docId.endsWith(":monthly:fixed")?"fixed_monthly":"delivery_daily",
  signature,date:docId.slice(0,10),amount:590,status:"issued",
  ...patch,
 });
}
async function saveAttempt(recordId,invoiceKey,patch={}){
 await t.collection("hybridBillingPaymentAttempts").doc(recordId).set({
  id:recordId,tenantId:id,invoiceId:invoiceKey,invoiceSignature:signature,
  amount:590,status:"pending_review",submittedBy:ownerId,submittedAt:stamp,
  verification:{provider:"slip2go",bankVerified:true,
   referenceId:"SECRET_BANK_REFERENCE_NEVER_EXPOSE",transRef:"CONFIDENTIAL"},
  slipPath:"tenants/private/HIDE_ORIGINAL_SLIP_PATH",
  ...patch,
 });
}
async function saveReview(recordId,invoiceKey,patch={}){
 await t.collection("hybridBillingPaymentEvents").doc(recordId+"-review").set({
  invoiceId:invoiceKey,attemptId:recordId,tenantId:id,action:"approve",
  resultStatus:"paid",reviewerId:superId,reviewedAt:stamp,
  bankVerified:true,verifiedExternally:false,
  note:"SENSITIVE_BANK_ACCOUNT_DATA_SHOULD_NEVER_APPEAR",
  ...patch,
 });
}
test("issued Hybrid invoice is read from real tenant doc without proof/write; suspended owner can inspect own debt",async()=>{
 await Promise.all([
  t.set({active:false,hybridBillingSuspended:true,name:"TEST Suspended Merchant"}),
  db.collection("tenants").doc(other).set({active:true}),
  db.collection("users").doc(ownerId).set({active:true,role:"owner",tenantId:id}),
  db.collection("users").doc(adminId).set({active:true,role:"admin",tenantId:id}),
  db.collection("users").doc(cashierId).set({active:true,role:"cashier",tenantId:id}),
  db.collection("users").doc(inactiveId).set({active:false,role:"admin",tenantId:id}),
  db.collection("users").doc(foreignOwner).set({active:true,role:"owner",tenantId:other}),
  db.collection("users").doc(superId).set({active:true,role:"super_admin"}),
 ]);
 await saveInvoice(invoiceId);
 const original=(await t.collection("hybridBillingInvoices").doc(invoiceId).get()).data();
 const result=await read();
 assert.equal(result.ok,true);
 assert.equal(result.mode,"issued_invoice_read_only");
 assert.equal(result.source,"firebase_hybrid_issued_ledger");
 assert.equal(result.tenantId,id);
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].paymentStatus,"not_submitted");
 assert.equal(result.items[0].amount,590);
 assert.equal(result.items[0].canPrepareLocalFile,true);
 assert.equal(result.items[0].sourceM7BankReconciled,false);
 assert.equal(result.items[0].operationalCashSettled,false);
 assert.equal(result.items[0].canSubmitPayment,false);
 assert.equal(result.operationalBankReconciled,false);
 assert.equal(result.financialPostingEnabled,false);
 assert.equal(result.paymentSubmissionEnabled,false);
 assert.equal(result.tenantAccessChanged,false);
 assert.equal(result.writesPerformed,false);
 assert.equal((await t.collection("hybridBillingInvoices").doc(invoiceId).get()).data().status,"issued");
 assert.deepEqual((await t.collection("hybridBillingInvoices").doc(invoiceId).get()).data(),original);
});
test("pending, rejected, recorded paid with matching immutable reviewer proof, and tampered paid fail closed",async()=>{
 const paidAttempt="paidAttempt"+randomUUID().replace(/-/g,"");
 await saveInvoice(paidId,{status:"paid",paidAttemptId:paidAttempt,
  latestAttemptId:paidAttempt});
 await saveAttempt(paidAttempt,paidId,{status:"paid",reviewedBy:superId,reviewedAt:stamp});
 await saveReview(paidAttempt,paidId);
 const pendingAttempt="pendingAttempt"+randomUUID().replace(/-/g,"");
 await saveInvoice(pendingId,{status:"pending_review",pendingAttemptId:pendingAttempt,
  latestAttemptId:pendingAttempt});
 await saveAttempt(pendingAttempt,pendingId,{status:"pending_review"});
 const rejectedAttempt="rejectedAttempt"+randomUUID().replace(/-/g,"");
 await saveInvoice(rejectedId,{status:"rejected",latestAttemptId:rejectedAttempt});
 await saveAttempt(rejectedAttempt,rejectedId,{status:"rejected",reviewedBy:superId,reviewedAt:stamp});
 await saveReview(rejectedAttempt,rejectedId,{action:"reject",resultStatus:"rejected",
  note:"Rejected because account does not match"});
 await saveInvoice(corruptId,{status:"paid",paidAttemptId:"missingAttempt123456789",
  latestAttemptId:"missingAttempt123456789"});
 const result=await read(adminId);
 const statuses=Object.fromEntries(result.items.map(x=>[x.id,x.paymentStatus]));
 assert.equal(statuses[paidId],"recorded_paid");
 assert.equal(statuses[pendingId],"pending_review");
 assert.equal(statuses[rejectedId],"rejected");
 assert.equal(statuses[corruptId],"needs_review");
 const paid=result.items.find(i=>i.id===paidId);
 assert.equal(paid.operationalCashSettled,false);
 assert.equal(paid.sourceM7BankReconciled,false);
 assert.equal(paid.canPrepareLocalFile,false);
 assert.equal(result.items.find(i=>i.id===rejectedId).canPrepareLocalFile,true);
 const serialized=JSON.stringify(result);
 for(const raw of ["SECRET_BANK_REFERENCE","CONFIDENTIAL",
  "HIDE_ORIGINAL_SLIP_PATH","SENSITIVE_BANK_ACCOUNT_DATA",
  "paidAttempt","reviewerId","slipPath","verification",
  "attemptId",signature])
  assert.ok(!serialized.includes(raw),raw);
});
test("cursor paging is server-scoped, stable, duplicate-free; input cannot forge status, amount, tenant or role",async()=>{
 const extraKeys=[];
 for(let i=1;i<=24;i++){
  const day=String(i).padStart(2,"0");
  const name="2026-10-"+day+":delivery:2026-10-"+day;
  extraKeys.push(name);
  await saveInvoice(name,{kind:"delivery_daily",amount:15.25});
 }
 const seen=new Set(),pages=[];
 let cursor=null;
 do{
  const next=await read(ownerId,{limit:7,...cursor?{cursor}:{}});
  pages.push(next);
  for(const item of next.items){
   assert.equal(seen.has(item.id),false,"duplicate "+item.id);
   seen.add(item.id);
  }
  cursor=next.cursor;
  assert.equal(next.hasMore,Boolean(cursor));
 }while(cursor);
 assert.equal(seen.size,29);
 assert.equal(pages.at(-1).hasMore,false);
 assert.equal(pages.at(-1).cursor,null);
 for(const bad of [
  {tenantId:other},{amountSatang:1},{status:"paid"},
  {invoiceId:paidId},{cursor:"../../users"},
  {limit:31},{limit:0},{limit:5.5},
 ]){
  await assert.rejects(read(ownerId,bad),{code:"invalid-argument"});
 }
 for(const uid of [cashierId,inactiveId,superId])
  await assert.rejects(read(uid),{code:"permission-denied"});
 // A foreign merchant cannot supply the selected tenant and cannot see this
 // tenant's documents; ownership always comes from the server-side profile.
 const foreign=await read(foreignOwner);
 assert.equal(foreign.tenantId,other);
 assert.equal(foreign.items.length,0);
 await assert.rejects(source.getOwnHybridIssuedInvoiceStatusPage.run({
  data:{tenantId:id},auth:{uid:foreignOwner}}),{code:"invalid-argument"});
 await assert.rejects(read(null),{code:"unauthenticated"});
});
test("Superadmin issued-invoice view uses identical server proof, cannot be invoked by owners/cashiers or forge a tenant",async()=>{
 const preview=await source._privateForTests.readPage({
  db,auth:auth(superId),data:{tenantId:id,limit:8},scope:"platform"});
 assert.equal(preview.ok,true);
 assert.equal(preview.tenantId,id);
 assert.equal(preview.items.find(item=>item.id===paidId)?.paymentStatus,"recorded_paid");
 assert.equal(preview.items.find(item=>item.id===corruptId)?.paymentStatus,"needs_review");
 assert.equal(preview.items.find(item=>item.id===corruptId)?.operationalCashSettled,false);
 assert.equal(preview.financialPostingEnabled,false);
 assert.equal(preview.writesPerformed,false);
 const foreign=await source._privateForTests.readPage({
  db,auth:auth(superId),data:{tenantId:other},scope:"platform"});
 assert.equal(foreign.tenantId,other);
 assert.equal(foreign.items.length,0);
 for(const uid of [ownerId,adminId,cashierId,inactiveId,foreignOwner])
  await assert.rejects(source._privateForTests.readPage({
   db,auth:auth(uid),data:{tenantId:id},scope:"platform"}),
   {code:"permission-denied"});
 for(const bad of [{tenantId:"../other"},{tenantId:id,paid:true},
  {tenantId:id,limit:40},{tenantId:id,amount:590},{tenantId:id,cursor:"unsafe"}])
  await assert.rejects(source._privateForTests.readPage({
   db,auth:auth(superId),data:bad,scope:"platform"}),
   {code:"invalid-argument"});
 await assert.rejects(source.getPlatformHybridIssuedInvoiceStatusPage.run({
  auth:auth(ownerId),data:{tenantId:id}}),{code:"permission-denied"});
});
test("tampered persistent invoice canonical amount rejects whole page rather than showing false payability",async()=>{
 await t.collection("hybridBillingInvoices").doc(invoiceId).update({
  amount:590.001,
 });
 await assert.rejects(read(),{code:"failed-precondition"});
 assert.equal((await t.collection("hybridBillingInvoices").doc(invoiceId).get()).data().status,"issued");
});
