import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid" ||
   !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))
  throw Error("P16_WALLET_FIRESTORE_EMULATOR_ONLY");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),wallet=require("./tenant-lalamove-wallet");
const salt=randomUUID().slice(0,10);
const superUid="p16-super-"+salt,ownerUid="p16-owner-"+salt,tenantId="p16-tenant-"+salt;
const admin={auth:{uid:superUid}};
const tenant=db.collection("tenants").doc(tenantId);
const topups=tenant.collection("lalamoveWalletTopups");
const realWallet=tenant.collection("settings").doc("lalamoveWallet");
const proof={provider:"slip2go",status:"manual_review",reason:"slip2go_bank_error",
 code:"200502",fallbackAllowed:true,amountMatched:null};
const base=(id,fields={})=>({
  amount:500,currency:"THB",status:"pending",paymentChannel:"01004",
  verificationProvider:"slip2go",verificationStatus:"manual_review",
  ocr:proof,createdAt:Timestamp.fromDate(new Date("2026-11-24T02:00:00Z")),
  slip:{path:`tenants/${tenantId}/lalamove-wallet-topups/${id}/slip.png`,
   mime:"image/png"},...fields,
});
async function read(data={}){return wallet.getTenantLalamoveWallet.run({...admin,data:{tenantId,...data}});}
test("P1.5 Firebase denies anon/Owner/inactive Superadmin for tenant wallet unified read",async()=>{
 await Promise.all([
  db.collection("users").doc(superUid).set({role:"super_admin",active:false}),
  db.collection("users").doc(ownerUid).set({role:"owner",active:true,tenantId}),
  tenant.set({id:tenantId,name:"P16 Wallet Test",active:true}),
  realWallet.set({balance:100,currency:"THB"}),
 ]);
 await assert.rejects(wallet.getTenantLalamoveWallet.run({data:{tenantId}}),{code:"unauthenticated"});
 await assert.rejects(wallet.getTenantLalamoveWallet.run({auth:{uid:ownerUid},data:{tenantId}}),{code:"permission-denied"});
 await assert.rejects(read(),{code:"permission-denied"});
 await db.collection("users").doc(superUid).set({role:"super_admin",active:true});
});
test("P1.5 canonical history covers real Wallet docs without combining independent Stripe TEST",async()=>{
 await topups.doc("p16-technical").set(base("p16-technical"));
 await topups.doc("p16-appeal").set(base("p16-appeal",{verificationStatus:"appeal_pending"}));
 await topups.doc("p16-mismatch").set(base("p16-mismatch",{
  verificationStatus:"mismatch",ocr:{...proof,status:"mismatch",reason:"amount_not_matched",
    code:"200402",amountMatched:false,fallbackAllowed:false},
 }));
 await topups.doc("p16-incomplete").set(base("p16-incomplete",{
  status:"approved",walletTransactionId:"nonexistent-ledger",paymentChannel:"stripe_promptpay",
 }));
 const initial=await read();
 assert.equal(initial.item.topupHistoryOrigin,"firebase_real_wallet_only");
 assert.equal(initial.item.topupHistory.length,4);
 const byId=Object.fromEntries(initial.item.topupHistory.map(row=>[row.id,row]));
 assert.equal(byId["p16-technical"].provider,"slip_transfer");
 assert.equal(byId["p16-technical"].reviewable,true);
 assert.equal(byId["p16-appeal"].reviewable,false);
 assert.equal(byId["p16-appeal"].rejectable,true);
 assert.equal(byId["p16-appeal"].bankEvidenceRequired,true);
 assert.equal(byId["p16-mismatch"].reviewable,false);
 assert.equal(byId["p16-mismatch"].rejectable,true);
 assert.equal(byId["p16-incomplete"].status,"under_review");
 assert.equal(byId["p16-incomplete"].postedToRealWallet,false);
 assert.equal(byId["p16-incomplete"].provider,"unknown");
 assert.equal(initial.item.balance,100);
 assert.equal(initial.item.topupHistory.some(x=>x.provider==="stripe_promptpay"),false);
 await assert.rejects(read({topupId:"../arbitrary"}),{code:"invalid-argument"});
});
test("P1.5 bank appeal and mismatched slip can NEVER increase balance, even with typed bank reference",async()=>{
 for(const id of ["p16-appeal","p16-mismatch"]){
  await assert.rejects(wallet.reviewTenantLalamoveWalletTopup.run({
   ...admin,data:{tenantId,topupId:id,action:"approve",
    note:"BANK-REFERENCE-20261125"},
  }),e=>e.code==="failed-precondition"&&
   (id==="p16-appeal"?e.message.includes("WALLET_APPEAL_BANK_EVIDENCE_REQUIRED"):
    e.message.includes("SLIP_MANUAL_REVIEW_NOT_ELIGIBLE")));
  assert.equal((await topups.doc(id).get()).data().status,"pending");
 }
 assert.equal((await realWallet.get()).data().balance,100);
});
test("P1.5 technical-only verified exception credits one ledger entry with exact independent proof",async()=>{
 const before=(await realWallet.get()).data().balance;
 const response=await wallet.reviewTenantLalamoveWalletTopup.run({
  ...admin,data:{tenantId,topupId:"p16-technical",action:"approve"},
 });
 assert.equal(response.ok,true);
 assert.ok(response.walletTransactionId);
 const readback=await read();
 const history=readback.item.topupHistory.find(row=>row.id==="p16-technical");
 const raw=readback.item.topups.find(row=>row.id==="p16-technical");
 const ledger=readback.item.transactions.find(row=>row.id===raw.walletTransactionId);
 assert.equal(history.status,"approved");
 assert.equal(history.postedToRealWallet,true);
 assert.equal(history.reviewable,false);
 assert.equal(ledger.reference,"TOPUP:p16-technical");
 assert.equal(ledger.amount,500);
 assert.equal(readback.item.balance,before+500);
 await assert.rejects(wallet.reviewTenantLalamoveWalletTopup.run({
  ...admin,data:{tenantId,topupId:"p16-technical",action:"approve"},
 }),{code:"already-exists"});
 assert.equal((await realWallet.get()).data().balance,before+500);
});
test("P1.5 rejected mismatched bank slip records rejection but never posts credit",async()=>{
 const before=(await realWallet.get()).data().balance;
 const receipt=await wallet.reviewTenantLalamoveWalletTopup.run({
  ...admin,data:{tenantId,topupId:"p16-mismatch",action:"reject",note:"Invalid amount"},
 });
 assert.equal(receipt.ok,true);
 const result=await read();
 const h=result.item.topupHistory.find(x=>x.id==="p16-mismatch");
 assert.equal(h.status,"rejected");
 assert.equal(h.postedToRealWallet,false);
 assert.equal(h.reviewNote,"Invalid amount");
 assert.equal(result.item.balance,before);
});
test("P1.5 deep-linked topup beyond most recent 50 is fetched ONLY by explicit scoped ID",async()=>{
 const oldId="p16-older-topup",oldLedgerId="p16-older-ledger";
 await topups.doc(oldId).set(base(oldId,{
  status:"approved",walletTransactionId:oldLedgerId,
  createdAt:Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")),
 }));
 await tenant.collection("lalamoveWalletTransactions").doc(oldLedgerId).set({
  type:"topup",direction:"credit",amount:500,balanceBefore:0,balanceAfter:500,
  reference:"TOPUP:"+oldId,createdAt:Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")),
 });
 const batch=db.batch();
 for(let index=0;index<51;index++){
  const id=`p16-latest-${String(index).padStart(3,"0")}`;
  batch.set(topups.doc(id),base(id,{createdAt:Timestamp.fromMillis(Date.UTC(2026,10,24,4,0,index))}));
  batch.set(tenant.collection("lalamoveWalletTransactions").doc("p16-newer-ledger-"+index),{
   type:"delivery_debit",direction:"debit",amount:1,balanceBefore:500,
   balanceAfter:499,reference:"ORDER:"+index,
   createdAt:Timestamp.fromMillis(Date.UTC(2026,10,24,4,0,index)),
  });
 }
 await batch.commit();
 const normal=await read();
 assert.equal(normal.item.topups.some(x=>x.id===oldId),false);
 const focused=await read({topupId:oldId});
 assert.equal(focused.item.topups.some(x=>x.id===oldId),true);
 const olderHistory=focused.item.topupHistory.find(x=>x.referenceId===oldId);
 assert.ok(olderHistory);
 assert.equal(olderHistory.status,"approved",
   "Historical real credit requires a direct older ledger doc proof");
 assert.equal(olderHistory.postedToRealWallet,true);
 assert.equal(focused.item.transactions.some(tx=>tx.id===oldLedgerId),false,
   "Older ledger record is beyond recent 50 and must be proof-read directly");
 assert.equal(focused.item.topupHistoryOrigin,"firebase_real_wallet_only");
});
