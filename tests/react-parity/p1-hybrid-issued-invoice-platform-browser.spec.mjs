import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("Platform Hybrid review uses same server-paid proof as merchant, ignores unverified Paid and paginates at 4 widths",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-hybrid-platform-issued-fixture-"));
 let vite,browser;
 const tenantId="tenant-platform-invoice-1234";
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"firebase.js"),"export const functions={};export const isHybridDemoMode=false;");
  await writeFile(resolve(dir,"auth.js"),"export const useAuth=()=>({status:'ready',profile:{role:'super_admin'}});");
  await writeFile(resolve(dir,"i18n.js"),`export const useI18n=()=>({intlLocale:"th-TH"});`);
  await writeFile(resolve(dir,"router.jsx"),"import React from 'react';export const Link=({to,children,...props})=><a href={to} {...props}>{children}</a>;export const Navigate=()=>null;");
  await writeFile(resolve(dir,"hook.js"),"export const useParityPage=()=>true;");
  await writeFile(resolve(dir,"component.jsx"),"import React from 'react';export const PageReadyOverlay=()=>null;export const ParityFooter=()=>null;export const LocaleSwitcher=()=>null;export const UserMenu=()=>null;export const HybridReviewDecisionPanel=()=> <small role='status'>Financial review locked until authorization</small>;");
  await writeFile(resolve(dir,"records.js"),`
   const tenantId=${JSON.stringify(tenantId)};
   const empty=()=>({items:[],cursor:null,hasMore:false});
   export const listHybridTenants=async()=>({items:[{
     id:tenantId,name:"Merchant Finance Fixture"}],cursor:null,hasMore:false});
   export const listHybridPaymentAttempts=async()=>({items:[{
     id:"attempt1234",invoiceId:"2026-11-20:monthly:fixed",
     status:"pending_review",amount:50,bankVerified:true,
     submittedAt:new Date("2026-11-20T10:00:00Z"),
   }],cursor:null,hasMore:false});
   export const listHybridPaymentReviewEvents=async()=>empty();
   export const listHybridAdjustments=async()=>empty();
   export const listHybridAdjustmentReviewEvents=async()=>empty();
   export const listHybridRefundCandidates=async()=>empty();`);
  await writeFile(resolve(dir,"functions.js"),`
   window.__calls=[];
   const tenantId=${JSON.stringify(tenantId)};
   const base={issuerSource:"firebase_hybrid_issued_ledger",currency:"THB",
    sourceM7BankReconciled:false,independentBankStatementVerified:false,
    operationalCashSettled:false,canSubmitPayment:false,canReleaseShop:false};
   const item=(id,status,amount)=>({
    ...base,id,kind:"fixed_monthly",date:id.slice(0,10),amount,
    invoiceAmountCents:Math.round(amount*100),
    paymentStatus:status,displayStatus:status==="recorded_paid"?"paid":
     status==="not_submitted"?"issued":status,
    canPrepareLocalFile:status==="not_submitted"||status==="rejected"});
   const rows=[
    item("2026-11-22:monthly:fixed","needs_review",999),
    item("2026-11-21:monthly:fixed","recorded_paid",590),
    item("2026-11-20:monthly:fixed","not_submitted",50),
   ];
   export const httpsCallable=(_,name)=>async args=>{
    window.__calls.push({name,args});
    if(name!=="getPlatformHybridIssuedInvoiceStatusPage"||
       args.tenantId!==tenantId||args.limit!==20||
       Object.keys(args).some(k=>!["tenantId","limit","cursor"].includes(k)))
     throw Error("INVALID_PLATFORM_ISSUED_CALL");
    const more=!!args.cursor;
    if(more&&args.cursor!==rows[1].id)throw Error("INVALID_CURSOR");
    return {data:{ok:true,mode:"issued_invoice_read_only",source:"firebase_hybrid_issued_ledger",
     tenantId,currency:"THB",operationalBankReconciled:false,
     financialPostingEnabled:false,paymentSubmissionEnabled:false,
     tenantAccessChanged:false,writesPerformed:false,
     items:more?rows.slice(2):rows.slice(0,2),
     hasMore:!more,cursor:more?null:rows[1].id}};
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";
   import "../public/parity/css/app.css";
   import "../public/parity/css/hybrid-billing-report.css";
   import "../public/parity/css/hybrid-billing-review.css";
   import{createRoot}from"react-dom/client";
   import{HybridBillingReviewPage}from"@/pages/HybridBillingReviewPage";
   createRoot(document.getElementById("root")).render(<HybridBillingReviewPage/>);`);
  vite=await createServer({configFile:false,root,cacheDir:resolve(dir,".vite-cache"),
   plugins:[react()],resolve:{alias:[
    {find:"@/firebase/client",replacement:resolve(dir,"firebase.js")},
    {find:"@/auth/AuthProvider",replacement:resolve(dir,"auth.js")},
    {find:"@/i18n/I18nProvider",replacement:resolve(dir,"i18n.js")},
    {find:"@/hooks/useParityPage",replacement:resolve(dir,"hook.js")},
    {find:"@/data/hybridInvoiceReviewData",replacement:resolve(dir,"records.js")},
    {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
    {find:"react-router-dom",replacement:resolve(dir,"router.jsx")},
    ...["PageReadyOverlay","ParityFooter","LocaleSwitcher","UserMenu","HybridReviewDecisionPanel"]
      .map(name=>({find:"@/components/"+name,replacement:resolve(dir,"component.jsx")})),
    {find:"@",replacement:resolve(root,"src")},
   ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:920}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto(url);
    await page.locator("#hybridReviewTenant").selectOption(tenantId);
    await page.getByText("หลักฐานไม่ครบ ต้องตรวจสอบ").waitFor();
    await page.getByText("บันทึก Paid ใน Firebase (รอเทียบ Source)",{exact:true}).first().waitFor();
    const cards=page.locator(".hybrid-report-metric");
    await cards.filter({hasText:"ยอดบันทึก Paid ใน Firebase (รอเทียบ Source)"}).first()
     .getByText("590.00",{exact:false}).waitFor();
    assert.equal(await page.getByText("ธนาคารยืนยัน",{exact:true}).count(),0);
    await page.getByText("ระบบตรวจสลิปผ่าน",{exact:true}).first().waitFor();
    const calls=await page.evaluate(()=>window.__calls);
    assert.equal(calls.filter(c=>c.name==="getPlatformHybridIssuedInvoiceStatusPage").length,1);
    await page.getByRole("button",{name:"โหลดบิลเพิ่มเติม"}).click();
    await page.getByText("ออกบิลแล้ว",{exact:true}).first().waitFor();
    const after=await page.evaluate(()=>window.__calls);
    assert.equal(after.length,2);
    assert.equal(after[1].args.cursor,"2026-11-21:monthly:fixed");
    assert.equal(await page.getByRole("button",{name:/อนุมัติ Paid|ปลดระงับร้าน/}).count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,
     "overflow "+width);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
test("Superadmin invoice reads no longer use raw Firestore invoice collection for paid totals",async()=>{
 const page=await readFile("react-app/src/pages/HybridBillingReviewPage.jsx","utf8");
 const client=await readFile("react-app/src/data/hybridIssuedInvoiceStatusClient.js","utf8");
 const fn=await readFile("functions/index.js","utf8");
 assert.match(page,/listPlatformIssuedHybridInvoices/);
 assert.doesNotMatch(page,/listHybridInvoices\(/);
 assert.match(page,/paymentStatus === "recorded_paid"/);
 assert.match(page,/หลักฐานไม่ครบ ต้องตรวจสอบ/);
 assert.match(client,/getPlatformHybridIssuedInvoiceStatusPage/);
 assert.match(fn,/exports\.getPlatformHybridIssuedInvoiceStatusPage/);
});
