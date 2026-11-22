import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("M7 Stripe TEST: merchant gated checkout + provider link and Superadmin shadow-only evidence on 4 widths",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-m7-stripe-shadow-ui-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"sweet.js"),"export const sweetConfirm=async()=>true;");
  await writeFile(resolve(dir,"functions.js"),`
   window.__calls=[];window.__toasts=[];
   const invoiceId="2026-11-22:monthly:fixed",attemptId="abcdef12-1234-1234-1234-123456789abc";
   const base={invoiceId,amountSatang:39900,kind:"monthly",currency:"THB"};
   const quote={...base,mode:"test",status:"reserved",attemptId,attemptNo:1,
    providerCheckoutCreated:false,checkoutUrl:"",settled:false,
    checkoutEnabled:false,settlementEnabled:false};
   const persisted=()=>sessionStorage.getItem("m7_test_status")||"reserved";
   const providerUrl="https://checkout.stripe.com/c/pay/cs_test_1234567890abcdef";
   const row=()=>({...quote,status:persisted(),
    providerVerified:persisted()==="verified_test",invoicePaid:false,
    operationalSettlementEnabled:false,
    checkoutUrl:persisted()==="checkout_ready"?providerUrl:""});
   export const httpsCallable=(_,name)=>async data=>{
    window.__calls.push({name,data});
    if(name==="getOwnM7StripeTestQuoteReadiness")return {data:{ok:true,
      quoteEnabled:true,checkoutEnabled:false,settlementEnabled:false,invoices:[{...base}]}};
    if(name==="getOwnM7StripeTestCheckoutStatus")return {data:{ok:true,
      available:true,checkoutEnabled:true,shadowLedgerEnabled:true,
      operationalSettlementEnabled:false,mode:"test",
      items:sessionStorage.getItem("m7_test_quote")==="1"?[row()]:[]}};
    if(name==="reserveOwnM7StripeTestInvoice"){
      if(Object.keys(data).length!==1||data.invoiceId!==invoiceId)throw Error("FORGED_INPUT");
      sessionStorage.setItem("m7_test_quote","1");
      return {data:{ok:true,reused:false,readOnlyFinancials:true,quote}};
    }
    if(name==="createOwnM7StripeTestCheckout"){
      if(Object.keys(data).length!==1||data.invoiceId!==invoiceId)throw Error("FORGED_CHECKOUT_AMOUNT");
      sessionStorage.setItem("m7_test_status","checkout_ready");
      return {data:{ok:true,providerStatus:"checkout_ready",reused:false,
        invoicePaid:false,operationalSettlementEnabled:false,
        item:{...row(),checkoutUrl:providerUrl}}};
    }
    if(name==="getPlatformM7StripeTestShadowHistory")return {data:{
      ok:true,available:true,mode:"test_shadow",currency:"THB",
      operationalSettlementEnabled:false,hasMore:false,
      items:[{...base,attemptId,attemptNo:1,status:"provider_test_verified",
       providerVerified:true,providerTestAccountOnly:true,operationalSettlementEnabled:false,
       createdAt:"2026-11-22T07:00:00Z"}]}};
    throw Error("UNEXPECTED_M7_CALL_"+name);
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";import {createRoot} from "react-dom/client";
    import {M7StripeTestReservation} from "@/components/M7StripeTestReservation";
    import {M7StripeTestShadowHistory} from "@/components/M7StripeTestShadowHistory";
    const scope=new URLSearchParams(location.search).get("scope")||"merchant";
    createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:980,margin:"auto"}}>
     {scope==="merchant"?<M7StripeTestReservation tenantId="tenant-uat-1234"
       notify={(message,tone)=>window.__toasts.push({message,tone})}/>:
      <M7StripeTestShadowHistory tenantId="tenant-uat-1234"/>}
    </main>);`);
  server=await createServer({configFile:false,root,plugins:[react()],resolve:{alias:[
   {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
   {find:"@/components/sweetDialog",replacement:resolve(dir,"sweet.js")},
   {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
   {find:"@",replacement:resolve(root,"src")},
  ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:930}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    const baseURL="http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html";
    await page.goto(baseURL+"?scope=merchant");
    const quote=page.locator("[data-m7-stripe-test-quote]");
    await quote.waitFor();await quote.locator("summary").click();
    await quote.getByRole("button",{name:"จองยอดทดสอบ",exact:true}).click();
    await quote.getByRole("button",{name:"เริ่ม Stripe TEST Checkout"}).waitFor();
    await quote.getByRole("button",{name:"เริ่ม Stripe TEST Checkout"}).click();
    const link=quote.getByRole("link",{name:"เปิดหน้า Stripe TEST"});
    await link.waitFor();
    assert.match(await link.getAttribute("href"),/^https:\/\/checkout\.stripe\.com\/c\/pay\//);
    assert.equal(await link.getAttribute("target"),"_blank");
    assert.match(await quote.innerText(),/ยังไม่เปลี่ยน Invoice เป็น Paid/);
    assert.ok((await page.evaluate(()=>window.__calls.filter(r=>r.name==="createOwnM7StripeTestCheckout"))).every(x=>
      Object.keys(x.data).length===1&&x.data.invoiceId==="2026-11-22:monthly:fixed"));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2);
    await page.goto(baseURL+"?scope=platform");
    const history=page.locator("[data-m7-stripe-shadow-history]");
    await history.locator("summary").click();
    await history.getByText("Stripe TEST ยืนยันใน Shadow Ledger",{exact:true}).waitFor();
    assert.match(await history.innerText(),/ไม่ได้บันทึก Paid จากส่วนนี้/);
    assert.equal(await history.locator("tbody tr").count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
test("UI exposes no confirmed cash status or changes to account; both routes correctly mounted",async()=>{
 const merchant=await readFile("react-app/src/components/M7StripeTestReservation.jsx","utf8");
 const admin=await readFile("react-app/src/pages/AdminTenantsPage.jsx","utf8");
 const fns=await readFile("functions/index.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 assert.match(merchant,/getOwnM7StripeTestCheckoutStatus/);
 assert.match(merchant,/createOwnM7StripeTestCheckout/);
 assert.match(merchant,/data\.invoicePaid!==false/);
 assert.match(merchant,/^const money=/m);
 assert.match(admin,/<M7StripeTestShadowHistory tenantId=\{tenantId\}/);
 assert.match(fns,/exports\.m7StripeTestShadowWebhook/);
 assert.match(fns,/exports\.getPlatformM7StripeTestShadowHistory/);
 assert.match(rules,/match \/m7StripeTestSettlements\/\{attemptId\} \{\s*allow read, write: if false/);
 assert.match(rules,/match \/m7StripeTestIntentClaims\/\{intentId\} \{\s*allow read, write: if false/);
});
