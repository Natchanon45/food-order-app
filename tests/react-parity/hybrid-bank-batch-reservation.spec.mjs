import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash,generateKeyPairSync,sign } from "node:crypto";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const { reserveDemoHybridSignedBankBatch,
  BANK_BATCH_RESERVATION_PRODUCTION_READY } =
  require("../../functions/hybrid-billing-bank-batch-reservation.js");
const { canonicalHybridBankEvidenceBytes } =
  require("../../functions/hybrid-billing-bank-evidence-contract.js");
const sha=x=>createHash("sha256").update(x).digest("hex");
const keys=generateKeyPairSync("ed25519");
const providerId="sandbox_bank", keyId="synthetic_key_2026";
const registry={ [providerId]:{ [keyId]:{
  enabled:true,publicKeyPem:keys.publicKey.export({type:"spki",format:"pem"}),
  fingerprintSha256:sha(keys.publicKey.export({type:"spki",format:"der"})),
  validFrom:"2026-10-01T00:00:00.000Z",
  validUntil:"2026-11-30T23:59:59.000Z",
  revokedAt:null,registeredBy:"test-registrar",reviewedBy:"test-reviewer",
}}};
const SCOPE=["tenantId","invoiceId","adjustmentId","instructionHash",
  "bankReferenceHash","destinationFingerprint","amountCents"];
function item(n,overrides={}) {
  const payload={
    tenantId:"tenant_demo",invoiceId:"2026-10-24:monthly:fixed",
    adjustmentId:"adjustment_"+String(n).padStart(16,"0"),
    instructionHash:sha("out-"+n),bankReferenceHash:sha("bank-"+n),
    destinationFingerprint:sha("recipient-"+n),amountCents:10000+n,
    currency:"THB",direction:"debit",postingStatus:"posted",
    submittedAt:"2026-10-24T09:00:00.000Z",
    postedAt:"2026-10-24T10:00:00.000Z",...overrides,
  };
  const unsigned={version:"hybrid_bank_posting_ed25519_v1",
    providerId,keyId,payload};
  return {envelope:{...unsigned,signatureBase64:sign(null,
      canonicalHybridBankEvidenceBytes(unsigned),keys.privateKey).toString("base64")},
    expected:Object.fromEntries(SCOPE.map(k=>[k,payload[k]]))};
}
let seq=0;
function fakeDb({projectId="demo-penguin-hybrid",active=true}={}) {
  const docs=new Map();
  if (active) docs.set("users/sandbox-admin",
    {role:"super_admin",active:true});
  const created=[];
  const ref=(name,id)=>({path:name+"/"+id});
  const db={app:{options:{projectId}},
    collection:name=>({doc:id=>ref(name,id)}),
    runTransaction:async callback=>{
      const staged=[];
      let writing=false;
      const tx={
        get:async r=>{
          if(writing)throw Error("READ_AFTER_WRITE");
          return {exists:docs.has(r.path),
            data:()=>docs.get(r.path)};
        },
        create:(r,value)=>{
          writing=true;
          if(docs.has(r.path)||staged.some(x=>x.path===r.path))
            throw Error("MOCK_DUPLICATE_CREATE");
          staged.push({path:r.path,value});
        },
      };
      const result=await callback(tx);
      for (const {path,value} of staged)docs.set(path,value);
      created.push(...staged);
      return result;
    },
  };
  return {db,docs,created};
}
const params=(db,postings,id="batch_demo_1234567890123456")=>({
  db,batchId:id,actorUid:"sandbox-admin",postings,
  trustedRegistry:registry,expectedProviderId:providerId,
  asOf:"2026-10-24T12:00:00.000Z",
  serverTimestamp:{__emulatorTimestamp:true},
});
const withDemo=async fn=>{
  const prior=process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST="127.0.0.1:8080";
  try { await fn(); }
  finally {
    if(prior===undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST=prior;
  }
};
const reject=async(p,code)=>assert.rejects(
  reserveDemoHybridSignedBankBatch(p),
  new RegExp("HYBRID_BANK_BATCH_RESERVATION_"+code));

test("atomic synthetic claim creation and redacted BLOCKED result",()=>withDemo(async()=>{
  const {db,docs,created}=fakeDb();
  const result=await reserveDemoHybridSignedBankBatch(
    params(db,[item(1),item(2)]));
  assert.equal(created.length,7);
  assert.equal(result.postingsReserved,2);
  assert.equal(result.crossBatchClaimsCreated,true);
  assert.equal(result.globalHistoricalReplayChecked,false);
  assert.equal(result.bankProviderIdentityIndependentlyAuthenticated,false);
  assert.equal(result.settlementAllowed,false);
  assert.equal(result.productionReleaseAllowed,false);
  assert.equal(result.writesPerformed,true);
  assert.ok([...docs.keys()].some(k=>k.startsWith("hybridBankBatchAdjustmentClaims/")));
  const output=JSON.stringify(result);
  for(const secret of [item(1).expected.tenantId,item(1).expected.adjustmentId,
    item(1).expected.bankReferenceHash,item(1).envelope.signatureBase64]){
    assert.equal(output.includes(secret),false);
  }
}));

test("separate later batch cannot reuse bank reference across tenants",()=>withDemo(async()=>{
  const {db,created}=fakeDb();
  const first=item(3);
  await reserveDemoHybridSignedBankBatch(params(db,[first]));
  const second=item(4,{tenantId:"another_tenant",
    bankReferenceHash:first.expected.bankReferenceHash});
  await reject(params(db,[second],"batch_demo_2222222222222222"),
    "BATCH_OR_REFERENCE_ALREADY_RESERVED");
  assert.equal(created.length,4);
}));

test("outgoing instruction and tenant-adjustment are globally claimed",()=>withDemo(async()=>{
  const {db,created}=fakeDb();
  const first=item(5);
  await reserveDemoHybridSignedBankBatch(params(db,[first]));
  await reject(params(db,[item(6,{instructionHash:first.expected.instructionHash})],
    "batch_demo_3333333333333333"),"BATCH_OR_REFERENCE_ALREADY_RESERVED");
  await reject(params(db,[item(7,{adjustmentId:first.expected.adjustmentId})],
    "batch_demo_4444444444444444"),"BATCH_OR_REFERENCE_ALREADY_RESERVED");
  assert.equal(created.length,4);
}));

test("legacy refund candidate claims also block new batch",()=>withDemo(async()=>{
  const {db,docs,created}=fakeDb();
  const post=item(8);
  docs.set("hybridRefundReferenceClaims/"+post.expected.bankReferenceHash,
    {state:"unverified_candidate"});
  await reject(params(db,[post]),"BATCH_OR_REFERENCE_ALREADY_RESERVED");
  assert.equal(created.length,0);
  docs.delete("hybridRefundReferenceClaims/"+post.expected.bankReferenceHash);
  docs.set("hybridRefundInstructionClaims/"+post.expected.instructionHash,
    {state:"unverified_candidate"});
  await reject(params(db,[post]),"BATCH_OR_REFERENCE_ALREADY_RESERVED");
  assert.equal(created.length,0);
}));

test("batch ID cannot be reused even for distinct signed evidence",()=>withDemo(async()=>{
  const {db,created}=fakeDb();
  await reserveDemoHybridSignedBankBatch(params(db,[item(9)]));
  await reject(params(db,[item(10)]),"BATCH_OR_REFERENCE_ALREADY_RESERVED");
  assert.equal(created.length,4);
}));

test("bad signature or expected scope fails before any Firestore write",()=>withDemo(async()=>{
  const {db,created}=fakeDb();
  const second=item(11);
  const changed={...second,expected:{...second.expected,amountCents:99999}};
  await assert.rejects(
    reserveDemoHybridSignedBankBatch(params(db,[item(12),changed])),
    /HYBRID_BANK_BATCH_ITEM_REJECTED/);
  assert.equal(created.length,0);
}));

test("only active Super Admin can create synthetic reservations",()=>withDemo(async()=>{
  const {db,created}=fakeDb({active:false});
  await reject(params(db,[item(13)]),"ACTIVE_SUPER_ADMIN_REQUIRED");
  assert.equal(created.length,0);
}));

test("unknown browser-injected flags and oversized batches rejected",()=>withDemo(async()=>{
  const {db,created}=fakeDb();
  await reject({...params(db,[item(14)]),settlementAllowed:true},
    "INVALID_INPUT_FIELDS");
  await reject(params(db,Array.from({length:26},(_,i)=>item(20+i))),
    "INVALID_METADATA_OR_BATCH_SIZE");
  await reject({...params(db,[item(14)]),batchId:"bad"},
    "INVALID_METADATA_OR_BATCH_SIZE");
  assert.equal(created.length,0);
}));

test("non-demo database and absent local emulator are refused",async()=>{
  const {db}=fakeDb({projectId:"production-project"});
  await withDemo(()=>reject(params(db,[item(15)]),"LOCAL_DEMO_ONLY"));
  const old=process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  try { await reject(params(fakeDb().db,[item(15)]),"LOCAL_DEMO_ONLY"); }
  finally {
    if(old!==undefined) process.env.FIRESTORE_EMULATOR_HOST=old;
  }
});

test("private reservation writer has no payment/Production callable exposure",()=>{
  assert.equal(BANK_BATCH_RESERVATION_PRODUCTION_READY,false);
  const source=fs.readFileSync(
    "functions/hybrid-billing-bank-batch-reservation.js","utf8");
  const prod=fs.readFileSync("functions/index.js","utf8")
    +fs.readFileSync("functions/bootstrap.js","utf8");
  assert.doesNotMatch(prod,/hybrid-billing-bank-batch-reservation/);
  assert.doesNotMatch(source,/onCall\(|onSchedule\(|https\.onRequest|fetch\(/);
  assert.match(source,/productionReleaseAllowed:false/);
  assert.match(source,/globalHistoricalReplayChecked:false/);
});
