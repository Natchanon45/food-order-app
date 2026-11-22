import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID,createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
initializeApp({projectId:project});
const db=getFirestore(),ledger=require("./stripe-wallet-sandbox-ledger"),policy=require("./stripe-wallet-sandbox-policy");
const account="acct_1234567890123456",key="sk_test_FAKE_CHECKOUT_KEY_1234",hook="whsec_FAKE_CHECKOUT_HOOK_1234";
const tenantId="stripe-sandbox-"+randomUUID(),uid="owner-"+randomUUID(),admin="admin-"+randomUUID(),other="other-"+randomUUID();
const tenant=db.collection("tenants").doc(tenantId),auth={uid};
const root=db.collection("stripeWalletSandboxTenants").doc(tenantId);
const live=tenant.collection("settings").doc("lalamoveWallet");
let calls=[],sessions=new Map(),intents=new Map(),events=new Map(),idem=new Map(),next=0;
const provider=async(url,opts)=>{
 assert.equal(new URL(url).origin,"https://api.stripe.com");assert.equal(opts.redirect,"error");assert.equal(opts.headers.Authorization,"Bearer "+key);
 const path=url.slice("https://api.stripe.com".length);calls.push(path);
 let result;
 if(path==="/v1/account")result={id:account,country:"TH",charges_enabled:true,livemode:false};
 else if(path.startsWith("/v1/payment_method_configurations"))result={data:[{active:true,promptpay:{available:true,display_preference:{value:"on"}}}]};
 else if(path==="/v1/checkout/sessions"&&opts.method==="POST"){
  const request=opts.body,ref=request.get("metadata[referenceId]");
  assert.equal(request.get("metadata[tenantId]"),tenantId);assert.equal(request.get("payment_intent_data[metadata][referenceId]"),ref);
  assert.equal(request.get("payment_method_types[0]"),"promptpay");assert.equal(request.get("line_items[0][price_data][currency]"),"thb");
  if(idem.has(opts.headers["Idempotency-Key"]))result=sessions.get(idem.get(opts.headers["Idempotency-Key"]));
  else{
   const id="cs_test_FAKESESSION"+String(++next).padStart(8,"0");
   result={id,livemode:false,mode:"payment",currency:"thb",amount_total:Number(request.get("line_items[0][price_data][unit_amount]")),status:"open",payment_status:"unpaid",metadata:{referenceId:ref,tenantId,purpose:ledger.PURPOSE},payment_method_types:["promptpay"],url:"https://checkout.stripe.com/c/pay/"+id};
   sessions.set(id,result);idem.set(opts.headers["Idempotency-Key"],id);
  }
 }else if(path.includes("/checkout/sessions/")){
  const id=path.split("/")[4];result=sessions.get(id);
  if(path.endsWith("/expire")&&result?.status==="open"){result={...result,status:"expired",payment_status:"unpaid"};sessions.set(id,result);}
 }else if(path.includes("/payment_intents/"))result=intents.get(path.split("/").at(-1));
 else if(path.includes("/events/"))result=events.get(path.split("/").at(-1));
 else throw Error("UNEXPECTED_PROVIDER_PATH");
 return {ok:!!result,json:async()=>structuredClone(result)};
};
const HttpsError=class extends Error{constructor(code,message){super(message);this.code=code;}};
const exports={};
const env={PENGUIN_STRIPE_WALLET_SANDBOX_ENABLED:"1",PENGUIN_STRIPE_WALLET_SANDBOX_CHECKOUT_ENABLED:"1",PENGUIN_STRIPE_WALLET_SANDBOX_TENANT_ID:tenantId,PENGUIN_STRIPE_WALLET_TEST_ACCOUNT_ID:account};
const source=readFileSync("functions/stripe-wallet-sandbox-checkout.js","utf8");
// Explicit local-only harness: real Firestore emulator, synthetic Stripe transport.
// Never alter process.env to enable the actual deployed endpoints.
vm.runInNewContext(source,{exports,require:name=>({"firebase-functions/v2/https":{onCall:(_,fn)=>fn,onRequest:(_,fn)=>fn,HttpsError},"firebase-functions/params":{defineSecret:n=>({value:()=>n.endsWith("_KEY")?key:hook})},"firebase-admin/firestore":{getFirestore:()=>db},"node:crypto":require("node:crypto"),"./stripe-wallet-sandbox-policy":policy,"./stripe-wallet-sandbox-ledger":ledger}[name]),process:{env},fetch:provider,URLSearchParams,AbortSignal});
const call=(name,data={},actor=auth)=>exports[name]({auth:actor,data});
async function webhook(event,tamper=false){
 events.set(event.id,event);
 const raw=Buffer.from(JSON.stringify(event)),stamp=Math.floor(Date.now()/1000);
 const sig="t="+stamp+",v1="+createHmac("sha256",hook).update(String(stamp)+".").update(raw).digest("hex");
 const response={status:n=>{response.code=n;return response},send:()=>response};
 await exports.stripeWalletSandboxWebhook({method:"POST",rawBody:tamper?Buffer.concat([raw,Buffer.from(" ")]):raw,get:()=>sig},response);
 return response.code;
}
const event=(id,session,type="checkout.session.completed")=>({id,type,livemode:false,data:{object:session}});
test("actual Firestore + synthetic Stripe: readiness, one reservation, duplicate signed events, expiration and live wallet isolation",async()=>{
 await Promise.all([tenant.set({active:true}),tenant.collection("settings").doc("lalamove").set({accountMode:"fod_central",fodCentralApproved:true}),live.set({balance:777,currency:"THB"}),db.collection("users").doc(uid).set({active:true,role:"owner",tenantId}),db.collection("users").doc(admin).set({active:true,role:"super_admin"}),db.collection("users").doc(other).set({active:true,role:"owner",tenantId:"other"})]);
 const ref=randomUUID(),ref2=randomUUID();
 assert.equal((await call("getOwnStripeWalletSandbox")).available,false);
 await assert.rejects(call("createStripeWalletSandboxCheckout",{referenceId:ref,amount:"300"}),{code:"failed-precondition"});
 assert.equal(calls.length,0);
 const handshake=event("evt_FAKEHANDSHAKE123",{id:"cs_test_FAKEHANDSHAKE123",metadata:{}});
 assert.equal(await webhook(handshake,true),400);
 assert.equal(await webhook(handshake),200);
 assert.equal((await call("getPlatformStripeWalletSandboxGate",{}, {uid:admin})).checkoutEnabled,true);
 assert.equal((await call("getOwnStripeWalletSandbox")).available,true);
 await assert.rejects(call("createStripeWalletSandboxCheckout",{referenceId:ref,amount:"300"},{uid:other}),{code:"permission-denied"});
 const concurrent=await Promise.allSettled([call("createStripeWalletSandboxCheckout",{referenceId:ref,amount:"300"}),call("createStripeWalletSandboxCheckout",{referenceId:ref2,amount:"200"})]);
 assert.equal(concurrent.filter(r=>r.status==="fulfilled").length,1);
 const winner=concurrent.find(r=>r.status==="fulfilled").value.item;
 const winnerRef=winner.referenceId,amount=winner.amountSatang;
 const retry=await call("createStripeWalletSandboxCheckout",{referenceId:winnerRef,amount:String(amount/100)});
 assert.equal(retry.item.checkoutUrl,winner.checkoutUrl);assert.equal(sessions.size,1);
 await assert.rejects(call("createStripeWalletSandboxCheckout",{referenceId:winnerRef,amount:"999"}));
 const session=[...sessions.values()][0],intentId="pi_FAKEINTENT12345678";
 const paid={...session,status:"complete",payment_status:"paid",payment_intent:intentId};
 sessions.set(session.id,paid);
 const intent={id:intentId,livemode:false,status:"succeeded",currency:"thb",amount,amount_received:amount-1,metadata:paid.metadata,payment_method_types:["promptpay"]};
 intents.set(intentId,intent);
 assert.equal(await webhook(event("evt_FAKEWRONGAMOUNT123",paid)),503);
 assert.equal((await root.get()).data().balanceSatang,undefined);
 intents.set(intentId,{...intent,amount_received:amount});
 const duplicate=event("evt_FAKEPAID123456",paid);
 const results=await Promise.all([webhook(duplicate),webhook(duplicate),call("checkStripeWalletSandboxCheckout",{referenceId:winnerRef})]);
 assert.deepEqual(results.slice(0,2),[200,200]);
 assert.equal(results[2].item.status,"verified");
 assert.equal((await root.get()).data().balanceSatang,amount);
 assert.equal((await root.collection("ledger").get()).size,1);
 assert.equal((await db.collection("stripeWalletSandboxIntentClaims").doc(intentId).get()).data().referenceId,winnerRef);
 assert.equal((await live.get()).data().balance,777);
 const third=randomUUID();const topup=await call("createStripeWalletSandboxCheckout",{referenceId:third,amount:"50.25"});
 assert.equal(topup.item.amountSatang,5025);
 const expired=await call("expireStripeWalletSandboxCheckout",{referenceId:third});assert.equal(expired.item.status,"expired");
 assert.equal((await root.get()).data().pendingReference,null);
 assert.equal((await root.get()).data().balanceSatang,amount);
 assert.equal((await live.get()).data().balance,777);
 const history=await call("getPlatformStripeWalletSandboxHistory",{tenantId},{uid:admin});
 assert.equal(history.balanceSatang,amount);assert.equal(history.items.length,2);
 assert.equal(history.items.some(row=>"checkoutUrl" in row),false);
 await assert.rejects(call("getPlatformStripeWalletSandboxHistory",{tenantId}),{code:"permission-denied"});
 assert.equal((await call("getPlatformStripeWalletSandboxHistory",{tenantId:"other"},{uid:admin})).available,false);
});
test("deployed callable refuses actual provider in emulator, including explicit enable flag",async()=>{
 const actual=require("./stripe-wallet-sandbox-checkout");
 const result=await actual.getOwnStripeWalletSandbox.run({auth,data:{}});
 assert.equal(result.available,false);assert.equal(result.balanceSatang,null);
 await assert.rejects(actual.createStripeWalletSandboxCheckout.run({auth,data:{referenceId:randomUUID(),amount:"300"}}),{code:"failed-precondition"});
});
