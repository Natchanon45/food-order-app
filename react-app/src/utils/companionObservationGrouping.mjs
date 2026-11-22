// Presentation-only grouping, matching the previous port-8000 Dashboard.
// Repeated notifications are never automatically treated as a single transfer.
export function groupCompanionObservations(items=[]) {
 const groups=[];
 const seen=new Map();
 for(const row of Array.isArray(items)?items:[]){
  const key=JSON.stringify([
   String(row.deviceId||row.deviceLabel||""),
   String(row.amountSatang),
   String(row.receiverSuffix||""),
   String(row.bankTimeUTC||""),
  ]);
  const index=seen.get(key);
  if(index!==undefined){
   groups[index].notificationCount+=1;
   groups[index].cashierConfirmedCount+=row.cashierPaymentConfirmed===true?1:0;
   groups[index].possibleDuplicate=true;
   continue;
  }
  seen.set(key,groups.length);
  groups.push({...row,notificationCount:1,possibleDuplicate:false,cashierConfirmedCount:row.cashierPaymentConfirmed===true?1:0});
 }
 return groups;
}
