import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import {
  pendingDeletionKey,readPendingDeletion,holdPendingDeletion,
  releasePendingDeletion,validateDeletionSafety,
  validateDeletionWrite,validateDeletionStatus,
  canonicalTenantAbsent,deletionUnknownError,deletionReasonLabel,
} from "../../react-app/src/data/tenantSafeDeletionRecovery.mjs";
const uid="p12g-test-admin",tenantId="p12g-test-tenant";
const op="687021f0-66ae-4a62-beb6-a028f38088ac";
const pending={tenantId,operationId:op};
const flags={
 canDeleteBusinessData:false,canDeleteFinanceHistory:false,
 canDeleteOwner:false,canReleaseTenant:false,
 canSettleMoney:false,canIssueInvoice:false,
};
const preview={
 ok:true,readOnly:true,tenantId,ready:true,
 reasonCodes:[],isHardDeleteRestricted:true,
 canDeleteOnlyUnownedPlaceholder:true,...flags,
};
const written={
 ok:true,readOnly:false,tenantId,operationId:op,
 deleted:true,replayed:false,...flags,
};
const confirmed={
 ok:true,readOnly:true,tenantId,operationId:op,
 status:"deleted_verified",...flags,
};
const storage=()=>({
 memory:new Map(),
 getItem(k){return this.memory.get(k)||null;},
 setItem(k,v){this.memory.set(k,v);},
 removeItem(k){this.memory.delete(k);},
});
test("only tenant ID + UUID persisted, scoped to one active Superadmin, survives deleted Tenant disappearing from list",()=>{
 const store=storage();
 assert.equal(pendingDeletionKey(uid),"penguin_p12g_tenant_delete_v1_"+uid);
 assert.equal(readPendingDeletion(uid,store),null);
 assert.equal(holdPendingDeletion(uid,pending,store),true);
 assert.deepEqual(readPendingDeletion(uid,store),pending);
 assert.equal(store.memory.size,1);
 assert.equal(store.memory.get(pendingDeletionKey(uid)),
  JSON.stringify(pending));
 assert.equal(readPendingDeletion("other-admin",store),null);
 assert.equal(holdPendingDeletion(uid,{...pending,operationId:
  "557650f7-7576-4e97-9591-b95097f6ea0f"},store),false);
 assert.equal(releasePendingDeletion(uid,{...pending,tenantId:"other"},store),false);
 assert.equal(readPendingDeletion(uid,store).operationId,op);
 assert.equal(releasePendingDeletion(uid,pending,store),true);
 assert.equal(readPendingDeletion(uid,store),null);
});
test("storage failure, malformed/forged receipts and invalid UUID fail closed",()=>{
 const disabled={getItem(){throw Error("private mode")},
  setItem(){throw Error("private mode")},removeItem(){throw Error("private mode")}};
 assert.equal(readPendingDeletion(uid,disabled),null);
 assert.equal(holdPendingDeletion(uid,pending,disabled),false);
 assert.equal(releasePendingDeletion(uid,pending,disabled),false);
 const store=storage();
 store.setItem(pendingDeletionKey(uid),'{"email":"owner@localhost","bankAccountNumber":"123"}');
 assert.equal(readPendingDeletion(uid,store),null);
 assert.equal(holdPendingDeletion(uid,{tenantId,operationId:"invalid"},store),false);
});
test("client preview refuses any claimed authority or unsupported reason, never assumes zero debt",()=>{
 assert.equal(validateDeletionSafety(preview,tenantId).ready,true);
 for(const delta of [
  {readOnly:false},{ready:false},{tenantId:"other-tenant"},
  {canDeleteBusinessData:true},{canDeleteFinanceHistory:true},
  {canDeleteOwner:true},{canSettleMoney:true},
  {canIssueInvoice:true},{canReleaseTenant:true},
  {reasonCodes:["PAID"]},{reasonCodes:["TENANT_NOT_FOUND"]},
  {isHardDeleteRestricted:false},
  {canDeleteOnlyUnownedPlaceholder:false},
 ]){
  assert.throws(()=>validateDeletionSafety({...preview,...delta},tenantId),
   /TENANT_DELETE_PREVIEW_UNVERIFIED/);
 }
 assert.equal(deletionReasonLabel("TENANT_OWNER_OR_ACTIVATION")
  .includes("Owner"),true);
});
test("write/status exact UUID + identity contract requires financial flags all FALSE",()=>{
 assert.equal(validateDeletionWrite(written,pending).deleted,true);
 assert.equal(validateDeletionStatus(confirmed,pending).status,"deleted_verified");
 for(const x of [
  {deleted:false},{replayed:"yes"},{readOnly:true},{tenantId:"other"},
  {operationId:"wrong"},{canDeleteBusinessData:true},
  {canDeleteOwner:true},{canDeleteFinanceHistory:true},
  {canReleaseTenant:true},{canIssueInvoice:true},{canSettleMoney:true},
 ]){
  assert.throws(()=>validateDeletionWrite({...written,...x},pending),
   /TENANT_DELETE_WRITE_UNCONFIRMED/);
 }
 for(const x of [
  {readOnly:false},{status:"paid"},{status:"deleted_guess"},
  {tenantId:"other"},{operationId:"wrong"},{canDeleteOwner:true},
  {canDeleteFinanceHistory:true},
 ]){
  assert.throws(()=>validateDeletionStatus({...confirmed,...x},pending),
   /TENANT_DELETE_STATUS_UNVERIFIED/);
 }
 assert.equal(validateDeletionStatus({...confirmed,status:"not_found"},pending).status,
  "not_found");
 assert.equal(validateDeletionStatus({...confirmed,status:"review_required"},pending).status,
  "review_required");
});
test("deleted Tenant must be absent from fresh canonical list; no re-delete on unknown errors",()=>{
 assert.equal(canonicalTenantAbsent([],tenantId),true);
 assert.equal(canonicalTenantAbsent([{id:"other"}],tenantId),true);
 assert.equal(canonicalTenantAbsent([{id:tenantId}],tenantId),false);
 assert.equal(canonicalTenantAbsent(null,tenantId),false);
 for(const code of ["functions/unavailable","functions/internal",
  "functions/unknown","functions/deadline-exceeded"])
  assert.equal(deletionUnknownError({code}),true);
 assert.equal(deletionUnknownError({code:"functions/failed-precondition"}),false);
});
test("target uses strict preflight -> user confirm -> UUID hold -> one-call deletion -> independent status + list read",async()=>{
 const page=await readFile("react-app/src/pages/AdminTenantsPage.jsx","utf8");
 const service=await readFile("react-app/src/data/platformTenantService.js","utf8");
 const legacy=await readFile("functions/tenant-admin.js","utf8");
 const backend=await readFile("functions/tenant-safe-deletion.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 for(const marker of [
  "getPlatformTenantDeletionSafety({tenantId})",
  "validateDeletionSafety(",
  "deleteTenant(request)",
  "validateDeletionWrite(",
  "getPlatformTenantDeletionStatus(pending)",
  "validateDeletionStatus(",
  "canonicalTenantAbsent(",
  "holdPendingDeletion(uid,pending)",
  "readPendingDeletion(uid)",
  "releasePendingDeletion(uid,pending)",
  "TenantDeletionRecoveryNotice",
  "onCheck={reconcileDeletion}",
  "readPendingProvision(uid)",
  "readPendingMasterEdit(uid,tenantId)",
  "readPendingSubscription(uid,tenantId)",
 ]){
  assert.ok(page.includes(marker),marker);
 }
 assert.doesNotMatch(page,/await deleteTenant\(\{ tenantId: tenant.id \}\)/);
 assert.match(service,/call\("getPlatformTenantDeletionSafety", payload\)/);
 assert.match(service,/call\("getPlatformTenantDeletionStatus", payload\)/);
 assert.match(legacy,/exports.deleteTenant = tenantSafeDeletion.deleteTenant/);
 assert.doesNotMatch(legacy,/recursiveDelete/);
 assert.match(backend,/tx.delete\(storeDoc.ref\)/);
 assert.match(backend,/tx.delete\(tenantRef\)/);
 assert.match(backend,/tx.create\(opRef,saved\)/);
 assert.match(backend,/tx.create\(tombRef/);
 assert.match(rules,/match \/platformTenantDeletionTombstones\/\{tenantId\}/);
 assert.match(rules,/allow delete: if false/);
});
test("responsive recovery card works at 320/390/768/1440 px, only one read-only Check action",async()=>{
 const root=resolve("react-app");
 const dir=await mkdtemp(resolve(root,"p12g-delete-browser-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;width:100%}</style></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"fixture.jsx"),`
    import React,{useState} from "react";
    import {createRoot} from "react-dom/client";
    import {TenantDeletionRecoveryNotice} from "@/components/TenantDeletionRecoveryNotice";
    function App(){
      const [checking,setChecking]=useState(false);
      const [calls,setCalls]=useState(0);
      return <main className="tenant-admin-page"
        style={{maxWidth:900,width:"100%",margin:"auto",padding:12}}>
        <TenantDeletionRecoveryNotice
          pending={{tenantId:"p12g-test-tenant",operationId:"687021f0-66ae-4a62-beb6-a028f38088ac"}}
          checking={checking} onCheck={()=>{
            setChecking(true);setCalls(n=>n+1);
          }}/>
        <output data-reconcile-calls>{calls}</output>
      </main>;
    }
    createRoot(document.getElementById("root")).render(<App/>);
  `);
  server=await createServer({root,configFile:false,publicDir:false,
   cacheDir:resolve(dir,".vite"),plugins:[react()],
   resolve:{alias:[{find:"@",replacement:resolve(root,"src")}]},
   server:{host:"127.0.0.1",port:0}});
  await server.listen();
  browser=await chromium.launch({headless:true,channel:"chrome"});
  const url="http://127.0.0.1:"+server.httpServer.address().port+
    "/"+basename(dir)+"/index.html";
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errors=[];
   page.on("pageerror",e=>errors.push(String(e)));
   try{
    await page.goto(url);
    const note=page.locator("[data-tenant-delete-pending]");
    await note.waitFor();
    assert.equal(await note.locator("button").count(),1);
    assert.ok((await note.innerText()).includes("ห้ามลบซ้ำ"));
    assert.equal(await note.locator("input").count(),0);
    await note.locator("button").click();
    assert.equal(await page.locator("[data-reconcile-calls]").innerText(),"1");
    assert.equal(await note.locator("button").isDisabled(),true);
    assert.ok(await page.evaluate(()=>
     document.documentElement.scrollWidth-window.innerWidth)<=2);
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{
  await browser?.close();await server?.close();
  await rm(dir,{recursive:true,force:true});
 }
});
