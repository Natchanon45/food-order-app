import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const gateway=require("../../functions/hybrid-billing-demo-enforced-writer.js");
const {auditHybridSealedEpochCandidate}=require(
 "../../functions/hybrid-billing-demo-sealed-audit.js");
const oldEnv=()=>({p:process.env.GCLOUD_PROJECT,h:process.env.FIRESTORE_EMULATOR_HOST});
function restore({p,h}){
 if(p===undefined)delete process.env.GCLOUD_PROJECT;else process.env.GCLOUD_PROJECT=p;
 if(h===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;else process.env.FIRESTORE_EMULATOR_HOST=h;
}
test("Phase3Z demo gateway has exactly four fixed source keys and never certifies",()=>{
 assert.deepEqual(gateway.SOURCE_KEYS,[
  "cod_cashier","promptpay_bank","refund_initial","refund_partial"]);
 const summary=gateway.describeHybridDemoGateway();
 assert.equal(summary.gatewayRequiresEpoch,true);
 assert.equal(summary.defaultCandidatePathsUnenrolled,true);
 assert.equal(summary.legacyPathsUnenrolled,true);
 assert.equal(summary.writerParticipationComplete,false);
 assert.equal(summary.coverageCertified,false);
 assert.equal(summary.canIssueInvoice,false);
 const index=readFileSync("functions/index.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-demo-enforced-writer/);
 assert.doesNotMatch(index,/hybrid-billing-demo-sealed-audit/);
});
test("Phase3Z gateway and sealed audit reject production projects, unknown routes and caller epoch override",async()=>{
 const before=oldEnv();
 try{
  process.env.GCLOUD_PROJECT="prod-not-demo";
  process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8187";
  await assert.rejects(gateway.executeHybridDemoEnforcedWriter({
   sourceKey:"cod_cashier",args:{tenantId:"tenant-unit-081",orderId:"order-unit-081"}
  }),/HYBRID_EPOCH_DEMO_EMULATOR_ONLY/);
  await assert.rejects(auditHybridSealedEpochCandidate({
   db:{},tenantId:"tenant-unit-081"}),/HYBRID_EPOCH_DEMO_EMULATOR_ONLY/);
  process.env.GCLOUD_PROJECT="demo-penguin-hybrid-uat";
  await assert.rejects(gateway.executeHybridDemoEnforcedWriter({
   sourceKey:"legacy_paid_delivery",args:{tenantId:"tenant-unit-081",orderId:"order-unit-081"}
  }),/HYBRID_DEMO_GATEWAY_UNKNOWN_SOURCE/);
  await assert.rejects(gateway.executeHybridDemoEnforcedWriter({
   sourceKey:"lalamove_cod_remittance",args:{tenantId:"tenant-unit-081",orderId:"order-unit-081"}
  }),/HYBRID_DEMO_GATEWAY_UNKNOWN_SOURCE/);
  await assert.rejects(gateway.executeHybridDemoEnforcedWriter({
   sourceKey:"cod_cashier",args:{tenantId:"tenant-unit-081",orderId:"order-unit-081",
    epochAdmissionDemo:false}
  }),/HYBRID_DEMO_GATEWAY_BAD_REQUEST/);
  await assert.rejects(gateway.executeHybridDemoEnforcedWriter({
   sourceKey:"cod_cashier",args:null
  }),/HYBRID_DEMO_GATEWAY_BAD_REQUEST/);
 }finally{restore(before)}
});
