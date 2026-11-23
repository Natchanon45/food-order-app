import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const p=require("./tenant-safe-deletion-policy");
const tenantId="p12g-tenant-test-01",admin="p12g-superadmin";
const operationId="687021f0-66ae-4a62-beb6-a028f38088ac";
const old=()=>({id:tenantId,name:"Unused Shop",slug:"unused-shop",
 active:false,onboardingRequired:true,createdBy:admin,
 masterEditRevision:0});
const store=()=>({tenantId,shopName:"Unused Shop",
 shopPhone:"",shopAddress:"",deliveryFeeNearby:0});
const slug=()=>({tenantId,slug:"unused-shop",name:"Unused Shop",
 active:false});
const input=()=>({tenantId,operationId,expectedName:"Unused Shop",
 expectedSlug:"unused-shop",expectedRevision:0,
 intent:"delete_unowned_placeholder"});
const inspect=(tenant=old(),settings=store(),index=slug(),names=["settings"],refs=[])=>
 p.inspect(tenant,settings,index,names,refs);
const has=(r,code)=>r.reasonCodes.includes(p.REASONS[code]);
test("strict selector and delete command reject forged owner/financial/hidden fields",()=>{
 assert.equal(p.selector({tenantId}),tenantId);
 assert.deepEqual(p.request(input()),input());
 for(const x of [
  null,{},[],{tenantId,unknown:true},{tenantId:"../other"},
  {tenantId,operationId:"not-a-uuid"},
  {...input(),expectedName:""},
  {...input(),expectedName:" Old "},
  {...input(),expectedSlug:"UPPER"},
  {...input(),expectedRevision:-1},
  {...input(),expectedRevision:"0"},
  {...input(),intent:"delete_any_tenant"},
  {...input(),force:true},{...input(),paid:true},
  {...input(),deleteOwner:true},{...input(),balance:0},
 ]){
  assert.throws(()=>p.request(x),/TENANT_DELETE_REQUEST_INVALID/);
 }
});
test("empty never-activated legacy placeholder is the ONLY hard-delete-eligible shape",()=>{
 const result=inspect();
 assert.equal(result.ready,true);
 assert.deepEqual(result.reasonCodes,[]);
 assert.equal(result.isHardDeleteRestricted,true);
 assert.equal(result.canDeleteOnlyUnownedPlaceholder,true);
 for(const f of ["canDeleteBusinessData","canDeleteFinanceHistory",
  "canDeleteOwner"])assert.equal(result[f],false);
});
test("active, trial, owner, membership or finance are never eligible even if other data are absent",()=>{
 for(const patch of [
  {active:true},{onboardingRequired:false},{ownerUid:"owner-uid"},
  {ownerEmail:"owner@example.test"},{firstActivatedAt:"2026-10-18"},
  {trialStartsAt:"2026-10-18"},{trialEndsAt:"2026-11-18"},
  {subscriptionExpiresAt:"2027-11-18"},{planCode:"yearly"},
  {signupBilling:{planCode:"monthly"}},
  {subscriptionStatus:"active"},{revenueShareSuspended:true},
  {m7FinanceAccessStatus:"not_suspended"},
  {m7InvoiceUnpaidCents:999999},{hybridBillingSuspended:true},
  {suspensionReason:"manual_security"},
 ]){
  const r=inspect({...old(),...patch});
  assert.equal(r.ready,false,JSON.stringify(patch));
  assert.ok(has(r,"TENANT_OWNER_OR_ACTIVATION")||
   has(r,"TENANT_NOT_PRISTINE"));
 }
});
test("unknown tenant fields block deletion, even apparent harmless policy config or secrets",()=>{
 for(const patch of [
  {bankAccountNumber:"999999999"},{paymentProvider:"stripe"},
  {businessType:"retail"},{masterEditRevision:1},
  {createdBy:""},{subscriptionUpdatedBy:"admin"},
  {lalamoveWallet:{balance:0}},
 ]){
  const r=inspect({...old(),...patch});
  assert.equal(r.ready,false);
  assert.ok(has(r,"TENANT_MASTER_FIELDS_UNEXPECTED"));
 }
});
test("no parent, missing store settings and foreign public slug all reject deletion",()=>{
 assert.ok(has(inspect(null,null,null),"TENANT_NOT_FOUND"));
 assert.ok(has(inspect(old(),null,slug()),"TENANT_SETTINGS_MISSING"));
 assert.ok(has(inspect(old(),store(),null),"TENANT_SLUG_MISMATCH"));
 for(const changed of [
  {tenantId:"foreign-tenant"},{active:true},
  {name:"Other shop"},{slug:"other-shop"},
  {ownerUid:"some-owner"},{provisioningId:"operation"},
 ]){
  const r=inspect(old(),store(),{...slug(),...changed});
  assert.ok(has(r,"TENANT_SLUG_MISMATCH"));
 }
});
test("store bank/PromptPay or unknown settings must not be destroyed, even if the shop is inactive",()=>{
 for(const patch of [
  {bankAccountNumber:"99998888"},{promptPayId:"0811111111"},
  {paymentVerified:true},{stripeConnected:true},
  {lalamoveWalletCredit:0},
  {tenantId:"foreign"},{shopName:"Different shop"},
 ]){
  const r=inspect(old(),{...store(),...patch});
  assert.ok(has(r,"TENANT_SETTINGS_UNEXPECTED"),JSON.stringify(patch));
 }
});
test("any non-settings subcollection or external reference blocks a hard delete",()=>{
 for(const names of [
  ["settings","orders"],["membership"],["orders"],
  ["settings","masterEditOperations"],["settings","invoices"],
  ["settings","lalamoveWalletTopups"],
 ]){
  const r=inspect(old(),store(),slug(),names);
  assert.ok(has(r,"TENANT_HAS_SUBCOLLECTIONS"));
 }
 assert.deepEqual(p.EXTERNAL_TENANT_DOCUMENT_ROOTS,
  ["paymentCompanionTenants","stripeWalletSandboxTenants"]);
 for(const collectionName of p.EXTERNAL_TENANT_REFERENCES){
  const r=inspect(old(),store(),slug(),["settings"],[collectionName]);
  assert.ok(has(r,"TENANT_EXTERNAL_REFERENCES"));
 }
});
test("CAS original name/slug/revision are mandatory before any destructive mutation",()=>{
 assert.doesNotThrow(()=>p.compare(old(),input()));
 for(const change of [
  {expectedName:"Other"},{expectedSlug:"different-shop"},
  {expectedRevision:1},
 ]){
  assert.throws(()=>p.compare(old(),{...input(),...change}),
   /TENANT_DELETE_STALE_STATE/);
 }
});
test("receipt binds actor, request digest, and deleted slug without bank data or financial authority",()=>{
 const request=p.request(input());
 const a=p.receipt({input:request,actor:admin,
  now:new Date("2026-11-23T08:00:00Z")});
 assert.equal(a.kind,"tenant_empty_placeholder_delete_v1");
 assert.equal(a.actor,admin);
 assert.equal(a.deletedSlug,request.expectedSlug);
 assert.equal(a.requestDigest,p.digest(request));
 assert.match(a.requestDigest,/^[a-f0-9]{64}$/);
 assert.notEqual(a.requestDigest,p.digest({...request,expectedName:"Other"}));
 assert.equal(p.digest(Object.fromEntries(Object.entries(request).reverse())),a.requestDigest);
 const outputs=[p.response(a),p.response(a,true),
  p.status({tenantId,operationId,state:"deleted_verified"})];
 for(const r of outputs){
  for(const field of ["canDeleteBusinessData","canDeleteFinanceHistory",
    "canDeleteOwner","canSettleMoney","canReleaseTenant","canIssueInvoice"])
   assert.equal(r[field],false,field);
 }
 assert.equal(p.response(a,true).replayed,true);
});
test("array and null input fail closed, sorted reasons and unknown future metadata remain blocked",()=>{
 const x=inspect({...old(),futureFinancialFeature:"unknown"},
   {...store(),futurePaidLedger:0},slug(),["settings","futureBilling"],["users"]);
 assert.equal(x.ready,false);
 assert.deepEqual(x.reasonCodes,[...x.reasonCodes].sort());
 assert.equal(new Set(x.reasonCodes).size,x.reasonCodes.length);
 assert.ok(has(x,"TENANT_MASTER_FIELDS_UNEXPECTED"));
 assert.ok(has(x,"TENANT_SETTINGS_UNEXPECTED"));
 assert.ok(has(x,"TENANT_HAS_SUBCOLLECTIONS"));
 assert.ok(has(x,"TENANT_EXTERNAL_REFERENCES"));
 assert.equal(inspect(old(),store(),slug(),null,[]).ready,false);
 assert.equal(inspect(old(),store(),slug(),["settings"],null).ready,false);
});
