import test from "node:test";
import assert from "node:assert/strict";
import {readFile,mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import * as P from "../../react-app/src/data/tenantProvisionRecovery.mjs";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
const OP="5f9194a6-7f5b-47a3-81f0-5fa6e11c4817";
const checked={ok:true,operationId:OP,status:"complete_verified",
 readOnly:true,tenantActivated:true,ownerConfigured:true,
 canIssueInvoice:false,canSettleMoney:false,canReleaseTenant:false,
 mayRetryWithNewOperationId:false,reason:null,
 tenant:{id:"created-tenant-12345678",name:"One Store",slug:"one-store",planCode:"yearly"},
 owner:{uid:"native-owner-12345678",role:"owner"}};
const storage=()=>{
 const map=new Map();
 return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),
 removeItem:k=>map.delete(k)};
};
test("one-operation session guard survives navigation/reload but stores ONLY opaque UUID per Superadmin",()=>{
 const store=storage();
 assert.equal(P.operationKey("superadmin-123"),"penguin_p12_owner_provision_v1_superadmin-123");
 assert.equal(P.holdPendingProvision("superadmin-123",OP,store),true);
 assert.equal(P.readPendingProvision("superadmin-123",store),OP);
 assert.equal(P.readPendingProvision("different-admin-123",store),null);
 assert.equal(P.releasePendingProvision("superadmin-123",
  "00000000-0000-4000-8000-000000000000",store),false);
 assert.equal(P.readPendingProvision("superadmin-123",store),OP);
 assert.equal(JSON.stringify(store).includes("password"),false);
 assert.equal(JSON.stringify(store).includes("email"),false);
 assert.equal(P.releasePendingProvision("superadmin-123",OP,store),true);
 assert.equal(P.readPendingProvision("superadmin-123",store),null);
 assert.equal(P.holdPendingProvision("superadmin-123","raw-secret",store),false);
 assert.equal(P.holdPendingProvision("x",OP,store),false);
});
test("browser storage unavailable prevents new server write; never fallback to non-durable operation",()=>{
 const unavailable={
  getItem:()=>{throw Error("STORAGE_DENIED")},
  setItem:()=>{throw Error("STORAGE_DENIED")},
  removeItem:()=>{throw Error("STORAGE_DENIED")},
 };
 assert.equal(P.readPendingProvision("admin-123",unavailable),null);
 assert.equal(P.holdPendingProvision("admin-123",OP,unavailable),false);
 assert.equal(P.releasePendingProvision("admin-123",OP,unavailable),false);
});
test("superadmin status protocol fail-closes unknown, forged money, unscoped retry and inconsistent success",()=>{
 assert.equal(P.validateProvisionStatus(checked,OP).status,"complete_verified");
 for(const response of [
  {...checked,operationId:"invalid"},
  {...checked,readOnly:false},
  {...checked,canSettleMoney:true},
  {...checked,canIssueInvoice:true},
  {...checked,canReleaseTenant:true},
  {...checked,mayRetryWithNewOperationId:true},
  {...checked,status:"failed_released"},
  {...checked,tenant:{...checked.tenant,planCode:"lifetime"}},
  {...checked,owner:{...checked.owner,role:"super_admin"}},
  {...checked,tenant:null},
  {...checked,status:"paid"},
  {...checked,tenantActivated:false},
 ])assert.throws(()=>P.validateProvisionStatus(response,OP));
 const uncertain={...checked,status:"pending_review",
  tenantActivated:false,ownerConfigured:false,tenant:null,owner:null};
 assert.equal(P.validateProvisionStatus(uncertain,OP).status,"pending_review");
 for(const state of ["not_found","review_required"]){
  assert.equal(P.validateProvisionStatus({...uncertain,status:state},OP).status,state);
 }
 const failed={...uncertain,status:"failed_released",mayRetryWithNewOperationId:true};
 assert.equal(P.validateProvisionStatus(failed,OP).mayRetryWithNewOperationId,true);
 assert.throws(()=>P.validateProvisionStatus({...failed,mayRetryWithNewOperationId:false},OP));
 assert.throws(()=>P.validateProvisionStatus({...failed,owner:{uid:"owner"}},OP));
});
test("one-shot completed operation needs both server-authenticated ownership and independently read canonical tenant",()=>{
 const expected=[{id:checked.tenant.id,slug:checked.tenant.slug,
  name:checked.tenant.name,planCode:"yearly",ownerUid:checked.owner.uid,
  onboardingRequired:false,active:true}];
 assert.equal(P.canonicalOwnerMatches(expected,checked),true);
 for(const mutated of [
  {ownerUid:"other"}, {name:"other"}, {planCode:"monthly"},
  {slug:"other"}, {active:false}, {onboardingRequired:true},
 ]){
  assert.equal(P.canonicalOwnerMatches([{...expected[0],...mutated}],checked),false);
 }
 assert.equal(P.canonicalOwnerMatches(expected,{...checked,status:"review_required"}),false);
 assert.equal(P.canonicalOwnerMatches([],checked),false);
});
test("transient or indeterminate write failure preserves original operation and blocks automatic retry",()=>{
 for(const code of ["functions/deadline-exceeded","functions/unavailable",
 "functions/internal","functions/unknown"]){
  assert.equal(P.isProvisionUnknownError({code}),true);
 }
 assert.equal(P.isProvisionUnknownError({details:{code:"TENANT_PROVISION_REVIEW_REQUIRED"}}),true);
 assert.equal(P.isProvisionUnknownError({message:"TENANT_WRITE_UNCONFIRMED"}),true);
 for(const code of ["functions/already-exists","functions/invalid-argument",
 "functions/permission-denied"]){
  assert.equal(P.isProvisionUnknownError({code}),false);
 }
});
test("Source Superadmin creation controls and server recovery integration remain one owner+tenant operation",async()=>{
 const page=await readFile("react-app/src/pages/AdminTenantsPage.jsx","utf8");
 const backend=await readFile("functions/tenant-provision.js","utf8");
 const status=await readFile("functions/tenant-provision-status.js","utf8");
 const funcs=await readFile("functions/index.js","utf8");
 const service=await readFile("react-app/src/data/platformTenantService.js","utf8");
 for(const id of ["tenantOwnerName","tenantOwnerEmail","tenantOwnerPassword",
   "tenantOwnerPasswordConfirm","tenantNewPlanCode"])assert.ok(page.includes('id="'+id+'"'));
 for(const fragment of [
  "createOperationIdRef.current = crypto.randomUUID()",
  "await createActiveTenantWithOwner(payload)",
  "await getPlatformTenantProvisionStatus({operationId: payload.operationId})",
  "holdPendingProvision(authState.user?.uid, operationId)",
  "releasePendingProvision(uid, operationId)",
  "validateProvisionStatus",
  "canonicalOwnerMatches",
  "data-pending-create-modal", // component supplies it, not inline
 ]){
  if(fragment==="data-pending-create-modal")continue;
  assert.ok(page.includes(fragment),"missing "+fragment);
 }
 assert.match(page,/<TenantProvisionRecoveryNotice/);
 assert.match(backend,/definitiveAuthCreateRejection/);
 assert.match(backend,/legacyCollision/);
 assert.match(backend,/tx\.get\(db\.collection\("users"\)\.doc\(request\.auth\.uid\)\)/);
 assert.match(status,/native\.email/);
 assert.match(status,/AUTH_PROOF_UNAVAILABLE/);
 assert.match(funcs,/getPlatformTenantProvisionStatus = require/);
 assert.match(service,/getPlatformTenantProvisionStatus = payload => call/);
 const comp=await readFile("react-app/src/components/TenantProvisionRecoveryNotice.jsx","utf8");
 assert.match(comp,/data-pending-tenant-provision/);
 assert.match(comp,/data-pending-create-modal/);
 assert.doesNotMatch(comp,/setDoc\(|updateDoc\(|createActiveTenantWithOwner\(/);
});
test("responsive recovery notice shows a single safe action with accurate pending state at 320/390/768/1440px",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p12-onboard-visual-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"fixture.jsx"),`import React,{useState} from "react";
   import{createRoot}from"react-dom/client";
   import{TenantProvisionRecoveryNotice} from "@/components/TenantProvisionRecoveryNotice";
   function App(){const [checking,setChecking]=useState(false),[clicks,setClicks]=useState(0);
   const check=()=>{setClicks(n=>n+1);setChecking(true)};
   return <div style={{maxWidth:920,margin:"15px auto",padding:"12px"}}>
    <main className="tenant-admin-page">
     <TenantProvisionRecoveryNotice operationId="${OP}" checking={checking} onCheck={check}/>
    </main>
    <section id="tenantDialog"><TenantProvisionRecoveryNotice mode="modal" checking={checking}
     operationId="${OP}" onCheck={check}/></section>
    <output data-clicks>{clicks}</output>
   </div>}
   createRoot(document.getElementById("root")).render(<App/>);`);
  vite=await createServer({configFile:false,root,
   cacheDir:resolve(dir,".vite-cache"),plugins:[react()],
   resolve:{alias:[{find:"@",replacement:resolve(root,"src")}]},
   server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on("pageerror",error=>errors.push(String(error)));
   try{
    await page.goto(url);
    const first=page.locator("[data-pending-tenant-provision]");
    const dialog=page.locator("[data-pending-create-modal]");
    await first.waitFor();
    assert.equal(await first.locator("button[data-check-tenant-provision]").count(),1);
    assert.equal(await dialog.locator("button[data-check-tenant-provision]").count(),1);
    assert.equal(await first.getByText(OP,{exact:false}).count(),1);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,"Recovery notice overflow "+width+"px: "+overflow);
    await first.getByRole("button",{name:/ตรวจสถานะคำขอเดิม/}).click();
    await first.getByRole("button",{name:/กำลังตรวจสอบ/}).waitFor();
    assert.equal(await dialog.locator("button").isDisabled(),true);
    assert.equal(await page.locator("output[data-clicks]").innerText(),"1");
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
