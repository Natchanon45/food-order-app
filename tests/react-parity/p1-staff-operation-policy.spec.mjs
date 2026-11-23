import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const p=require("./staff-operation-policy.js");
const id=randomUUID(),tenantId="p13b-tenant";
const create=(patch={})=>({
 expectedTenantId:tenantId,operationId:id,
 displayName:"Test Staff",email:"staff@example.test",password:"ExamplePassword123!",
 role:"cashier",businessScope:"order_delivery",active:true,...patch,
});
const update=(patch={})=>({
 expectedTenantId:tenantId,operationId:id,uid:"staff-member",
 expectedRevision:0,displayName:"Updated Staff",role:"kitchen",
 businessScope:"both",active:false,...patch,
});
test("strict create shape forbids fields that can affect tenant/Owner/finance",()=>{
 const value=p.createInput(create());
 assert.equal(value.email,"staff@example.test");
 assert.equal(Object.hasOwn(value,"tenantBilling"),false);
 for(const patch of [{tenantId:"foreign"},{ownerUid:"x"},{bankAccountNumber:"xx"},
   {active:"true"},{email:"MixedCase@Example.Test"},{email:"invalid"},
   {displayName:" A"},{displayName:"A"},{password:"short"},
   {password:"p".repeat(129)},{businessScope:"platform"},
   {role:"owner"},{role:"super_admin"},{operationId:"not-uuid"},
   {expectedTenantId:"../other"}]){
   assert.throws(()=>p.createInput(create(patch)),/STAFF_/);
 }
 assert.throws(()=>p.createInput({...create(),emailVerified:true}),/STAFF_/);
});
test("edit CAS has revision and exact fields, never accepts owner/tenant fields",()=>{
 assert.equal(p.updateInput(update()).expectedRevision,0);
 for(const patch of [{uid:"bad uid"},{expectedRevision:-1},
    {expectedRevision:"0"},{expectedRevision:1.5},{role:"owner"},
    {active:1},{displayName:"  "},{businessScope:"unknown"},
    {subscriptionStatus:"active"},{email:"changed@example.test"}]){
  assert.throws(()=>p.updateInput(update(patch)),/STAFF_/);
 }
 assert.throws(()=>p.updateInput({...update(),password:"secret"}),/STAFF_/);
});
test("operation IDs determine deterministic Auth UIDs and SHA-256 email lock",()=>{
 assert.match(p.uidFor(id),/^stf-[a-f0-9]{32}$/);
 assert.equal(p.uidFor(id),p.uidFor(id));
 assert.equal(p.emailLockKey("staff@example.test").length,64);
 assert.notEqual(p.emailLockKey("other@example.test"),p.emailLockKey("staff@example.test"));
});
test("server status and canonical comparison are strict, never contain password or email",()=>{
 const after=p.view({uid:"staff-member",email:"x@example.test",role:"cashier",
   displayName:"A Person",businessScope:"order_delivery",staffRevision:1,active:false});
 assert.equal(p.matches({...after,tenantId},"STALE",tenantId),false);
 assert.equal(p.matches({...after,tenantId},after,tenantId),true);
 assert.equal(p.matches({...after,tenantId,active:true},after,tenantId),false);
 const x=p.response({operationId:id,kind:"create",tenantId,
   staffUid:"staff-member",after},"complete_verified");
 assert.equal(x.staffRevision,1);
 assert.equal(x.readOnly,true);
 assert.equal(x.canSendEmail,false);
 assert.equal(x.canSettleMoney,false);
 assert.equal(JSON.stringify(x).includes("x@example.test"),false);
 assert.equal(p.response({operationId:id},"not_found").mayRetryWithNewOperationId,false);
 for(const x of [{operationId:"bad"},{expectedTenantId:tenantId},{}]){
  assert.throws(()=>p.statusSelector({...x,expectedTenantId:x.expectedTenantId||tenantId}),/STAFF_/);
 }
});
