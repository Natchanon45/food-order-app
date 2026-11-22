import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("merchant Hybrid issued-invoice page joins actual server statuses, pages safely, and does not show raw bank data at 4 widths",async()=>{
 const root=resolve("react-app");
 const dir=await mkdtemp(resolve(root,"p1-hybrid-issued-invoice-fixture-"));
 let vite,browser;
 const tenantId="tenant-merchant-production-like";
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"firebase.js"),"export const functions={};export const isHybridDemoMode=false;");
  await writeFile(resolve(dir,"auth.js"),"export const useAuth=()=>({status:'ready',profile:{role:'owner',tenantId:'tenant-merchant-production-like'}});");
  await writeFile(resolve(dir,"tenant.js"),"export const useTenant=()=>({status:'ready',tenant:{id:'tenant-merchant-production-like',name:'Merchant Fixture',billingCycleAnchorAt:'2026-10-18'}});");
  await writeFile(resolve(dir,"i18n.js"),`export const useI18n=()=>({
    t:(key)=>key,intlLocale:"th-TH",
    formatNumber:(n,options)=>new Intl.NumberFormat("th-TH",options).format(n),
   });`);
  await writeFile(resolve(dir,"router.jsx"),"import React from 'react';export const Link=({to,children,...props})=><a href={to} {...props}>{children}</a>;export const Navigate=()=>null;");
  await writeFile(resolve(dir,"hook.js"),"export const useParityPage=()=>true;");
  await writeFile(resolve(dir,"component.jsx"),"import React from 'react';export const PageReadyOverlay=()=>null;export const ParityFooter=()=>null;export const LocaleSwitcher=()=>null;export const UserMenu=()=>null;export const HybridTenantProofPanel=({invoice})=><div role='status' data-local-only='true'>Local proof preview for {invoice.id}: no payment submitted</div>;");
  await writeFile(resolve(dir,"preview.js"),"export const getHybridBillingPreview=async()=>({invoices:[],periodEnded:false,totalDeliverySales:0,totalFee:0,config:{deliveryThreshold:10000,deliveryShareRate:0},slipQuota:100,mode:'fixed_monthly'});");
  await writeFile(resolve(dir,"functions.js"),`
   window.__calls=[];
   const tenantId=${JSON.stringify(tenantId)};
   const base={currency:"THB",sourceM7BankReconciled:false,
     independentBankStatementVerified:false,operationalCashSettled:false,
     canSubmitPayment:false,canReleaseShop:false,
     issuerSource:"firebase_hybrid_issued_ledger"};
   const item=(id,kind,status,canPrepareLocalFile,amount,date)=>({
     ...base,id,date,kind,amount,invoiceAmountCents:Math.round(amount*100),
     status:status==="recorded_paid"?"paid":status,
     displayStatus:status==="not_submitted"?"issued":
       status==="recorded_paid"?"paid":status,
     paymentStatus:status,canPrepareLocalFile,
   });
   const records=[
    item("2026-11-21:monthly:fixed","fixed_monthly","needs_review",false,590,"2026-11-21"),
    item("2026-11-20:delivery:2026-11-19","delivery_daily","recorded_paid",false,50,"2026-11-20"),
    item("2026-11-19:delivery:2026-11-18","delivery_daily","pending_review",false,175,"2026-11-19"),
    item("2026-11-18:monthly:fixed","fixed_monthly","not_submitted",true,590,"2026-11-18"),
   ];
   export const httpsCallable=(_,name)=>async args=>{
    window.__calls.push({name,args});
    if(name!=="getOwnHybridIssuedInvoiceStatusPage")throw Error("FORBIDDEN_CALLABLE_"+name);
    if(args.limit!==20||Object.keys(args).some(k=>!["limit","cursor"].includes(k)))
      throw Error("UNEXPECTED_SELECTOR");
    if(sessionStorage.getItem("badPayload")==="1")
      return {data:{ok:true,mode:"issued_invoice_read_only",source:"firebase_hybrid_issued_ledger",
      tenantId,currency:"THB",operationalBankReconciled:false,financialPostingEnabled:false,
      paymentSubmissionEnabled:false,tenantAccessChanged:false,writesPerformed:false,
      items:[{...records[0],canSubmitPayment:true}],hasMore:false,cursor:null}};
    let visible,cursor;
    if(args.cursor){
     if(args.cursor!==records[1].id)throw Error("INVALID_CURSOR");
     visible=records.slice(2);cursor=null;
    }else{visible=records.slice(0,2);cursor=records[1].id;}
    return {data:{ok:true,mode:"issued_invoice_read_only",source:"firebase_hybrid_issued_ledger",
     tenantId,currency:"THB",operationalBankReconciled:false,financialPostingEnabled:false,
     paymentSubmissionEnabled:false,tenantAccessChanged:false,writesPerformed:false,
     items:visible,hasMore:!!cursor,cursor}};
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from"react";
   import "../public/parity/css/app.css";
   import "../public/parity/css/hybrid-billing-report.css";
   import "../public/parity/css/hybrid-billing-review.css";
   import{createRoot}from"react-dom/client";
   import{HybridBillingReportPage}from"@/pages/HybridBillingReportPage";
   createRoot(document.getElementById("root")).render(<HybridBillingReportPage/>);`);
  const aliases=[
   {find:"@/firebase/client",replacement:resolve(dir,"firebase.js")},
   {find:"@/auth/AuthProvider",replacement:resolve(dir,"auth.js")},
   {find:"@/tenant/TenantProvider",replacement:resolve(dir,"tenant.js")},
   {find:"@/i18n/I18nProvider",replacement:resolve(dir,"i18n.js")},
   {find:"@/hooks/useParityPage",replacement:resolve(dir,"hook.js")},
   {find:"@/data/hybridBillingReport",replacement:resolve(dir,"preview.js")},
   {find:"react-router-dom",replacement:resolve(dir,"router.jsx")},
   {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
   ...["PageReadyOverlay","ParityFooter","LocaleSwitcher","UserMenu","HybridTenantProofPanel"]
     .map(name=>({find:"@/components/"+name,replacement:resolve(dir,"component.jsx")})),
   {find:"@",replacement:resolve(root,"src")},
  ];
  vite=await createServer({configFile:false,root,
   cacheDir:resolve(dir,".vite-cache"),plugins:[react()],
   resolve:{alias:aliases},
   server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto(url);
    await page.getByText("หลักฐานไม่ครบ ต้องตรวจสอบ").waitFor();
    await page.getByText("บันทึก Paid ใน Firebase (รอเทียบ Source)").waitFor();
    const section=page.locator(".hybrid-review-inline");
    assert.equal(await section.getByRole("button",{name:/เตรียมสลิป/}).count(),0);
    await page.getByRole("button",{name:"โหลดบิลเพิ่มเติม"}).click();
    await page.getByText("ยังไม่ส่งหลักฐาน").waitFor();
    await page.getByText("รอตรวจสลิป").waitFor();
    assert.equal(await section.getByRole("button",{name:/เตรียมสลิป/}).count(),1);
    assert.equal((await page.evaluate(()=>window.__calls)).length,2);
    await section.getByRole("button",{name:/เตรียมสลิป/}).click();
    await page.getByText("Local proof preview for 2026-11-18:monthly:fixed",{exact:false}).waitFor();
    assert.equal(await page.getByRole("button",{name:/อนุมัติ Paid|ปลดระงับ/}).count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,
      "overflow "+width);
    await page.evaluate(()=>sessionStorage.setItem("badPayload","1"));
    await page.getByRole("button",{name:/รีเฟรชรายการบิล/}).click();
    await page.getByText("HYBRID_ISSUED_INVOICE_UNTRUSTED_ITEM").waitFor();
    assert.equal(await section.getByRole("button",{name:/เตรียมสลิป/}).count(),0);
    assert.equal(await page.getByText("บันทึก Paid ใน Firebase (รอเทียบ Source)").count(),0);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
test("all merchant Invoice UI read paths use server sanitized callable, not direct Browser Firestore",async()=>{
 const page=await readFile("react-app/src/pages/HybridBillingReportPage.jsx","utf8");
 const client=await readFile("react-app/src/data/hybridIssuedInvoiceStatusClient.js","utf8");
 const fn=await readFile("functions/index.js","utf8");
 assert.match(page,/listOwnIssuedHybridInvoices/);
 assert.match(page,/source/);
 assert.doesNotMatch(page,/listHybridInvoices\(/);
 assert.match(client,/getOwnHybridIssuedInvoiceStatusPage/);
 assert.match(client,/operationalCashSettled!==false/);
 assert.match(fn,/exports\.getOwnHybridIssuedInvoiceStatusPage/);
 assert.doesNotMatch(page,/onClick=\{.*reviewHybridInvoicePaymentProof/);
});
