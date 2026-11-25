"use strict";
// First-time configuration only. Secret Manager payloads are never read by
// this service, returned to a client, or written to Firestore/logs.
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore}=require("firebase-admin/firestore");
const {getApp}=require("firebase-admin/app");
const PROJECT="chat-45754";
const NAMES=Object.freeze({secretKey:"PENGUIN_STRIPE_WALLET_TEST_KEY",webhookSecret:"PENGUIN_STRIPE_WALLET_TEST_WEBHOOK"});
const options={region:"asia-southeast1",serviceAccount:"penguin-stripe-setup@chat-45754.iam.gserviceaccount.com",timeoutSeconds:30,maxInstances:1,concurrency:1};
const formats={secretKey:/^sk_test_[A-Za-z0-9_]{8,240}$/,webhookSecret:/^whsec_[A-Za-z0-9_]{8,240}$/};
async function authorize(request,recent=false){
 if(!request.auth?.uid)throw new HttpsError("unauthenticated","Sign-in required");
 const profile=(await getFirestore().collection("users").doc(request.auth.uid).get()).data();
 if(profile?.role!=="super_admin"||profile.active!==true)throw new HttpsError("permission-denied","Superadmin only");
 if(recent){
  const age=Math.floor(Date.now()/1000)-Number(request.auth.token?.auth_time);
  if(!Number.isFinite(age)||age<0||age>900)throw new HttpsError("failed-precondition","STRIPE_SETUP_RECENT_LOGIN_REQUIRED");
 }
 if(process.env.FUNCTIONS_EMULATOR==="true"||process.env.FIRESTORE_EMULATOR_HOST||(process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT||process.env.GCP_PROJECT)!==PROJECT)
  throw new HttpsError("failed-precondition","STRIPE_SETUP_PROJECT_UNAVAILABLE");
}
async function manager(name,operation,value){
 if(!Object.values(NAMES).includes(name))throw new Error("SECRET_NAME_INVALID");
 const token=(await getApp().options.credential.getAccessToken()).access_token;
 const url="https://secretmanager.googleapis.com/v1/projects/"+PROJECT+"/secrets/"+name+
   (operation==="list"?"/versions?pageSize=1":":addVersion");
 const response=await fetch(url,{method:operation==="list"?"GET":"POST",
   headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
   ...(operation==="list"?{}:{body:JSON.stringify({payload:{data:Buffer.from(value,"utf8").toString("base64")}})}),
   redirect:"error",signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new HttpsError("unavailable","STRIPE_SETUP_STORAGE_UNAVAILABLE");
 if(operation==="list"){
  const result=await response.json();
  if(result.versions!==undefined&&!Array.isArray(result.versions))throw new HttpsError("unavailable","STRIPE_SETUP_STORAGE_UNAVAILABLE");
  return {present:Boolean(result.versions?.length||result.nextPageToken),enabled:result.versions?.[0]?.state==="ENABLED"};
 }
}
async function status(){
 const [key,hook]=await Promise.all([manager(NAMES.secretKey,"list"),manager(NAMES.webhookSecret,"list")]);
 return {ok:true,storageReady:true,keyPresent:key.present,webhookPresent:hook.present,configured:key.enabled&&hook.enabled,
   firstSetupOnly:true,providerVerified:false,webhookReady:false,checkoutEnabled:false};
}
exports.getPlatformStripeWalletSetup=onCall(options,async request=>{
 await authorize(request);return status();
});
exports.savePlatformStripeWalletSetup=onCall(options,async request=>{
 await authorize(request,true);
 const data=request.data;
 if(!data||typeof data!=="object"||Array.isArray(data)||Object.keys(data).some(k=>!Object.hasOwn(NAMES,k)))
  throw new HttpsError("invalid-argument","STRIPE_SETUP_INVALID");
 const before=await status();
 const pending=[];
 for(const [field,present] of [["secretKey",before.keyPresent],["webhookSecret",before.webhookPresent]]){
  const value=data[field];
  if(present){
   if(value!==undefined&&value!=="")throw new HttpsError("failed-precondition","STRIPE_SETUP_ROTATION_NOT_ALLOWED");
  }else{
   if(typeof value!=="string"||!formats[field].test(value))throw new HttpsError("invalid-argument","STRIPE_SETUP_FORMAT_INVALID");
   pending.push([field,value]);
  }
 }
 if(!pending.length)return before;
 // Validate the submitted test key with Stripe's fixed read-only endpoint.
 // No Stripe object is created, and account details are not returned/logged.
 const submittedKey=pending.find(([field])=>field==="secretKey")?.[1];
 if(submittedKey){
  let response;
  try{response=await fetch("https://api.stripe.com/v1/account",{headers:{Authorization:"Bearer "+submittedKey},redirect:"error",signal:AbortSignal.timeout(8000)});}
  catch{throw new HttpsError("unavailable","STRIPE_SETUP_PROVIDER_UNAVAILABLE");}
  if(!response.ok)throw new HttpsError("invalid-argument","STRIPE_SETUP_TEST_KEY_REJECTED");
  const account=await response.json();
  if(!/^acct_[A-Za-z0-9]+$/.test(account?.id||"")||account.livemode===true)throw new HttpsError("invalid-argument","STRIPE_SETUP_TEST_KEY_REJECTED");
 }
 // One runtime instance, one request at a time; first setup only. Re-read
 // immediately before adding each version. Console rotation is a separate
 // administrator workflow; do not run it concurrently with this form.
 for(const [field,value] of pending){
  if((await manager(NAMES[field],"list")).present)throw new HttpsError("failed-precondition","STRIPE_SETUP_ROTATION_NOT_ALLOWED");
  await manager(NAMES[field],"add",value);
 }
 return status();
});
