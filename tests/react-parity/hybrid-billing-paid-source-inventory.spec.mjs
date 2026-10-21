import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {inspectHybridPaidWriterSourcesCandidate}=require(
 "../../functions/hybrid-billing-paid-source-inventory.js");
const tenantId="tenant-source-unit-081";
function fakeDB(rows){
 const items=rows.map((data,i)=>({id:"paid-source-"+String(i).padStart(4,"0"),
   data:()=>data}));
 const events=[];
 const q={_limit:200,_cursor:null,where(){return this},orderBy(){return this},
  limit(n){this._limit=n;return this},startAfter(id){this._cursor=id;return this},
  async get(){
   const k=this._cursor===null?0:items.findIndex(x=>x.id===this._cursor)+1;
   const docs=items.slice(k,k+this._limit);
   events.push({cursor:this._cursor,limit:this._limit,count:docs.length});
   return {size:docs.length,docs};
  }};
 const tenant={async get(){return {exists:true,data:()=>({
  hybridBillingEnabled:true,billingPolicyVersion:"hybrid_v1"})}},
  collection(name){assert.equal(name,"orders");return q;}};
 const db={collection(name){assert.equal(name,"tenants");return {
  doc(id){assert.equal(id,tenantId);return tenant;}}}};
 return {db,events};
}
test("Phase3Y paid writer inventory flags legacy, missing, prototype keys and stays never-certified",async()=>{
 const base={orderType:"delivery",paymentStatus:"paid",paidAt:{toMillis:()=>1000}};
 const {db,events}=fakeDB([
  {...base,paymentReceiptSource:"hybrid_cod_cashier_server"},
  {...base,paymentReceiptSource:"__proto__"},
  {...base},
  {...base,paymentReceiptSource:"hybrid_promptpay_bank_verified_server"}
 ]);
 const a=await inspectHybridPaidWriterSourcesCandidate({db,tenantId,pageSize:2});
 assert.equal(a.scanned,4);
 assert.equal(a.unregisteredCount,2);
 assert.equal(a.unregisteredSources["__proto__"],1);
 assert.equal(a.unregisteredSources["(missing_or_invalid)"],1);
 assert.equal(a.approvedSources.hybrid_cod_cashier_server,1);
 assert.equal(a.approvedSources.hybrid_promptpay_bank_verified_server,1);
 assert.equal(a.sourceCompletenessProven,false);
 assert.equal(a.writerParticipationComplete,false);
 assert.equal(a.coverageCertified,false);
 assert.equal(a.canIssueInvoice,false);
 assert.match(a.advisoryDigest,/^[a-f0-9]{64}$/);
 assert.equal(events.length,3);
 assert.equal({}.polluted,undefined);
 const index=readFileSync("functions/index.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-paid-source-inventory/);
});
test("Phase3Y inventory enforces bounded scan and cannot turn it into certified coverage",async()=>{
 const data={paymentStatus:"paid",orderType:"delivery",
  paymentReceiptSource:"hybrid_cod_cashier_server",paidAt:{toMillis:()=>1}};
 const {db}=fakeDB([data,data,data]);
 await assert.rejects(inspectHybridPaidWriterSourcesCandidate({
  db,tenantId,maxRows:2,pageSize:2}),/HYBRID_SOURCE_INVENTORY_LIMIT/);
 await assert.rejects(inspectHybridPaidWriterSourcesCandidate({
  db,tenantId,pageSize:201}),/HYBRID_SOURCE_INVENTORY_BAD_REQUEST/);
 await assert.rejects(inspectHybridPaidWriterSourcesCandidate({
  db,tenantId,maxRows:10001}),/HYBRID_SOURCE_INVENTORY_BAD_REQUEST/);
});
