"use strict";
const {createHash,timingSafeEqual}=require("node:crypto");
const {receiverRevision,receiverState}=require("./payment-companion-receiver");
const QR_DURATION_MS=5*60*1000;
const MAX_QR_AMOUNT_SATANG=100000000;
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const SHA=/^[a-f0-9]{64}$/;
const PURPOSE="penguin_companion_confirmed_order_5m";
const error=code=>{throw Error(code);};
function configuredTenant(env=process.env){
 if(env.FUNCTIONS_EMULATOR==="true"||env.FIRESTORE_EMULATOR_HOST||env.FIREBASE_AUTH_EMULATOR_HOST||String(env.GCLOUD_PROJECT||env.GCP_PROJECT||"").startsWith("demo-")||env.PENGUIN_PAYMENT_COMPANION_PILOT_ENABLED!=="1"||env.PENGUIN_PAYMENT_COMPANION_QR_ENABLED!=="1")return "";
 return ID.test(env.PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID||"")?env.PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID:"";
}
function satang(amount){
 if(typeof amount!=="number"||!Number.isFinite(amount))error("QR_AMOUNT_INVALID");
 const cents=Math.round(amount*100);
 if(!Number.isSafeInteger(cents)||cents<=0||cents>MAX_QR_AMOUNT_SATANG||Math.abs(amount*100-cents)>0.0000001)error("QR_AMOUNT_INVALID");
 return cents;
}
function payee(store){
 const raw=String(store?.promptPayId||"").replace(/[ -]/g,"");
 if(!/^(?:0[0-9]{9}|[0-9]{13})$/.test(raw))error("QR_PAYEE_INVALID");
 return raw;
}
function receiverReady(storeSnapshot,link,tenantId,now=Date.now()){
 const recipient=receiverState(storeSnapshot,link,true);
 if(!tenantId||!recipient.enabled||!recipient.storePaymentReady||!Number.isSafeInteger(link?.confirmedAtMs)||link.confirmedAtMs>now||now-link.confirmedAtMs<0)error("QR_RECEIVER_UNCONFIRMED");
 return {recipient,revision:receiverRevision(storeSnapshot),payee:payee(storeSnapshot.data())};
}
function verifyCatalog(items,menuDocs,order){
 if(!Array.isArray(items)||items.length<1||items.length>60||!Array.isArray(menuDocs)||menuDocs.length!==items.length)error("QR_CART_INVALID");
 let food=0;
 for(let i=0;i<items.length;i++){
  const item=items[i],menu=menuDocs[i]?.data?.()||{};
  const identifier=String(item.menuId||"");
  if(!ID.test(identifier)||!menuDocs[i].exists||menu.active===false||menu.hidden===true||item.isGift===true||!Number.isInteger(item.qty)||item.qty<1||item.qty>100)error("QR_CART_INVALID");
  const unit=satang(menu.price),claimed=satang(item.price);
  if(claimed!==unit)error("QR_MENU_PRICE_CHANGED");
  food+=unit*item.qty;
 }
 if(!Number.isSafeInteger(food)||food<=0||satang(order.subtotalAmount)!==food)error("QR_CART_TOTAL_MISMATCH");
 // Pilot does not yet have source-side signed promotion snapshots.
 if(order.freeShippingApplied===true||order.freeGiftApplied===true||(order.freeGiftMenuIds||[]).length||Number(order.deliveryFeeDiscount||0)!==0)error("QR_PROMOTION_NOT_PORTED");
 return food;
}
function verifyQuotation(order,quote,food,now=Date.now()){
 const q=quote?.data?.()||{},id=String(order.lalamoveQuotationId||"");
 if(!ID.test(id)||!quote?.exists||q.tenantId!==order.tenantId||q.quotationId!==id||q.paymentMethod!=="promptpay"||!Number.isFinite(q.latitude)||!Number.isFinite(q.longitude)||q.latitude!==order.deliveryLatitude||q.longitude!==order.deliveryLongitude)error("QR_QUOTE_UNCONFIRMED");
 const quoteFee=satang(q.fee),expiry=Date.parse(q.expiresAt||"");
 if(!Number.isFinite(expiry)||expiry<=now+10000||expiry>now+15*60*1000||satang(order.deliveryFee)!==quoteFee||satang(order.deliveryBaseFee)!==quoteFee||satang(order.totalAmount)!==food+quoteFee)error("QR_QUOTE_UNCONFIRMED");
 return {feeSatang:quoteFee,expiresAt:expiry};
}
function qrSnapshot(order,storeSnapshot,link,tenantId,now=Date.now()){
 if(!order||order.orderType!=="delivery"||order.paymentMethod!=="promptpay"||order.paymentQrMode!=="confirmed_order_5m")return {mode:"none",active:false,canUploadSlip:false};
 const started=Date.parse(order.paymentQrStartedAtUTC||""),expires=Date.parse(order.paymentQrExpiresAtUTC||"");
 const orderCreated=order.createdAt?.toMillis?.()||Date.parse(order.createdAtUTC||"");
 if(!Number.isFinite(started)||!Number.isFinite(expires)||expires-started!==QR_DURATION_MS||
    started>now+60000||!Number.isFinite(orderCreated)||started<orderCreated-120000||started>orderCreated+60000||
    !SHA.test(order.paymentQrReceiverRevision||"")||order.tenantId!==tenantId)return {mode:"invalid",active:false,canUploadSlip:false};
 if(order.companionKitchenRelease?.status==="admitted_unverified")
  return {mode:"confirmed_order_5m",active:false,canUploadSlip:false,reason:"kitchen_admitted"};
 if(order.paymentStatus!=="pending_verification"||order.status!=="pending")return {mode:"resolved",active:false,canUploadSlip:false};
 const expired=now>=expires,hasSlip=typeof order.paymentSlipPath==="string"&&!!order.paymentSlipPath;
 const storedRevision=receiverRevision(storeSnapshot),recipient=receiverState(storeSnapshot,link,true);
 const payeeUnchanged=storedRevision===order.paymentQrReceiverRevision&&recipient.enabled&&recipient.confirmedAtMs<=started&&recipient.storePaymentReady;
 let displayId="";
 if(payeeUnchanged){try{displayId=payee(storeSnapshot.data());}catch{displayId="";}}
 const active=!expired&&!hasSlip&&payeeUnchanged&&!!displayId;
 return {mode:"confirmed_order_5m",active,canUploadSlip:!hasSlip&&(expired||!payeeUnchanged||!displayId),expiresAtUTC:new Date(expires).toISOString(),serverNowMs:now,recipientId:active?displayId:"",recipientName:active?String(storeSnapshot.data()?.promptPayName||storeSnapshot.data()?.shopName||"").trim().slice(0,100):"",reason:!payeeUnchanged?"receiver_changed":expired?"expired":hasSlip?"slip_submitted":"awaiting"};
}
function verifyCapability(token,digest){
 if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token)||!SHA.test(digest||""))return false;
 const calculated=Buffer.from(createHash("sha256").update(token).digest("hex"),"hex"),expected=Buffer.from(digest,"hex");
 return timingSafeEqual(calculated,expected);
}
module.exports={QR_DURATION_MS,ID,SHA,PURPOSE,configuredTenant,satang,payee,receiverReady,verifyCatalog,verifyQuotation,qrSnapshot,verifyCapability};
