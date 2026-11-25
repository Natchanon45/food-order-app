import {httpsCallable} from "firebase/functions";
import {functions} from "@/firebase/client";

const getReceiver=()=>httpsCallable(functions,"getPlatformReceiptReceiver")({});
export async function loadPlatformReceiptReceiver(){
 const response=(await getReceiver())?.data;
 const item=response?.item;
 if(response?.ok!==true||!item||item.storageReady!==true||
    !Number.isSafeInteger(item.revision)||item.revision<0||
    !item.receiver||typeof item.receiver!=="object"||
    typeof item.configured!=="boolean"||
    item.paymentRoutingEnabled!==false)
  throw Error("RECEIVER_READBACK_INVALID");
 return item;
}
export async function savePlatformReceiptReceiver(receiver,expectedRevision){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
  throw Error("RECEIVER_REVISION_REQUIRED");
 let result;
 try{
  result=(await httpsCallable(functions,"updatePlatformReceiptReceiver")({
   receiver,expectedRevision,
  }))?.data;
 }catch(error){
  const code=String(error?.code||"").replace(/^functions\//,"");
  if(["invalid-argument","unauthenticated","permission-denied",
   "failed-precondition"].includes(code))throw error;
  throw Error("RECEIVER_SAVE_UNCONFIRMED");
 }
 if(result?.ok!==true||result.item?.revision!==expectedRevision+1||
    !result.item?.configured)
  throw Error("RECEIVER_SAVE_UNCONFIRMED");
 let confirmed;
 try{confirmed=await loadPlatformReceiptReceiver();}
 catch{throw Error("RECEIVER_SAVE_UNCONFIRMED");}
 if(confirmed.revision!==result.item.revision||
    JSON.stringify(confirmed.receiver)!==JSON.stringify(result.item.receiver))
  throw Error("RECEIVER_SAVE_UNCONFIRMED");
 return confirmed;
}
