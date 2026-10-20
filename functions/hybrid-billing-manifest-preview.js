"use strict";

// SOURCE-ONLY, UNEXPORTED. A deterministic READ-ONLY witness of a complete
// paged scan. It is NOT a financial invoice, a certified writer-wide snapshot,
// or proof that all settlement writers participated in receipt journaling.
const {createHash}=require("node:crypto");
const {inspectHybridJournalCoveragePage,SHARDS}=require("./hybrid-billing-receipt-journal");
const SAFE_ID=/^[A-Za-z0-9_-]{8,128}$/;
const MAX_PAGES=100;
const sha=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
function validateFenceRows(rows){
 if(!Array.isArray(rows)||rows.length!==SHARDS)throw Error("HYBRID_MANIFEST_FENCE_INCOMPLETE");
 const sorted=[...rows].sort((a,b)=>a.shard-b.shard);
 for(let i=0;i<SHARDS;i++){
   if(sorted[i]?.shard!==i||!Number.isSafeInteger(sorted[i]?.version)
     ||sorted[i].version<0)throw Error("HYBRID_MANIFEST_FENCE_INVALID");
 }
 return sorted.map(x=>x.version);
}
async function readFenceVersions(tenantRef){
 const snapshots=await Promise.all(Array.from({length:SHARDS},(_,i)=>
   tenantRef.collection("hybridBillingReceiptFences")
     .doc("shard-"+String(i).padStart(2,"0")).get()));
 return validateFenceRows(snapshots.map((s,i)=>({
   shard:i,version:s.exists?s.data()?.version:0
 })));
}
/**
 * Bounded complete scan with pre/post journal writer-fence comparison.
 *
 * Even identical fences cannot certify a cross-page read: an old writer may
 * bypass the fence, an unauthorized mutation might not bump it, and a valid
 * writer might commit AFTER the second read. Require a new coordinated writer
 * barrier + immutable manifests before a live billing cutover.
 *
 * `afterPage` is an internal test-only scheduling hook; never expose a
 * public callable accepting caller-defined functions.
 */
async function previewHybridJournalManifest({
 db,tenantId,pageSize=100,maxPages=MAX_PAGES,afterPage=undefined,
 readPage=inspectHybridJournalCoveragePage,readFences=readFenceVersions,
}){
 if(!db||!SAFE_ID.test(String(tenantId||""))
   ||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>200
   ||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>MAX_PAGES
   ||(afterPage!==undefined&&typeof afterPage!=="function")
   ||typeof readPage!=="function"||typeof readFences!=="function")
    throw Error("HYBRID_MANIFEST_BAD_REQUEST");
 const t=db.collection("tenants").doc(tenantId);
 const before=validateFenceRows(
   (await readFences(t)).map((version,shard)=>({shard,version})));
 let cursor=null,scanned=0,issueCount=0,hasMore=true;
 const pages=[],issues=[];
 for(let page=0;page<maxPages&&hasMore;page++){
   const current=await readPage({db,tenantId,afterId:cursor,pageSize});
   if(!current||current.tenantId!==tenantId
      ||current.coverageCertified!==false
      ||!Number.isSafeInteger(current.scanned)
      ||current.scanned<0||current.scanned>pageSize
      ||!Number.isSafeInteger(current.issueCount)
      ||current.issueCount!==current.issues?.length
      ||current.scanned===0&&current.hasMore
      ||typeof current.pageDigest!=="string"
      ||!/^[a-f0-9]{64}$/.test(current.pageDigest)
      ||typeof current.hasMore!=="boolean"
      ||current.hasMore&&(!current.nextAfterId||current.nextAfterId===cursor)
      ||!current.hasMore&&current.nextAfterId!==null)
     throw Error("HYBRID_MANIFEST_PAGE_INCOMPLETE");
   scanned+=current.scanned;
   issueCount+=current.issueCount;
   pages.push([cursor,current.nextAfterId,current.scanned,current.pageDigest]);
   if(current.issueCount)issues.push(...current.issues.slice(0,Math.max(0,100-issues.length)));
   hasMore=current.hasMore;
   cursor=current.nextAfterId;
   if(afterPage)await afterPage({pageIndex:page,scanned,hasMore});
 }
 if(hasMore)throw Error("HYBRID_MANIFEST_PAGE_LIMIT_NOT_COMPLETE");
 const after=validateFenceRows(
   (await readFences(t)).map((version,shard)=>({shard,version})));
 if(before.some((value,i)=>value!==after[i]))
   throw Error("HYBRID_MANIFEST_WRITER_RACE");
 const rootDigest=sha(["hybrid_manifest_advisory_v1",tenantId,before,pages]);
 return {tenantId,scanned,pages:pages.length,issueCount,
   issues:issues.slice(0,100),rootDigest,fenceVersions:before,
   coverageCertified:false,canIssueInvoice:false,
   note:"advisory_read_only_non_atomic_no_provider_certification"};
}
module.exports={previewHybridJournalManifest,readFenceVersions,
 validateFenceRows,MAX_PAGES};
