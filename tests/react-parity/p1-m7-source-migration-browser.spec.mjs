import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
const require=createRequire(import.meta.url);
const manifest=require("../fixtures/m7-source-migration.synthetic.cjs").fixture();
const report=require("../../functions/m7-source-migration-contract.js").inspect(manifest);
const comparison=require("../../functions/m7-source-migration-reconcile.js").compare(manifest,[]);
test("Superadmin reviews sanitized M7 Source SQL manifest before separately confirming UAT-only audit, responsive 4 widths",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-m7-source-migration-fixture-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"sweet.js"),"window.__confirmationCount=0;export const sweetConfirm=async()=>{window.__confirmationCount++;return true;};");
  await writeFile(resolve(dir,"functions.js"),`
   window.__calls=[];
   const REPORT=${JSON.stringify(report)};
   const COMPARISON=${JSON.stringify(comparison)};
   const tenantId=${JSON.stringify(manifest.tenantId)};
   const digest=REPORT.manifestDigest;
   export const httpsCallable=(_,name)=>async data=>{
    window.__calls.push({name,data});
    if(name==="getPlatformM7SourceMigrationPreflightHistory"){
     if(JSON.stringify(data)!==JSON.stringify({tenantId}))
      throw Error("CROSS_TENANT_HISTORY");
     return {data:{ok:true,mode:"m7_source_migration_preflight_history",tenantId,
      hasMore:false,bankCashApproved:false,serviceCreditPostApproved:false,
      tenantAccessReleaseAllowed:false,
      items:sessionStorage.getItem("staged")==="1"?[{
       manifestDigest:digest,totalRows:REPORT.totalRows,
       structuralIssuesDetected:REPORT.structuralIssuesDetected,
       status:"unauthenticated_source_preview"}]:[]}};
    }
    if(name==="previewPlatformM7SourceMigrationPreflight"){
     if(Object.keys(data).join(",")!=="manifest"||
        data.manifest.tenantId!==tenantId||
        data.manifest.version!==REPORT.mode||
        data.manifest.tables.merchant_platform_invoice_journal.length!==3)
      throw Error("INVALID_MIGRATION_PAYLOAD");
     return {data:{...REPORT,candidateComparison:COMPARISON,
      authenticated:true,superadminOnly:true,staged:false}};
    }
    if(name==="stagePlatformM7SourceMigrationPreflight"){
     if(Object.keys(data).join(",")!=="manifest"||
        data.manifest.tenantId!==tenantId||data.manifest.version!==REPORT.mode)
      throw Error("INVALID_STAGE_PAYLOAD");
     sessionStorage.setItem("staged","1");
     return {data:{ok:true,mode:"m7_untrusted_source_preflight_audit",
      manifestDigest:digest,reused:false,staged:true,
      structuralIssuesDetected:0,operationalPromotionAllowed:false,
      serviceCreditPostApproved:false,operationalInvoicePaid:false,
      tenantAccessReleaseAllowed:false}};
    }
    throw Error("MUST_NOT_CALL_FINANCE_WRITER_"+name);
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from"react";
   import{createRoot}from"react-dom/client";
   import{M7SourceMigrationPreflight}from"@/components/M7SourceMigrationPreflight";
   createRoot(document.getElementById("root")).render(<main style={{maxWidth:960,padding:12,margin:"auto"}}>
     <M7SourceMigrationPreflight tenantId=${JSON.stringify(manifest.tenantId)}/>
   </main>);`);
  vite=await createServer({configFile:false,root,cacheDir:resolve(dir,".vite-cache"),
   plugins:[react()],resolve:{alias:[
    {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
    {find:"@/components/sweetDialog",replacement:resolve(dir,"sweet.js")},
    {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
    {find:"@",replacement:resolve(root,"src")},
   ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:940}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto(url);
    const card=page.locator("[data-m7-source-migration]");
    await card.locator("summary").waitFor();
    assert.equal((await page.evaluate(()=>window.__calls)).filter(c=>
      c.name==="previewPlatformM7SourceMigrationPreflight").length,0);
    await card.locator("summary").click();
    const upload=page.getByLabel("ไฟล์ Source M7 Migration JSON");
    await upload.setInputFiles({name:"sanitized-manifest.json",
      mimeType:"application/json",buffer:Buffer.from(JSON.stringify(manifest))});
    await page.getByRole("button",{name:"ตรวจโครงสร้าง Source (Read-only)"}).click();
    await card.getByText("ต้นฉบับ SQL/ผู้ส่งออกยังไม่ได้รับรอง",{exact:false}).waitFor();
    assert.match(await card.innerText(),/ยังไม่ได้/);
    assert.match(await card.innerText(),/ยังไม่ได้ยืนยันบัญชี Source/);
    assert.match(await card.innerText(),/ไม่พบ Invoice ปลายทาง 3 รายการ/);
    assert.equal(await page.evaluate(()=>window.__confirmationCount),0);
    await page.getByRole("button",{name:"บันทึก Preflight Audit (UAT)"}).click();
    await card.getByText("บันทึก Audit ตรวจโครงสร้างแล้ว",{exact:false}).waitFor();
    await card.getByText("ยังไม่รับรอง Source",{exact:false}).waitFor();
    assert.equal(await page.evaluate(()=>window.__confirmationCount),1);
    const calls=await page.evaluate(()=>window.__calls);
    assert.equal(calls.filter(c=>c.name==="previewPlatformM7SourceMigrationPreflight").length,1);
    assert.equal(calls.filter(c=>c.name==="stagePlatformM7SourceMigrationPreflight").length,1);
    assert.equal(calls.some(c=>/Paid|Credit|Hold|Release|Checkout/.test(c.name)),false);
    assert.equal(await page.getByRole("button",{name:/รับรองเงินจริง|โพสต์เครดิต|ปลดระงับ|ย้ายบัญชีจริง/}).count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,"overflow "+width);
    assert.ok(!(await card.innerText()).includes(manifest.tables.merchant_platform_payment_attempts[0].slip_sha256));
    // Prevent raw field submission when file shape changes.
    await upload.setInputFiles({name:"raw-private-export.json",
      mimeType:"application/json",buffer:Buffer.from(JSON.stringify({
       ...manifest,tenantId:"another-tenant"}))});
    await card.getByText("Manifest ไม่ตรงกับ Tenant/Version",{exact:false}).waitFor();
    assert.equal(await page.getByRole("button",{name:"บันทึก Preflight Audit (UAT)"}).isDisabled(),true);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
test("migration UI only calls preflight, is mounted on Superadmin tenant page and has NO finance approval actions",async()=>{
 const page=await readFile("react-app/src/pages/AdminTenantsPage.jsx","utf8");
 const ui=await readFile("react-app/src/components/M7SourceMigrationPreflight.jsx","utf8");
 const fn=await readFile("functions/index.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 assert.match(page,/M7SourceMigrationPreflight/);
 assert.match(ui,/previewPlatformM7SourceMigrationPreflight/);
 assert.match(ui,/stagePlatformM7SourceMigrationPreflight/);
 assert.match(ui,/getPlatformM7SourceMigrationPreflightHistory/);
 assert.match(ui,/sweetConfirm/);
 assert.match(ui,/operationalPromotionAllowed/);
 assert.match(fn,/exports\.previewPlatformM7SourceMigrationPreflight/);
 assert.match(fn,/exports\.stagePlatformM7SourceMigrationPreflight/);
 assert.match(rules,/match \/m7SourceMigrationPreflightRuns\/\{manifestDigest\} \{\s*allow read, write: if false/);
 assert.doesNotMatch(fn,/exports\.(migrateM7BankCash|migrateM7OperationalCredit|releaseM7SourceHold)/);
});
