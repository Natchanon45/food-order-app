import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {resolve} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {getApps,initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore,Timestamp}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8189"||
 process.env.VITE_USE_FIREBASE_EMULATORS!=="true"||
 process.env.VITE_HYBRID_DEMO_PAYMENT_E2E!=="true"||
 process.env.VITE_DEMO_FIRESTORE_EMULATOR_PORT!=="8189"||
 process.env.FUNCTIONS_EMULATOR!=="true")
 throw Error("P24_REPORT_SIGNED_BROWSER_DEMO_ONLY");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),auth=getAuth();
const suffix=randomUUID().slice(0,10);
const tenantId="p24-sales-"+suffix,otherId="p24-other-"+suffix;
const owner="p24-owner-"+suffix,foreign="p24-foreign-"+suffix,cashier="p24-cashier-"+suffix;
const password="OnlyLocalEmulator1234!";
const tenant=db.collection("tenants").doc(tenantId),orders=tenant.collection("orders");
const amount=value=>Number(String(value||"").replace(/[^0-9.]/g,""))||0;
const day="2026-11-25";
const paidAt=Timestamp.fromDate(new Date("2026-11-24T17:02:00Z"));
async function person(uid,tenantId,role){
 const email=uid+"@example.test";
 await Promise.all([
  auth.createUser({uid,email,password,emailVerified:true}),
  db.collection("users").doc(uid).set({uid,email,role,active:true,
   tenantId,businessUnits:["order_delivery"]}),
 ]);
 return email;
}
async function signin(origin,browser,uid){
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:"reduce"});
 const page=await context.newPage();
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?
  r.continue():r.abort());
 await page.goto(origin+"/login?next="+encodeURIComponent("/admin/sales-report"));
 await page.locator("#email").waitFor({timeout:25000});
 await page.locator("#email").fill(uid+"@example.test");
 await page.locator("#password").fill(password);
 await page.locator("#loginForm button[type=submit]").click();
 return {context,page,errors};
}
test("P2.4 signed Firebase Sales Report: all 261 orders, Bangkok filters, cancelled history, fail-closed read, Tenant/role isolation",{
 timeout:180000,
},async()=>{
 const [ownerEmail,foreignEmail,cashierEmail]=await Promise.all([
  person(owner,tenantId,"owner"),person(foreign,otherId,"owner"),person(cashier,tenantId,"cashier"),
 ]);
 await Promise.all([
  tenant.set({id:tenantId,name:"Sales tenant",slug:"p24-"+suffix,
   businessUnits:["order_delivery"],active:true,subscriptionStatus:"active",
   subscriptionExpiresAt:"2028-11-25T00:00:00Z"}),
  db.collection("tenants").doc(otherId).set({id:otherId,slug:"other-"+suffix,
   name:"Other tenant",businessUnits:["order_delivery"],active:true,
   subscriptionStatus:"active",subscriptionExpiresAt:"2028-11-25T00:00:00Z"}),
 ]);
 const batch=db.batch();
 for(let i=0;i<260;i++){
  const key="sale-"+String(i).padStart(3,"0");
  batch.set(orders.doc(key),{
   tenantId,id:key,billId:"B"+String(i).padStart(5,"0"),
   status:"paid",paymentStatus:"paid",totalAmount:5,originalPaidTotal:5,
   orderType:"delivery",paymentMethod:"promptpay",createdAt:paidAt,
   paidAt,items:[{name:"Food "+i,price:5,qty:1}],
  });
 }
 batch.set(orders.doc("voided"),{
  tenantId,id:"voided",billId:"BVOID2026",status:"cancelled",paymentStatus:"paid",
  totalAmount:200,originalPaidTotal:200,cancellationSource:"cashier",
  orderType:"delivery",paymentMethod:"promptpay",createdAt:paidAt,paidAt,
  items:[{name:"Voided Food",price:200,qty:1,cancelled:true,cancellationSource:"cashier"}],
 });
 await batch.commit();
 const app=await createServer({configFile:false,root:resolve("react-app"),plugins:[react()],
  resolve:{alias:[{find:"@",replacement:resolve("react-app/src")}]},
  publicDir:resolve("public"),server:{host:"127.0.0.1",port:0},clearScreen:false});
 await app.listen();
 const origin="http://127.0.0.1:"+app.httpServer.address().port;
 const browser=await chromium.launch({channel:"chrome",headless:true});
 const active=[];
 try{
  const o=await signin(origin,browser,owner);active.push(o.context);
  const p=o.page;
  await p.waitForURL("**/admin/sales-report",{timeout:25000});
  try {
    await p.locator("#totalSales").waitFor({timeout:10000});
  }catch(error){
    console.error("P24_REPORT_DIAG",JSON.stringify({
      url:p.url(),text:(await p.locator("body").innerText()).slice(0,1600),
      errors:o.errors,html:(await p.locator("main").first().innerHTML().catch(()=>"-")).slice(0,800),
    }));
    throw error;
  }
  await p.locator("#reportDate").fill(day);
  await p.waitForFunction(()=>Number(document.querySelector("#receiptCount")?.textContent.replace(/\D/g,""))===260);
  assert.equal(amount(await p.locator("#totalSales").textContent()),1300);
  assert.equal(amount(await p.locator("#averageReceipt").textContent()),5);
  assert.equal(await p.locator("#receiptResultCount").textContent().then(x=>x.match(/\d+/g)?.join("")||""),"261",
   "all 260 paid and one voided row remain in history, unlike last-250 feed");
  await p.locator("#receiptStatusFilter").selectOption("cancelled");
  await p.locator('[data-view-receipt]').first().waitFor({timeout:12000});
  assert.equal(await p.locator("#receiptRows tr").count(),1);
  assert.equal(amount(await p.locator("#totalSales").textContent()),1300,
   "status history filter NEVER affects sales KPIs");
  await p.locator('[data-view-receipt]').first().click();
  const dialog=p.locator("#receiptDialog");
  await dialog.waitFor({state:"visible"});
  assert.equal(await dialog.locator(".receipt-cancelled-banner").count(),1);
  assert.equal(await dialog.locator(".receipt-item-row.is-cancelled").count(),1);
  await dialog.locator("#closeReceiptDialog").click();
  await p.locator("#receiptStatusFilter").selectOption("");
  for(const width of [320,390,768,1440]){
   await p.setViewportSize({width,height:1000});
   assert.equal(amount(await p.locator("#totalSales").textContent()),1300);
   // Charts and receipt tables deliberately have their own horizontal
   // scroll region. documentElement.scrollWidth can include those nested
   // rendered columns even when the page itself cannot scroll sideways.
   // Test the actual user-visible horizontal scroll opportunity instead.
   const horizontal=await p.evaluate(()=>{
     window.scrollTo({left:500,top:0,behavior:"instant"});
     const shift=window.scrollX;
     window.scrollTo({left:0,top:0,behavior:"instant"});
     return shift;
   });
   if(horizontal>1)console.error("P24_OUTER_DIAG",JSON.stringify(await p.evaluate(()=>({
    html:{overflow:getComputedStyle(document.documentElement).overflowX,width:document.documentElement.scrollWidth},
    body:{overflow:getComputedStyle(document.body).overflowX,width:document.body.scrollWidth},
    chain:(()=>{
      const result=[];
      for(let el=document.querySelector(".report-breakdown-grid .breakdown-row");el&&result.length<9;el=el.parentElement){
       const r=el.getBoundingClientRect(),style=getComputedStyle(el);
       result.push({tag:el.tagName,cl:String(el.className).slice(0,70),w:Math.round(r.width),
        left:Math.round(r.left),right:Math.round(r.right),padding:style.padding,
        minWidth:style.minWidth,maxWidth:style.maxWidth,width:style.width,
        boxSizing:style.boxSizing,grid:style.gridTemplateColumns});
      }
      return result;
    })(),
    offenders:[...document.body.querySelectorAll("*")].map(el=>{
     const box=el.getBoundingClientRect();
     return {tag:el.tagName,id:el.id,cl:String(el.className||"").slice(0,65),
      right:Math.round(box.right),left:Math.round(box.left),width:Math.round(box.width)};
    }).filter(item=>item.right>window.innerWidth+2&&item.right<window.innerWidth+40)
     .slice(0,35),
   }))));
   assert.ok(horizontal<=1,"Sales page itself scrolls sideways at "+width+" by "+horizontal);
   const internal=await p.locator(".receipt-table-scroll").evaluate(el=>{
     el.scrollLeft=200;return el.scrollLeft;
   });
   if(width<=768)assert.ok(internal>0,
     "receipt table must scroll horizontally on a narrow viewport "+width);
   // On 1440px, the 980px receipt table naturally fits without scrolling.
  }
  await p.locator('[data-period=monthly]').click();
  await p.locator("#reportMonth").fill("2026-11");
  assert.equal(amount(await p.locator("#totalSales").textContent()),1300);
  await p.locator('[data-period=yearly]').click();
  await p.locator("#reportYear").selectOption("2026");
  assert.equal(amount(await p.locator("#totalSales").textContent()),1300);
  await p.locator('[data-period=custom]').click();
  await p.locator("#startDate").fill("2026-11-26");
  await p.locator("#endDate").fill("2026-11-25");
  await p.locator('[data-sales-report-range-state=invalid]').waitFor();
  assert.equal(await p.locator("#totalSales").count(),0,
   "invalid range must not fabricate a 0 KPI");
  await p.locator("#startDate").fill("2026-11-25");
  await p.locator("#totalSales").waitFor();
  assert.equal(amount(await p.locator("#totalSales").textContent()),1300);
  // Corrupted financial record triggers a failed-read screen, not stale KPI.
  await orders.doc("sale-001").update({totalAmount:-25});
  await p.locator('[data-sales-report-read-state=failed]').waitFor({timeout:25000});
  assert.equal(await p.locator("#totalSales").count(),0);
  await orders.doc("sale-001").update({totalAmount:5});
  await p.locator("#totalSales").waitFor({timeout:25000});
  assert.equal(amount(await p.locator("#totalSales").textContent()),1300);
  const other=await signin(origin,browser,foreign);active.push(other.context);
  await other.page.waitForURL("**/admin/sales-report",{timeout:25000});
  await other.page.locator("#totalSales").waitFor({timeout:25000});
  assert.equal(amount(await other.page.locator("#totalSales").textContent()),0);
  assert.equal(await other.page.locator("#receiptRows tr").count(),1);
  const c=await signin(origin,browser,cashier);active.push(c.context);
  await c.page.waitForURL(url=>url.pathname!=="/admin/sales-report"&&url.pathname!=="/login",{timeout:25000});
  assert.equal(await c.page.locator("#totalSales").count(),0);
  assert.deepEqual(o.errors,[]);
  assert.deepEqual(other.errors,[]);
  assert.deepEqual(c.errors,[]);
 }finally{
  await Promise.all(active.map(ctx=>ctx.close()));
  await browser.close();await app.close();
 }
});
