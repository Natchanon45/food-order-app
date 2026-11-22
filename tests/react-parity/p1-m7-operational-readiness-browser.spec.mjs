import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("Superadmin views bank-cash and credit gaps on 320/390/768/1440, no raw details or payable buttons",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-m7-operational-fixture-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"functions.js"),`
   window.__calls=[];
   const tenantId="m7-private-uat-demo",invoiceId="2026-11-22:monthly:fixed";
   export const httpsCallable=(_,name)=>async data=>{
    window.__calls.push({name,data});
    if(name!=="getPlatformM7OperationalFinanceReadiness"||
     JSON.stringify(data)!==JSON.stringify({tenantId}))
     throw Error("WRONG_CALLABLE_OR_TENANT");
    return {data:{ok:true,mode:"m7_source_finance_gap_read_only",tenantId,
     currency:"THB",authenticated:true,superadminOnly:true,writesPerformed:false,
     canPostOperationalInvoicePaid:false,canApplyServiceCredit:false,canReleaseTenant:false,
     sourceCreditLedgerMigrated:false,sourceSignedHoldApprovalsMigrated:false,
     bankStatementSourceAuthenticated:false,stripeTestShadowIsBankCash:false,
     partialHistory:sessionStorage.getItem("partialHistory")==="1",
     invoiceCount:1,invoices:[{
       invoiceId,kind:"monthly",firebaseStatus:"paid",
       grossCentsFromFirebase:50000,firebaseRecordedOnlyCents:50000,
       sourceOperationalPaid:false,sourceBankVerifiedCents:null,
       sourceCreditBalanceCents:null,remainingBankCashDueCents:null,
       sourceServiceCreditAppliedCents:null,tenantAccessReleaseAllowed:false,
       creditPostingAllowed:false,blockerCodes:[
        "SOURCE_M7_BANK_JOURNAL_NOT_MIGRATED",
        "SOURCE_M7_CREDIT_ACCOUNT_EVENTS_NOT_MIGRATED",
        "FIREBASE_PAYMENT_REVIEW_NOT_BANK_STATEMENT",
        "STRIPE_TEST_SHADOW_NOT_OPERATIONAL_BANK_CASH"],
       privateSlip:"NEVER_EXPOSE_SLIP",
       secretBankRef:"NEVER_EXPOSE_BANK_REFERENCE",
       stripeKey:"NEVER_EXPOSE_SECRET",
     }]}};
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from"react";
   import{createRoot}from"react-dom/client";
   import{M7OperationalFinanceReadiness}from"@/components/M7OperationalFinanceReadiness";
   createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:960,margin:"auto"}}>
     <M7OperationalFinanceReadiness tenantId="m7-private-uat-demo"/>
   </main>);`);
  vite=await createServer({configFile:false,root,cacheDir:resolve(dir,".vite-cache"),
   plugins:[react()],resolve:{alias:[
    {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
    {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
    {find:"@",replacement:resolve(root,"src")},
   ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:940}});
   const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto(url);
    const card=page.locator("[data-m7-operational-finance-gap]");
    await card.locator("summary").waitFor();
    assert.equal((await page.evaluate(()=>window.__calls)).length,0);
    await card.locator("summary").click();
    await card.getByText("ยังไม่ได้ยืนยันทะเบียนรับเงินจริงจากธนาคาร",{exact:false}).waitFor();
    await card.getByText("ยังไม่ได้ย้ายบัญชี Service Credit",{exact:false}).waitFor();
    await card.getByText("500.00 บาท",{exact:false}).first().waitFor();
    const text=await card.innerText();
    assert.match(text,/ยังไม่ยืนยัน/);
    assert.match(text,/ปลดระงับร้านค้าจากรายงานนี้/);
    assert.match(text,/Stripe TEST Shadow Ledger/);
    assert.match(text,/ไม่อนุญาตรับเงินจริง/);
    assert.ok(!text.includes("NEVER_EXPOSE"));
    assert.equal(await page.getByRole("button",{name:/อนุมัติ Paid|หัก Service Credit|ปลดระงับ/}).count(),0);
    assert.deepEqual(await page.evaluate(()=>window.__calls),[
      {name:"getPlatformM7OperationalFinanceReadiness",data:{tenantId:"m7-private-uat-demo"}},
    ]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,"overflow "+width);
    await page.evaluate(()=>sessionStorage.setItem("partialHistory","1"));
    await page.getByRole("button",{name:"รีเฟรช"}).click();
    await card.getByText("ประวัติมีจำนวนมากกว่าขอบเขตการอ่าน",{exact:false}).waitFor();
    assert.equal(await page.getByRole("button",{name:/อนุมัติ Paid|หัก Service Credit|ปลดระงับ/}).count(),0);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
test("Superadmin route mounts gap card, server enforces UAT-only and no credit/payment writer exported",async()=>{
 const route=await readFile("react-app/src/pages/AdminTenantsPage.jsx","utf8");
 const ui=await readFile("react-app/src/components/M7OperationalFinanceReadiness.jsx","utf8");
 const fn=await readFile("functions/index.js","utf8");
 const server=await readFile("functions/m7-operational-finance-readiness.js","utf8");
 assert.match(route,/M7OperationalFinanceReadiness/);
 assert.match(ui,/result\.canPostOperationalInvoicePaid!==false/);
 assert.match(ui,/result\.canApplyServiceCredit!==false/);
 assert.match(ui,/result\.canReleaseTenant!==false/);
 assert.match(fn,/exports\.getPlatformM7OperationalFinanceReadiness/);
 assert.match(server,/allowedTenant=gate/);
 assert.match(server,/user\.role!=="super_admin"/);
 assert.doesNotMatch(fn,/exports\.(postM7OperationalBankCash|applyM7OperationalServiceCredit|releaseM7OperationalHold)/);
});
