import {groupCompanionObservations} from "../utils/companionObservationGrouping.mjs";
const MONEY_LIMIT=10000000000;
const safeText=(v,max=100)=>String(v??"").slice(0,max);
const iso=value=>{
 const date=new Date(value||"");
 return Number.isFinite(date.getTime())?date.toISOString():null;
};
// An authorized Owner's companion dashboard is a read-only hint, not bank proof.
// Never accept a backend shape that can masquerade as bank-confirmed settlement.
export function projectMerchantObserver(result){
 if(!result||result.paymentVerified!==false||
  result.bankConfirmed!==false||result.canSettleInvoice!==false||
  result.canReleaseKitchen!==false||typeof result.enabled!=="boolean"||
  !Array.isArray(result.devices)||!Array.isArray(result.items)||
  !Array.isArray(result.matches)||result.items.length>50||
  result.devices.length>100||result.matches.length>201)
  throw Error("COMPANION_OBSERVER_UNCONFIRMED");
 const devices=result.devices.map(device=>({
  id:safeText(device?.id,128),label:safeText(device?.label,100),
  enabled:device?.enabled===true,lastSeenUTC:iso(device?.lastSeenUTC),
 }));
 const notices=result.items.map(row=>{
  if(!Number.isSafeInteger(row?.amountSatang)||
   row.amountSatang<0||row.amountSatang>MONEY_LIMIT||
   row?.paymentVerified!==false||row?.bankConfirmed!==false||
   row?.canReleaseKitchen!==false)throw Error("COMPANION_OBSERVER_ROW_UNCONFIRMED");
  return {
   id:safeText(row.id,128),deviceId:safeText(row.deviceId,128),
   deviceLabel:safeText(row.deviceLabel,100),
   amountSatang:row.amountSatang,source:safeText(row.source,60),
   receiverSuffix:safeText(row.receiverSuffix,25),
   receivedUTC:iso(row.receivedUTC),bankTimeUTC:iso(row.bankTimeUTC),
   cashierPaymentConfirmed:false,
  };
 });
 const ids=new Set(notices.map(item=>item.id));
 if(ids.size!==notices.length||notices.some(item=>!item.id))
  throw Error("COMPANION_OBSERVER_DUPLICATE_EVENT");
 const groupedNotices=groupCompanionObservations(notices);
 return {
  enabled:result.enabled,devices,notices,groupedNotices,
  matchStatus:safeText(result.matchStatus,40),
  matches:result.matches.map(row=>({
   orderId:safeText(row?.orderId,128),
   amountSatang:Number.isSafeInteger(row?.amountSatang)?row.amountSatang:null,
   status:["candidate","ambiguous","no_match","unavailable"].includes(row?.status)
    ?row.status:"unavailable",
   orderTimeUTC:iso(row?.orderTimeUTC),hasSlip:row?.hasSlip===true,
  })).filter(row=>row.orderId&&row.amountSatang!==null),
  activeCount:devices.filter(device=>device.enabled).length,
  duplicateGroups:groupedNotices.filter(group=>group.possibleDuplicate).length,
  // Go Source has LK Shop outbox read; Firebase currently has no equivalent
  // read authority. We must not manufacture matching entries.
  lkHistoryAvailable:false,
  bankVerified:false,canAutoSettle:false,
 };
}
