import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("M7 evidence: responsive merchant+Superadmin history, bounded source, no Stripe-paid impersonation",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-m7-evidence-fixture-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"functions.js"),`window.__m7Calls=[];
  const items=[
   {paymentId:"attempt-1",tenantId:"tenant-demo123",tenantName:"ร้านทดสอบ",invoiceKey:"2026-11-22:monthly:fixed",invoiceKind:"platform",
     sourceKind:"hybrid_invoice_proof",status:"recorded",amountCents:39900,recordedCents:39900,verifiedStripeCents:0,stripeSettled:false,bankSettlementVerified:false,
     createdAt:"2026-11-22T11:00:00.000Z"},
   {paymentId:"share-1",tenantId:"tenant-demo123",tenantName:"ร้านทดสอบ",invoiceKey:"2026-11-22",invoiceKind:"delivery_daily",
     sourceKind:"legacy_delivery_revenue_share",status:"pending",amountCents:4550,recordedCents:0,verifiedStripeCents:0,stripeSettled:false,bankSettlementVerified:false,
     createdAt:"2026-11-22T12:00:00.000Z"},
  ];
  export const httpsCallable=(_,name)=>async data=>{
   window.__m7Calls.push({name,data});
   if(!["getOwnM7FinanceEvidenceHistory","getPlatformM7FinanceEvidenceHistory"].includes(name))throw Error("FORBIDDEN");
   const rows=items.filter(row=>(data.status==="all"||row.status===data.status)&&
       (data.kind==="all"||row.invoiceKind===data.kind));
   return {data:{source:"firebase_m7_finance_evidence_not_stripe_settlements",
    currency:"THB",settlementSourceAvailable:false,
    authenticated:true,readOnly:true,tenantId:data.tenantId||"tenant-demo123",
    items:rows,hasMore:false}};
  };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";import{createRoot}from"react-dom/client";import{M7FinanceEvidenceHistory}from"@/components/M7FinanceEvidenceHistory";
   const isPlatform=new URLSearchParams(location.search).get("scope")==="platform";
   createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:1000,margin:"auto"}}>
   <M7FinanceEvidenceHistory scope={isPlatform?"platform":"merchant"} tenantId="tenant-demo123"/>
   </main>);`);
  server=await createServer({configFile:false,root,plugins:[react()],resolve:{alias:[
   {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
   {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
   {find:"@",replacement:resolve(root,"src")},
  ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();browser=await chromium.launch({channel:"chrome",headless:true});
  for(const scope of ["merchant","platform"])for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto("http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html?scope="+scope);
    const details=page.locator("[data-m7-evidence-history]");
    await details.locator("summary").click();
    await page.getByText("ประวัติหลักฐานการชำระและผลการตรวจสอบ").waitFor();
    await page.getByText("ยอดที่บันทึกชำระ คือสถานะที่ระบบบัญชีบันทึกตามหลักฐาน",{exact:false}).waitFor();
    const rows=page.locator(scope==="merchant"?"[data-m7-evidence-row]":".m7-evidence-scroll tbody tr");
    await rows.first().waitFor();assert.equal(await rows.count(),2);
    const calls=await page.evaluate(()=>window.__m7Calls);
    assert.equal(calls[0].name,scope==="merchant"?"getOwnM7FinanceEvidenceHistory":"getPlatformM7FinanceEvidenceHistory");
    assert.equal(calls[0].data.tenantId,scope==="merchant"?undefined:"tenant-demo123");
    assert.ok(!(await details.innerText()).includes("ชำระ Stripe สำเร็จ"));
    const pending=page.getByRole("button",{name:"รอตรวจ",exact:true});
    await pending.click();
    await page.waitForFunction(()=>window.__m7Calls.at(-1).data.status==="pending");
    await page.getByText("รอตรวจสอบ",{exact:true}).first().waitFor();
    assert.equal(await rows.count(),1);
    await page.getByRole("button",{name:"รีเฟรช"}).click();
    await page.waitForFunction(()=>window.__m7Calls.length>=3);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,scope+" viewport "+width);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
test("M7 component integrated in both routes and read-only callables exported without paid writes",async()=>{
 const mer=await readFile("react-app/src/pages/RevenueShareReportPage.jsx","utf8");
 const plat=await readFile("react-app/src/pages/AdminTenantsPage.jsx","utf8");
 const functions=await readFile("functions/index.js","utf8");
 const policy=await readFile("functions/m7-evidence-history-policy.js","utf8");
 assert.match(mer,/<M7FinanceEvidenceHistory key=\{tenant\?\.id\} scope="merchant"/);
 assert.match(plat,/<M7FinanceEvidenceHistory scope="platform"/);
 assert.match(functions,/exports\.getOwnM7FinanceEvidenceHistory/);
 assert.match(functions,/exports\.getPlatformM7FinanceEvidenceHistory/);
 assert.doesNotMatch(policy,/source:\s*"m7_stripe_checkout_verified_settlements"/);
 assert.match(policy,/verifiedStripeCents:0,stripeSettled:false,bankSettlementVerified:false/);
});
