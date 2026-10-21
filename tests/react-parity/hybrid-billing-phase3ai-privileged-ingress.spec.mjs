import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync,readdirSync} from "node:fs";
const require=createRequire(import.meta.url);
const {PINS,BASELINE,gitBlobSha,mutationKeys,
 auditHybridPrivilegedIngressCandidate}=require(
 "../../functions/hybrid-billing-phase3ai-privileged-ingress.js");
const read=n=>readFileSync("functions/"+n,"utf8");
const files=()=>readdirSync("functions").filter(n=>n.endsWith(".js"));
test("Phase3AI existing privileged source SHA fingerprints match reviewed Git blobs",()=>{
 for(const [name,sha] of Object.entries(PINS))
  assert.equal(gitBlobSha(read(name)),sha,"REVIEWED_SOURCE_CHANGED: "+name);
 assert.equal(Object.keys(PINS).length,10);
});
test("Phase3AI baseline audit scans source files and cannot claim global trust",()=>{
 const actual=auditHybridPrivilegedIngressCandidate({readSource:read,listFiles:files});
 assert.equal(actual.status,"source_review_baseline_only");
 assert.equal(actual.reviewedEntrypoints,10);
 assert.deepEqual(actual.observed.map(x=>x.file),
   ["delivery-slip.js","operational-orders.js","public-delivery-submit.js"]);
 assert.equal(actual.unknownAdminSdkRoutesClosed,false);
 assert.equal(actual.runtimeEnforcement,false);
 assert.equal(actual.writerParticipationComplete,false);
 assert.equal(actual.sourceCompletenessProven,false);
 assert.equal(actual.coverageCertified,false);
 assert.equal(actual.canMarkPaid,false);
 assert.equal(actual.canIssueInvoice,false);
});
test("Phase3AI direct mutation tripwire catches paid/refund fields beyond old literal-only regex",()=>{
 const s=[
  'tx.update(orderRef,{paymentStatus: candidateStatus,paidAt: serverTime})',
  'tx.update(orderRef,{["paymentStatus"]: candidateStatus})',
  "tx.update(orderRef,{'refundTotal': calculatedRefund})",
  'patch["paymentReceiptSource"] = incomingSource;',
  'record.paidAt = timestamp;',
 ].join("\n");
 assert.deepEqual(mutationKeys(s),{
  paymentStatus:2,paidAt:2,refundTotal:1,paymentReceiptSource:1
 });
 assert.deepEqual(mutationKeys('// paymentStatus: "paid"\n/* refundTotal: 1 */\nconst x = row.paymentStatus;'),{});
});
test("Phase3AI newly added unreviewed writer with nonliteral Paid status fails closed",()=>{
 const injected="danger-new-admin-writer.js";
 const all=[...files(),injected];
 const getter=name=>name===injected
  ?'const patch = {paymentStatus: request.data.status}; tx.update(orderRef,patch);'
  :read(name);
 assert.throws(()=>auditHybridPrivilegedIngressCandidate({
  readSource:getter,listFiles:()=>all
 }),/HYBRID_INGRESS_NEW_OR_CHANGED_FINANCIAL_MUTATION: danger-new-admin-writer\.js/);
});
test("Phase3AI edited critical source, including computed-key bypass, cannot silently pass fingerprint",()=>{
 const altered=name=>name==="delivery-slip.js"
  ?read(name)+'\nconst k="payment"+"Status"; tx.update(orderRef,{[k]:"paid"});'
  :read(name);
 assert.throws(()=>auditHybridPrivilegedIngressCandidate({
  readSource:altered,listFiles:files
 }),/HYBRID_INGRESS_REVIEWED_SOURCE_CHANGED: delivery-slip\.js/);
});
test("Phase3AI candidate remains completely unexported from server entrypoint",()=>{
 const index=read("index.js");
 assert.ok(!index.includes("hybrid-billing-phase3ai-privileged-ingress"));
 assert.ok(!index.includes("auditHybridPrivilegedIngressCandidate"));
 assert.equal(BASELINE["delivery-slip.js"].paymentStatus,2);
 assert.equal(PINS["index.js"].length,40);
});
