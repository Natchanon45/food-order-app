"use strict";
// P1 rebaseline 2026-11-25: dedicated central receiver account configuration.
// This DOES NOT select payment rails, authorize a paid invoice, issue a QR,
// or enable Google Vision / retired Slip2Go verification.
const {HttpsError,onCall}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const REGION="asia-southeast1";
const COLLECTION="platformPrivateSettings";
const DOC="receiptReceiver";

async function assertSuperAdmin(auth){
 if(!auth?.uid)throw new HttpsError("unauthenticated","Authentication required");
 const profile=(await getFirestore().collection("users").doc(auth.uid).get()).data();
 if(!profile||profile.active===false||profile.role!=="super_admin")
  throw new HttpsError("permission-denied","Superadmin required");
}

function readReceiver(data={}){
 const raw=data.receiver&&typeof data.receiver==="object"?data.receiver:{};
 return {
  accountType:String(raw.accountType||""),
  accountNumber:String(raw.accountNumber||""),
  accountNameTH:String(raw.accountNameTH||""),
  accountNameEN:String(raw.accountNameEN||""),
  promptPayType:String(raw.promptPayType||""),
  promptPayId:String(raw.promptPayId||""),
 };
}
function configured(r){
 return /^01[0-9]{3}$/.test(r.accountType)&&
  /^[0-9]{4,20}$/.test(r.accountNumber)&&
  Boolean(r.accountNameTH||r.accountNameEN);
}
function publicView(data={},legacyUnconfirmed=false){
 const receiver=readReceiver(data);
 const revision=Number.isSafeInteger(data.revision)&&data.revision>=0?data.revision:0;
 return {
  storageReady:true,promptPayStorageReady:true,receiver,revision,
  configured:configured(receiver)&&revision>0,
  legacyUnconfirmed:Boolean(legacyUnconfirmed),
  paymentRoutingEnabled:false,
 };
}
function validate(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new HttpsError("invalid-argument","RECEIVER_PAYLOAD_INVALID");
 const accountType=String(raw.accountType||"").trim();
 const accountNumber=String(raw.accountNumber||"").replace(/[-\s]/g,"");
 const accountNameTH=String(raw.accountNameTH||"").trim();
 const accountNameEN=String(raw.accountNameEN||"").trim();
 const promptPayType=String(raw.promptPayType||"").trim();
 const promptPayId=String(raw.promptPayId||"").replace(/[\s-]/g,"");
 if(!/^01[0-9]{3}$/.test(accountType)||!/^[0-9]{4,20}$/.test(accountNumber)||
    !(accountNameTH||accountNameEN)||accountNameTH.length>180||
    accountNameEN.length>180||
    !["","phone","citizen"].includes(promptPayType)||
    (promptPayType==="phone"&&!/^0[0-9]{9}$/.test(promptPayId))||
    (promptPayType==="citizen"&&!/^[0-9]{13}$/.test(promptPayId))||
    (!promptPayType&&promptPayId)||
    /[\u0000-\u001f<>]/.test(accountNameTH+accountNameEN)){
  throw new HttpsError("invalid-argument","RECEIVER_BANK_OR_PROMPTPAY_INVALID");
 }
 return {accountType,accountNumber,accountNameTH,accountNameEN,promptPayType,promptPayId};
}
async function legacyData(db){
 const snap=await db.collection(COLLECTION).doc("slipVerification").get();
 const raw=snap.data()||{};
 const draft={
  accountType:String(raw.receiverAccountType||""),
  accountNumber:String(raw.receiverAccountNumber||""),
  accountNameTH:String(raw.receiverNameTh||""),
  accountNameEN:String(raw.receiverNameEn||""),
  promptPayType:"",promptPayId:"",
 };
 return configured(draft)?draft:null;
}
exports.getPlatformReceiptReceiver=onCall({region:REGION},async request=>{
 await assertSuperAdmin(request.auth);
 const db=getFirestore();
 const snap=await db.collection(COLLECTION).doc(DOC).get();
 if(snap.exists)return {ok:true,item:publicView(snap.data())};
 const draft=await legacyData(db);
 const item=publicView(draft?{receiver:draft,revision:0}:{});
 return {ok:true,item:{...item,legacyUnconfirmed:Boolean(draft)}};
});
exports.updatePlatformReceiptReceiver=onCall({region:REGION},async request=>{
 await assertSuperAdmin(request.auth);
 const payload=request.data||{};
 const receiver=validate(payload.receiver);
 const expectedRevision=Number(payload.expectedRevision);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>1000000)
  throw new HttpsError("invalid-argument","RECEIVER_REVISION_INVALID");
 const db=getFirestore();
 const ref=db.collection(COLLECTION).doc(DOC);
 const revision=await db.runTransaction(async tx=>{
  const [actor,snapshot]=await Promise.all([
   tx.get(db.collection("users").doc(request.auth.uid)),tx.get(ref),
  ]);
  if(actor.data()?.role!=="super_admin"||actor.data()?.active===false)
   throw new HttpsError("permission-denied","Superadmin permission changed");
  const current=Number.isSafeInteger(snapshot.data()?.revision)?
   snapshot.data().revision:0;
  if(current!==expectedRevision)throw new HttpsError(
   "failed-precondition","RECEIVER_REVISION_CONFLICT");
  tx.set(ref,{
   receiver,revision:current+1,
   updatedAt:FieldValue.serverTimestamp(),updatedBy:request.auth.uid,
  },{merge:false});
  return current+1;
 });
 const saved=await ref.get();
 const item=publicView(saved.data());
 if(!saved.exists||item.revision!==revision||
   JSON.stringify(item.receiver)!==JSON.stringify(receiver))
  throw new HttpsError("internal","RECEIVER_SAVE_UNCONFIRMED");
 return {ok:true,item};
});
