import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const p=require("./tenant-subscription-command-policy");
const ID="tenant-subscription-uat";
const OP="5f9194a6-7f5b-47a3-81f0-5fa6e11c4817";
const FIRST=new Date("2026-10-18T03:30:00.000Z");
const TRIAL=new Date("2026-11-17T16:59:59.999Z");
const EXPIRES=new Date("2027-11-17T16:59:59.999Z");
const tenant=(patch={})=>({
 name:"Emulator Subscription Merchant",slug:"p12d-subscription",
 ownerUid:"owner-uat-account",active:true,
 planCode:"yearly",subscriptionStatus:"active",
 firstActivatedAt:FIRST,trialStartsAt:FIRST,trialEndsAt:TRIAL,
 subscriptionStartedAt:FIRST,subscriptionExpiresAt:EXPIRES,
 gracePeriodDays:3,subscriptionAdminRevision:0,...patch,
});
const input=(t=tenant(),extra={})=>({
 tenantId:ID,operationId:OP,
 action:"extend",days:30,expiresAt:"2027-11-17",
 gracePeriodDays:3,planCode:"yearly",
 expectedExpiresAt:p.iso(t.subscriptionExpiresAt),
 expectedStatus:t.subscriptionStatus||"active",
 expectedActive:t.active!==false,expectedRevision:t.subscriptionAdminRevision??0,
 expectedGracePeriodDays:t.gracePeriodDays??3,
 expectedPlanCode:t.planCode||"monthly",
 ...extra,
});
test("strict request shape rejects injection, invalid options, grace, stale fake dates and duplicate inputs",()=>{
 const valid=p.validate(input());
 assert.equal(valid.operationId,OP);
 assert.throws(()=>p.validate({...input(),canSettleMoney:true}),/SUBSCRIPTION_INPUT_INVALID/);
 assert.throws(()=>p.validate({...input(),gracePeriodDays:NaN}),/SUBSCRIPTION_INPUT_INVALID/);
 assert.throws(()=>p.validate({...input(),gracePeriodDays:31}),/SUBSCRIPTION_INPUT_INVALID/);
 assert.throws(()=>p.validate({...input(),gracePeriodDays:"3"}),/SUBSCRIPTION_INPUT_INVALID/);
 assert.throws(()=>p.validate({...input(),expectedGracePeriodDays:3.3}),/SUBSCRIPTION_INPUT_INVALID/);
 assert.throws(()=>p.validate({...input(),expectedRevision:-1}),/SUBSCRIPTION_INPUT_INVALID/);
 assert.throws(()=>p.validate({...input(),expectedExpiresAt:"2027-11-17"}),/SUBSCRIPTION_EXPECTED_EXPIRY_INVALID/);
 assert.throws(()=>p.validate({...input(),planCode:"unlimited"}),/SUBSCRIPTION_INPUT_INVALID/);
 assert.throws(()=>p.validate({...input(),operationId:"2"}),/SUBSCRIPTION_INPUT_INVALID/);
 assert.throws(()=>p.validate({...input(),days:1}),/SUBSCRIPTION_EXTENSION_INVALID/);
 assert.throws(()=>p.validate({...input(),action:"activate",days:365}),/SUBSCRIPTION_EXTENSION_INVALID/);
});
test("Bangkok end of day uses exact +7 offset; leap days and monthly boundaries verified",()=>{
 assert.equal(p.bangkokEnd("2026-11-23").toISOString(),"2026-11-23T16:59:59.999Z");
 assert.equal(p.bangkokEnd("2028-02-29").toISOString(),"2028-02-29T16:59:59.999Z");
 for(const value of ["2026-02-29","2026-02-30","2026-13-01",
 "2026-00-01","2026-12-32","2026-1-01","2026-04-31","1900-01-01"]){
  assert.throws(()=>p.bangkokEnd(value),/SUBSCRIPTION_DATE_INVALID/,value);
 }
});
test("exact 30/365 extensions use certified original expiry and preserve immutable signup dates",()=>{
 const t=tenant(),request=p.validate(input(t));
 const patch=p.next(t,request,new Date("2026-11-23T04:00:00.000Z"));
 assert.equal(patch.subscriptionExpiresAt.toISOString(),"2027-12-17T16:59:59.999Z");
 assert.equal(patch.subscriptionStatus,"active");
 assert.equal(patch.active,true);
 assert.equal(patch.subscriptionAdminRevision,1);
 assert.equal("firstActivatedAt" in patch,false);
 assert.equal("trialEndsAt" in patch,false);
 assert.equal("subscriptionStartedAt" in patch,false);
 assert.equal("signupBilling" in patch,false);
 assert.equal("m7FinanceAccessStatus" in patch,false);
 const yearly=p.next(t,p.validate(input(t,{days:365})),new Date("2026-11-23T04:00:00Z"));
 assert.equal(yearly.subscriptionExpiresAt.toISOString(),"2028-11-16T16:59:59.999Z");
});
test("stale snapshot rejects second extension, plan/stored status/grace/active/revision drift",()=>{
 const t=tenant(),good=p.validate(input(t));
 const patch=p.next(t,good,new Date("2026-11-23T04:00:00Z"));
 const newer={...t,...patch};
 assert.throws(()=>p.next(newer,good,new Date("2026-11-23T04:00:00Z")),/SUBSCRIPTION_STALE_STATE/);
 for(const change of [
  {active:false},{subscriptionStatus:"suspended"},{planCode:"monthly"},
  {gracePeriodDays:5},{subscriptionAdminRevision:2},
 ]){
  assert.throws(()=>p.next({...t,...change},good,new Date("2026-11-23T04:00:00Z")),
   /SUBSCRIPTION_STALE_STATE/);
 }
});
test("never issue new trial/activate an unowned store or allow Hybrid, M7 or revenue share access changes",()=>{
 const t=tenant(),request=p.validate(input(t));
 for(const change of [
  {onboardingRequired:true},{ownerUid:""},{firstActivatedAt:null},
  {trialStartsAt:null},{revenueShareSuspended:true},{revenueShareEnabled:true},
  {billingMode:"revenue_share"},{billingPolicyVersion:"hybrid_v1"},
 ]){
  assert.throws(()=>p.next({...t,...change},request,new Date("2026-11-23T04:00:00Z")),
    /SUBSCRIPTION_.*(?:REQUIRED|UNSUPPORTED)/);
 }
 assert.throws(()=>p.next(t,p.validate(input(t,{planCode:"monthly"})),
  new Date("2026-11-23T04:00:00Z")),/SUBSCRIPTION_PLAN_MIGRATION_REQUIRES_REVIEW/);
});
test("manual suspension remains suspended when extending; separate explicit activation required",()=>{
 const t=tenant(),suspend=p.validate(input(t,{action:"suspend",days:0}));
 const patch=p.next(t,suspend,new Date("2026-11-23T04:00:00Z"));
 assert.equal(patch.subscriptionStatus,"suspended");
 assert.equal(patch.active,false);
 assert.equal(patch.suspensionReason,"manual_subscription_superadmin");
 const stored={...t,...patch};
 const extend=p.next(stored,p.validate(input(stored)),
  new Date("2026-11-23T04:00:00Z"));
 assert.equal(extend.subscriptionStatus,"suspended");
 assert.equal(extend.active,false);
 assert.equal(extend.subscriptionAdminRevision,2);
 const recovered={...stored,...extend};
 const activate=p.next(recovered,p.validate(input(recovered,{
  action:"activate",days:0,
 })),new Date("2026-11-23T04:00:00Z"));
 assert.equal(activate.subscriptionStatus,"active");
 assert.equal(activate.active,true);
 assert.equal(activate.suspensionReason,"");
});
test("financial M7 hold and unrelated manual restriction cannot be bypassed with activate, extend, set-expiry or suspend",()=>{
 const m7=tenant({m7FinanceAccessStatus:"suspended",
   m7FinanceAccessReason:"m7_overdue_invoice",active:false,
   subscriptionStatus:"suspended",suspensionReason:"manual_subscription_superadmin"});
 const act=p.validate(input(m7,{action:"activate",days:0}));
 assert.throws(()=>p.next(m7,act,new Date("2026-11-23T04:00:00Z")),
  /SUBSCRIPTION_INDEPENDENT_HOLD/);
 const independent=tenant({active:false,suspensionReason:"security_review"});
 const request=p.validate(input(independent));
 const patch=p.next(independent,request,new Date("2026-11-23T04:00:00Z"));
 assert.equal(patch.active,false);
 assert.equal(patch.suspensionReason,"security_review");
 assert.throws(()=>p.next(independent,p.validate(input(independent,{
  action:"suspend",days:0,
 })),new Date("2026-11-23T04:00:00Z")),/SUBSCRIPTION_INDEPENDENT_HOLD/);
 const financial=tenant({m7FinanceAccessStatus:"review_required"});
 const result=p.next(financial,p.validate(input(financial)),new Date("2026-11-23T04:00:00Z"));
 assert.equal(result.active,false);
});
test("set-expiry chooses Bangkok midnight not browser-local time and past date becomes expired",()=>{
 const t=tenant();
 const patch=p.next(t,p.validate(input(t,{action:"set-expiry",
  days:0,expiresAt:"2026-11-23"})),new Date("2026-11-23T11:00:00Z"));
 assert.equal(patch.subscriptionExpiresAt.toISOString(),"2026-11-23T16:59:59.999Z");
 assert.equal(patch.active,true);
 const past=p.next(t,p.validate(input(t,{action:"set-expiry",
  days:0,expiresAt:"2026-11-22"})),new Date("2026-11-23T11:00:00Z"));
 assert.equal(past.subscriptionStatus,"expired");
 assert.equal(past.active,false);
});
test("manual activation with expired subscription remains expired; no unlimited membership via activate",()=>{
 const t=tenant({active:false,subscriptionStatus:"suspended",
  suspensionReason:"manual_subscription_superadmin",
  subscriptionExpiresAt:new Date("2025-11-01T16:59:59.999Z")});
 const approved=p.next(t,p.validate(input(t,{action:"activate",days:0})),
  new Date("2026-11-23T00:00:00Z"));
 assert.equal(approved.subscriptionStatus,"expired");
 assert.equal(approved.active,false);
 assert.throws(()=>p.next(tenant(),p.validate(input(tenant(),{
  action:"activate",days:0,
 })),new Date("2026-11-23T00:00:00Z")),/SUBSCRIPTION_NOT_MANUALLY_SUSPENDED/);
});
test("old stores missing a certified expiry cannot receive an invented new membership from today's date",()=>{
 const t=tenant({subscriptionExpiresAt:null,active:false,subscriptionStatus:"expired"});
 assert.throws(()=>p.next(t,p.validate(input(t)),
  new Date("2026-11-23T04:00:00Z")),/SUBSCRIPTION_EXISTING_EXPIRY_REQUIRED/);
 const allowed=p.next(t,p.validate(input(t,{action:"set-expiry",days:0,
  expiresAt:"2026-12-31"})),new Date("2026-11-23T04:00:00Z"));
 assert.equal(allowed.subscriptionExpiresAt.toISOString(),"2026-12-31T16:59:59.999Z");
 assert.equal(allowed.subscriptionStatus,"active");
});

test("audit receipt deterministic, idempotent and never includes financial/secret proof",()=>{
 const t=tenant(),request=p.validate(input(t));
 const patch=p.next(t,request,new Date("2026-11-23T00:00:00Z"));
 const doc=p.receipt({tenantId:ID,operationId:OP,actor:"superadmin-uat",
  action:"extend",input:request,patch,previous:p.view(t),
  at:new Date("2026-11-23T00:00:00Z")});
 assert.match(doc.requestDigest,/^[a-f0-9]{64}$/);
 assert.equal(doc.kind,"legacy_subscription_control_v1");
 assert.equal(doc.financialAuthority,false);
 const replay=p.response(doc,true);
 assert.equal(replay.idempotent,true);
 assert.equal(replay.canIssueInvoice,false);
 assert.equal(replay.canSettleMoney,false);
 assert.equal(replay.canReleaseFinancialHold,false);
 assert.equal(JSON.stringify(doc).includes("owner-uat-account"),false);
 assert.notEqual(p.fingerprint({...request,days:365}),doc.requestDigest);
});
