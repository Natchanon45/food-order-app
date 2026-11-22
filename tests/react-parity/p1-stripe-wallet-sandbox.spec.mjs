import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const require=createRequire(import.meta.url);
const policy=require("../../functions/stripe-wallet-sandbox-policy");
const source=readFileSync(new URL("../../functions/stripe-wallet-sandbox.js",import.meta.url),"utf8");
const account="acct_1234567890123456",key="sk_test_FAKE_TEST_KEY_1234",hook="whsec_FAKE_TEST_HOOK_1234";
test("source sandbox account, Thai PromptPay, test mode and hosted URL are validated",()=>{
 assert.equal(policy.configurationReady(key,hook,account),true);
 assert.equal(policy.configurationReady(key.replace("test","live"),hook,account),false);
 assert.equal(policy.accountVerified({id:account,country:"TH",charges_enabled:true,livemode:false},account),true);
 for(const patch of [{country:"US"},{livemode:true},{charges_enabled:false},{id:"acct_other_account"}])assert.equal(policy.accountVerified({id:account,country:"TH",charges_enabled:true,livemode:false,...patch},account),false);
 assert.equal(policy.promptPayEnabled({data:[{active:true,promptpay:{available:true,display_preference:{value:"on"}}}]}),true);
 assert.equal(policy.promptPayEnabled({data:[{active:false,promptpay:{available:true,display_preference:{value:"on"}}}]}),false);
 assert.ok(policy.safeCheckoutURL("https://checkout.stripe.com/c/pay/cs_test_fake"));
 for(const url of ["http://checkout.stripe.com/c/pay/x","https://checkout.stripe.com.evil.example/c/pay/x","https://user@checkout.stripe.com/c/pay/x","https://checkout.stripe.com:444/c/pay/x"])assert.equal(policy.safeCheckoutURL(url),"");
});
test("raw webhook signature, timestamp and body mutation are fail-closed",()=>{
 const raw=Buffer.from('{"id":"evt_sandbox"}'),stamp=1700000000;
 const sig="t="+stamp+",v1="+createHmac("sha256",hook).update(String(stamp)+".").update(raw).digest("hex");
 assert.equal(policy.verifyWebhook(raw,sig,hook,stamp),true);
 assert.equal(policy.verifyWebhook(raw,sig,hook,stamp+301),false);
 assert.equal(policy.verifyWebhook(Buffer.concat([raw,Buffer.from(" ")]),sig,hook,stamp),false);
 assert.equal(policy.verifyWebhook(raw,"t="+stamp+","+sig,hook,stamp),false);
 assert.equal(policy.verifyWebhook(raw,sig,"whsec_WRONG_TEST_SECRET",stamp),false);
});
test("independent Stripe session/intent proof requires exact tenant, reference, amount, currency and test mode",()=>{
 const referenceId="12345678-abcd-abcd-abcd-123456789012",tenantId="tenant-test";
 const metadata={referenceId,tenantId,purpose:"penguin_lalamove_wallet_sandbox"};
 const attempt={referenceId,tenantId,accountId:account,sessionId:"cs_test_FAKE_TEST_SESSION_123",amountSatang:30000,mode:"test"};
 const session={id:attempt.sessionId,livemode:false,mode:"payment",status:"complete",payment_status:"paid",currency:"thb",amount_total:30000,metadata,payment_method_types:["promptpay"],payment_intent:"pi_FAKE_TEST_INTENT_123"};
 const intent={id:session.payment_intent,livemode:false,status:"succeeded",currency:"thb",amount:30000,amount_received:30000,metadata,payment_method_types:["promptpay"]};
 const proof={attempt,session,intent,expectedAccount:account};
 assert.equal(policy.verifiedSandboxPayment(proof),true);
 for(const patch of [{session:{...session,livemode:true}},{session:{...session,payment_status:"unpaid"}},{session:{...session,metadata:{...metadata,tenantId:"other"}}},{intent:{...intent,amount_received:29999}},{intent:{...intent,currency:"usd"}},{intent:{...intent,payment_method_types:["card"]}},{attempt:{...attempt,accountId:"acct_wrong_account"}},{intent:{...intent,status:"processing"}}])assert.equal(policy.verifiedSandboxPayment({...proof,...patch}),false);
});
function harness({role="super_admin",active=true,env={},secret=key}={}){
 let calls=0;const exports={};
 const HttpsError=class extends Error{constructor(code,message){super(message);this.code=code;}};
 const fakeDB={collection:()=>({doc:()=>({get:async()=>({data:()=>({role,active})})})})};
 const fakeFetch=async(url,options)=>{calls++;assert.equal(options.redirect,"error");assert.equal(options.headers.Authorization,"Bearer "+key);return {ok:true,json:async()=>url.endsWith("/account")?{id:account,country:"TH",charges_enabled:true,livemode:false}:{data:[{active:true,promptpay:{available:true,display_preference:{value:"on"}}}]}};};
 vm.runInNewContext(source,{exports,require:name=>({"firebase-functions/v2/https":{onCall:(_,handler)=>handler,HttpsError},"firebase-functions/params":{defineSecret:name=>({value:()=>name.endsWith("_KEY")?secret:hook})},"firebase-admin/firestore":{getFirestore:()=>fakeDB},"./stripe-wallet-sandbox-policy":policy}[name]),process:{env},fetch:fakeFetch,AbortSignal});
 return {fn:exports.getPlatformStripeWalletSandboxStatus,calls:()=>calls};
}
const environment={PENGUIN_STRIPE_WALLET_SANDBOX_ENABLED:"1",PENGUIN_STRIPE_WALLET_TEST_ACCOUNT_ID:account};
test("only active superadmin can check sandbox; emulator and disabled/live config never access Stripe",async()=>{
 const guest=harness({env:environment});await assert.rejects(guest.fn({data:{verify:true}}),{code:"unauthenticated"});assert.equal(guest.calls(),0);
 for(const opts of [{role:"owner"},{active:false}]){const h=harness({...opts,env:environment});await assert.rejects(h.fn({auth:{uid:"test"},data:{verify:true}}),{code:"permission-denied"});assert.equal(h.calls(),0);}
 for(const opts of [{env:{}},{env:{...environment,FUNCTIONS_EMULATOR:"true"}},{env:{...environment,PENGUIN_STRIPE_WALLET_LIVE_ENABLED:"1"}},{env:environment,secret:key.replace("test","live")}]){const h=harness(opts);const v=await h.fn({auth:{uid:"test"},data:{verify:true}});assert.equal(v.checkoutEnabled,false);assert.equal(v.verified,false);assert.equal(h.calls(),0);}
});
test("provider read is explicit, masked and does not enable checkout or webhook",async()=>{
 const h=harness({env:environment});const initial=await h.fn({auth:{uid:"test"},data:{verify:false}});assert.equal(initial.configured,true);assert.equal(h.calls(),0);
 const checked=await h.fn({auth:{uid:"test"},data:{verify:true}});assert.equal(h.calls(),2);assert.equal(checked.verified,true);assert.equal(checked.promptPayEnabled,true);assert.equal(checked.webhookReady,false);assert.equal(checked.checkoutEnabled,false);
 const text=JSON.stringify(checked);for(const secret of [key,hook,account])assert.ok(!text.includes(secret));
});
