"use strict";
// Local demo-only implementation. A future authorized staging rollout must
// explicitly replace this gate after signed bank reconciliation is accepted.
const {receiverRevision}=require("./payment-companion-receiver");
const {payee}=require("./payment-companion-qr-policy");
const {__test:routes}=require("./google-delivery");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const FLOW="notification_first";
const fail=code=>{throw Error(code);};
function demoEnabled(tenantId,env=process.env){
 return ID.test(tenantId)&&tenantId.startsWith("p34-notify-")&&
   env.FUNCTIONS_EMULATOR==="true"&&env.GCLOUD_PROJECT==="demo-penguin-hybrid"&&
   env.FIRESTORE_EMULATOR_HOST==="127.0.0.1:8189";
}
function cents(v,allowZero=false){
 if(typeof v!=="number"||!Number.isFinite(v))fail("DELIVERY_NOTIFICATION_AMOUNT_INVALID");
 const n=Math.round(v*100);
 if(!Number.isSafeInteger(n)||n<(allowZero?0:1)||n>100000000||Math.abs(n-v*100)>1e-6)
  fail("DELIVERY_NOTIFICATION_AMOUNT_INVALID");
 return n;
}
function cart(order,docs){
 if(!Array.isArray(order.items)||order.items.length<1||order.items.length>60||
    docs.length!==order.items.length)fail("DELIVERY_NOTIFICATION_CART_INVALID");
 const seen=new Set();let food=0;
 const items=order.items.map((row,i)=>{
  const menu=docs[i]?.data?.();
  if(!ID.test(row.menuId||"")||seen.has(row.menuId)||!docs[i]?.exists||!menu||
     menu.active===false||menu.hidden===true||row.isGift===true||row.cancelled===true||
     !Number.isInteger(row.qty)||row.qty<1||row.qty>100||
     typeof menu.name!=="string"||!menu.name.trim())fail("DELIVERY_NOTIFICATION_CART_INVALID");
  seen.add(row.menuId);
  const price=cents(menu.price);
  if(cents(row.price)!==price)fail("DELIVERY_NOTIFICATION_MENU_PRICE_CHANGED");
  food+=price*row.qty;
  return {menuId:row.menuId,name:menu.name,price:price/100,qty:row.qty,
    note:typeof row.note==="string"?row.note.slice(0,300):"",cancelled:false};
 });
 if(food!==cents(order.subtotalAmount))fail("DELIVERY_NOTIFICATION_CART_TOTAL_MISMATCH");
 return {food,items};
}
function routeKey(tenantId,store,order){
 const origin={latitude:store.storeLatitude,longitude:store.storeLongitude};
 const dest={latitude:order.deliveryLatitude,longitude:order.deliveryLongitude};
 if(!Number.isFinite(origin.latitude)||Math.abs(origin.latitude)>90||
    !Number.isFinite(origin.longitude)||Math.abs(origin.longitude)>180||
    (origin.latitude===0&&origin.longitude===0))fail("DELIVERY_NOTIFICATION_ROUTE_REQUIRED");
 return routes.cacheKey(tenantId,origin,dest);
}
function fee(tenantId,store,order,evidence,now){
 if(String(store.deliveryProvider||"self")!==order.deliveryProvider)fail("DELIVERY_NOTIFICATION_PROVIDER_CHANGED");
 if(!evidence?.exists)fail("DELIVERY_NOTIFICATION_ROUTE_REQUIRED");
 const q=evidence.data()||{};
 if(q.tenantId!==tenantId)fail("DELIVERY_NOTIFICATION_ROUTE_REQUIRED");
 if(order.deliveryProvider==="lalamove"){
  const exp=Date.parse(q.expiresAt||"");
  if(!ID.test(order.lalamoveQuotationId||"")||q.quotationId!==order.lalamoveQuotationId||
     q.paymentMethod!=="promptpay"||q.latitude!==order.deliveryLatitude||q.longitude!==order.deliveryLongitude||
     !Number.isFinite(exp)||exp<=now+10000||exp>now+900000||
     Number(store.deliveryMaxDistanceKm)>0)fail("DELIVERY_NOTIFICATION_QUOTE_INVALID");
  // Quote cache does not carry authoritative distance; do not bypass a configured max.
  return {base:cents(q.fee,true),zone:"lalamove",label:"Lalamove",mode:"lalamove_quotation",
   quote:{lalamoveQuotationId:q.quotationId,lalamoveQuotationExpiresAt:q.expiresAt,
     lalamoveCurrency:"THB",lalamoveCodEnabled:false,lalamoveCodAmount:0}};
 }
 const at=q.updatedAt?.toMillis?.()||0;
 if(!at||at>now||now-at>=86400000||
    q.origin?.latitude!==store.storeLatitude||q.origin?.longitude!==store.storeLongitude||
    q.destination?.latitude!==order.deliveryLatitude||q.destination?.longitude!==order.deliveryLongitude)
  fail("DELIVERY_NOTIFICATION_ROUTE_REQUIRED");
 const result=routes.routeResult(q,store);
 if(!result.inRange||!result.zone)fail("DELIVERY_NOTIFICATION_ROUTE_REQUIRED");
 return {base:cents(result.zone.fee,true),zone:result.zone.id,label:result.zone.label,
  mode:"google_routes",quote:{deliveryDistanceMeters:result.distanceMeters,
  deliveryDistanceKm:result.distanceKm,deliveryDurationSeconds:result.durationSeconds,deliveryRouteProvider:"google_routes"}};
}
function canonical(tenantId,storeSnap,order,docs,evidence,now=Date.now()){
 const store=storeSnap.data()||{};
 if(store.deliveryPromptPayEnabled===false||order.paymentMethod!=="promptpay")fail("DELIVERY_NOTIFICATION_RECEIVER_REQUIRED");
 const revision=receiverRevision(storeSnap);
 const recipient=payee(store);
 if(!revision||order.paymentRecipientId!==recipient)fail("DELIVERY_NOTIFICATION_RECEIVER_CHANGED");
 // No gift promotion authority yet: avoid both omission and fabricated gifts.
 if(store.deliveryPromotion?.freeGift?.enabled===true||order.freeGiftApplied===true||
    (order.freeGiftMenuIds||[]).length||(order.freeGiftItems||[]).length)
  fail("DELIVERY_NOTIFICATION_GIFT_NOT_PORTED");
 const {food,items}=cart(order,docs);
 const delivery=fee(tenantId,store,order,evidence,now);
 const promotion=store.deliveryPromotion?.freeShipping||{};
 const free=promotion.enabled===true&&Number(promotion.minimumSubtotal)>0&&
    food>=cents(Number(promotion.minimumSubtotal));
 const finalFee=free?0:delivery.base;
 if(order.deliveryZone!==delivery.zone||cents(order.deliveryBaseFee,true)!==delivery.base||
    cents(order.deliveryFee,true)!==finalFee||cents(order.totalAmount)!==food+finalFee||
    Boolean(order.freeShippingApplied)!==free||
    cents(order.deliveryFeeDiscount??0,true)!==delivery.base-finalFee)
  fail("DELIVERY_NOTIFICATION_TOTAL_CHANGED");
 // Rebuild rather than spread arbitrary browser payload.
 return {items,subtotalAmount:food/100,totalAmount:(food+finalFee)/100,
  deliveryProvider:order.deliveryProvider,deliveryZone:delivery.zone,deliveryZoneLabel:delivery.label,
  deliveryBaseFee:delivery.base/100,deliveryFee:finalFee/100,
  deliveryFeeDiscount:(delivery.base-finalFee)/100,freeShippingApplied:free,
  deliveryFeeMode:delivery.mode,freeGiftApplied:false,freeGiftMenuIds:[],freeGiftItems:[],
  ...delivery.quote,paymentRecipientId:recipient,paymentReceiverRevision:revision,
  bankTransferReviewFlow:FLOW,slipCheckStatus:"",paymentReviewRequired:false,
  paymentSlipPath:"",paymentSlipUrl:"",paymentCorrectionRevision:0};
}
module.exports={FLOW,demoEnabled,routeKey,canonical,cents};
