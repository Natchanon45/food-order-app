"use strict";
// Phase3AI SOURCE-ONLY / UNEXPORTED. Immutable review-baseline tripwire for
// selected deployed entrypoints plus a narrow direct-key mutation inventory.
// CI passing here DOES NOT mean global Admin SDK/REST/browser enforcement.
const {createHash}=require("node:crypto");
const {readFileSync,readdirSync}=require("node:fs");
const {join}=require("node:path");
const PINS=Object.freeze({
 "index.js":"c3511f05b723dfcdfd3b7fcdbb9133519c966ec4",
 "delivery-slip.js":"be9fe40606057932728e6d05ec16b5ecbc54d166",
 "operational-orders.js":"c0d2de28bb949d43d283e783ca147d4ebffe651a",
 "public-delivery-submit.js":"0be3cdebc2ecb85399499d6e240a99f97b307efe",
 "lalamove-order-lifecycle.js":"4e6964c5f36e9172647f19ca5fd735ae374dfff4",
 "lalamove-webhook.js":"a6716d828f9349846afba1481b1bef89efcd811c",
 "retail-pos-backup.js":"f56f25d6579fb055322d58106aaf00a8208eaa68",
 "saas-migration.js":"91a286e8612113fe67086e510ec8211a57460e36",
 "tenant-admin.js":"fa830dc6fac9f973b1f9d74b14097c51845b2dfc",
 "revenue-share.js":"393edfeaa54d4aeb3f62fb431c16fad69c8eb802",
 "subscription-admin.js":"f992e8e5744d6ae56b84d65728012ad2179258ff",
 "hybrid-billing-legacy-payment-guard.js":"a696082ffb84ef5cd3eb7ee42d89977e3019d2e5"
});
const KEYS=Object.freeze(["paymentStatus","paidAt","refundTotal","refundAmount","paymentReceiptSource"]);
const BASELINE=Object.freeze({
 "delivery-slip.js":Object.freeze({paymentStatus:2,paidAt:2}),
 "operational-orders.js":Object.freeze({paymentStatus:1,paidAt:1}),
 "public-delivery-submit.js":Object.freeze({paymentStatus:1})
});
function gitBlobSha(source){
 if(typeof source!=="string")throw Error("HYBRID_INGRESS_MISSING_SOURCE");
 const bytes=Buffer.from(source,"utf8");
 return createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0"))
  .update(bytes).digest("hex");
}
// Strip comments, preserve quoted property names and string literals.
// This is still a lexical inspection, not AST/data-flow/runnable enforcement.
function removeComments(source){
 let out="",mode="normal",escaped=false;
 for(let i=0;i<source.length;i++){
  const c=source[i],n=source[i+1];
  if(mode==="line"){
   if(c==="\n"){out+="\n";mode="normal"}else out+=" ";
   continue;
  }
  if(mode==="block"){
   if(c==="*"&&n==="/"){out+="  ";i++;mode="normal";}
   else out+=c==="\n"?"\n":" ";
   continue;
  }
  if(mode==="string"){
   out+=c;
   if(escaped){escaped=false;continue;}
   if(c==="\\"){escaped=true;continue;}
   if(c===quote)mode="normal";
   continue;
  }
  if(c==="/"&&n==="/"){out+="  ";i++;mode="line";continue}
  if(c==="/"&&n==="*"){out+="  ";i++;mode="block";continue}
  if(c==='"'||c==="'"||c==="`"){mode="string";quote=c;out+=c;continue}
  out+=c;
 }
 return out;
}
let quote="";
function mutationKeys(source){
 const text=removeComments(source),counts=Object.fromEntries(KEYS.map(k=>[k,0]));
 // Direct object literals including quoted or computed constant keys.
 // This tripwire intentionally errs on the side of blocking review if
 // a source adds a matching field, regardless of its value.
 for(const key of KEYS){
  const escaped=key;
  const literal=new RegExp("(?:\\b"+escaped+"\\b|[\"']"+escaped+"[\"']|\\[\\s*[\"']"+escaped+"[\"']\\s*\\])\\s*:", "g");
  counts[key]+=[...text.matchAll(literal)].length;
  // Explicit direct member assignment; never count ==, === or =>.
  const assignment=new RegExp("(?:\\."+escaped+"\\b|\\[\\s*[\"']"+escaped+"[\"']\\s*\\])\\s*(?:=(?!=)|\\+=|-=)", "g");
  counts[key]+=[...text.matchAll(assignment)].length;
 }
 return Object.fromEntries(Object.entries(counts).filter(([,n])=>n!==0));
}
function auditHybridPrivilegedIngressCandidate({
 readSource=name=>readFileSync(join(__dirname,name),"utf8"),
 listFiles=()=>readdirSync(__dirname).filter(x=>x.endsWith(".js"))
}={}){
 if(typeof readSource!=="function"||typeof listFiles!=="function")
  throw Error("HYBRID_INGRESS_REVIEW_REQUIRED");
 const files=listFiles();
 if(!Array.isArray(files)||files.some(x=>typeof x!=="string"||!/^[-a-z0-9]+\.js$/.test(x))
  ||new Set(files).size!==files.length)throw Error("HYBRID_INGRESS_FILE_LIST_INVALID");
 for(const [name,sha] of Object.entries(PINS)){
  if(!files.includes(name))throw Error("HYBRID_INGRESS_MISSING_REVIEWED_SOURCE: "+name);
  if(gitBlobSha(readSource(name))!==sha)
   throw Error("HYBRID_INGRESS_REVIEWED_SOURCE_CHANGED: "+name);
 }
 // Source-only hybrid finance candidates are intentionally excluded from
 // the deployed non-hybrid literal inventory: index.js itself is pinned.
 const observed=[];
 for(const name of files.filter(x=>!x.startsWith("hybrid-billing-")).sort()){
  const actual=mutationKeys(readSource(name));
  const expected=BASELINE[name]||{};
  if(JSON.stringify(Object.entries(actual).sort())!==
     JSON.stringify(Object.entries(expected).sort()))
   throw Error("HYBRID_INGRESS_NEW_OR_CHANGED_FINANCIAL_MUTATION: "+name+
     " expected="+JSON.stringify(expected)+" actual="+JSON.stringify(actual));
  if(Object.keys(actual).length)observed.push({file:name,keys:actual});
 }
 return {status:"source_review_baseline_only",reviewedEntrypoints:Object.keys(PINS).length,
  observed,unknownAdminSdkRoutesClosed:false,
  runtimeEnforcement:false,writerParticipationComplete:false,
  sourceCompletenessProven:false,coverageCertified:false,
  canMarkPaid:false,canIssueInvoice:false};
}
module.exports={PINS,BASELINE,gitBlobSha,mutationKeys,
 auditHybridPrivilegedIngressCandidate};
