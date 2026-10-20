import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {SOURCES,REGISTRY_DIGEST,reviewHybridWriterRegistryCandidate,
 requireHybridEpochAdmissionCandidate}=require(
 "../../functions/hybrid-billing-writer-epoch-candidate.js");
test("registry enumerates existing and missing trusted writer paths, never certifies",()=>{
 const r=reviewHybridWriterRegistryCandidate();
 assert.equal(r.sourcesActuallyWired,0);
 assert.equal(r.writerParticipationComplete,false);
 assert.equal(r.coverageCertified,false);
 assert.equal(r.canIssueInvoice,false);
 assert.equal(new Set(SOURCES.map(x=>x.key)).size,SOURCES.length);
 for(const key of ["cod_cashier","promptpay_bank","refund_initial",
  "refund_partial","lalamove_cod_remittance","legacy_paid_delivery"])
  assert.ok(SOURCES.some(x=>x.key===key),key);
 assert.ok(SOURCES.every(x=>x.wired===false));
 assert.equal(r.registryDigest,REGISTRY_DIGEST);
 assert.match(REGISTRY_DIGEST,/^[a-f0-9]{64}$/);
});
test("epoch guard has no production execution path and rejects missing demo environment",async()=>{
 const previousProject=process.env.GCLOUD_PROJECT;
 const previousHost=process.env.FIRESTORE_EMULATOR_HOST;
 try{
  delete process.env.GCLOUD_PROJECT;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  await assert.rejects(requireHybridEpochAdmissionCandidate({
    tx:{},tenantRef:{},sourceKey:"cod_cashier"
  }),/HYBRID_EPOCH_DEMO_EMULATOR_ONLY/);
 }finally{
  if(previousProject===undefined)delete process.env.GCLOUD_PROJECT;
  else process.env.GCLOUD_PROJECT=previousProject;
  if(previousHost===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
  else process.env.FIRESTORE_EMULATOR_HOST=previousHost;
 }
 const index=readFileSync("functions/index.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-writer-epoch-candidate/);
});
test("demo enrolled writer admission fails closed on unknown, absent, forged and sealed epoch",async()=>{
 const oldP=process.env.GCLOUD_PROJECT,oldH=process.env.FIRESTORE_EMULATOR_HOST;
 process.env.GCLOUD_PROJECT="demo-penguin-hybrid-uat";
 process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8187";
 const tenantRef={collection:()=>({doc:()=>({})})};
 const state={epoch:1,status:"open",registryDigest:REGISTRY_DIGEST,
  candidateOnly:true,coverageCertified:false,canIssueInvoice:false};
 const tx=value=>({get:async()=>({exists:value!==null,data:()=>value})});
 try{
  const result=await requireHybridEpochAdmissionCandidate({
   tx:tx(state),tenantRef,sourceKey:"cod_cashier"});
  assert.equal(result.admittedForDemo,true);
  assert.equal(result.coverageCertified,false);
  assert.equal(result.canIssueInvoice,false);
  for(const key of ["lalamove_cod_remittance","legacy_paid_delivery","unknown"])
   await assert.rejects(requireHybridEpochAdmissionCandidate({
    tx:tx(state),tenantRef,sourceKey:key}),/HYBRID_EPOCH_WRITER_NOT_REGISTERED/);
  await assert.rejects(requireHybridEpochAdmissionCandidate({
   tx:tx(null),tenantRef,sourceKey:"cod_cashier"}),/HYBRID_EPOCH_MISSING_OR_TAMPERED/);
  await assert.rejects(requireHybridEpochAdmissionCandidate({
   tx:tx({...state,registryDigest:"0".repeat(64)}),tenantRef,
   sourceKey:"refund_initial"}),/HYBRID_EPOCH_MISSING_OR_TAMPERED/);
  await assert.rejects(requireHybridEpochAdmissionCandidate({
   tx:tx({...state,status:"sealed"}),tenantRef,
   sourceKey:"promptpay_bank"}),/HYBRID_EPOCH_CLOSED/);
  await assert.rejects(requireHybridEpochAdmissionCandidate({
   tx:tx({...state,coverageCertified:true}),tenantRef,
   sourceKey:"refund_partial"}),/HYBRID_EPOCH_MISSING_OR_TAMPERED/);
 }finally{
  if(oldP===undefined)delete process.env.GCLOUD_PROJECT;
  else process.env.GCLOUD_PROJECT=oldP;
  if(oldH===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
  else process.env.FIRESTORE_EMULATOR_HOST=oldH;
 }
});
