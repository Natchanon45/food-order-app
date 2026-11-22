import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("M7 Stripe TEST owner-only quote UI: hidden by default, server amount, once-only reuse, 4 widths",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-m7-stripe-quote-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"sweet.js"),"export const sweetConfirm=async()=>true;");
  await writeFile(resolve(dir,"functions.js"),`window.__m7ReservationCalls=[];window.__mode=sessionStorage.getItem("m7mode")||"enabled";window.__count=0;
   export const httpsCallable=(_,name)=>async data=>{
    window.__m7ReservationCalls.push({name,data});
    if(name==="getOwnM7StripeTestQuoteReadiness")return {data:{ok:true,
     quoteEnabled:window.__mode==="enabled",checkoutEnabled:false,settlementEnabled:false,
     invoices:window.__mode==="enabled"?[{invoiceId:"2026-11-22:monthly:fixed",
       kind:"monthly",amountSatang:39900,currency:"THB"}]:[]}};
    if(name==="reserveOwnM7StripeTestInvoice"){
     if(JSON.stringify(Object.keys(data))!==JSON.stringify(["invoiceId"]))throw Error("FORGED_INPUT");
     if(data.invoiceId!=="2026-11-22:monthly:fixed")throw Error("WRONG_INVOICE");
     window.__count++;
     return {data:{ok:true,readOnlyFinancials:true,reused:window.__count>1,
       quote:{invoiceId:data.invoiceId,kind:"monthly",amountSatang:39900,
        currency:"THB",mode:"test",attemptId:"abcdef12-1234-1234-1234-123456789abc",
        attemptNo:1,status:"reserved",providerCheckoutCreated:false,
        checkoutUrl:"",settled:false,checkoutEnabled:false,settlementEnabled:false}}};
    }
    throw Error("UNEXPECTED_CALL");
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from"react";import{createRoot}from"react-dom/client";import{M7StripeTestReservation}from"@/components/M7StripeTestReservation";
   createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:900,margin:"auto"}}>
    <M7StripeTestReservation tenantId="tenant-test-123" notify={(s,e)=>{window.__toast=[s,e]}}/></main>);`);
  server=await createServer({configFile:false,root,plugins:[react()],resolve:{alias:[
   {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
   {find:"@/components/sweetDialog",replacement:resolve(dir,"sweet.js")},
   {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
   {find:"@",replacement:resolve(root,"src")},
  ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    const url="http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html";
    await page.goto(url);
    const quote=page.locator("[data-m7-stripe-test-quote]");
    await quote.waitFor();
    await quote.locator("summary").click();
    assert.match(await quote.innerText(),/ยังไม่รับเงิน/);
    assert.match(await quote.innerText(),/399\.00 บาท/);
    await page.getByRole("button",{name:"จองยอดทดสอบ",exact:true}).click();
    await quote.getByText("จองยอดแล้ว",{exact:false}).waitFor();
    await page.getByRole("button",{name:"ตรวจสอบรายการจองเดิม"}).click();
    await page.waitForFunction(()=>window.__count===2);
    const records=await page.evaluate(()=>window.__m7ReservationCalls.filter(c=>c.name==="reserveOwnM7StripeTestInvoice"));
    assert.equal(records.length,2);
    assert.deepEqual(records[0].data,records[1].data);
    assert.deepEqual(Object.keys(records[0].data),["invoiceId"]);
    assert.ok(!(await quote.innerText()).includes("Stripe Checkout URL"));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2);
    await page.evaluate(()=>{sessionStorage.setItem("m7mode","disabled");window.__mode="disabled"});
    await page.reload();
    await page.waitForFunction(()=>window.__m7ReservationCalls.some(c=>c.name==="getOwnM7StripeTestQuoteReadiness"));
    await page.waitForFunction(()=>document.querySelector("[data-m7-stripe-test-quote]")===null);
    assert.equal(await quote.count(),0);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
test("M7 quote mounted owner/admin only and provider writer remains private",async()=>{
 const page=await readFile("react-app/src/pages/RevenueShareReportPage.jsx","utf8");
 const component=await readFile("react-app/src/components/M7StripeTestReservation.jsx","utf8");
 const policy=await readFile("functions/m7-stripe-test-reservation-policy.js","utf8");
 const shadow=await readFile("functions/m7-stripe-test-shadow-policy.js","utf8");
 const callable=await readFile("functions/index.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 assert.match(page,/<M7StripeTestReservation key=\{"stripe-"/);
 assert.match(page,/\["owner","admin"\]\.includes\(profile\?\.role\)/);
 assert.match(component,/getOwnM7StripeTestQuoteReadiness/);
 assert.match(component,/reserveOwnM7StripeTestInvoice/);
 assert.match(shadow,/PENGUIN_M7_STRIPE_TEST_CHECKOUT_ENABLED==="1"/);
 assert.match(policy,/PENGUIN_M7_STRIPE_TEST_SETTLEMENT_ENABLED==="1"/);
 assert.match(callable,/exports\.reserveOwnM7StripeTestInvoice/);
 assert.match(rules,/match \/m7StripeTestInvoiceQuotes\/\{invoiceKey\} \{\s*allow read, write: if false/);
 assert.match(rules,/match \/m7StripeTestReservations\/\{attemptId\} \{\s*allow read, write: if false/);
});
