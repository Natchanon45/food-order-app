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
const shadow=require("../../functions/m7-uat-operational-ledger-policy.js").plan(manifest).shadow;
test("Superadmin UAT financial shadow renders money as UNVERIFIED, separate explicit simulation and record confirmation, 4 widths",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-m7-shadow-finance-fixture-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"sweet.js"),"window.__confirmCount=0;export const sweetConfirm=async()=>{window.__confirmCount++;return true;};");
  await writeFile(resolve(dir,"functions.js"),`
    window.__calls=[];
    const REPORT=${JSON.stringify(shadow)};
    const tenantId=REPORT.tenantId,digest=REPORT.sourceManifestDigest;
    export const httpsCallable=(_,name)=>async data=>{
     window.__calls.push({name,data});
     if(name==="getPlatformM7UatFinancialShadowHistory"){
      if(Object.keys(data).join(",")!=="tenantId"||data.tenantId!==tenantId)
       throw Error("CROSS_TENANT_HISTORY");
      return {data:{ok:true,mode:"m7_uat_financial_shadow_history",
       tenantId,hasMore:false,financialPostingAuthorized:false,
       tenantAccessReleaseAllowed:false,
       items:sessionStorage.getItem("recorded")==="1"?[{
        sourceManifestDigest:digest,status:"untrusted_shadow_only",
        sourceGrossCents:REPORT.sourceGrossCents,sourceBankReportedCents:REPORT.sourceBankReportedCents}]:[]}};
     }
     if(name==="previewPlatformM7UatFinancialShadow"){
      if(Object.keys(data).join(",")!=="manifest"||
       data.manifest.tenantId!==tenantId)throw Error("UNTRUSTED_MANIFEST");
      return {data:{ok:true,...REPORT,preflightRequired:true,
       bankAndSourceEvidenceStillUnverified:true,
       preflightStagedAndConsistent:true,recordAllowed:true,recorded:false,
       ...sessionStorage.getItem("badPreview")==="1"?
        {bankCashOperationallyVerified:true}:{}}};
     }
     if(name==="stagePlatformM7UatFinancialShadow"){
      if(Object.keys(data).join(",")!=="manifest"||
       data.manifest.tenantId!==tenantId)throw Error("UNTRUSTED_POSTING");
      if(sessionStorage.getItem("denyRecord")==="1")
       throw Error("GLOBAL_BANK_CLAIM_CONFLICT");
      sessionStorage.setItem("recorded","1");
      return {data:{ok:true,mode:REPORT.mode,tenantId,
       sourceManifestDigest:digest,reused:false,recorded:true,
       financialShadowOnly:true,financialPostingAuthorized:false,
       operationalReleaseAuthorized:false,billingInvoicesMutated:false,
       tenantAccessMutated:false}};
     }
     throw Error("MUST_NOT_CALL_OPERATIONAL_WRITER_"+name);
    };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from"react";
   import{createRoot}from"react-dom/client";
   import{M7UatFinancialShadow}from"@/components/M7UatFinancialShadow";
   const manifest=${JSON.stringify(manifest)};
   const digest=${JSON.stringify(shadow.sourceManifestDigest)};
   createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:960,margin:"auto"}}>
    <M7UatFinancialShadow tenantId={manifest.tenantId}
     manifest={manifest} sourceManifestDigest={digest} preflightStaged={true}/>
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
   const page=await browser.newPage({viewport:{width,height:930}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto(url);
    const card=page.locator("[data-m7-uat-financial-shadow]");
    await card.getByRole("button",{name:"ตรวจบัญชีจำลองทั้งหมด (Read-only)"}).waitFor();
    assert.equal(await page.getByRole("button",{name:"บันทึก UAT Financial Shadow Ledger"}).isDisabled(),true);
    assert.equal((await page.evaluate(()=>window.__calls)).filter(c=>
      c.name==="stagePlatformM7UatFinancialShadow").length,0);
    await page.getByRole("button",{name:"ตรวจบัญชีจำลองทั้งหมด (Read-only)"}).click();
    await card.getByText("เงินธนาคารตาม Export (ยังไม่ยืนยัน)").waitFor();
    await card.getByText("เครดิตที่ใช้จาก Export (ไม่รับรอง)").waitFor();
    const text=await card.innerText();
    assert.match(text,/500.00 บาท/);
    assert.match(text,/152.20 บาท/);
    assert.match(text,/ไม่ปลดระงับร้าน/);
    assert.match(text,/ยอดจาก Source เป็นข้อมูลที่ส่งออกมา/);
    assert.equal(await page.evaluate(()=>window.__confirmCount),0);
    await page.getByRole("button",{name:"บันทึก UAT Financial Shadow Ledger"}).click();
    await card.getByText("บันทึก UAT Financial Shadow Ledger แล้ว",{exact:false}).waitFor();
    await card.getByText("ยังไม่รับรองเงินธนาคารหรือ Service Credit",{exact:false}).waitFor();
    assert.equal(await page.evaluate(()=>window.__confirmCount),1);
    const calls=await page.evaluate(()=>window.__calls);
    assert.equal(calls.filter(c=>c.name==="previewPlatformM7UatFinancialShadow").length,1);
    assert.equal(calls.filter(c=>c.name==="stagePlatformM7UatFinancialShadow").length,1);
    assert.equal(calls.some(c=>/OperationalBank|PostPaid|ApplyCredit|ReleaseTenant|StripeCheckout/.test(c.name)),false);
    assert.equal(await page.getByRole("button",{name:/ปลดระงับร้าน|จ่ายเงินจริง|หักเครดิตจริง/}).count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,
      "document overflow "+width);
    await page.evaluate(()=>sessionStorage.setItem("badPreview","1"));
    await page.getByRole("button",{name:"ตรวจบัญชีจำลองทั้งหมด (Read-only)"}).click();
    await card.getByText("ไม่สามารถจำลองบัญชีได้",{exact:false}).waitFor();
    assert.equal(await page.getByRole("button",{name:"บันทึก UAT Financial Shadow Ledger"}).isDisabled(),true);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
test("Superadmin primary migration module nests ledger after signed UAT preflight, no operational writer in Functions exports",async()=>{
 const preflight=await readFile("react-app/src/components/M7SourceMigrationPreflight.jsx","utf8");
 const shadowUI=await readFile("react-app/src/components/M7UatFinancialShadow.jsx","utf8");
 const backend=await readFile("functions/m7-uat-operational-ledger.js","utf8");
 const index=await readFile("functions/index.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 assert.match(preflight,/preflightStaged/);
 assert.match(preflight,/M7UatFinancialShadow/);
 assert.match(shadowUI,/sweetConfirm/);
 assert.match(shadowUI,/bankCashOperationallyVerified===false/);
 assert.match(shadowUI,/financialPostingAuthorized===false/);
 assert.match(index,/exports\.previewPlatformM7UatFinancialShadow/);
 assert.match(index,/exports\.stagePlatformM7UatFinancialShadow/);
 assert.match(index,/exports\.getPlatformM7UatFinancialShadowHistory/);
 assert.match(backend,/source\._privateForTests\.compareFirebase/);
 assert.match(rules,/match \/m7UatFinancialBankClaims\/\{digest\} \{\s*allow read, write: if false/);
 assert.match(rules,/match \/m7UatFinancialShadowRuns\/\{manifestDigest\} \{\s*allow read, write: if false/);
 assert.doesNotMatch(index,/exports\.(postM7OperationalCash|payM7SourceInvoice|applyM7SourceCredit|releaseM7FinancialHold)/);
});
