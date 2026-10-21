import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {classifyPaidAt,previewHybridLegacyPaidAtQuarantineCandidate}=
 require("../../functions/hybrid-billing-demo-paidat-quarantine.js");
const {requireHybridDemoGatewayPreflight}=
 require("../../functions/hybrid-billing-demo-gateway-preflight.js");
const paid=paidAt=>({orderType:"delivery",paymentStatus:"paid",paidAt});
test("Phase3AJ legacy string and missing paidAt are quarantined, never silently canonicalized",()=>{
 const sample="2026-10-20T16:00:00Z";
 assert.equal(classifyPaidAt(paid(sample)),"legacy_string_requires_independent_review");
 assert.equal(classifyPaidAt(paid(undefined)),"missing_timestamp_requires_independent_review");
 assert.equal(classifyPaidAt(paid({seconds:123})),"invalid_timestamp_requires_independent_review");
 assert.equal(classifyPaidAt(paid({toMillis:()=>1760000000000})),"canonical_timestamp_unverified_source");
 assert.equal(classifyPaidAt({...paid(sample),paymentStatus:"unpaid"}),"outside_paid_delivery");
});
test("Phase3AJ pure quarantine never edits original paidAt and requires trusted timestamp representation",()=>{
 const value=Object.freeze(paid("2026-10-20T16:00:00Z"));
 assert.equal(classifyPaidAt(value),"legacy_string_requires_independent_review");
 assert.equal(value.paidAt,"2026-10-20T16:00:00Z");
 assert.equal(classifyPaidAt(paid({toMillis:()=>NaN})),"invalid_timestamp_requires_independent_review");
});
test("Phase3AJ preview rejects missing reviewer and invalid limits before any Firestore access",async()=>{
 await assert.rejects(previewHybridLegacyPaidAtQuarantineCandidate({
  db:{},tenantId:"tenant-aj-unit-001",reviewerUid:"super-aj-unit-001",maxRows:301
 }),/HYBRID_PAIDAT_QUARANTINE_INVALID_REQUEST/);
 await assert.rejects(previewHybridLegacyPaidAtQuarantineCandidate({
  db:{},tenantId:"tenant-aj-unit-001",reviewerUid:"super-aj-unit-001",pageSize:0
 }),/HYBRID_PAIDAT_QUARANTINE_INVALID_REQUEST/);
});
test("Phase3AJ suspended demo preflight cannot run outside isolated localhost project",async()=>{
 const oldProject=process.env.GCLOUD_PROJECT,oldHost=process.env.FIRESTORE_EMULATOR_HOST;
 try{
  process.env.GCLOUD_PROJECT="production";
  process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8080";
  await assert.rejects(requireHybridDemoGatewayPreflight({
   db:{},tenantId:"tenant-aj-unit-001",actorUid:"cashier-aj-unit-001",
   sourceKey:"cod_cashier"
  }),/HYBRID_EPOCH_DEMO_EMULATOR_ONLY/);
 }finally{
  if(oldProject===undefined)delete process.env.GCLOUD_PROJECT;
  else process.env.GCLOUD_PROJECT=oldProject;
  if(oldHost===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
  else process.env.FIRESTORE_EMULATOR_HOST=oldHost;
 }
});
test("Phase3AJ preflight, paidAt quarantine and finance candidates remain unexported",()=>{
 const index=readFileSync("functions/index.js","utf8");
 for(const name of ["hybrid-billing-demo-gateway-preflight",
  "hybrid-billing-demo-paidat-quarantine","requireHybridDemoGatewayPreflight",
  "previewHybridLegacyPaidAtQuarantineCandidate"])
  assert.equal(index.includes(name),false);
 const src=readFileSync("functions/hybrid-billing-demo-enforced-writer.js","utf8");
 assert.ok(src.includes("await requireHybridDemoGatewayPreflight("));
 assert.ok(src.indexOf("await requireHybridDemoGatewayPreflight(") <
   src.indexOf("return recordHybridVerifiedPromptPay("));
});
