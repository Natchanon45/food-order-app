import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {basename,resolve} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import * as s from "../../react-app/src/data/tenantSubscriptionRecovery.mjs";
const tenantId="p12d-tenant-a123456";
const ownerId="superadmin-uid-123456";
const op="5f9194a6-7f5b-47a3-81f0-5fa6e11c4817";
const stored=()=>{
 const map=new Map();
 return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),
  removeItem:key=>map.delete(key)};
};
const receipt={
 ok:true,readOnly:false,tenantId,operationId:op,action:"extend",
 status:"active",active:true,expiresAt:"2027-12-17T16:59:59.999Z",
 gracePeriodDays:3,planCode:"yearly",revision:1,idempotent:false,
 canIssueInvoice:false,canSettleMoney:false,canReleaseFinancialHold:false,
};
const checked={
 ok:true,readOnly:true,tenantId,operationId:op,
 status:"complete_current",canIssueInvoice:false,
 canSettleMoney:false,canReleaseFinancialHold:false,
 tenant:{
  id:tenantId,subscriptionStatus:receipt.status,active:receipt.active,
  subscriptionExpiresAt:receipt.expiresAt,gracePeriodDays:3,
  planCode:"yearly",subscriptionAdminRevision:1,
 },
};
test("per-Superadmin + tenant UUID guard survives reload, never includes date, identity, credentials or a paid claim",()=>{
 const storage=stored();
 assert.equal(s.subscriptionKey(ownerId,tenantId),
  "penguin_p12d_subscription_command_v1_"+ownerId+"_"+tenantId);
 assert.equal(s.readPendingSubscription(ownerId,tenantId,storage),null);
 assert.equal(s.holdPendingSubscription(ownerId,tenantId,op,storage),true);
 assert.equal(s.readPendingSubscription(ownerId,tenantId,storage),op);
 assert.equal(s.readPendingSubscription("other-admin-1234",tenantId,storage),null);
 assert.equal(s.readPendingSubscription(ownerId,"another-tenant123",storage),null);
 assert.equal(s.holdPendingSubscription(ownerId,tenantId,
  "00000000-0000-4000-8000-000000000000",storage),false);
 assert.equal(s.releasePendingSubscription(ownerId,tenantId,
  "00000000-0000-4000-8000-000000000000",storage),false);
 assert.equal(s.readPendingSubscription(ownerId,tenantId,storage),op);
 assert.equal(s.releasePendingSubscription(ownerId,tenantId,op,storage),true);
 assert.equal(s.readPendingSubscription(ownerId,tenantId,storage),null);
});
test("sessionStorage access denial blocks local issuance rather than sending a non-idempotent extension",()=>{
 const denied={getItem(){throw Error("NOT_ALLOWED")},setItem(){throw Error("NOT_ALLOWED")},
  removeItem(){throw Error("NOT_ALLOWED")}};
 assert.equal(s.holdPendingSubscription(ownerId,tenantId,op,denied),false);
 assert.equal(s.readPendingSubscription(ownerId,tenantId,denied),null);
 assert.equal(s.releasePendingSubscription(ownerId,tenantId,op,denied),false);
});
test("canonical expiry snapshot preserves precise UTC timestamp, not browser-day string",()=>{
 const tenant={
  id:tenantId,planCode:"yearly",subscriptionStatus:"trialing",
  active:true,gracePeriodDays:0,subscriptionAdminRevision:8,
  subscriptionExpiresAt:"2027-11-17T16:59:59.999Z",
 };
 assert.deepEqual(s.sourceSnapshot(tenant),{
  expectedExpiresAt:"2027-11-17T16:59:59.999Z",
  expectedStatus:"trialing",expectedActive:true,
  expectedRevision:8,expectedGracePeriodDays:0,
  expectedPlanCode:"yearly",
 });
});
test("strict browser-response contract rejects forged finance authority, changed revision, mismatched tenant and altered plan",()=>{
 const payload={tenantId,operationId:op,action:"extend",planCode:"yearly",
  expectedRevision:0,gracePeriodDays:3};
 assert.equal(s.validateSubscriptionWrite(receipt,payload).revision,1);
 for(const changes of [
  {canSettleMoney:true},{readOnly:true},{revision:2},
  {planCode:"monthly"},{status:"paid"},
  {tenantId:"another"},{operationId:"another"},
  {gracePeriodDays:8},{canIssueInvoice:true},
  {canReleaseFinancialHold:true},{expiresAt:"maybe"},
 ]){
  assert.throws(()=>s.validateSubscriptionWrite({...receipt,...changes},payload),
   /SUBSCRIPTION_WRITE_UNCONFIRMED/);
 }
 assert.equal(s.validateSubscriptionOperation(checked,tenantId,op).status,"complete_current");
 for(const changes of [
  {canSettleMoney:true},{tenantId:"other-tenant123"},
  {status:"paid"},{readOnly:false},
  {tenant:{...checked.tenant,planCode:"lifetime"}},
  {tenant:{...checked.tenant,subscriptionAdminRevision:-1}},
 ]){
  assert.throws(()=>s.validateSubscriptionOperation({...checked,...changes},tenantId,op),
   /SUBSCRIPTION_OPERATION_UNVERIFIED/);
 }
 for(const state of ["not_found","review_required","complete_superseded"]){
  assert.equal(s.validateSubscriptionOperation({
   ...checked,status:state,tenant:null,
  },tenantId,op).status,state);
 }
});
test("canonical Firebase tenant reread is mandatory before an operation clears its lock",()=>{
 const row={id:tenantId,active:true,subscriptionStatus:receipt.status,
  subscriptionExpiresAt:receipt.expiresAt,gracePeriodDays:3,
  planCode:"yearly",subscriptionAdminRevision:1};
 assert.equal(s.canonicalSubscriptionMatches([row],receipt),true);
 for(const change of [
  {active:false},{subscriptionStatus:"suspended"},
  {subscriptionExpiresAt:"2027-11-17T16:59:59.999Z"},
  {gracePeriodDays:4},{planCode:"monthly"},
  {subscriptionAdminRevision:2},
 ]){
  assert.equal(s.canonicalSubscriptionMatches([{...row,...change}],receipt),false);
 }
 assert.equal(s.canonicalSubscriptionMatches([],receipt),false);
});
test("ambiguous network/transaction output keeps per-store hold; definitive status is not inferred from HTTP 409",()=>{
 for(const code of ["functions/unavailable","functions/internal",
  "functions/deadline-exceeded","functions/unknown"]){
  assert.equal(s.subscriptionUnknownError({code}),true);
 }
 assert.equal(s.subscriptionUnknownError({
  details:{code:"SUBSCRIPTION_WRITE_OUTCOME_UNKNOWN"},
 }),true);
 assert.equal(s.subscriptionUnknownError({
  message:"SUBSCRIPTION_WRITE_UNCONFIRMED",
 }),true);
 assert.equal(s.subscriptionUnknownError({code:"functions/already-exists"}),false);
});
test("frontend wires one signed Firebase command, status-only recovery, no page-open historical backfill",async()=>{
 const page=await readFile("react-app/src/pages/AdminTenantsPage.jsx","utf8");
 const component=await readFile("react-app/src/components/TenantSubscriptionControl.jsx","utf8");
 const backend=await readFile("functions/subscription-admin.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 const index=await readFile("functions/index.js","utf8");
 for(const fragment of [
  "holdPendingSubscription(uid, tenantId, operationId)",
  "validateSubscriptionWrite(",
  "validateSubscriptionOperation(",
  "canonicalSubscriptionMatches(",
  "getPlatformTenantSubscriptionOperation(",
  "releasePendingSubscription(uid, tenantId, operationId)",
  "onCheckSubscription={reconcileSubscription}",
 ])assert.ok(page.includes(fragment),fragment);
 assert.doesNotMatch(page,/await backfillTenantSubscriptions\(\{\}\)/);
 assert.match(component,/data-subscription-pending/);
 assert.match(component,/data-subscription-action="activate"/);
 assert.match(component,/data-subscription-action="extend"/);
 assert.match(component,/data-plan-code value=\{planCode\} disabled/);
 assert.match(backend,/subscriptionAdminActions/);
 assert.match(backend,/tx\.create\(opRef,row\)/);
 assert.match(backend,/SUBSCRIPTION_HISTORICAL_BACKFILL_REQUIRES_ORIGINAL_EVIDENCE/);
 assert.match(rules,/match \/subscriptionAdminActions\/\{operationId\}/);
 assert.match(index,/exports\.getPlatformTenantSubscriptionOperation/);
});
test("Source-style subscription card works at 320/390/768/1440, validates zero grace and blocks pending duplicate writes",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p12d-membership-browser-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;width:100%}</style><link rel="stylesheet" href="/public/parity/css/tenant-admin.css"><link rel="stylesheet" href="/public/parity/css/tenant-admin-compact.css"><link rel="stylesheet" href="/public/parity/css/tenant-control-panel-port.css"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  const tenant=JSON.stringify({
   id:tenantId,name:"Merchant Membership",ownerUid:"owner-registered",
   planCode:"yearly",subscriptionStatus:"active",active:true,
   gracePeriodDays:3,subscriptionAdminRevision:0,
   firstActivatedAt:"2026-10-18T03:30:00.000Z",
   subscriptionExpiresAt:"2027-11-17T16:59:59.999Z",
  });
  await writeFile(resolve(dir,"fixture.jsx"),`
    import React,{useState} from "react";
    import {createRoot} from "react-dom/client";
    import {TenantSubscriptionControl} from "@/components/TenantSubscriptionControl";
    const t=(key,values)=>key+(values?.count??"");
    function App(){
      const [locked,setLocked]=useState(false),[busy,setBusy]=useState(false);
      const [requests,setRequests]=useState([]),[checks,setChecks]=useState(0);
      const onAction=async (tenant,payload)=>{
        setRequests(prev=>[...prev,payload]);setLocked(true);
      };
      return <main className="tenant-admin-page"
       style={{maxWidth:920,padding:12,margin:"16px auto"}}>
       <TenantSubscriptionControl tenant={${tenant}} t={t}
        intlLocale="th-TH" onAction={onAction} writeUnconfirmed={locked}
        checking={busy} onCheck={()=>{setChecks(n=>n+1);setBusy(true)}}/>
       <output data-requests style={{display:"block",width:"100%",overflowWrap:"anywhere"}}>
         {JSON.stringify(requests)}</output>
       <output data-checks>{checks}</output>
      </main>
    }
    createRoot(document.getElementById("root")).render(<App/>);
   `);
  vite=await createServer({root,configFile:false,publicDir:false,
   cacheDir:resolve(dir,".vite"),plugins:[react()],
   resolve:{alias:[{find:"@",replacement:resolve(root,"src")}]},
   server:{host:"127.0.0.1",port:0}});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const url="http://127.0.0.1:"+vite.httpServer.address().port+
   "/"+basename(dir)+"/index.html";
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on("pageerror",e=>errors.push(String(e)));
   try{
    await page.goto(url);
    const card=page.locator("[data-subscription-tenant]");
    await card.waitFor();
    await card.locator("summary").click();
    assert.equal(await card.locator("[data-plan-code]").isDisabled(),true);
    assert.equal(await card.locator("[data-expiry-date]").inputValue(),"2027-11-17");
    await card.locator("[data-grace-days]").fill("45");
    await card.locator('[data-subscription-action="extend"][data-days="30"]').click();
    assert.equal(await card.locator("[data-subscription-validation]").count(),1);
    assert.equal(await page.locator("[data-requests]").innerText(),"[]");
    await card.locator("[data-grace-days]").fill("0");
    await card.locator('[data-subscription-action="extend"][data-days="30"]').click();
    await card.locator("[data-subscription-pending]").waitFor();
    const requests=JSON.parse(await page.locator("[data-requests]").innerText());
    assert.equal(requests.length,1);
    assert.equal(requests[0].expectedExpiresAt,"2027-11-17T16:59:59.999Z");
    assert.equal(requests[0].expectedRevision,0);
    assert.equal(requests[0].gracePeriodDays,0);
    for(const action of await card.locator("[data-subscription-action]").all())
      assert.equal(await action.isDisabled(),true);
    await card.locator("[data-reconcile-subscription]").click();
    assert.equal(await card.locator("[data-reconcile-subscription]").isDisabled(),true);
    assert.equal(await page.locator("[data-checks]").innerText(),"1");
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,"subscription card overflows at "+width+"px: "+overflow);
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{
  await browser?.close();await vite?.close();
  await rm(dir,{recursive:true,force:true});
 }
});
