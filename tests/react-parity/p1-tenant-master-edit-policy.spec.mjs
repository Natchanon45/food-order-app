import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const p=require("./tenant-master-edit-policy");
const tenantId="p12f-master-tenant";
const operationId="687021f0-66ae-4a62-beb6-a028f38088ac";
const seed={
 name:"Old Shop",slug:"old-shop",shopPhone:"022244455",
 shopAddress:"Old Street",businessType:"restaurant_cafe",
 masterEditRevision:3,active:true,ownerUid:"p12f-owner",
 firstActivatedAt:"2026-10-18T03:30:00.000Z",
 planCode:"yearly",revenueShareSuspended:false,
};
const store={
 shopName:"Old Shop",shopPhone:"022244455",
 shopAddress:"Old Street",bankAccountNumber:"1234567890123",
 promptPayId:"0999888777",
};
const input=(overrides={})=>({
 tenantId,operationId,
 name:"New Shop",slug:"new-shop",phone:"0867778888",
 address:"New Street",businessType:"retail",
 expectedName:"Old Shop",expectedSlug:"old-shop",
 expectedPhone:"022244455",expectedAddress:"Old Street",
 expectedBusinessType:"restaurant_cafe",expectedRevision:3,
 ...overrides,
});
test("full strict typed request permits only master fields, never Source billing/owner/financial extras",()=>{
 const validated=p.request(input());
 assert.equal(validated.slug,"new-shop");
 const malformed=[
  {tenantId:"../../other"},{operationId:"invalid"},
  {slug:"UPPER"},{slug:"a"},{slug:"invalid space"},
  {expectedSlug:"../old"},{name:"X"},{name:" Shop "},
  {expectedName:"  Old Shop "},{phone:"1".repeat(31)},
  {address:"A".repeat(301)},{phone:null},
  {expectedPhone:null},{expectedAddress:9},
  {businessType:"all"},{expectedBusinessType:"unlimited"},
  {expectedRevision:-1},{expectedRevision:3.5},
  {expectedRevision:"3"},{active:true},
  {revenueShareSuspended:false},{ownerUid:"other"},
  {subscriptionExpiresAt:"2029-01-01"}, {planCode:"monthly"},
  {m7FinanceAccessStatus:"not_suspended"},
 ];
 for(const bad of malformed)
  assert.throws(()=>p.request(input(bad)),/MASTER_/);
 assert.throws(()=>p.request({...input(),bankAccountNumber:"secret"}),
  /MASTER_INPUT_SHAPE_INVALID/);
});
test("immutable original name, slug, phone, address, business and revision must CAS before rename",()=>{
 const view=p.oldView(seed,store);
 assert.deepEqual(view,{
  name:"Old Shop",slug:"old-shop",phone:"022244455",
  address:"Old Street",businessType:"restaurant_cafe",revision:3,
 });
 assert.doesNotThrow(()=>p.compare(view,input()));
 for(const changed of [
  {expectedName:"Other"},{expectedSlug:"new-shop"},
  {expectedPhone:""},{expectedAddress:"mismatch"},
  {expectedBusinessType:"both"},{expectedRevision:4},
 ]){
  assert.throws(()=>p.compare(view,input(changed)),/MASTER_STALE_ORIGINAL/);
 }
});
test("empty store contact fields override stale tenant fallback, enabling intentional clearing of address/phone",()=>{
 const old=p.oldView(seed,{shopPhone:"",shopAddress:""});
 assert.equal(old.phone,"");
 assert.equal(old.address,"");
 const noStore=p.oldView(seed,{});
 assert.equal(noStore.phone,"022244455");
 assert.equal(noStore.address,"Old Street");
});
test("legacy businessUnits map to master type without touching historical signupBilling",()=>{
 assert.equal(p.normalizedBusiness({businessUnits:["order_delivery"]}),"restaurant_cafe");
 assert.equal(p.normalizedBusiness({businessUnits:["retail_pos"]}),"retail");
 assert.equal(p.normalizedBusiness({businessUnits:["order_delivery","retail_pos"]}),"both");
 assert.equal(p.normalizedBusiness({businessType:"retail",
  businessUnits:["order_delivery"]}),"retail");
 assert.equal(p.normalizedBusiness({businessType:"unknown"}),"both");
});
test("next master revision is an isolated projection with no financial or signup fields",()=>{
 const result=p.outcome(input(),4);
 assert.deepEqual(result,{
  tenantId,name:"New Shop",slug:"new-shop",
  phone:"0867778888",address:"New Street",
  businessType:"retail",revision:4,
 });
 for(const field of [
  "active","planCode","subscriptionStatus","trialEndsAt","revenueShareSuspended",
  "m7FinanceAccessStatus","bankVerified","ownerUid","signupBilling",
 ]){
  assert.equal(field in result,false);
 }
});
test("immutable request digest distinguishes original snapshot, new slug and contact changes",()=>{
 const a=p.digest(input()),b=p.digest(input());
 assert.equal(a,b);
 assert.match(a,/^[a-f0-9]{64}$/);
 for(const mutation of [
  {slug:"second-slug"},{expectedRevision:4},
  {phone:"0123334455"},{address:"Another"},
  {businessType:"both"},{expectedName:"Edited Earlier"},
 ]){
  assert.notEqual(p.digest(input(mutation)),a);
 }
 assert.equal(p.digest(Object.fromEntries(Object.entries(input()).reverse())),a);
});
test("immutable receipt and recovery response never authorize credit, account owner change or restored access",()=>{
 const row=p.receipt({input:input(),actor:"superadmin-p12f",
  before:p.oldView(seed,store),after:p.outcome(input(),4),
  userCount:2,stamp:new Date("2026-11-23T07:00:00Z")});
 assert.equal(row.kind,"tenant_master_edit_v1");
 assert.equal(row.userCount,2);
 assert.match(row.requestDigest,/^[a-f0-9]{64}$/);
 assert.equal(row.canReleaseTenant,false);
 assert.equal(row.changedSubscriptionTerms,false);
 assert.equal(row.canChangeOwnerIdentity,false);
 for(const response of [
  p.response(row),p.response(row,true),
  p.readonly(row,"complete_current",tenantId,operationId),
  p.readonly(row,"review_required",tenantId,operationId),
  p.readonly(row,"complete_superseded",tenantId,operationId),
 ]){
  assert.equal(response.canIssueInvoice,false);
  assert.equal(response.canSettleMoney,false);
  assert.equal(response.canReleaseTenant,false);
  assert.equal(response.canChangeOwnerIdentity,false);
  assert.equal(response.changedSubscriptionTerms,false);
 }
 const str=JSON.stringify(row);
 assert.ok(!str.includes("1234567890123"));
 assert.ok(!str.includes("0999888777"));
 assert.equal(p.readonly(row,"review_required",tenantId,operationId).master,null);
 assert.equal(p.response(row,true).replayed,true);
});
test("legacy missing revision defaults to zero but unsafe non-integer stored versions fail closed",()=>{
 const basic=p.oldView({...seed,masterEditRevision:undefined},store);
 assert.equal(basic.revision,0);
 for(const invalid of ["4",0.1,NaN,-2]){
  const current=p.oldView({...seed,masterEditRevision:invalid},store);
  assert.throws(()=>p.compare(current,input({expectedRevision:invalid})),/MASTER_/);
 }
});
