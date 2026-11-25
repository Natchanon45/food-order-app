import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {generateKeyPairSync,sign,createHash} from "node:crypto";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {VERSION,PROVIDER,bytes,accountFingerprint,preflight}=require("../../functions/delivery-bank-reconcile-policy");
const {__test:{parse,record}}=require("../../functions/delivery-bank-reconcile");
const {receiverRevision,receiverState}=require("../../functions/payment-companion-receiver");
const {fingerprint,flags}=require("../../functions/delivery-notification-match-policy");
const {digest}=require("../../functions/payment-companion-policy");
const now=Date.now(),created=now-120000,tenantId="p34-notify-bank-demo",orderId="p34-order-bank",evidenceId="e".repeat(64);
const iso=n=>new Date(n).toISOString();
const store={data:()=>({bankName:"SCB",bankAccountNumber:"0000000000",bankAccountName:"DEMO ONLY",promptPayId:"0800000000"}),updateTime:{seconds:1,nanoseconds:2}};
const revision=receiverRevision(store);
const link={enabled:true,revision,bankCode:"scb",accountLast4:"0000",confirmedAtMs:created-10000};
const device={id:"device-demo",enabled:true};
const notice={eventId:"a".repeat(64),deviceId:device.id,source:"line_scb_connect",receiverRevision:revision,receiverSuffix:"X-0000",
 verificationStatus:"unverified",amountSatang:15000,bankMs:created+10000,observedMs:created+11000,receivedMs:created+12000};
notice.id=digest(device.id+":"+notice.eventId);
const order={tenantId,orderType:"delivery",bankTransferReviewFlow:"notification_first",paymentMethod:"promptpay",paymentStatus:"pending_verification",status:"pending",totalAmount:150,paymentReceiverRevision:revision,paymentRecipientId:"0800000000",createdAt:{toMillis:()=>created}};
const audit={tenantId,orderId,notificationId:notice.id,amountSatang:15000,receiverRevision:revision,observationFingerprint:fingerprint(notice),status:"recorded_unverified",...flags};
const claim={orderId,notificationId:notice.id,flow:"notification_first"},collision={orderId,notificationId:notice.id};
const {publicKey,privateKey}=generateKeyPairSync("ed25519");
const keyId="demo-key";
const registry={[PROVIDER]:{[keyId]:{enabled:true,publicKeyPem:publicKey.export({type:"spki",format:"pem"}),fingerprintSha256:createHash("sha256").update(publicKey.export({type:"spki",format:"der"})).digest("hex"),validFrom:iso(created-60000),validUntil:iso(now+3600000),revokedAt:null,registeredBy:"demo-registrar",reviewedBy:"demo-reviewer"}}};
const payload={tenantId,orderId,notificationId:notice.id,receiverRevision:revision,accountFingerprint:accountFingerprint(store,receiverState(store,link,true)),transactionReference:"demo-test-reference-001",amountSatang:15000,currency:"THB",direction:"credit",postingStatus:"posted",postedAt:iso(notice.bankMs)};
function signed(p=payload){
 const envelope={version:VERSION,providerId:PROVIDER,keyId,payload:p};
 return {...envelope,signatureBase64:sign(null,bytes(envelope),privateKey).toString("base64")};
}
const envelope=signed();
const base={tenantId,orderId,order,audit,claim,collision,notice,device,store,link,envelope,registry,now};
const check=patch=>preflight({...base,...patch});
test("signed synthetic posted credit matches exact order and observation, never authorizes settlement",()=>{
 const r=check({});
 assert.equal(r.signatureCryptographicallyValid,true);
 assert.equal(r.realBankProviderAuthenticated,false);
 assert.equal(r.settlementAllowed,false);
 assert.equal(r.referenceHash,digest(payload.transactionReference));
 for(const [k,v] of Object.entries(flags))assert.equal(r[k],v);
});
test("reject independent signed wrong scope, amount, reference class and posting time",()=>{
 for(const patch of [{tenantId:"foreign-tenant"},{orderId:"foreign-order"},{notificationId:"b".repeat(64)},{amountSatang:14999},{accountFingerprint:"b".repeat(64)},{postedAt:iso(created-1)},{postedAt:iso(now+1)}])
  assert.throws(()=>check({envelope:signed({...payload,...patch})}),/DELIVERY_BANK/);
 for(const patch of [{direction:"debit"},{postingStatus:"pending"},{currency:"USD"},{transactionReference:"real-bank-reference"}])
  assert.throws(()=>signed({...payload,...patch}),/EVIDENCE_INVALID/);
});
test("tampered signature and disabled/revoked/wrong pinned key fail closed",()=>{
 assert.throws(()=>check({envelope:{...envelope,signatureBase64:Buffer.alloc(64).toString("base64")}}),/SIGNATURE_INVALID/);
 for(const patch of [{enabled:false},{revokedAt:iso(now)},{fingerprintSha256:"b".repeat(64)},{reviewedBy:"demo-registrar"},{validUntil:iso(now-1)}])
  assert.throws(()=>check({registry:{[PROVIDER]:{[keyId]:{...registry[PROVIDER][keyId],...patch}}}}),/HYBRID_BANK_KEY/);
});
test("stale receiver, invalid notice, missing claims and settled orders are not eligible",()=>{
 for(const patch of [{order:{...order,paymentStatus:"paid"}},{order:{...order,kitchenReleasedAt:true}},{order:{...order,paymentReceiverRevision:"b".repeat(64)}},{link:{...link,enabled:false}},{audit:{...audit,paymentVerified:true}},{claim:{...claim,orderId:"other"}},{collision:null},{notice:{...notice,amountSatang:14999}},{device:{...device,enabled:false}}])
  assert.throws(()=>check(patch),/DELIVERY_BANK/);
});
function fixture(){
 const db={collection:name=>col(name)};
 const col=path=>({doc:id=>ref(path+"/"+id)});
 const ref=path=>({path,id:path.split("/").at(-1),collection:name=>col(path+"/"+name)});
 const tenant=ref("tenants/"+tenantId),root=ref("paymentCompanionTenants/"+tenantId);
 const c={tenantId,tenant,root,uid:"demo-cashier",role:"cashier"};
 const rp=root.path+"/",tp=tenant.path+"/";
 const rows=new Map([
  [tp+"orders/"+orderId,order],[rp+"notificationFirstReviews/"+orderId,audit],
  ["deliveryDemoBankEvidence/"+evidenceId,{tenantId,orderId,environment:"demo",envelope}],
  ["deliveryDemoBankKeys/registry",{providers:registry}],[tp+"settings/store",store.data()],
  [root.path,{receiver:link}],[rp+"reviewClaims/"+notice.id,claim],
  [rp+"notificationFirstObservationClaims/"+audit.observationFingerprint,collision],
  [rp+"notices/"+notice.id,notice],[rp+"devices/"+device.id,device]
 ]);
 const receiptPath=rp+"notificationFirstBankPreflights/"+orderId;
 const claimPath="deliveryDemoBankReferenceClaims/"+digest(payload.transactionReference);
 const legacyPath="platformSlipUsedReferences/"+digest(payload.transactionReference);
 let writes=[];
 const tx={get:async r=>({id:r.id,exists:rows.has(r.path),data:()=>rows.get(r.path),...(r.path===tp+"settings/store"?{updateTime:store.updateTime}:{})}),
  create:(r,v)=>{assert.equal(rows.has(r.path),false);writes.push([r.path,v]);}};
 const run=async()=>{
  writes=[];
  const result=await record(db,tx,c,{orderId,evidenceId});
  for(const [path,v] of writes)rows.set(path,v);
  return result;
 };
 return {rows,run,receiptPath,claimPath,legacyPath,writes:()=>writes};
}
test("transaction records only immutable demo receipt and global claim; idempotent replay does not write",async()=>{
 const f=fixture(),r=await f.run();
 assert.equal(r.alreadyRecorded,false);
 assert.equal(r.paymentVerified,false);
 assert.equal(r.settlementAllowed,false);
 assert.deepEqual(f.writes().map(([p])=>p),[f.receiptPath,f.claimPath]);
 assert.equal(f.rows.get(f.receiptPath).recordedByUid,"demo-cashier");
 assert.equal((await f.run()).alreadyRecorded,true);
 assert.equal(f.writes().length,0);
});
test("existing legacy or other demo reference, and inconsistent replay, reject with zero writes",async()=>{
 for(const path of ["legacyPath","claimPath"]){
  const f=fixture();f.rows.set(f[path],{tenantId:"other",orderId:"other"});
  await assert.rejects(f.run(),/REFERENCE_REUSED/);assert.equal(f.writes().length,0);
 }
 const f=fixture();await f.run();f.rows.delete(f.claimPath);
 await assert.rejects(f.run(),/PREFLIGHT_CONFLICT/);assert.equal(f.writes().length,0);
});
test("client cannot provide keys, amounts, actor or evidence payload; private evidence and claims deny browser access",()=>{
 assert.deepEqual(parse({orderId,evidenceId}),{orderId,evidenceId});
 for(const patch of [{tenantId},{amountSatang:15000},{envelope},{registry},{paymentVerified:true}])assert.throws(()=>parse({orderId,evidenceId,...patch}),/INPUT_INVALID/);
 const rules=readFileSync("firestore.rules","utf8");
 for(const col of ["deliveryDemoBankEvidence","deliveryDemoBankKeys","deliveryDemoBankReferenceClaims"])
  assert.ok(rules.includes("match /"+col+"/{path=**} { allow read, write: if false; }"));
});
