import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {exceptionPlan,recordHybridDemoLateExceptionCandidate}=require(
 "../../functions/hybrid-billing-demo-late-exception.js");
const sourceAt=new Date("2026-10-20T15:00:00Z");
const postedAt=new Date("2026-10-21T02:00:00Z");
const good={tenantId:"tenant-phase3af-test-108",originalDay:"2026-10-20",
 bookingDay:"2026-10-21",sourceType:"lalamove_cod_paid_out",
 sourceAt,postedAt,amountCents:3000,referenceHash:"a".repeat(64),
 sourceEvidenceSha256:"b".repeat(64),postedEvidenceSha256:"c".repeat(64)};
test("Phase3AF pure pending exception binds original and next Bangkok day to separate proof digests",()=>{
 const a=exceptionPlan(good),b=exceptionPlan({...good});
 assert.deepEqual(a,b);
 assert.match(a.planDigest,/^[a-f0-9]{64}$/);
 assert.equal(a.payload.originalDay,"2026-10-20");
 assert.equal(a.payload.bookingDay,"2026-10-21");
 assert.notEqual(a.planDigest,exceptionPlan({...good,amountCents:4000}).planDigest);
});
test("Phase3AF reject same day, backdated posted credit, forged timezone, mismatched independent proofs",()=>{
 for(const patch of [
  {bookingDay:"2026-10-20"},{bookingDay:"2026-10-19"},
  {postedAt:new Date("2026-10-20T13:00:00Z")},
  {originalDay:"2026-10-19"},{bookingDay:"2026-10-22"},
  {sourceEvidenceSha256:"c".repeat(64)},
  {referenceHash:"bad"},{amountCents:0},{amountCents:1.5},
  {sourceType:"legacy_unverified"}, {originalDay:"2026-02-30"}
 ]) assert.throws(()=>exceptionPlan({...good,...patch}),
    /HYBRID_DEMO_LATE_INVALID_SOURCE_DAYS_OR_PROOF/);
});
test("Phase3AF never exposes candidate to production or existing client Functions",async()=>{
 const before={g:process.env.GCLOUD_PROJECT,h:process.env.FIRESTORE_EMULATOR_HOST};
 try{
   process.env.GCLOUD_PROJECT="production-project";
   process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8187";
   await assert.rejects(recordHybridDemoLateExceptionCandidate({
     db:{},reviewerUid:"super-phase3af-test-108",...good
   }),/HYBRID_EPOCH_DEMO_EMULATOR_ONLY/);
 }finally{
   if(before.g===undefined)delete process.env.GCLOUD_PROJECT;
   else process.env.GCLOUD_PROJECT=before.g;
   if(before.h===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
   else process.env.FIRESTORE_EMULATOR_HOST=before.h;
 }
 const index=readFileSync("functions/index.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-demo-late-exception|recordHybridDemoLateExceptionCandidate/);
});
