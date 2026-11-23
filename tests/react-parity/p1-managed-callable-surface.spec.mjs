import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {assertManagedEmailVerified}=require("./managed-email-callable");

function stub(profile,{fail=false}={}){
 let reads=0;
 const db={collection(name){
  assert.equal(name,"users");
  return {doc(uid){
   assert.equal(uid,"managed-owner-1234");
   return {async get(){
    reads++;
    if(fail)throw Error("BACKEND_OFFLINE");
    return {exists:profile!==undefined,data:()=>profile};
   }};
  }};
 }};
 return {db,reads:()=>reads};
}
const actor=(token)=>({auth:{uid:"managed-owner-1234",token}});
test("verified provider token avoids profile read; public/anonymous calls retain handler policy",async()=>{
 const offline=stub({emailVerificationRequired:true},{fail:true});
 await assertManagedEmailVerified({auth:{uid:"managed-owner-1234",
  token:{email_verified:true}}},{db:offline.db});
 await assertManagedEmailVerified({auth:null},{db:offline.db});
 await assertManagedEmailVerified({},{db:offline.db});
 assert.equal(offline.reads(),0);
});
test("unverified managed actor denied before all native Callable handlers; missing token is never proof",async()=>{
 const profile=stub({role:"owner",active:true,emailVerificationRequired:true});
 await assert.rejects(assertManagedEmailVerified(actor({email_verified:false}),{db:profile.db}),
  error=>error.code==="permission-denied"&&
    error.message==="MANAGED_EMAIL_VERIFICATION_REQUIRED");
 await assert.rejects(assertManagedEmailVerified(actor({}),{db:profile.db}),
  error=>error.code==="permission-denied");
 await assert.rejects(assertManagedEmailVerified(actor(undefined),{db:profile.db}),
  error=>error.code==="permission-denied");
 assert.equal(profile.reads(),3);
});
test("legacy profile, absent profile and self-signup without marker continue existing downstream policy",async()=>{
 for(const profile of [undefined,{role:"owner",active:true},
  {emailVerificationRequired:false},
  {emailVerificationRequired:null}]){
  const store=stub(profile);
  await assertManagedEmailVerified(actor({email_verified:false}),{db:store.db});
  assert.equal(store.reads(),1);
 }
});
test("unknown Firestore lookup never implies verified/legacy; fail closed on outage",async()=>{
 const store=stub(undefined,{fail:true});
 await assert.rejects(assertManagedEmailVerified(actor({email_verified:false}),{db:store.db}),
  error=>error.code==="unavailable"&&
    error.message==="MANAGED_EMAIL_VERIFICATION_CHECK_UNAVAILABLE");
 assert.equal(store.reads(),1);
});
test("every exported v2 Callable definition uses a single shared pre-handler Auth gate",()=>{
 const root=new URL("../../functions/",import.meta.url);
 const files=readdirSync(root).filter(n=>n.endsWith(".js")&&n!=="managed-email-callable.js");
 let modules=0,definitions=0;
 for(const name of files){
  const text=readFileSync(new URL(name,root),"utf8");
  const count=(text.match(/\bonCall\s*\(/g)||[]).length;
  if(!count)continue;
  modules++;
  definitions+=count;
  assert.match(text,/require\(["']\.\/managed-email-callable["']\)/,
   name+" did not use central pre-handler gate");
  assert.doesNotMatch(text,/require\(["']firebase-functions\/v2\/https["']\)/,
   name+" may import an unguarded onCall");
 }
 assert.equal(modules,45,"audit each of the 45 callable modules");
 assert.equal(definitions,144,"audit the complete 144-Callable surface");
 const source=readFileSync(new URL("managed-email-callable.js",root),"utf8");
 assert.match(source,/await assertManagedEmailVerified\(request\);\s*return handler\(request,\.\.\.rest\)/);
 assert.match(source,/request.auth\?\.token\?\.email_verified === true/);
});
test("7 HTTP webhook/device/tax handlers remain separate from Firebase Auth Callable gating",()=>{
 const root=new URL("../../functions/",import.meta.url);
 const modules={
  "lk-shop-device-gateway.js":1,
  "payment-companion.js":2,
  "lalamove-webhook.js":1,
  "stripe-wallet-sandbox-checkout.js":1,
  "m7-stripe-test-checkout.js":1,
  "tax-buyer-lookup.js":1,
 };
 let endpoints=0;
 for(const [name,count] of Object.entries(modules)){
  const source=readFileSync(new URL(name,root),"utf8");
  const found=(source.match(/\bonRequest\s*\(/g)||[]).length;
  assert.equal(found,count,name);
  endpoints+=count;
 }
 assert.equal(endpoints,7);
 const native=require("firebase-functions/v2/https");
 const wrapper=require("./managed-email-callable");
 assert.strictEqual(wrapper.onRequest,native.onRequest,
  "Webhook and device endpoints keep their original signature/credential trust model");
 assert.match(readFileSync(new URL("lalamove-webhook.js",root),"utf8"),
   /validSignature\(payload, credentials.apiSecret\)/);
 assert.match(readFileSync(new URL("stripe-wallet-sandbox-checkout.js",root),"utf8"),
   /verifyWebhook\(req.rawBody/);
 assert.match(readFileSync(new URL("payment-companion.js",root),"utf8"),
   /authorized\(db,tx,bearer\(req\)\)/);
 assert.match(readFileSync(new URL("tax-buyer-lookup.js",root),"utf8"),
   /Access-Control-Allow-Origin', '\*'/);
});
