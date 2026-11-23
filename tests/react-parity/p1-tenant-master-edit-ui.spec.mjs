import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import {
  masterEditKey,readPendingMasterEdit,holdPendingMasterEdit,
  releasePendingMasterEdit,masterSnapshot,masterBusinessType,
  validateMasterEditWrite,validateMasterEditOperation,
  canonicalMasterMatches,masterUnknownError,
} from "../../react-app/src/data/tenantMasterEditRecovery.mjs";
const uid="p12f-superadmin";
const tenantId="p12f-tenant-test";
const op="687021f0-66ae-4a62-beb6-a028f38088ac";
const original={
 id:tenantId,name:"Original Shop",slug:"original-shop",
 shopPhone:"022244455",shopAddress:"Soi 1",
 businessType:"restaurant_cafe",masterEditRevision:2,
 active:true,ownerUid:"p12f-owner",
};
const data={
 ...masterSnapshot(original),tenantId,operationId:op,
 name:"Updated Shop",slug:"updated-shop",phone:"0855555555",
 address:"Soi 2",businessType:"retail",
};
const saved={
 ok:true,readOnly:false,operationId:op,tenantId,
 replayed:false,canSettleMoney:false,canReleaseTenant:false,
 canIssueInvoice:false,canChangeOwnerIdentity:false,
 changedSubscriptionTerms:false,
 master:{tenantId,name:data.name,slug:data.slug,phone:data.phone,
  address:data.address,businessType:data.businessType,revision:3},
};
const inspected={
 ok:true,readOnly:true,tenantId,operationId:op,status:"complete_current",
 master:saved.master,canSettleMoney:false,canReleaseTenant:false,
 canIssueInvoice:false,canChangeOwnerIdentity:false,
 changedSubscriptionTerms:false,
};
const store=()=>{
 const map=new Map();
 return {
  setItem:(key,value)=>map.set(key,value),
  getItem:key=>map.get(key)||null,
  removeItem:key=>map.delete(key),
 };
};
test("opaque pending command scoped per Superadmin+tenant survives route reload; cannot leak personal/business content",()=>{
 const storage=store();
 assert.equal(masterEditKey(uid,tenantId),
  "penguin_p12f_master_edit_"+uid+"_"+tenantId);
 assert.equal(readPendingMasterEdit(uid,tenantId,storage),null);
 assert.equal(holdPendingMasterEdit(uid,tenantId,op,storage),true);
 assert.equal(readPendingMasterEdit(uid,tenantId,storage),op);
 assert.equal(readPendingMasterEdit("different-superadmin",tenantId,storage),null);
 assert.equal(readPendingMasterEdit(uid,"different-tenant",storage),null);
 assert.equal(holdPendingMasterEdit(uid,tenantId,
  "5f9194a6-7f5b-47a3-81f0-5fa6e11c4817",storage),false);
 assert.equal(releasePendingMasterEdit(uid,tenantId,
  "5f9194a6-7f5b-47a3-81f0-5fa6e11c4817",storage),false);
 assert.equal(readPendingMasterEdit(uid,tenantId,storage),op);
 assert.equal(releasePendingMasterEdit(uid,tenantId,op,storage),true);
 assert.equal(readPendingMasterEdit(uid,tenantId,storage),null);
});
test("sessionStorage blocked -> no operation should be sent",()=>{
 const blocked={getItem(){throw Error("DISABLED")},
  setItem(){throw Error("DISABLED")},removeItem(){throw Error("DISABLED")}};
 assert.equal(readPendingMasterEdit(uid,tenantId,blocked),null);
 assert.equal(holdPendingMasterEdit(uid,tenantId,op,blocked),false);
 assert.equal(releasePendingMasterEdit(uid,tenantId,op,blocked),false);
});
test("original snapshot requires exact master business, version and shop contacts",()=>{
 assert.deepEqual(masterSnapshot(original),{
  expectedName:"Original Shop",expectedSlug:"original-shop",
  expectedPhone:"022244455",expectedAddress:"Soi 1",
  expectedBusinessType:"restaurant_cafe",expectedRevision:2,
 });
 assert.equal(masterBusinessType({businessUnits:["retail_pos"]}),"retail");
 assert.equal(masterBusinessType({businessUnits:["order_delivery"]}),"restaurant_cafe");
 assert.equal(masterBusinessType({businessUnits:["retail_pos","order_delivery"]}),"both");
});
test("server write and operation receipt must match each field and ALL financial flags must be false",()=>{
 assert.equal(validateMasterEditWrite(saved,data).master.revision,3);
 assert.equal(validateMasterEditOperation(inspected,tenantId,op).status,"complete_current");
 for(const change of [
  {canSettleMoney:true},{canReleaseTenant:true},{canIssueInvoice:true},
  {canChangeOwnerIdentity:true},{changedSubscriptionTerms:true},
  {readOnly:true},{operationId:"wrong-operation"},
  {master:{...saved.master,slug:"other-slug"}},
  {master:{...saved.master,revision:4}},
  {master:{...saved.master,businessType:"both"}},
  {master:{...saved.master,phone:"not-saved"}},
 ]){
  assert.throws(()=>validateMasterEditWrite({...saved,...change},data),
   /MASTER_EDIT_/);
 }
 for(const change of [
  {readOnly:false},{canSettleMoney:true},
  {operationId:"wrong"},{tenantId:"other"},
  {status:"paid"},{master:{...saved.master,revision:-1}},
 ]){
  assert.throws(()=>validateMasterEditOperation({...inspected,...change},tenantId,op),
   /MASTER_EDIT_/);
 }
 for(const status of ["not_found","review_required","complete_superseded"]){
  const row=validateMasterEditOperation({...inspected,status,master:null},tenantId,op);
  assert.equal(row.master,null);
 }
});
test("independently reread canonical Tenant must match server master, not success toast",()=>{
 const canonical={...original,name:data.name,slug:data.slug,
  shopPhone:data.phone,shopAddress:data.address,
  businessType:data.businessType,masterEditRevision:3};
 assert.equal(canonicalMasterMatches([canonical],saved.master),true);
 assert.equal(canonicalMasterMatches([original],saved.master),false);
 assert.equal(canonicalMasterMatches([],saved.master),false);
 for(const change of [
  {name:"different"},{slug:"different"},
  {shopPhone:"other"},{shopAddress:"Old address"},
  {businessType:"both"},{masterEditRevision:4},
 ]){
  assert.equal(canonicalMasterMatches([{...canonical,...change}],saved.master),false);
 }
});
test("network timeout/unknown status always keeps recovery lock; rejected invalid argument is distinct",()=>{
 for(const code of ["functions/deadline-exceeded","functions/unavailable",
  "functions/internal","functions/unknown"]){
  assert.equal(masterUnknownError({code}),true);
 }
 assert.equal(masterUnknownError({message:"MASTER_EDIT_WRITE_UNCONFIRMED"}),true);
 assert.equal(masterUnknownError({code:"functions/invalid-argument"}),false);
 assert.equal(masterUnknownError({code:"functions/already-exists"}),false);
});
test("Admin Tenants page integrates one-call atomic edit, recoverable status and no legacy batch write",async()=>{
 const page=await readFile("react-app/src/pages/AdminTenantsPage.jsx","utf8");
 const functions=await readFile("functions/index.js","utf8");
 const policy=await readFile("functions/tenant-master-edit.js","utf8");
 const legacy=await readFile("functions/tenant-admin.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 for(const marker of [
  "submitMasterEdit(editing,payload)",
  "holdPendingMasterEdit(uid,tenantId,operationId)",
  "validateMasterEditWrite(",
  "getPlatformTenantMasterEditOperation(",
  "validateMasterEditOperation(",
  "canonicalMasterMatches(",
  "releasePendingMasterEdit(uid,tenantId,operationId)",
  "TenantMasterEditRecoveryNotice",
  "readPendingMasterEdit(authState.user?.uid,editing.id)",
  "ยืนยันการเปลี่ยน Slug ร้านค้า",
 ]){
  assert.ok(page.includes(marker),marker);
 }
 assert.doesNotMatch(page,/await updateTenant\(payload\)/);
 assert.match(functions,/exports.updateTenantMasterAtomic/);
 assert.match(functions,/exports.getPlatformTenantMasterEditOperation/);
 assert.match(policy,/tx.create\(newRef/);
 assert.match(policy,/tx.delete\(oldRef/);
 assert.match(policy,/tx.create\(opRef/);
 assert.match(policy,/usersRef.where\("tenantId","==",input.tenantId\)/);
 assert.match(legacy,/exports.updateTenant = tenantMasterEdit.updateTenantMasterAtomic/);
 assert.match(rules,/match \/masterEditOperations\/\{operationId\}/);
 assert.match(rules,/'masterEditRevision'/);
});
test("Recovery card React/Chrome at 320,390,768,1440: in-flight disabled, exact one explicit Check, no destructive buttons",async()=>{
 const root=resolve("react-app");
 const dir=await mkdtemp(resolve(root,"p12f-master-browser-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;width:100%}</style></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"fixture.jsx"),`
    import React,{useState} from "react";
    import {createRoot} from "react-dom/client";
    import {TenantMasterEditRecoveryNotice} from "@/components/TenantMasterEditRecoveryNotice";
    function App(){
      const [checking,setChecking]=useState(false);
      const [count,setCount]=useState(0);
      return <main className="tenant-admin-page"
       style={{width:"100%",maxWidth:900,margin:"auto",padding:12}}>
       <TenantMasterEditRecoveryNotice tenantId="p12f-tenant-test"
        checking={checking} onCheck={()=>{
          setCount(value=>value+1);setChecking(true);
        }}/>
       <output data-request-count>{count}</output>
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
   const errors=[];page.on("pageerror",e=>errors.push(String(e)));
   try{
    await page.goto(url);
    const note=page.locator("[data-tenant-master-edit-pending]");
    await note.waitFor();
    assert.equal(await note.locator("button").count(),1);
    assert.ok((await note.innerText()).includes("ห้าม"));
    assert.equal(await note.locator("input").count(),0);
    await note.locator("button").click();
    assert.equal(await page.locator("[data-request-count]").innerText(),"1");
    assert.equal(await note.locator("button").isDisabled(),true);
    const overflow=await page.evaluate(()=>
     document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflow<=2,"overflow at "+width+": "+overflow);
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{
  await browser?.close();await server?.close();
  await rm(dir,{recursive:true,force:true});
 }
});
