import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {evaluate,fingerprint,flags,WINDOW}=require("../../functions/delivery-notification-match-policy");
const {receiverRevision}=require("../../functions/payment-companion-receiver");
const {digest}=require("../../functions/payment-companion-policy");
const now=Date.now(),created=now-120000,tenantId="p34-notify-shop",orderId="p34-order-test";
const store={data:()=>({bankName:"SCB",bankAccountNumber:"0000000000",bankAccountName:"Demo",promptPayId:"0800000000"}),updateTime:{seconds:1,nanoseconds:2}};
const revision=receiverRevision(store);
const link={enabled:true,revision,bankCode:"scb",accountLast4:"0000",confirmedAtMs:created-1000};
const o={id:orderId,tenantId,orderType:"delivery",bankTransferReviewFlow:"notification_first",paymentMethod:"promptpay",paymentStatus:"pending_verification",status:"pending",totalAmount:150,paymentRecipientId:"0800000000",paymentReceiverRevision:revision,createdAt:{toMillis:()=>created}};
const d={id:"device-test",enabled:true};
const n={deviceId:d.id,eventId:"a".repeat(64),source:"line_scb_connect",receiverRevision:revision,receiverSuffix:"X-0000",verificationStatus:"unverified",amountSatang:15000,bankMs:created+10000,observedMs:created+11000,receivedMs:created+12000};
n.id=digest(d.id+":"+n.eventId);
const base={tenantId,orderId,orders:[o],notices:[n],devices:[d],store,link,now};
const run=patch=>evaluate({...base,...patch});
test("unique current receiver-bound post-order notice is advisory only",()=>{
 const r=run({});
 assert.equal(r.status,"candidate");assert.equal(r.notificationId,n.id);
 for(const [k,v] of Object.entries(flags))assert.equal(r[k],v);
 assert.match(r.observationFingerprint,/^[a-f0-9]{64}$/);
});
test("wrong amount, source, suffix, revision, device, id and timestamp fail closed",()=>{
 for(const patch of [{amountSatang:14999},{source:"bank_kplus"},{receiverSuffix:"X-0001"},{receiverRevision:"b".repeat(64)},{deviceId:"foreign"},{id:"b".repeat(64)},{receivedMs:now+1},{bankMs:created-120000},{observedMs:created-1},{verificationStatus:"verified"}])
  assert.equal(run({notices:[{...n,...patch}]}).status,"no_match");
 assert.equal(run({devices:[{...d,enabled:false}]}).status,"no_match");
 assert.equal(run({devices:[{...d,archivedMs:now}]}).status,"no_match");
});
test("receiver change/reconfirmation, foreign/paid/cancelled order, stale window and truncated data block matches",()=>{
 for(const patch of [{paymentRecipientId:"0899999999"},{paymentReceiverRevision:"b".repeat(64)}])
  assert.equal(run({orders:[{...o,...patch}]}).status,"receiver_unconfirmed");
 assert.equal(run({link:{...link,confirmedAtMs:created+1}}).status,"receiver_unconfirmed");
 for(const patch of [{tenantId:"foreign"},{paymentStatus:"paid"},{status:"cancelled"},{bankTransferReviewFlow:"legacy"}])
  assert.equal(run({orders:[{...o,...patch}]}).status,"order_unavailable");
 assert.equal(run({now:created+WINDOW+60001}).status,"window_expired");
 assert.equal(run({truncated:true}).status,"bounded_unavailable");
});
test("competing bills across rails and repeated notices are ambiguous",()=>{
 for(const patch of [{bankTransferReviewFlow:"legacy"},{paymentStatus:"paid"},{orderType:"takeaway"}])
  assert.equal(run({orders:[o,{...o,id:"another",...patch}]}).status,"ambiguous");
 const another={...n,eventId:"b".repeat(64)};another.id=digest(d.id+":"+another.eventId);
 assert.equal(run({notices:[n,another]}).status,"ambiguous");
 assert.equal(fingerprint(n),fingerprint(another));
 assert.equal(run({orders:[o,{...o,id:"another",totalAmount:151}]}).status,"candidate");
});
test("SCB whole-minute timestamp before order is review-only, never claimable",()=>{
 const c=Math.floor(created/60000)*60000+30000;
 const row={...o,createdAt:{toMillis:()=>c}};
 const notice={...n,bankMs:c-30000,observedMs:c+1000,receivedMs:c+2000};
 assert.equal(run({orders:[row],notices:[notice],link:{...link,confirmedAtMs:c-60000}}).status,"time_precision_review");
});
test("signed record uses shared claim, per-order audit and conservative fingerprint; never mutates order",()=>{
 const s=readFileSync("functions/delivery-notification-match.js","utf8");
 assert.match(s,/demoEnabled\(tenantId\)/);
 assert.match(s,/tx.create\(audit,record\)/);
 assert.match(s,/tx.create\(claim,/);
 assert.match(s,/tx.create\(fingerprint,/);
 assert.match(s,/r.status!=="candidate"/);
 assert.doesNotMatch(s,/tx.update\(|tx.set\(|paymentStatus:"paid"|canReleaseKitchen:true/);
 assert.match(readFileSync("firestore.rules","utf8"),/match \/paymentCompanionTenants\/\{path=\*\*\} \{ allow read, write: if false; \}/);
});
