import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";

// Isolated browser mocks only: they never contact Firebase, Production,
// actual Auth accounts, SMTP or notification providers.
test("Admin Users real React page recovers lost create reply after reload and safely edits/suspends",async()=>{
 const root=resolve("react-app");
 const dir=await mkdtemp(resolve(root,"p13b-staff-browser-"));
 let vite,browser;
 try{
  const file=async(name,body)=>writeFile(resolve(dir,name),body);
  await file("index.html",
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await file("auth.js",`
   export const useAuth=()=>({status:"ready",profile:{role:"owner",tenantId:"demo-tenant",active:true},user:{uid:"demo-owner"}});`);
  await file("tenant.js",`
   export const useTenant=()=>({status:"ready",tenant:{id:"demo-tenant",name:"Demo Shop"}});`);
  await file("i18n.js",`
   const t=(key,values)=>key+((values&&values.count!==undefined)?" "+values.count:"");
   export const useI18n=()=>({t,locale:"th"});`);
  await file("parity.js",`export const useParityPage=()=>true;`);
  await file("components.jsx",`
   import React from "react";
   export const LocaleSwitcher=()=>null;
   export const PageReadyOverlay=()=> <div data-loading>Loading</div>;
   export const ParityFooter=()=>null;
   export const UserMenu=()=>null;
   export const DynamicField=({children})=><div>{children}</div>;`);
  await file("invitation.js",`export async function requestManagedAccountSetupEmail(email){
    window.__mock.invites.push(email);
    return {providerAccepted:true,deliveryConfirmed:false,containsPassword:false};
   }`);
  await file("staff.js",`
   const persist=()=>localStorage.setItem("p13b_mock_backend",JSON.stringify(window.__mock));
   const tenantId="demo-tenant";
   export async function listStaffUsers(expectedTenantId){
    if(expectedTenantId!==tenantId)throw Error("CROSS_TENANT");
    window.__mock.listReads+=1;persist();
    return window.__mock.staff.map(x=>({...x}));
   }
   export async function createStaffUser(expectedTenantId,payload){
    if(expectedTenantId!==tenantId)throw Error("CROSS_TENANT");
    const state=window.__mock;
    state.calls.push({kind:"create",operationId:payload.operationId});
    const uid="demo-staff-"+state.calls.filter(x=>x.kind==="create").length;
    const row={uid,displayName:payload.displayName,email:payload.email,
     role:payload.role,businessScope:payload.businessScope,active:payload.active,
     staffRevision:1,tenantId};
    state.staff.push(row);
    state.ops[payload.operationId]={kind:"create",uid,staffRevision:1};
    const timeout=state.simulateTimeout;
    state.simulateTimeout=false;persist();
    if(timeout)throw Error("NETWORK_REPLY_LOST_AFTER_SERVER_COMMIT");
    return {ok:true,operationId:payload.operationId,uid,
     pendingIndependentVerification:true,emailSent:false};
   }
   export async function updateStaffUser(expectedTenantId,uid,payload){
    if(expectedTenantId!==tenantId)throw Error("CROSS_TENANT");
    const state=window.__mock,row=state.staff.find(x=>x.uid===uid);
    if(!row||row.staffRevision!==payload.expectedRevision)throw Error("STALE");
    Object.assign(row,{displayName:payload.displayName,role:payload.role,
      businessScope:payload.businessScope,active:payload.active,staffRevision:row.staffRevision+1});
    state.calls.push({kind:"update",operationId:payload.operationId});
    state.ops[payload.operationId]={kind:"update",uid,staffRevision:row.staffRevision};
    persist();
    return {ok:true,operationId:payload.operationId,uid,pendingIndependentVerification:true};
   }
   export async function getTenantStaffOperationStatus(expectedTenantId,operationId){
    if(expectedTenantId!==tenantId)throw Error("CROSS_TENANT");
    const state=window.__mock;state.statusReads+=1;persist();
    const op=state.ops[operationId];
    return {ok:true,readOnly:true,status:op?"complete_verified":"not_found",
      kind:op?.kind||null,uid:op?.uid||null,staffRevision:op?.staffRevision||null,
      tenantId,operationId,mayRetryWithNewOperationId:false};
   }`);
  await file("fixture.jsx",`
   import React from "react";
   import{createRoot}from"react-dom/client";
   import{MemoryRouter}from"react-router-dom";
   import{AdminUsersPage}from"@/pages/AdminUsersPage";
   window.__mock=JSON.parse(localStorage.getItem("p13b_mock_backend")||
    '{"staff":[],"ops":{},"calls":[],"listReads":0,"statusReads":0,"simulateTimeout":false,"invites":[]}');
   createRoot(document.getElementById("root")).render(
    <MemoryRouter initialEntries={["/admin/users"]}><AdminUsersPage/></MemoryRouter>);`);
  const alias=[
   ["@/auth/AuthProvider","auth.js"],
   ["@/tenant/TenantProvider","tenant.js"],
   ["@/i18n/I18nProvider","i18n.js"],
   ["@/hooks/useParityPage","parity.js"],
   ["@/data/adminStaff","staff.js"],
   ["@/auth/managedAccountInvitation","invitation.js"],
   ...["LocaleSwitcher","PageReadyOverlay","ParityFooter","UserMenu","DynamicField"]
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
   const page=await browser.newPage({viewport:{width,height:900}});
   const pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?
      r.continue():r.abort());
    await page.goto(url);
    await page.locator("#openCreateUserModal:not([disabled])").waitFor({timeout:20000});
    const add=async(name,email)=>{
      await page.locator("#openCreateUserModal").click();
      // React batches the previous successful form reset. Do not type until
      // the newly opened dialog has rendered its empty state.
      await page.waitForFunction(()=>{
        const dialog=document.querySelector("#userDialog");
        return dialog?.open && ["displayName","email","password","confirmPassword"]
          .every(id=>document.getElementById(id)?.value==="");
      },null,{timeout:8000});
      await page.locator("#displayName").fill(name);
      await page.locator("#email").fill(email);
      await page.locator("#password").fill("EmulatorOnly1234!");
      await page.locator("#confirmPassword").fill("EmulatorOnly1234!");
      await page.waitForFunction(()=>document.querySelector("#userForm")?.checkValidity(),
        null,{timeout:5000});
      await page.locator("#createUserButton").click();
    };
    await add("First Person","first@example.test");
    await page.waitForFunction(()=>window.__mock.staff.length===1&&
      window.__mock.statusReads>=1&&sessionStorage.length===0,null,{timeout:7000});
    await page.locator("#userDialog").waitFor({state:"hidden"});
    await page.locator("#openCreateUserModal:not([disabled])").waitFor();
    assert.equal(await page.locator("[data-staff-operation-recovery]").count(),0);
    assert.equal((await page.evaluate(()=>window.__mock.invites)).length,0,
      "Staff creation must not send an invitation on its own");
    await page.locator(width<700?
      '[data-mobile-staff-invite="demo-staff-1"]':
      '[data-staff-invite="demo-staff-1"]').click();
    await page.waitForFunction(()=>window.__mock.invites.length===1);
    assert.equal((await page.evaluate(()=>window.__mock.invites[0])),"first@example.test");
    await page.evaluate(()=>{window.__mock.simulateTimeout=true;});
    await add("Second Person","second@example.test");
    await page.locator("[data-staff-operation-recovery]").waitFor({timeout:6000});
    assert.equal(await page.locator("#userDialog").evaluate(el=>el.open),false);
    assert.equal(await page.locator("#openCreateUserModal").isDisabled(),true);
    const session=await page.evaluate(()=>Object.values(sessionStorage));
    assert.equal(session.length,1);
    assert.match(session[0],/^[0-9a-f-]{36}$/);
    assert.equal(session.join("").includes("second@example.test"),false);
    assert.equal((await page.evaluate(()=>window.__mock.calls))
      .filter(x=>x.kind==="create").length,2);
    await page.reload();
    await page.locator("[data-staff-operation-recovery]").waitFor();
    await page.locator("[data-staff-check-original]").click();
    await page.locator("#openCreateUserModal:not([disabled])").waitFor();
    assert.equal(await page.locator("[data-staff-operation-recovery]").count(),0);
    assert.equal((await page.evaluate(()=>window.__mock.calls))
      .filter(x=>x.kind==="create").length,2,
      "must never retry lost create");
    const uid="demo-staff-1";
    const nameInput=page.locator(width<700?
      '[data-mobile-name-uid="'+uid+'"]':'[data-name-uid="'+uid+'"]');
    await nameInput.fill("Safe Renamed");
    await page.locator(width<700?
      '[data-mobile-save-user="'+uid+'"]':'[data-save-user="'+uid+'"]').click();
    await page.waitForFunction(()=>window.__mock.staff[0].staffRevision===2 &&
       sessionStorage.length===0);
    if(width<700){
      await page.locator('[data-mobile-active-uid="'+uid+'"]').click();
    }else{
      await page.locator('[data-active-uid="'+uid+'"]').uncheck();
    }
    await page.locator(width<700?
      '[data-mobile-save-user="'+uid+'"]':'[data-save-user="'+uid+'"]').click();
    await page.waitForFunction(()=>window.__mock.staff[0].staffRevision===3 &&
       window.__mock.staff[0].active===false&&sessionStorage.length===0);
    assert.equal(await page.locator("[data-staff-operation-recovery]").count(),0);
    assert.deepEqual(pageErrors,[]);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
