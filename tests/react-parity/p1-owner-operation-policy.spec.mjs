import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const P=require("./tenant-owner-operation-policy.js");
const operationId=randomUUID(),tenantId="p13c-tenant-123";
const create=(extra={})=>({
 tenantId,operationId,expectedSlug:"owner-test-shop",expectedName:"Test Shop",
 expectedRevision:0,expectedOnboardingRequired:true,planCode:"yearly",
 displayName:"Test Owner",email:"owner@example.test",password:"DemoOnlyPassword1234!",
 ...extra,
});
const edit=(extra={})=>({
 tenantId,operationId,ownerUid:"owner-1234",expectedRevision:1,
 expectedDisplayName:"Test Owner",displayName:"Updated Owner",...extra,
});
test("strict create request rejects foreign owner, finance and subscription injections",()=>{
 assert.equal(P.createInput(create()).email,"owner@example.test");
 for(const extra of [
  {ownerUid:"hijack"},{subscriptionExpiresAt:"2030-01-01"},
  {signupBilling:{planCode:"yearly"}},{active:true},
  {tenantId:"../other"},{operationId:"notuuid"},
  {expectedRevision:-1},{expectedSlug:"Invalid slug"},
  {expectedName:"X"},{displayName:" X "},{email:"MixedCase@Example.Test"},
  {email:"invalid"},{password:"1234"},{password:"a".repeat(73)},
  {planCode:"lifetime"},{expectedOnboardingRequired:"true"},
  {staffRevision:0},{ownerEmail:"changed@example.test"},
 ])assert.throws(()=>P.createInput(create(extra)),/OWNER_/);
 assert.equal(P.createInput(create({expectedOnboardingRequired:false,
   planCode:""})).planCode,"");
 assert.throws(()=>P.createInput(create({expectedOnboardingRequired:false})),/OWNER_/);
});
test("Owner update requires CAS and existing immutable uid, never password or billing",()=>{
 assert.equal(P.updateInput(edit()).expectedRevision,1);
 for(const extra of [{ownerUid:"x"},{expectedRevision:"1"},
  {expectedRevision:-1},{expectedDisplayName:"X"},
  {displayName:" "},{password:"new-password"},
  {email:"owner@example.test"},{active:false},
  {planCode:"monthly"}])assert.throws(()=>P.updateInput(edit(extra)),/OWNER_/);
});
test("deterministic native UID and cross-tenant email hash never expose passwords",()=>{
 assert.equal(P.uidFor(operationId),P.uidFor(operationId));
 assert.match(P.uidFor(operationId),/^own-[0-9a-f]{32}$/);
 assert.match(P.emailHash("owner@example.test"),/^[0-9a-f]{64}$/);
 assert.notEqual(P.emailHash("other@example.test"),P.emailHash("owner@example.test"));
 const payload={operationId,kind:"create",ownerUid:P.uidFor(operationId),
  tenantId,afterName:"Test Owner",ownerRevision:1};
 const status=P.response(payload,"complete_verified");
 assert.equal(status.readOnly,true);
 assert.equal(status.emailSent,false);
 assert.equal(status.canChangeSubscription,false);
 assert.equal(JSON.stringify(status).includes("owner@example.test"),false);
 assert.equal(P.response(payload,"not_found").mayRetryWithNewOperationId,false);
});
test("Owner profile coherence and billing hash are immutable under rename",()=>{
 const user={uid:"owner-1234",tenantId,email:"owner@example.test",
  displayName:"Owner",role:"owner",active:true};
 assert.equal(P.profileMatches(user,{...user},tenantId),true);
 assert.equal(P.profileMatches(user,{...user,role:"cashier"},tenantId),false);
 assert.equal(P.profileMatches(user,{...user,email:"other@example.test"},tenantId),false);
 const financial={planCode:"yearly",firstActivatedAt:"2026-10-18",
  trialStartsAt:"2026-10-18",m7InvoiceUnpaidCents:900099,
  signupBilling:{planCode:"yearly",billingMode:"subscription"}};
 const before=P.billingDigest(financial);
 assert.equal(P.billingDigest({...financial,ownerDisplayName:"Renamed"}),before);
 assert.notEqual(P.billingDigest({...financial,m7InvoiceUnpaidCents:0}),before);
 assert.notEqual(P.billingDigest({...financial,trialStartsAt:"2026-11-19"}),before);
});
test("status selector is tenant+UUID only",()=>{
 assert.deepEqual(P.statusSelector({tenantId,operationId}),{tenantId,operationId});
 for(const payload of [{tenantId},{operationId},{tenantId,operationId,ownerUid:"x"},
  {tenantId,operationId:"invalid"}])
 assert.throws(()=>P.statusSelector(payload),/OWNER_/);
});
