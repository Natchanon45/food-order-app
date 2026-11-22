"use strict";
const qr=require("./payment-companion-qr-policy");
const binding=require("./payment-companion-receiver");
// Never permit unverified bank notifications to release a kitchen on a live
// customer project. A separate, explicitly named UAT project is mandatory.
function configuredUatTenant(env=process.env){
 const project=String(env.GCLOUD_PROJECT||env.GCP_PROJECT||"");
 if(!project||project==="penguin-food"||project==="penguin-food-prod"||
    project==="penguin-food-production"||project.startsWith("demo-")||
    env.PENGUIN_PAYMENT_COMPANION_UAT_PROJECT_ID!==project||
    env.PENGUIN_PAYMENT_COMPANION_AUTO_KITCHEN_ENABLED!=="1")return "";
 return qr.configuredTenant(env);
}
function consentState(link,autoConsent,recipient,enabled){
 return enabled&&recipient?.enabled===true&&autoConsent?.enabled===true&&
    typeof autoConsent.revision==="string"&&autoConsent.revision===link?.revision&&
    Number.isSafeInteger(autoConsent.confirmedAtMs)&&Number.isSafeInteger(link?.confirmedAtMs)&&
    autoConsent.confirmedAtMs>=link.confirmedAtMs;
}
function admitEligible({order,match,notice,recipient,link,autoConsent,store,now=Date.now()}){
 if(!order||!match||!notice||!store||!consentState(link,autoConsent,recipient,true))return false;
 let cents;
 try{cents=qr.satang(order.totalAmount);}catch{return false;}
 if(order.orderType!=="delivery"||order.deliveryProvider!=="lalamove"||order.paymentMethod!=="promptpay"||
    order.paymentQrMode!=="confirmed_order_5m"||order.paymentQrSlipFallbackStatus!=="not_required"||
    order.paymentStatus!=="pending_verification"||order.status!=="pending"||
    order.paymentSlipPath||order.kitchenReleasedAt||order.companionKitchenRelease||
    match.status!=="candidate"||match.notificationId!==notice.id||!match.orderId||
    !match.amountSatang||match.hasSlip||!Number.isFinite(order.totalAmount)||
    cents!==match.amountSatang||cents!==notice.amountSatang||
    notice.receiverRevision!==link.revision||notice.receiverSuffix!=="X-"+recipient.accountLast4||
    order.paymentQrReceiverRevision!==link.revision)return false;
 const created=order.createdAt?.toMillis?.(),started=Date.parse(order.paymentQrStartedAtUTC||""),
   expiry=Date.parse(order.paymentQrExpiresAtUTC||"");
 if(!Number.isFinite(created)||!Number.isFinite(started)||!Number.isFinite(expiry)||
    expiry-started!==qr.QR_DURATION_MS||started<created-120000||started>created+60000||
    created<link.confirmedAtMs||created<autoConsent.confirmedAtMs||
    created>now+120000||now>expiry+60000)return false;
 if(notice.bankMs<created||notice.bankMs>expiry||notice.receivedMs<created||
    notice.receivedMs<notice.bankMs||notice.receivedMs>expiry+60000||
    notice.receivedMs>now+1000)return false;
 try{
  return qr.payee(store.data())===order.promptPayQRRecipientId&&
    binding.receiverRevision(store)===link.revision;
 }catch{return false;}
}
module.exports={configuredUatTenant,consentState,admitEligible};
