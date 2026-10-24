import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const { auditDemoHybridBankKeyHistory } =
  require("../../functions/hybrid-billing-bank-key-history-audit.js");
const collections=[
  "hybridBankKeyEnrollmentRequests", "hybridBankKeyEnrollmentReviews",
  "hybridBankKeyFingerprintClaims", "hybridBankKeySlotClaims",
];
const id="bankreq_123456789012345";
const providerId="sandbox_bank", keyId="key_oct_2026";
const fingerprintSha256="a".repeat(64);
const slotHash=createHash("sha256").update(
  "hybrid-bank-key-enrollment-v1:key-slot:"+providerId+"/"+keyId,
).digest("hex");
const requestedAt="2026-10-24T12:00:00.000Z";
const reviewedAt="2026-10-24T14:00:00.000Z";
const createdAt="SERVER_TIMESTAMP";
const request={
  id,providerId,keyId,fingerprintSha256,
  validFrom:"2026-10-25T00:00:00.000Z",
  validUntil:"2026-11-30T00:00:00.000Z",
  requestedAt,proposedBy:"super-one",state:"pending_internal_review",
  bankOriginAuthenticated:false,trustedRegistryPromoted:false,
  keyActivated:false,createdAt,
};
const fingerprint={
  requestId:id,providerId,keyId,fingerprintSha256,
  state:"pending_internal_review",createdAt,
};
const slot={
  requestId:id,providerId,keyId,slotHash,
  state:"pending_internal_review",createdAt,
};
const review={
  id,providerId,keyId,fingerprintSha256,proposedBy:"super-one",
  reviewedBy:"super-two",decision:"acknowledge_internal_review",
  reviewedAt,status:"internally_acknowledged_untrusted",
  bankOriginAuthenticated:false,trustedRegistryPromoted:false,
  keyActivated:false,createdAt,
};
function rows({reviewed=false}={}) {
  return {
    hybridBankKeyEnrollmentRequests:[[id,request]],
    hybridBankKeyEnrollmentReviews:reviewed?[[id,review]]:[],
    hybridBankKeyFingerprintClaims:[[fingerprintSha256,fingerprint]],
    hybridBankKeySlotClaims:[[slotHash,slot]],
  };
}
async function scenario(fn,{seed={},projectId="demo-penguin-hybrid",
  host="127.0.0.1:8080"}={}) {
  const scanned=[];
  const db={app:{options:{projectId}},collection:name=>({
    limit:n=>({get:async()=>{
      scanned.push({name,limit:n});
      return {docs:(seed[name]||[]).slice(0,n).map(([id,value,path])=>({
        id,data:()=>value,ref:{path:path||name+"/"+id},
      }))};
    }}),
  })};
  const before=process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST=host;
  try {return await fn({db,scanned});}
  finally {if(before===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST=before;}
}
const includes=(report,code)=>assert.ok(report.integrityIssueCodes.includes(code),
  "Expected "+code+" in "+JSON.stringify(report.integrityIssueCodes));

test("empty emulator inventory never means a verified bank or active signer",()=>
  scenario(async({db,scanned})=>{
    const r=await auditDemoHybridBankKeyHistory({db});
    assert.deepEqual(r.scannedCollections,collections);
    assert.equal(scanned.length,4);
    assert.ok(scanned.every(s=>s.limit===101));
    assert.equal(r.integrityIssueCount,0);
    assert.equal(r.pendingInternalReviews,0);
    assert.equal(r.bankOriginAuthenticated,false);
    assert.equal(r.trustedRegistryPromoted,false);
    assert.equal(r.anyKeyActivated,false);
    assert.equal(r.historicalKeyCoverageVerified,false);
    assert.equal(r.settlementAllowed,false);
    assert.equal(r.releaseReady,false);
    assert.equal(r.writesPerformed,false);
    assert.equal(r.nonAtomicSnapshot,true);
    assert.ok(r.blockers.includes("BANK_SIGNER_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED"));
  }));

test("consistent pending request with both claims is reviewable but NEVER bank trusted",()=>
  scenario(async({db})=>{
    const r=await auditDemoHybridBankKeyHistory({db});
    assert.equal(r.integrityIssueCount,0);
    assert.equal(r.pendingInternalReviews,1);
    assert.equal(r.counts.hybridBankKeyEnrollmentRequests,1);
    assert.equal(r.counts.hybridBankKeyEnrollmentReviews,0);
    assert.ok(r.blockers.includes("PENDING_INTERNAL_KEY_REVIEWS"));
    assert.equal(r.anyKeyActivated,false);
  },{seed:rows()}));

test("consistent independent internal review remains untrusted and not activated",()=>
  scenario(async({db})=>{
    const r=await auditDemoHybridBankKeyHistory({db});
    assert.deepEqual(r.integrityIssueCodes,[]);
    assert.equal(r.pendingInternalReviews,0);
    assert.equal(r.counts.hybridBankKeyEnrollmentReviews,1);
    assert.equal(r.bankOriginAuthenticated,false);
    assert.equal(r.releaseReady,false);
  },{seed:rows({reviewed:true})}));

test("deleted or repointed fingerprint claim is detected, without auto-repair",async()=>{
  for(const altered of [
    [],
    [[fingerprintSha256,{...fingerprint,keyId:"other_signer"}]],
    [["b".repeat(64),fingerprint]],
  ])await scenario(async({db})=>{
    const report=await auditDemoHybridBankKeyHistory({db});
    includes(report,"FINGERPRINT_RESERVATION_MISMATCH");
    assert.equal(report.releaseReady,false);
  },{seed:{...rows(),hybridBankKeyFingerprintClaims:altered}});
});

test("deleted, repointed or forged key-slot hashes trigger integrity exceptions",async()=>{
  for(const altered of [
    [],
    [[slotHash,{...slot,requestId:"bankreq_other_1234567890"}]],
    [[slotHash,{...slot,slotHash:"b".repeat(64)}]],
    [["c".repeat(64),slot]],
  ])await scenario(async({db})=>{
    const report=await auditDemoHybridBankKeyHistory({db});
    includes(report,"KEY_SLOT_RESERVATION_MISMATCH");
    assert.equal(report.anyKeyActivated,false);
  },{seed:{...rows(),hybridBankKeySlotClaims:altered}});
});

test("an orphan global fingerprint/slot claim without its request is reported",()=>
  scenario(async({db})=>{
    const r=await auditDemoHybridBankKeyHistory({db});
    includes(r,"ORPHAN_OR_SPOOFED_FINGERPRINT_CLAIM");
    includes(r,"ORPHAN_OR_SPOOFED_KEY_SLOT_CLAIM");
    assert.equal(r.releaseReady,false);
  },{seed:{...rows(),hybridBankKeyEnrollmentRequests:[]}}));

test("review event with no request is an orphan, not bank approval",()=>
  scenario(async({db})=>{
    const r=await auditDemoHybridBankKeyHistory({db});
    includes(r,"ORPHAN_REVIEW_EVENT");
    assert.equal(r.bankOriginAuthenticated,false);
  },{seed:{hybridBankKeyEnrollmentReviews:[[id,review]]}}));

test("mutated review actor, status or forged trust flags is blocked",async()=>{
  for(const change of [
    {reviewedBy:"super-one"},
    {status:"bank_verified"},
    {bankOriginAuthenticated:true},
    {trustedRegistryPromoted:true},
    {keyActivated:true},
    {fingerprintSha256:"b".repeat(64)},
    {reviewedAt:"2026-10-23T00:00:00.000Z"},
    {reviewedAt:"2026-12-01T00:00:00.000Z"},
    {settlementAllowed:true},
  ])await scenario(async({db})=>{
    const r=await auditDemoHybridBankKeyHistory({db});
    includes(r,"REVIEW_EVENT_MISMATCH");
    assert.equal(r.anyKeyActivated,false);
  },{seed:{...rows({reviewed:true}),hybridBankKeyEnrollmentReviews:[[id,{...review,...change}]]}});
});

test("mutated request cannot become a clean bank enrollment audit",async()=>{
  for(const change of [
    {bankOriginAuthenticated:true},
    {trustedRegistryPromoted:true},
    {keyActivated:true},
    {state:"approved"},
    {validFrom:"2026-02-30T00:00:00.000Z"},
    {validUntil:"2026-10-23T00:00:00.000Z"},
    {signerPrivateKey:"SECRET"},
  ])await scenario(async({db})=>{
    const r=await auditDemoHybridBankKeyHistory({db});
    includes(r,"REQUEST_SHAPE_OR_TRUST_FLAG_INVALID");
    assert.equal(r.releaseReady,false);
  },{seed:{...rows(),hybridBankKeyEnrollmentRequests:[[id,{...request,...change}]]}});
});

test("scan limit overflow fails closed before issuing partial conclusions",()=>
  scenario(async({db})=>{
    await assert.rejects(auditDemoHybridBankKeyHistory({
      db,maxPerSource:2,
    }),/HYBRID_BANK_KEY_AUDIT_SCAN_OVERFLOW/);
  },{seed:{hybridBankKeyEnrollmentReviews:[
    ["review_1_1234567890",review],
    ["review_2_1234567890",review],
    ["review_3_1234567890",review],
  ]}}));

test("invalid scan limit, wrong project and nonloopback host reject before scanning",async()=>{
  for(const opts of [
    {projectId:"live-production"},{host:"remote-firestore:8080"},{host:""},
  ])await scenario(async({db,scanned})=>{
    await assert.rejects(auditDemoHybridBankKeyHistory({db}),/DEMO_ONLY/);
    assert.equal(scanned.length,0);
  },opts);
  await scenario(async({db,scanned})=>{
    for(const maxPerSource of [0,501,2.5,"100",NaN]){
      await assert.rejects(auditDemoHybridBankKeyHistory({
        db,maxPerSource,
      }),/INVALID_SCAN_LIMIT/);
    }
    assert.equal(scanned.length,0);
  });
});

test("bad document paths and repeated Firestore IDs fail closed",async()=>{
  const bad=[
    [[id,request,"outside/"+id]],
    [[id,request],[id,request]],
  ];
  for(const x of bad)await scenario(async({db})=>{
    await assert.rejects(auditDemoHybridBankKeyHistory({db}),
      /BAD_DOCUMENT_hybridBankKeyEnrollmentRequests/);
  },{seed:{...rows(),hybridBankKeyEnrollmentRequests:x}});
});

test("audit exposes sanitized issue codes and counts, never identities or hashes",()=>
  scenario(async({db})=>{
    const r=await auditDemoHybridBankKeyHistory({db});
    const raw=JSON.stringify(r);
    for(const secret of [id,providerId,keyId,fingerprintSha256,slotHash,
      "super-one","super-two"]){
      assert.equal(raw.includes(secret),false,secret);
    }
    assert.equal(Object.hasOwn(r,"documents"),false);
    assert.equal(Object.hasOwn(r,"trustedRegistry"),false);
  },{seed:{...rows({reviewed:true}),
    hybridBankKeySlotClaims:[]}}));

test("private inventory is side-effect free, no browser or Production callable export",()=>{
  const src=fs.readFileSync("functions/hybrid-billing-bank-key-history-audit.js","utf8");
  const production=fs.readFileSync("functions/index.js","utf8")
    +fs.readFileSync("functions/bootstrap.js","utf8");
  assert.doesNotMatch(production,/hybrid-billing-bank-key-history-audit/);
  assert.doesNotMatch(src,/onCall\(|onSchedule\(|runTransaction\(|tx\.(create|set|update)\(|\.doc\(.+\)\.set\(/);
  assert.match(src,/bankOriginAuthenticated:false/);
  assert.match(src,/settlementAllowed:false/);
  assert.match(src,/nonAtomicSnapshot:true/);
});
