import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const source=readFileSync("functions/platform-stripe-setup.js","utf8");
const TEST_KEY="sk_test_FIXTURE_ONLY_12345",HOOK="whsec_FIXTURE_ONLY_12345";
function harness({profile={role:"super_admin",active:true},project="chat-45754",initial={},failHook=false}={}){
 const versions=new Map(Object.entries(initial)),calls=[],exports={};
 const HttpsError=class extends Error{constructor(code,message){super(message);this.code=code;}};
 const db={collection:()=>({doc:()=>({get:async()=>({data:()=>profile})})})};
 const fakeApp={options:{credential:{getAccessToken:async()=>({access_token:"fixture-token"})}}};
 const response=(data,ok=true)=>({ok,json:async()=>data});
 vm.runInNewContext(source,{exports,require:name=>({
  "./managed-email-callable":{HttpsError,onCall:(_,handler)=>handler},
  "firebase-admin/firestore":{getFirestore:()=>db},
  "firebase-admin/app":{getApp:()=>fakeApp}
 })[name],process:{env:{GCLOUD_PROJECT:project}},Buffer,AbortSignal,Date,fetch:async(url,opt)=>{
  if(url==="https://api.stripe.com/v1/account"){calls.push("provider-read");assert.equal(opt.redirect,"error");return response({id:"acct_FIXTURE123456789",livemode:false});}
  const m=url.match(/\/secrets\/(PENGUIN_STRIPE_WALLET_TEST_(?:KEY|WEBHOOK))(\/versions\?pageSize=1|:addVersion)$/);assert.ok(m,url);
  const name=m[1];if(m[2].startsWith("/"))return response({versions:versions.has(name)?[{state:versions.get(name)}]:[]});
  calls.push("add:"+name);if(failHook&&name.endsWith("WEBHOOK"))return response({},false);
  const value=Buffer.from(JSON.parse(opt.body).payload.data,"base64").toString();
  assert.equal(value,name.endsWith("WEBHOOK")?HOOK:TEST_KEY);
  versions.set(name,"ENABLED");return response({});
 }});
 return {exports,versions,calls};
}
const actor=()=>({uid:"fixture-super",token:{auth_time:Math.floor(Date.now()/1000)}});
const data={secretKey:TEST_KEY,webhookSecret:HOOK};
test("first-time setup saves only the two fixed test secrets and returns status, never values",async()=>{
 const h=harness();
 const initial=await h.exports.getPlatformStripeWalletSetup({auth:actor()});
 assert.equal(initial.keyPresent,false);assert.equal(initial.webhookPresent,false);assert.equal(initial.checkoutEnabled,false);
 const result=await h.exports.savePlatformStripeWalletSetup({auth:actor(),data});
 assert.equal(result.configured,true);assert.equal(result.providerVerified,false);assert.equal(result.webhookReady,false);assert.equal(result.checkoutEnabled,false);
 assert.equal(h.calls.length,3);assert.ok(!JSON.stringify(result).includes(TEST_KEY));assert.ok(!JSON.stringify(result).includes(HOOK));
 await assert.rejects(h.exports.savePlatformStripeWalletSetup({auth:actor(),data}),{code:"failed-precondition"});
 assert.equal(h.calls.length,3);
});
test("unauthenticated, owner, inactive admin, wrong project, stale login and invalid live key cannot write",async()=>{
 for(const [opts,auth,payload] of [[{},null,data],[{profile:{role:"owner",active:true}},actor(),data],[{profile:{role:"super_admin",active:false}},actor(),data],[{project:"demo-penguin-hybrid"},actor(),data],[{}, {uid:"fixture",token:{auth_time:1}},data],[{},actor(),{...data,secretKey:"sk_live_fixture123"}],[{},actor(),{...data,name:"other-secret"}]]){
  const h=harness(opts);await assert.rejects(h.exports.savePlatformStripeWalletSetup({auth,data:payload}));assert.equal(h.calls.length,0);
 }
});
test("partial write remains detectable, existing versions cannot be overwritten, missing field can be completed",async()=>{
 const h=harness({failHook:true});await assert.rejects(h.exports.savePlatformStripeWalletSetup({auth:actor(),data}),{code:"unavailable"});
 const status=await h.exports.getPlatformStripeWalletSetup({auth:actor()});assert.equal(status.keyPresent,true);assert.equal(status.webhookPresent,false);
 const resume=harness({initial:{"PENGUIN_STRIPE_WALLET_TEST_KEY":"ENABLED"}});
 const result=await resume.exports.savePlatformStripeWalletSetup({auth:actor(),data:{webhookSecret:HOOK}});
 assert.equal(result.configured,true);assert.equal(resume.calls.length,1);
 const disabled=harness({initial:{"PENGUIN_STRIPE_WALLET_TEST_KEY":"DISABLED","PENGUIN_STRIPE_WALLET_TEST_WEBHOOK":"ENABLED"}});
 assert.equal((await disabled.exports.getPlatformStripeWalletSetup({auth:actor()})).configured,false);
});
test("form uses password inputs and refuses save when storage readiness is unconfirmed",()=>{
 const page=readFileSync("react-app/src/components/BankalertStripePlatformSettings.jsx","utf8");
 for(const id of ["walletStripeSecret","walletStripeHook"])assert.match(page,new RegExp('id="'+id+'" className="input" type="password"'));
 assert.match(page,/!setup\?\.storageReady/);assert.match(page,/getPlatformStripeWalletSetup/);assert.match(page,/savePlatformStripeWalletSetup/);
 assert.doesNotMatch(page,/localStorage|sessionStorage/);
});
