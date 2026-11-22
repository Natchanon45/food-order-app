import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("Superadmin reviews no-intent TEST expiration, approves closure, and merchant manually reserves a NEW quote at 4 widths",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-m7-closure-fixture-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"sweet.js"),"window.__confirmCount=(window.__confirmCount||0);export const sweetConfirm=async()=>{window.__confirmCount++;return true;};");
  await writeFile(resolve(dir,"functions.js"),`
   window.__calls=[];window.__notices=[];
   const tenantId="tenant-uat-closure-1234",invoiceId="2026-11-22:monthly:fixed",
    attemptId="abcdef12-1234-1234-1234-123456789abc",
    nextAttemptId="fedcba12-1234-1234-1234-123456789abc";
   const condition=()=>sessionStorage.getItem("closureCondition")||"can_review_closure";
   const state=()=>sessionStorage.getItem("closedApproved")==="1"?"closed_expired_test":"expired_test";
   export const httpsCallable=(_,name)=>async data=>{
    window.__calls.push({name,data});
    if(name==="getPlatformM7StripeTestShadowHistory"){
     if(JSON.stringify(data)!==JSON.stringify({tenantId}))throw Error("CROSS_TENANT");
     return {data:{ok:true,available:true,mode:"test_shadow",
      currency:"THB",operationalSettlementEnabled:false,hasMore:false,
      items:[{tenantId,invoiceId,attemptId,amountSatang:39900,currency:"THB",
       kind:"monthly",attemptNo:1,status:state(),providerVerified:false,
       providerTestAccountOnly:true,operationalSettlementEnabled:false}]}};
    }
    if(name==="reviewPlatformM7StripeTestClosure"){
     if(Object.keys(data).join(",")!=="tenantId,invoiceId,attemptId"||
       data.tenantId!==tenantId||data.invoiceId!==invoiceId||data.attemptId!==attemptId)
      throw Error("FORGED_CLOSURE_REVIEW");
     return {data:{ok:true,mode:"test",tenantId,invoiceId,attemptId,
      amountSatang:39900,currency:"THB",status:condition(),readOnly:true,
      canCreateNewCheckout:false,operationalInvoicePaid:false,
      serviceCreditChanged:false,providerClosureVerified:false,
      eligibleForOperatorApproval:condition()==="can_review_closure",
      requiresSuperadminConfirmation:condition()==="can_review_closure",
      scannedPages:2}};
    }
    if(name==="approvePlatformM7StripeTestClosure"){
     if(Object.keys(data).join(",")!=="tenantId,invoiceId,attemptId"||
       data.tenantId!==tenantId||data.invoiceId!==invoiceId||data.attemptId!==attemptId||
       condition()!=="can_review_closure")throw Error("FORGED_CLOSURE_APPROVAL");
     sessionStorage.setItem("closedApproved","1");
     return {data:{ok:true,mode:"test",status:"reviewed_expired_no_intent",
      tenantId,invoiceId,attemptId,newQuotePermitted:true,
      newCheckoutCreated:false,operationalInvoicePaid:false,
      serviceCreditChanged:false}};
    }
    if(name==="getOwnM7StripeTestQuoteReadiness")return {data:{ok:true,
      quoteEnabled:true,checkoutEnabled:false,settlementEnabled:false,
      invoices:[{invoiceId,amountSatang:39900,currency:"THB",kind:"monthly"}]}};
    if(name==="getOwnM7StripeTestCheckoutStatus")return {data:{ok:true,available:true,
      checkoutEnabled:false,shadowLedgerEnabled:true,mode:"test",
      operationalSettlementEnabled:false,items:[{invoiceId,amountSatang:39900,
       currency:"THB",kind:"monthly",attemptNo:1,attemptId,
       status:sessionStorage.getItem("newQuote")==="1"?"reserved":state(),
       providerVerified:false,mode:"test",invoicePaid:false,
       operationalSettlementEnabled:false,checkoutUrl:""}]}};
    if(name==="reserveOwnM7StripeTestInvoice"){
     if(Object.keys(data).join(",")!=="invoiceId"||data.invoiceId!==invoiceId||
        state()!=="closed_expired_test")throw Error("UNAPPROVED_NEW_QUOTE");
     sessionStorage.setItem("newQuote","1");
     return {data:{ok:true,reused:false,readOnlyFinancials:true,quote:{
      invoiceId,kind:"monthly",amountSatang:39900,currency:"THB",
      mode:"test",attemptId:nextAttemptId,attemptNo:2,status:"reserved",
      providerCheckoutCreated:false,checkoutUrl:"",settled:false,
      checkoutEnabled:false,settlementEnabled:false}}};
    }
    if(name==="createOwnM7StripeTestCheckout")throw Error("MUST_NOT_POST_CHECKOUT");
    throw Error("UNEXPECTED_CALL_"+name);
   };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from"react";
   import{createRoot}from"react-dom/client";
   import{M7StripeTestReservation}from"@/components/M7StripeTestReservation";
   import{M7StripeTestShadowHistory}from"@/components/M7StripeTestShadowHistory";
   const scope=new URLSearchParams(location.search).get("scope")||"platform";
   createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:960,margin:"auto"}}>
    {scope==="platform"?<M7StripeTestShadowHistory tenantId="tenant-uat-closure-1234"/>:
     <M7StripeTestReservation tenantId="tenant-uat-closure-1234"
      notify={(message,tone)=>window.__notices.push({message,tone})}/>}
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
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:930}});
   const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto(url+"?scope=platform");
    const card=page.locator("[data-m7-stripe-shadow-history]");
    await card.locator("summary").click();
    const review=page.getByRole("button",{name:"ตรวจปิด Session หมดอายุ"});
    await review.waitFor();
    assert.equal(await page.getByRole("button",{name:"อนุมัติปิด TEST Session"}).count(),0);
    await review.click();
    await card.getByText("Stripe TEST ยืนยันว่าหมดอายุ ไม่มี PaymentIntent",{exact:false}).first().waitFor();
    await page.getByRole("button",{name:"อนุมัติปิด TEST Session"}).click();
    await card.getByText("บันทึก Closure Audit แล้ว",{exact:false}).waitFor();
    await card.getByText("Superadmin ปิด TEST Session หมดอายุแล้ว",{exact:false}).waitFor();
    assert.equal(await page.evaluate(()=>window.__confirmCount),1);
    const platformCalls=await page.evaluate(()=>window.__calls);
    assert.equal(platformCalls.filter(c=>c.name==="reviewPlatformM7StripeTestClosure").length,1);
    assert.equal(platformCalls.filter(c=>c.name==="approvePlatformM7StripeTestClosure").length,1);
    assert.equal(platformCalls.some(c=>c.name==="createOwnM7StripeTestCheckout"),false);
    assert.match(await card.innerText(),/ไม่ได้บันทึก Paid จากส่วนนี้/);
    await page.goto(url+"?scope=merchant");
    const merchant=page.locator("[data-m7-stripe-test-quote]");
    await merchant.locator("summary").click();
    const reQuote=page.getByRole("button",{name:"จองยอด TEST ใหม่หลังอนุมัติ"});
    await reQuote.waitFor();
    await reQuote.click();
    await merchant.getByText("จองยอดแล้ว · ครั้งที่ 2",{exact:false}).waitFor();
    assert.equal(await page.evaluate(()=>window.__confirmCount),1);
    const calls=await page.evaluate(()=>window.__calls);
    assert.equal(calls.filter(c=>c.name==="reserveOwnM7StripeTestInvoice").length,1);
    assert.equal(calls.some(c=>c.name==="createOwnM7StripeTestCheckout"),false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2,"overflow "+width);
    for(const condition of ["cooldown","no_single_match","provider_changed","scan_incomplete"]){
     await page.evaluate(value=>{
      sessionStorage.removeItem("closedApproved");sessionStorage.removeItem("newQuote");
      sessionStorage.setItem("closureCondition",value);
     },condition);
     await page.goto(url+"?scope=platform");
     await card.locator("summary").click();
     await review.waitFor();await review.click();
     const labels={cooldown:"ยังไม่พ้นช่วงรอตรวจ",
      no_single_match:"พบข้อมูล Session ไม่ตรง",
      provider_changed:"Stripe TEST เปลี่ยนสถานะ",
      scan_incomplete:"ค้น Session ยังไม่ครบ"};
     await card.getByText(labels[condition],{exact:false}).first().waitFor();
     assert.equal(await page.getByRole("button",{name:"อนุมัติปิด TEST Session"}).count(),0);
     await page.goto(url+"?scope=merchant");
     await merchant.locator("summary").click();
     assert.equal(await page.getByRole("button",{name:"จองยอด TEST ใหม่หลังอนุมัติ"}).count(),0);
    }
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
test("private test closure Audit, operator intent and Service Credit cannot be changed through UI",async()=>{
 const component=await readFile("react-app/src/components/M7StripeTestShadowHistory.jsx","utf8");
 const merchant=await readFile("react-app/src/components/M7StripeTestReservation.jsx","utf8");
 const fn=await readFile("functions/index.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 assert.match(component,/reviewPlatformM7StripeTestClosure/);
 assert.match(component,/approvePlatformM7StripeTestClosure/);
 assert.match(component,/sweetConfirm/);
 assert.match(component,/newQuotePermitted!==true/);
 assert.match(component,/newCheckoutCreated!==false/);
 assert.match(merchant,/closed_expired_test/);
 assert.match(fn,/exports\.approvePlatformM7StripeTestClosure/);
 assert.match(rules,/match \/m7StripeTestClosureAudits\/\{attemptId\} \{\s*allow read, write: if false/);
});
