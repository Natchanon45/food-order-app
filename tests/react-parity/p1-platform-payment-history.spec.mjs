import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const source=fs.readFileSync("functions/revenue-share.js","utf8");
function fixture(role="super_admin",active=true){
 const rowsA=[{id:"same",status:"approved",platformAmountDue:75,createdAt:"2026-11-21T00:00:00Z",periodStart:"2026-11-20",periodEnd:"2026-11-20",slipVerificationProvider:"slip2go",slipPath:"private-slip",ocr:{sensitive:"secret"}},...Array.from({length:201},(_,i)=>({id:"p"+i,status:"pending",platformAmountDue:12.5,createdAt:new Date(Date.UTC(2025,0,1+i)).toISOString()}))];
 const rowsB=[{id:"same",status:"rejected",platformAmountDue:21,createdAt:"2026-11-22T00:00:00Z"},{id:"unknown",status:"unknown",createdAt:"2026-11-20T00:00:00Z",platformAmountDue:"not-money"},{id:"fraction",status:"approved",createdAt:"2026-11-19T00:00:00Z",platformAmountDue:1.234}];
 const tenant=(id,rows)=>({id,exists:true,data:()=>({name:"Demo "+id}),ref:{collection:name=>{assert.equal(name,"revenueSharePayments");let filter="all",limit;const q={where:(f,op,v)=>{assert.equal(f,"status");assert.equal(op,"==");filter=v;return q},orderBy:(f,dir)=>{assert.equal(f,"createdAt");assert.equal(dir,"desc");return q},limit:n=>{limit=n;return q},get:async()=>({docs:rows.filter(r=>filter==="all"||r.status===filter).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,limit).map(r=>({id:r.id,data:()=>r}))})};return q}}});
 const tenants=[tenant("a",rowsA),tenant("b",rowsB)];
 const db={collection:name=>{if(name==="users")return{doc:()=>({get:async()=>({data:()=>({role,active})})})};assert.equal(name,"tenants");return{get:async()=>({docs:tenants}),doc:id=>({get:async()=>tenants.find(t=>t.id===id)||{exists:false}})};}};
 const deps={
 "firebase-functions/v2/https":{onCall:(_,fn)=>fn,HttpsError:class extends Error{constructor(code,message){super(message);this.code=code}}},
 "firebase-functions/v2/scheduler":{onSchedule:(_,fn)=>fn},
 "firebase-admin/firestore":{getFirestore:()=>db,FieldValue:{}},
 "firebase-admin/storage":{getStorage:()=>({})},
 "node:crypto":require("node:crypto"),
 "./finance-slip-claims":require("../../functions/finance-slip-claims.js"),
 "./finance-manual-review-policy":require("../../functions/finance-manual-review-policy.js"),
 "./delivery-threshold-schedule":require("../../functions/delivery-threshold-schedule.js"),
 "./billing-anniversary":require("../../functions/billing-anniversary.js"),
 "./subscription-pricing-core":require("../../functions/subscription-pricing-core.js"),
 "./revenue-share-policy":require("../../functions/revenue-share-policy.js"),
 "./slip-verification":{inspectSlip:()=>{throw Error("unexpected provider call")}}
 };
  // This isolated business-logic harness stubs Firebase HTTPS; security is
  // separately verified against the actual wrapped Callables in Emulator.
  deps["./managed-email-callable"] = deps["firebase-functions/v2/https"];
 const m={exports:{}};
 new Function("module","exports","require",source)(m,m.exports,key=>{assert.ok(key in deps,key);return deps[key]});
 return m.exports.getPlatformRevenueSharePaymentHistory;
}
const ask=(fn,data={})=>fn({auth:{uid:"admin"},data});
test("history is an all-date, bounded, sorted projection with no private slip or Stripe claims",async()=>{
 const result=await ask(fixture(),{status:"all",date:"1900-01-01"});
 assert.equal(result.source,"firebase_revenue_share_payment_records");
 assert.equal(result.currency,"THB");
 assert.equal(result.items.length,200);
 assert.equal(result.hasMore,true);
 assert.equal(result.items[0].tenantId,"b");
 assert.equal(result.items[1].tenantId,"a");
 assert.equal(result.items[1].amountCents,7500);
 assert.equal(result.items.find(r=>r.paymentId==="unknown").amountCents,null);
 assert.equal(result.items.find(r=>r.paymentId==="fraction").amountCents,null);
 for(const word of ["private-slip","sensitive","verifiedCents","invoiceKey"])assert.ok(!JSON.stringify(result).includes(word));
});
test("server filters before limit and isolates selected tenant, rejects unauthorized or invalid filters",async()=>{
 const fn=fixture(); const approved=await ask(fn,{tenantId:"a",status:"approved"});
 assert.equal(approved.items.length,1);assert.equal(approved.items[0].status,"approved");assert.equal(approved.hasMore,false);
 assert.deepEqual((await ask(fn,{tenantId:"missing"})).items,[]);
 await assert.rejects(ask(fn,{status:"verified"}),{code:"invalid-argument"});
 await assert.rejects(ask(fn,{tenantId:"../b"}),{code:"invalid-argument"});
 await assert.rejects(ask(fixture("owner")),{code:"permission-denied"});
 await assert.rejects(ask(fixture("super_admin",false)),{code:"permission-denied"});
});
