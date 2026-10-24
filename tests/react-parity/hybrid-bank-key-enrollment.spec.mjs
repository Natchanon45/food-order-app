import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { stageDemoHybridBankKeyEnrollment: stage,
  reviewDemoHybridBankKeyEnrollment: review,
  BANK_KEY_ENROLLMENT_PRODUCTION_READY } =
  require("../../functions/hybrid-billing-bank-key-enrollment.js");

const id = "bankreq_123456789012345";
const base = {requestId:id,providerId:"sandbox_bank",keyId:"oct_2026",
  fingerprintSha256:"a".repeat(64),
  validFrom:"2026-10-25T00:00:00.000Z",
  validUntil:"2026-11-30T00:00:00.000Z",
  actorUid:"super-one",requestedAt:"2026-10-24T12:00:00.000Z",
  serverTimestamp:"SERVER_TIME"};
const reviewInput = {requestId:id,reviewerUid:"super-two",
  decision:"acknowledge_internal_review",
  reviewedAt:"2026-10-24T14:00:00.000Z",serverTimestamp:"SERVER_TIME"};
async function sandbox(run, opts={}){
  const docs=new Map([
    ["users/super-one",{role:"super_admin",active:true}],
    ["users/super-two",{role:"super_admin",active:true}],
    ["users/owner",{role:"owner",active:true}],
  ]);
  let txCount=0;
  const db={app:{options:{projectId:opts.projectId||"demo-penguin-hybrid"}},
    collection:c=>({doc:x=>({path:c+"/"+x})}),
    runTransaction:async fn=>{
      txCount++;
      const writes=[];
      const tx={
        get:async ref=>({exists:docs.has(ref.path),data:()=>docs.get(ref.path)}),
        create:(ref,value)=>writes.push([ref.path,value]),
      };
      const result=await fn(tx);
      for(const [p] of writes)if(docs.has(p))throw Error("DUPLICATE");
      for(const [p,v] of writes)docs.set(p,v);
      return result;
    }};
  const old=process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST=opts.host===undefined?"127.0.0.1:8080":opts.host;
  try {await run({db,docs,get txCount(){return txCount}});}
  finally {if(old===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST=old;}
}
test("proposal creates two global claims but never activates a banking key",()=>sandbox(async f=>{
  const v=await stage({db:f.db,...base});
  assert.equal(v.keyActivated,false);
  assert.equal(v.bankOriginAuthenticated,false);
  const d=f.docs.get("hybridBankKeyEnrollmentRequests/"+id);
  assert.equal(d.state,"pending_internal_review");
  assert.equal(d.trustedRegistryPromoted,false);
  assert.equal("publicKeyPem" in d,false);
  assert.equal([...f.docs.keys()].filter(k=>k.startsWith("hybridBankKeyFingerprintClaims/")).length,1);
  assert.equal([...f.docs.keys()].filter(k=>k.startsWith("hybridBankKeySlotClaims/")).length,1);
  await assert.rejects(stage({db:f.db,...base}),/REQUEST_ALREADY_EXISTS/);
}));

test("global fingerprint and provider-key slot both reject reuse",()=>sandbox(async f=>{
  await stage({db:f.db,...base});
  await assert.rejects(stage({db:f.db,...base,requestId:"bankreq_another_1234567890123",
    providerId:"other_bank",keyId:"nov_2026"}),/FINGERPRINT_ALREADY_CLAIMED/);
  await assert.rejects(stage({db:f.db,...base,requestId:"bankreq_another_1234567890123",
    fingerprintSha256:"b".repeat(64)}),/KEY_SLOT_ALREADY_CLAIMED/);
}));

test("second reviewer creates immutable acknowledgement, never external bank approval",()=>sandbox(async f=>{
  await stage({db:f.db,...base});
  await assert.rejects(review({db:f.db,...reviewInput,reviewerUid:"super-one"}),
    /REVIEW_INTEGRITY_INVALID/);
  await assert.rejects(review({db:f.db,...reviewInput,reviewerUid:"owner"}),
    /ACTIVE_SUPER_ADMIN_REQUIRED/);
  const r=await review({db:f.db,...reviewInput});
  assert.equal(r.status,"internally_acknowledged_untrusted");
  assert.equal(r.bankOriginAuthenticated,false);
  assert.equal(r.keyActivated,false);
  assert.equal(f.docs.get("hybridBankKeyEnrollmentReviews/"+id).trustedRegistryPromoted,false);
  await assert.rejects(review({db:f.db,...reviewInput}),/ALREADY_REVIEWED/);
}));

test("revoked initiator and altered request cannot become reviewed",()=>sandbox(async f=>{
  await stage({db:f.db,...base});
  f.docs.set("users/super-one",{role:"super_admin",active:false});
  await assert.rejects(review({db:f.db,...reviewInput}),/INITIATOR_REVOKED/);
  f.docs.set("users/super-one",{role:"super_admin",active:true});
  f.docs.set("hybridBankKeyEnrollmentRequests/"+id,{
    ...f.docs.get("hybridBankKeyEnrollmentRequests/"+id),keyActivated:true});
  await assert.rejects(review({db:f.db,...reviewInput}),/REVIEW_INTEGRITY_INVALID/);
}));

test("production projects, remote emulator and invalid metadata fail closed",async()=>{
  for(const options of [{projectId:"production-live"},{host:"remote:8080"},{host:""}]){
    await sandbox(async f=>{
      await assert.rejects(stage({db:f.db,...base}),/DEMO_EMULATOR_ONLY/);
      assert.equal(f.txCount,0);
    },options);
  }
  await sandbox(async f=>{
    for(const field of [{fingerprintSha256:"invalid"},{validFrom:"2026-02-30T00:00:00.000Z"},
      {validFrom:"2026-10-20T00:00:00.000Z"}]){
      await assert.rejects(stage({db:f.db,...base,...field}),/UNSAFE_METADATA/);
    }
  });
  assert.equal(BANK_KEY_ENROLLMENT_PRODUCTION_READY,false);
});

test("browser and production exports never expose bank key enrollment",()=>{
  const rules=fs.readFileSync("firestore.rules","utf8");
  const prod=fs.readFileSync("functions/bootstrap.js","utf8")+
    fs.readFileSync("functions/index.js","utf8");
  for(const col of ["hybridBankKeyEnrollmentRequests","hybridBankKeyEnrollmentReviews",
    "hybridBankKeyFingerprintClaims","hybridBankKeySlotClaims"]){
    assert.ok(rules.includes("match /"+col+"/"));
  }
  assert.doesNotMatch(prod,/hybrid-billing-bank-key-enrollment/);
});
