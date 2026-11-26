import test from "node:test";
import assert from "node:assert/strict";
import history from "../../functions/provider-receipt-history.js";
const {readProviderReceiptHistory:read}=history;
const now="2026-11-26T02:00:00.000Z";
const row=(scope,tenantId,n)=>({id:String(n).padStart(64,"0"),data:()=>({
 schemaVersion:1,scope,tenantId,provider:"example",source:"provider",paymentVerified:false,
 currency:"THB",amountMinor:9900,occurredAt:now,recordedAt:now,fingerprint:"private"
})});
function fixture(){
 const docs=[row("tenant","a",1),row("tenant","b",2),row("platform","",3),row("tenant","a",4)];
 const users={root:{active:true,role:"super_admin"},a:{active:true,role:"owner",tenantId:"a"},
 b:{active:true,role:"admin",tenantId:"b"},staff:{active:true,role:"cashier",tenantId:"a"},
 pending:{active:true,role:"owner",tenantId:"a",emailVerificationRequired:true},
 off:{active:false,role:"owner",tenantId:"a"},inactive:{active:true,role:"owner",tenantId:"inactive"}};
 const tenants={a:{active:true},b:{active:true},inactive:{active:false}};
 let historyReads=0;
 const db={collection(name){return {
 doc(id){return {name,id};},
 where(field,op,value){assert.equal(name,"providerReceiptRecordsV1");assert.equal(op,"==");
 const filters=[[field,value]];return {where(f,o,v){assert.equal(o,"==");filters.push([f,v]);return this;},
 orderBy(f,o){assert.equal(f,"occurredAt");assert.equal(o,"desc");return this;},
 limit(n){return {query:true,filters,n};}};}
 };},async runTransaction(fn){return fn({async get(ref){
 if(ref.query){historyReads++;return {docs:docs.filter(d=>ref.filters.every(([f,v])=>d.data()[f]===v)).slice(0,ref.n)};}
 return {data:()=>ref.name==="users"?users[ref.id]:tenants[ref.id]};
 }});}};
 return {db,docs,get historyReads(){return historyReads;}};
}
test("merchant and central history use only canonical scope and hide private fingerprint",async()=>{
 const f=fixture();
 const a=await read(f.db,{uid:"a"},{scope:"tenant"});
 const b=await read(f.db,{uid:"b"},{scope:"tenant"});
 const root=await read(f.db,{uid:"root"},{scope:"platform"});
 assert.deepEqual(a.items.map(x=>x.id),[f.docs[0].id,f.docs[3].id]);
 assert.deepEqual(b.items.map(x=>x.id),[f.docs[1].id]);
 assert.deepEqual(root.items.map(x=>x.id),[f.docs[2].id]);
 assert.equal(Object.hasOwn(a.items[0],"fingerprint"),false);
 assert.equal(a.items[0].paymentVerified,false);
});
test("denies unauthorized profiles before reading history",async()=>{
 const f=fixture();
 for(const uid of ["staff","pending","off","inactive","missing","root"])
  await assert.rejects(read(f.db,{uid},{scope:"tenant"}),{code:"permission-denied"});
 await assert.rejects(read(f.db,{uid:"a"},{scope:"platform"}),{code:"permission-denied"});
 await assert.rejects(read(f.db,null,{scope:"platform"}),{code:"unauthenticated"});
 assert.equal(f.historyReads,0);
});
test("rejects caller supplied tenant and invalid limit; returns bounded history",async()=>{
 const f=fixture();
 for(const input of [{scope:"tenant",tenantId:"b"},{scope:"tenant",limit:0},{scope:"tenant",limit:51},{scope:"tenant",limit:1.5}])
  await assert.rejects(read(f.db,{uid:"a"},input),{code:"invalid-argument"});
 const r=await read(f.db,{uid:"a"},{scope:"tenant",limit:1});
 assert.equal(r.items.length,1);assert.equal(r.hasMore,true);
});
test("fails closed for malformed stored data",async()=>{
 const f=fixture(),d=f.docs[0],original=d.data;
 d.data=()=>({...original(),paymentVerified:true});
 await assert.rejects(read(f.db,{uid:"a"},{scope:"tenant"}),{code:"PROVIDER_RECEIPT_RECORD_INVALID"});
});
