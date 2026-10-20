import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {previewHybridJournalManifest,validateFenceRows,MAX_PAGES}=
 require("../../functions/hybrid-billing-manifest-preview.js");
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const tenantId="tenant-manifest-test-101";
function mockScan(total,{onRead}={}){
 const db={collection:()=>({doc:()=>({})})};
 const readPage=async({afterId,pageSize})=>{
   const start=afterId===null?0:Number(afterId.slice(2));
   const end=Math.min(start+pageSize,total);
   if(onRead)await onRead(start);
   return {tenantId,scanned:end-start,issues:[],issueCount:0,coverageCertified:false,
     hasMore:end<total,nextAfterId:end<total?"id"+end:null,
     pageDigest:hash([start,end,total])};
 };
 return {db,readPage};
}
test("bounded source-only 3,001-record candidate traverses 16 deterministic pages, never certifies or invoices",async()=>{
 const {db,readPage}=mockScan(3001),readFences=async()=>Array(16).fill(0);
 const a=await previewHybridJournalManifest({db,tenantId,pageSize:200,
   readPage,readFences});
 const b=await previewHybridJournalManifest({db,tenantId,pageSize:200,
   readPage,readFences});
 assert.equal(a.scanned,3001);
 assert.equal(a.pages,16);
 assert.equal(a.issueCount,0);
 assert.equal(a.rootDigest,b.rootDigest);
 assert.match(a.rootDigest,/^[a-f0-9]{64}$/);
 assert.equal(a.coverageCertified,false);
 assert.equal(a.canIssueInvoice,false);
 const index=readFileSync("functions/index.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-manifest-preview|previewHybridJournalManifest/);
});
test("manifest fails closed on racing writer, partial scan, malformed page or fence",async()=>{
 let versions=Array(16).fill(0);
 const {db,readPage}=mockScan(401);
 const readFences=async()=>[...versions];
 await assert.rejects(previewHybridJournalManifest({db,tenantId,pageSize:200,
  readPage,readFences,afterPage:({pageIndex})=>{
    if(pageIndex===0)versions[4]++;
  }}),/HYBRID_MANIFEST_WRITER_RACE/);
 versions=Array(16).fill(0);
 await assert.rejects(previewHybridJournalManifest({db,tenantId,pageSize:200,
  maxPages:2,readPage,readFences}),/HYBRID_MANIFEST_PAGE_LIMIT_NOT_COMPLETE/);
 await assert.rejects(previewHybridJournalManifest({db,tenantId,pageSize:200,
  readFences,readPage:async()=>({...await readPage({afterId:null,pageSize:200}),
    pageDigest:"invalid"})}),/HYBRID_MANIFEST_PAGE_INCOMPLETE/);
 assert.throws(()=>validateFenceRows([{shard:0,version:0}]),
   /HYBRID_MANIFEST_FENCE_INCOMPLETE/);
 assert.equal(MAX_PAGES,100);
});
test("manifest mock source exceptions cannot become a certified or payable snapshot",async()=>{
 const {db,readPage}=mockScan(2);
 const resp=await previewHybridJournalManifest({db,tenantId,
  readFences:async()=>Array(16).fill(0),
  readPage:async input=>({...await readPage(input),issues:[{
    orderId:"order-legacy-001",reason:"noncanonical_paid_at"}],issueCount:1})});
 assert.equal(resp.issueCount,1);
 assert.equal(resp.coverageCertified,false);
 assert.equal(resp.canIssueInvoice,false);
});
