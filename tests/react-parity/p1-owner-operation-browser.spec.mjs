import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";

// Actual PlatformOwnersPage React handlers are exercised against an isolated
// in-memory Server mock. This test never touches Firebase or real accounts.
test("Owner add lost-response → durable lock → reload → status proof → rename works on mobile and desktop",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p13c-owner-browser-"));
 let vite,browser;
 try{
  const write=(name,value)=>writeFile(resolve(dir,name),value);
  await write("index.html",
   '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await write("auth.js",`export const useAuth=()=>({status:"ready",profile:{role:"super_admin",active:true},user:{uid:"p13c-superadmin"}});`);
  await write("i18n.js",`export const useI18n=()=>({t:(key)=>key,formatNumber:(n)=>String(n)});`);
  await write("parity.js",`export const useParityPage=()=>true;`);
  await write("components.jsx",`import React from "react";
  export const DynamicField=({children})=><div>{children}</div>;
  export const LocaleSwitcher=()=>null;
  export const PageReadyOverlay=()=> <div data-loading>Loading</div>;
  export const ParityFooter=()=>null;
  export const UserMenu=()=>null;`);
  await write("invitation.js",`export async function requestManagedAccountSetupEmail(email){
   window.__ownerMock.invites.push(email);
   return {providerAccepted:true,deliveryConfirmed:false,containsPassword:false};
  }`);
  await write("service.js",`
   const persist=()=>localStorage.setItem("p13c_mock_backend",JSON.stringify(window.__ownerMock));
   export async function listTenants(){
    const state=window.__ownerMock;state.listReads+=1;persist();
    return state.tenants.map(x=>({...x}));
   }
   export async function createTenantOwner(input){
    const state=window.__ownerMock,tenant=state.tenants.find(t=>t.id===input.tenantId);
    state.calls.push({kind:"create",operationId:input.operationId});
    if(!tenant||tenant.ownerUid)throw Error("DUPLICATE");
    const ownerUid="p13c-owner-demo";
    Object.assign(tenant,{ownerUid,ownerEmail:input.email,ownerDisplayName:input.displayName,
      ownerRevision:1,active:true,onboardingRequired:false,
      planCode:input.planCode,firstActivatedAt:"2026-11-23T13:30:00.000Z"});
    state.ops[input.operationId]={kind:"create",tenantId:input.tenantId,
      ownerUid,displayName:input.displayName,ownerRevision:1};
    const lost=state.loseReply;state.loseReply=false;persist();
    if(lost)throw Error("NETWORK_REPLY_LOST_AFTER_SERVER_COMMIT");
    return {ok:true,operationId:input.operationId,ownerUid,
      pendingIndependentVerification:true,emailSent:false};
   }
   export async function updateTenantOwner(input){
    const state=window.__ownerMock,tenant=state.tenants.find(t=>t.id===input.tenantId);
    if(tenant.ownerUid!==input.ownerUid||tenant.ownerRevision!==input.expectedRevision)
      throw Error("STALE");
    state.calls.push({kind:"update",operationId:input.operationId});
    tenant.ownerDisplayName=input.displayName;
    tenant.ownerRevision+=1;
    state.ops[input.operationId]={kind:"update",tenantId:input.tenantId,
      ownerUid:tenant.ownerUid,displayName:input.displayName,
      ownerRevision:tenant.ownerRevision};
    const lost=state.loseReply;state.loseReply=false;persist();
    if(lost)throw Error("NETWORK_REPLY_LOST_AFTER_SERVER_COMMIT");
    return {ok:true,operationId:input.operationId,ownerUid:tenant.ownerUid,
      pendingIndependentVerification:true};
   }
   export async function getPlatformTenantOwnerOperation({tenantId,operationId}){
    const state=window.__ownerMock;state.statusReads+=1;persist();
    const op=state.ops[operationId];
    if(!op)return {ok:true,readOnly:true,operationId,tenantId,status:"not_found",
      kind:null,ownerUid:null,ownerRevision:null,mayRetryWithNewOperationId:false,
      canIssueInvoice:false,canSettleMoney:false,canChangeSubscription:false,
      emailSent:false};
    return {...op,ok:true,readOnly:true,status:"complete_verified",operationId,tenantId,
      canIssueInvoice:false,canSettleMoney:false,canChangeSubscription:false,
      mayRetryWithNewOperationId:false,emailSent:false};
   }
   `);
  await write("fixture.jsx",`
   import React from "react";
   import{createRoot}from"react-dom/client";
   import{MemoryRouter}from"react-router-dom";
   import{PlatformOwnersPage}from"@/pages/PlatformOwnersPage";
   window.__ownerMock=JSON.parse(localStorage.getItem("p13c_mock_backend")||
    '{"tenants":[{"id":"p13c-shop","name":"Test Demo Shop","slug":"test-demo-shop","active":false,"onboardingRequired":true,"ownerRevision":0}],"ops":{},"calls":[],"statusReads":0,"listReads":0,"loseReply":false,"invites":[]}');
   createRoot(document.getElementById("root")).render(
    <MemoryRouter initialEntries={["/platform/owners"]}><PlatformOwnersPage/></MemoryRouter>);`);
  const alias=[
   ["@/auth/AuthProvider","auth.js"],["@/i18n/I18nProvider","i18n.js"],
   ["@/hooks/useParityPage","parity.js"],["@/data/platformTenantService","service.js"],
   ["@/auth/managedAccountInvitation","invitation.js"],
   ...["DynamicField","LocaleSwitcher","PageReadyOverlay","ParityFooter","UserMenu"]
     .map(name=>["@/components/"+name,"components.jsx"]),
  ].map(([find,name])=>({find,replacement:resolve(dir,name)}));
  alias.push({find:"@",replacement:resolve(root,"src")});
  vite=await createServer({configFile:false,root,
    cacheDir:resolve(dir,".vite-cache"),plugins:[react()],
    resolve:{alias},server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:950},reducedMotion:"reduce"});
   const errors=[];page.on("pageerror",e=>errors.push(String(e)));

   try{
    await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?
      route.continue():route.abort());
    await page.goto(url);
    await page.locator('[data-owner-action="create"]:not([disabled])').waitFor();
    await page.evaluate(()=>{window.__ownerMock.loseReply=true;});
    await page.locator('[data-owner-action="create"]').click();
    await page.locator("#ownerDisplayName").fill("New Owner");
    await page.locator("#ownerEmail").fill("newowner@example.test");
    await page.locator("#ownerPassword").fill("DemoOnlyOwnerPassword123!");
    await page.locator("#ownerPasswordConfirm").fill("DemoOnlyOwnerPassword123!");
    await page.locator("#ownerBillingPlan").selectOption("yearly");
    await page.locator("#ownerSubmitButton").click();
    await page.locator("[data-owner-operation-recovery]").waitFor({timeout:8000});
    assert.equal(await page.locator('[data-owner-action="create"]').isDisabled(),true);
    const session=await page.evaluate(()=>Object.values(sessionStorage));
    assert.equal(session.length,1);
    assert.match(session[0],/^[0-9a-f-]{36}$/);
    assert.equal(session.join("").includes("newowner@example.test"),false);
    assert.equal((await page.evaluate(()=>window.__ownerMock.calls)).length,1);
    await page.reload();
    await page.locator("[data-owner-operation-recovery]").waitFor();
    await page.locator("[data-owner-check-original]").click();
    await page.locator('[data-owner-action="edit"]:not([disabled])').waitFor();
    assert.equal(await page.locator("[data-owner-operation-recovery]").count(),0);
    assert.equal((await page.evaluate(()=>window.__ownerMock.calls)).length,1,
      "lost create response must never trigger a duplicate Auth create");
    assert.equal((await page.evaluate(()=>window.__ownerMock.invites)).length,0,
      "Owner creation never sends an invitation automatically");
    await page.locator("[data-owner-invite]").click();
    await page.waitForFunction(()=>window.__ownerMock.invites.length===1);
    assert.equal((await page.evaluate(()=>window.__ownerMock.invites[0])),
      "newowner@example.test");
    await page.locator('[data-owner-action="edit"]').click();
    await page.locator("#ownerDisplayName").fill("Owner Renamed");
    await page.locator("#ownerSubmitButton").click();
    await page.waitForFunction(()=>window.__ownerMock.tenants[0].ownerRevision===2&&
      sessionStorage.length===0,null,{timeout:8000});
    assert.equal((await page.evaluate(()=>window.__ownerMock.tenants[0].ownerDisplayName)),
     "Owner Renamed");
    await page.locator('[data-owner-action="edit"]').click();
    await page.locator("#ownerDisplayName").fill("Owner Renamed Again");
    await page.evaluate(()=>{window.__ownerMock.loseReply=true;});
    await page.locator("#ownerSubmitButton").click();
    await page.locator("[data-owner-operation-recovery]").waitFor();
    assert.equal(await page.locator('[data-owner-action="edit"]').isDisabled(),true);
    await page.locator("[data-owner-check-original]").click();
    await page.locator('[data-owner-action="edit"]:not([disabled])').waitFor();
    assert.equal((await page.evaluate(()=>window.__ownerMock.calls)).length,3);
    assert.equal(await page.evaluate(()=>sessionStorage.length),0);
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
