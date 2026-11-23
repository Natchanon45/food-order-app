import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {createRequire} from "node:module";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import {validateTenantAccessEvidence,ACCESS_REASONS,SOURCE_GAPS,
 summaryText} from "../../react-app/src/data/tenantAccessEvidenceContract.mjs";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const backend=require("./tenant-access-evidence-policy");
const tenantId="p12e-merchant-fixture";
const other="p12e-other-fixture";
const now=new Date("2026-11-23T07:00:00.000Z");
const row=(id)=>({
 id,slug:"p12e-test-shop",active:true,subscriptionStatus:"active",
 ownerUid:"p12e-owner",firstActivatedAt:"2026-10-18T03:30:00.000Z",
 trialStartsAt:"2026-10-18T03:30:00.000Z",
 subscriptionExpiresAt:"2027-11-17T16:59:59.999Z",
 gracePeriodDays:3,m7FinanceAccessStatus:"not_suspended",
});
const response=(tenant=tenantId,fields={})=>{
 const record={...row(tenant),...fields};
 return {...backend.inspect({tenantId:tenant,tenant:record,now,
  slugIndex:{
   tenantId:tenant,active:record.active,
   subscriptionStatus:record.subscriptionStatus,
   subscriptionExpiresAt:record.subscriptionExpiresAt,
   gracePeriodDays:record.gracePeriodDays,
  }}),authenticated:true,superadminOnly:true};
};
test("strict client proof contract requires all five source gaps and null financial amounts, refuses fabricated access approval",()=>{
 const valid=response();
 assert.equal(validateTenantAccessEvidence(valid,tenantId).canSell,null);
 assert.equal(summaryText(valid.state).includes("ยืนยันสิทธิ์ขายจริงไม่ได้"),true);
 for(const patch of [
  {canSell:true},{canReleaseTenant:true},{canSettleMoney:true},
  {canIssueInvoice:true},{canApplyCredit:true},{writesPerformed:true},
  {sourceOriginalHoldSignatureVerified:true},
  {independentBankCashVerified:true},
  {originalInvoiceJournalCertified:true},
  {sourceCreditLedgerCertified:true},{financialBalanceKnown:true},
  {certifiedOutstandingCents:0},{certifiedOpenInvoiceCount:0},
  {readOnly:false},{authenticated:false},{superadminOnly:false},
  {snapshotDigest:"forged"},{tenantId:other},
  {reasonCodes:["FAKE_PAID"]},
  {reasonCodes:["M7_FINANCE_REVIEW_REQUIRED","LEGACY_DELIVERY_SHARE_HOLD"]},
  {sourceProofGaps:[]},{sourceProofGaps:[...valid.sourceProofGaps,"extra"]},
  {mode:"operational_signed"},
 ]){
  assert.throws(()=>validateTenantAccessEvidence({...valid,...patch},tenantId),
   /TENANT_ACCESS_EVIDENCE_UNVERIFIED/);
 }
 assert.equal(Object.keys(ACCESS_REASONS).length,17);
 assert.equal(Object.keys(SOURCE_GAPS).length,5);
});
test("source-aligned read-only frontend uses ONLY the new Superadmin report; no mutation, paid, local TEST override",async()=>{
 const component=await readFile("react-app/src/components/TenantAccessEvidencePanel.jsx","utf8");
 const parent=await readFile("react-app/src/components/TenantControlPanel.jsx","utf8");
 const service=await readFile("react-app/src/data/platformTenantService.js","utf8");
 const callable=await readFile("functions/tenant-access-evidence.js","utf8");
 const policy=await readFile("functions/tenant-access-evidence-policy.js","utf8");
 const entry=await readFile("functions/index.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 assert.match(service,/call\("getPlatformTenantAccessEvidence", payload\)/);
 assert.match(entry,/exports.getPlatformTenantAccessEvidence/);
 assert.match(component,/getPlatformTenantAccessEvidence\(\{tenantId\}\)/);
 assert.match(component,/validateTenantAccessEvidence\(data,tenantId\)/);
 assert.match(component,/data-tenant-access-evidence-refresh/);
 assert.match(parent,/enabled=\{expanded\}/);
 assert.match(parent,/tenant-control-access-disclaimer/);
 assert.match(parent,/มีค่าระงับ/);
 assert.match(parent,/ตามข้อมูลร้าน/);
 assert.doesNotMatch(component,/<button[^>]+onClick=\{[^}]+(?:suspend|unlock|settle|approve)/);
 assert.match(callable,/db.runTransaction/);
 assert.doesNotMatch(callable,/tx\.(?:update|create|delete|set)\(/);
 assert.match(policy,/sourceOriginalHoldSignatureVerified:false/);
 assert.match(policy,/canSell:null,canReleaseTenant:false/);
 assert.match(rules,/m7AdminTestOverrideMode/);
 assert.match(rules,/m7InvoiceUnpaidCents/);
});
test("read-only panel lazy loads and renders proof gaps at 320/390/768/1440 with no fake Paid, unlock or 0 balance",async()=>{
 const root=resolve("react-app");
 const dir=await mkdtemp(resolve(root,"p12e-access-browser-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{box-sizing:border-box}body{margin:0}main{padding:12px;max-width:900px;margin:auto}</style></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"fixture.jsx"),`
   import React,{useState} from "react";
   import {createRoot} from "react-dom/client";
   import {TenantAccessEvidencePanel} from "@/components/TenantAccessEvidencePanel";
   window.__p12ePending=[];window.__p12eRequests=[];
   function App(){
    const [enabled,setEnabled]=useState(false);
    const [id,setId]=useState("p12e-merchant-fixture");
    const [version,setVersion]=useState(0);
    return <main className="tenant-admin-page">
     <button data-enable onClick={()=>setEnabled(v=>!v)}>toggle</button>
     <button data-switch onClick={()=>setId("p12e-other-fixture")}>other</button>
     <button data-version onClick={()=>setVersion(v=>v+1)}>version</button>
     <TenantAccessEvidencePanel tenantId={id} enabled={enabled}
      refreshVersion={version}/>
    </main>;
   }
   createRoot(document.getElementById("root")).render(<App/>);
  `);
  const mock={
   name:"p12e-service-stub",enforce:"pre",
   resolveId(id){if(id.includes("platformTenantService"))return "\0p12e-service";},
   load(id){if(id==="\0p12e-service")return `
    export const getPlatformTenantAccessEvidence=payload=>{
     window.__p12eRequests.push(payload);
     return new Promise((resolve,reject)=>{
      window.__p12ePending.push({resolve,reject});
     });
    };
   `;}
  };
  server=await createServer({root,configFile:false,publicDir:false,
   cacheDir:resolve(dir,".vite"),plugins:[mock,react()],
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
    assert.equal(await page.locator("[data-tenant-access-evidence]").count(),0);
    assert.equal(await page.evaluate(()=>window.__p12eRequests.length),0);
    await page.locator("[data-enable]").click();
    await page.locator("[data-tenant-access-evidence-status=loading]").waitFor();
    await page.waitForFunction(()=>window.__p12eRequests.length===1,{},{timeout:5000});
    assert.deepEqual(await page.evaluate(()=>window.__p12eRequests),
     [{tenantId}]);
    const flagged=response(tenantId,{m7FinanceAccessStatus:"suspended",
     m7FinanceAccessReason:"m7_overdue_invoice",
     m7InvoiceUnpaidCents:999999,active:false,
     suspensionReason:"security_review",
     m7AdminTestOverrideMode:"allow"});
    await page.evaluate(data=>window.__p12ePending[0].resolve(data),flagged);
    await page.locator("[data-tenant-access-evidence-status=ready]").waitFor();
    const txt=await page.locator("[data-tenant-access-evidence]").innerText();
    assert.ok(txt.includes("พบสถานะระงับในข้อมูลร้าน"));
    assert.ok(txt.includes("ลายเซ็นอนุมัติ Hold"));
    assert.ok(txt.includes("ยังไม่ยืนยัน"));
    assert.ok(txt.includes("ปลด Hold"));
    assert.ok(!txt.includes("999999"));
    assert.ok(!txt.includes("ชำระแล้ว"));
    assert.equal(await page.locator("[data-tenant-access-evidence] button").count(),1);
    assert.equal(await page.locator("[data-tenant-access-evidence] input").count(),0);
    const overflow=await page.evaluate(()=>
     document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflow<=2,"Overflow at "+width+"px: "+overflow);
    if(width===390){
      // A previously verified tenant must not flash across tenants while
      // useEffect rechecks authorization and requests the next snapshot.
      await page.locator("[data-switch]").click();
      await page.locator("[data-tenant-access-evidence-status=loading]").waitFor();
      assert.equal(await page.locator(".tenant-access-evidence-body").count(),0);
      assert.equal(await page.locator("[data-tenant-access-evidence]").getAttribute(
       "data-tenant-access-evidence"),other);
    }
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
  const page=await browser.newPage({viewport:{width:390,height:850}});
  try{
   await page.goto(url);
   await page.locator("[data-enable]").click();
   await page.locator("[data-tenant-access-evidence-status=loading]").waitFor();
   await page.waitForFunction(()=>window.__p12eRequests.length===1,{},{timeout:5000});
   // Source A's reply becomes stale after switching tenant.
   await page.locator("[data-switch]").click();
   await page.evaluate(data=>window.__p12ePending[0].resolve(data),response());
   await page.waitForFunction(()=>window.__p12eRequests.length===2);
   assert.equal(await page.locator("[data-tenant-access-evidence-status=ready]").count(),0);
   await page.evaluate(data=>window.__p12ePending[1].resolve(data),response(other));
   await page.locator("[data-tenant-access-evidence-status=ready]").waitFor();
   assert.equal(await page.locator("[data-tenant-access-evidence]").getAttribute(
    "data-tenant-access-evidence"),other);
   await page.locator("[data-tenant-access-evidence-refresh]").click();
   await page.waitForFunction(()=>window.__p12ePending.length===3);
   await page.evaluate(()=>window.__p12ePending[2].resolve({ok:true,canSell:true}));
   await page.locator("[data-tenant-access-evidence-status=unavailable]").waitFor();
   assert.ok((await page.locator("[data-tenant-access-evidence]").innerText())
     .includes("ยังไม่สามารถสรุปสิทธิ์ขาย"));
   assert.equal(await page.locator("[data-tenant-access-evidence]").getByText(
    "คำสั่งปลดระงับ").count(),0);
  }finally{await page.close();}
 }finally{
  await browser?.close();await server?.close();
  await rm(dir,{recursive:true,force:true});
 }
});
