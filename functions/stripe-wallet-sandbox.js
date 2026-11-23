"use strict";
const { onCall, HttpsError } = require("./managed-email-callable");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore } = require("firebase-admin/firestore");
const { configurationReady, accountVerified, promptPayEnabled } = require("./stripe-wallet-sandbox-policy");
const stripeKey = defineSecret("PENGUIN_STRIPE_WALLET_TEST_KEY");
const webhookKey = defineSecret("PENGUIN_STRIPE_WALLET_TEST_WEBHOOK");
const region = "asia-southeast1";
async function authorize(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated","Authentication required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (profile?.active !== true || profile.role !== "super_admin")
    throw new HttpsError("permission-denied","Superadmin only");
}
function environmentAllowed() {
  return process.env.FUNCTIONS_EMULATOR !== "true" &&
    !process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST &&
    !String(process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "").startsWith("demo-") &&
    process.env.PENGUIN_STRIPE_WALLET_SANDBOX_ENABLED === "1" &&
    process.env.PENGUIN_STRIPE_WALLET_LIVE_ENABLED !== "1";
}
async function stripeRead(key,path) {
  // Fixed origin and endpoint allowlist: never forward secrets on redirects.
  if (!["/v1/account","/v1/payment_method_configurations?limit=30"].includes(path))
    throw new Error("STRIPE_ENDPOINT_INVALID");
  const response = await fetch("https://api.stripe.com"+path,{
    method:"GET", headers:{Authorization:"Bearer "+key},redirect:"error",signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error("STRIPE_PROVIDER_UNAVAILABLE");
  return response.json();
}
exports.getPlatformStripeWalletSandboxStatus = onCall({region,timeoutSeconds:25,secrets:[stripeKey,webhookKey]},async request=>{
  await authorize(request.auth);
  const enabled=environmentAllowed();
  const key=enabled?stripeKey.value():"";
  const hook=enabled?webhookKey.value():"";
  const expected=String(process.env.PENGUIN_STRIPE_WALLET_TEST_ACCOUNT_ID || "");
  const configured=enabled && configurationReady(key,hook,expected);
  let verified=false,promptPay=false,providerReadFailed=false;
  if(configured && request.data?.verify===true){
    try{
      verified=accountVerified(await stripeRead(key,"/v1/account"),expected);
      if(verified) promptPay=promptPayEnabled(await stripeRead(key,"/v1/payment_method_configurations?limit=30"));
    }catch{providerReadFailed=true;}
  }
  // No Checkout or ledger writer has been approved. Configured signing key
  // alone does not prove webhook readiness or payment success.
  return {ok:true,mode:"test",enabled,configured,verified,promptPayEnabled:promptPay,
    providerChecked:configured && request.data?.verify===true && !providerReadFailed,
    providerReadFailed,webhookSecretConfigured:configured,webhookReady:false,
    checkoutEnabled:false,gate:"sandbox_settlement_not_enabled"};
});
