// Only a known pre-placement rejection permits a further place request.
// Never retry unknown outcomes, transport errors or uncertain provider jobs.
export const lalamoveFeeChanged = (a,b) => Math.abs(Number(a)-Number(b)) > .009;
export async function placeWithFreshLalamoveQuote({order,approval,quote,place,onQuote,now=Date.now(),forceRefresh=false}){
  let refreshed=false;
  const refresh=async()=>{
    refreshed=true;
    const result=await quote();
    onQuote(result.order);
    if(result.alreadyPlaced || result.order?.lalamoveOrderId) return {kind:"alreadyPlaced",result};
    const fee=Number(result.item?.quoteFee);
    if(!Number.isFinite(fee)||fee<0) throw new Error("CASHIER_LALAMOVE_QUOTE_RESPONSE_INVALID");
    if(lalamoveFeeChanged(fee,approval.approvedFee)) return {kind:"priceChanged",result};
    return null;
  };
  const expires=Date.parse(order.lalamoveDispatchQuote?.expiresAt || "");
  if(forceRefresh || (Number.isFinite(expires) && expires<=now)){
    const stop=await refresh();
    if(stop)return stop;
  }
  try{
    return {kind:"placed",result:await place(approval)};
  }catch(error){
    // Only a KNOWN pre-placement expiry is retryable; normalized Firebase
    // codes are generic FAILED_PRECONDITION but message carries the exact
    // canonical backend reason. Unknown reservation/transport outcomes never
    // retry: provider may already have accepted the booking.
    const specific=String(error?.details?.code || error?.message || error?.code || "");
    if(refreshed || specific!=="LALAMOVE_QUOTATION_EXPIRED") throw error;
    const stop=await refresh();
    if(stop)return stop;
    return {kind:"placed",result:await place(approval)};
  }
}
