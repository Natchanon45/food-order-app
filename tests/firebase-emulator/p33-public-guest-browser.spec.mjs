import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {resolve} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid" ||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8189" ||
 process.env.VITE_USE_FIREBASE_EMULATORS!=="true" ||
 process.env.VITE_HYBRID_DEMO_PAYMENT_E2E!=="true" ||
 process.env.VITE_DEMO_FIRESTORE_EMULATOR_PORT!=="8189")
 throw Error("P33_FIREBASE_GUEST_DEMO_ONLY");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),id=randomUUID().slice(0,9);
const tenantId="p33-guest-"+id,slug="p33-guest-"+id,tableToken="p33-table-token-"+id;
const shop=db.collection("tenants").doc(tenantId);
const validTakeaway={
 customerName:"Guest",customerPhone:"0800000000",totalAmount:65,
 subtotalAmount:65,items:[{menuId:"meal",name:"Soup",price:65,qty:1}],
};
async function attachBridge(page,origin){
 await page.addScriptTag({type:"module",url:origin+"/src/dev-test-bridge/p33-public-guest.js"});
 await page.waitForFunction(()=>typeof window.__p33Guest==="function");
}
async function guest(page,slug,kind,order){
 return page.evaluate(data=>window.__p33Guest(data),{slug,kind,order});
}
async function denied(page,args,unsafe=false){
 return page.evaluate(async({args,unsafe})=>{
  try{
   if(unsafe)await window.__p33GuestUnsafe(args);
   else await window.__p33Guest(args);
   return {ok:true};
  }catch(e){return {ok:false,code:e.code||"",message:e.message||""};}
 },{args,unsafe});
}
test("P3.3 real guest Chrome and Firebase rules: Takeaway/Table open, replay and suspended refuse, public URL and table revocation",{
 timeout:140000,
},async()=>{
 const batch=db.batch();
 batch.set(shop,{
  id:tenantId,slug,name:"P33 Test Kitchen",businessType:"restaurant_cafe",
  active:true,subscriptionStatus:"active",businessUnits:["order_delivery"],
  subscriptionExpiresAt:"2028-11-25T00:00:00Z",
 });
 batch.set(shop.collection("settings").doc("store"),{
  shopName:"P33 Test Kitchen",deliveryManualStatus:{mode:"open"},
  deliveryPromptPayEnabled:true,deliveryCodEnabled:false,
 });
 batch.set(shop.collection("menus").doc("meal"),{
  id:"meal",name:"Soup",price:65,active:true,category:"Meal",
 });
 batch.set(shop.collection("tables").doc("T01"),{
  id:"T01",code:"T01",name:"Table 1",active:true,status:"occupied",
  orderToken:tableToken,currentRound:0,orderIds:[],
 });
 await batch.commit();
 const vite=await createServer({configFile:false,root:resolve("react-app"),
  plugins:[react()],resolve:{alias:[{find:"@",replacement:resolve("react-app/src")}]},
  publicDir:resolve("public"),server:{host:"127.0.0.1",port:0},clearScreen:false});
 await vite.listen();
 const origin="http://127.0.0.1:"+vite.httpServer.address().port;
 const browser=await chromium.launch({channel:"chrome",headless:true});
 const contexts=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:950},reducedMotion:"reduce"});
  contexts.push(context);
  const page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?
    r.continue():r.abort());
  await page.goto(origin+"/s/"+slug+"/takeaway");
  await page.locator(".store-branded-hero").waitFor({timeout:30000});
  await page.locator(".delivery-pos").waitFor({timeout:15000});
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:970});
   const hero=await page.locator(".store-branded-hero").boundingBox();
   assert.ok(hero && hero.width>180,"Takeaway branded hero renders "+width);
  }
  await attachBridge(page,origin);
  const orderId="p33takeaway"+id;
  const response=await guest(page,slug,"takeaway",{...validTakeaway,id:orderId,
   paymentStatus:"paid",status:"paid"});
  assert.equal(response.id,orderId);
  const created=(await shop.collection("orders").doc(orderId).get()).data();
  assert.equal(created.paymentStatus,"unpaid","Forged public paid flags never authorize a paid receipt");
  assert.equal(created.status,"pending");
  const repeat=await guest(page,slug,"takeaway",{...validTakeaway,id:orderId,
   totalAmount:1,items:[{menuId:"meal",name:"Soup",qty:1,price:1}]});
  assert.equal(repeat.alreadyRecorded,true,
   "A lost response with the same actual menu/quantity is safely idempotent despite browser-tampered price");
  const different=await denied(page,{slug,kind:"takeaway",order:{...validTakeaway,id:orderId,
   totalAmount:1,items:[{menuId:"meal",name:"Soup",qty:2,price:1}]}});
  assert.equal(different.ok,false,"A different cart cannot overwrite a previously saved Takeaway bill");
  assert.equal((await shop.collection("orders").doc(orderId).get()).data().totalAmount,65);
  const tId="p33table"+id;
  const table=await guest(page,slug,"table",{
   id:tId,tableCode:"T01",tableToken,items:validTakeaway.items,totalAmount:65,
   paymentStatus:"paid",status:"paid",
  });
  assert.equal(table.id,tId);
  const tableSaved=(await shop.collection("orders").doc(tId).get()).data();
  assert.equal(tableSaved.roundNumber,1);
  assert.equal(tableSaved.status,"pending");
  assert.equal(tableSaved.paymentStatus,"unpaid",
   "A guest can never forge a paid Table order");
  const reTable=await guest(page,slug,"table",{
   id:tId,tableCode:"T01",tableToken,items:validTakeaway.items,totalAmount:1,
   paymentStatus:"paid",status:"paid",
  });
  assert.equal(reTable.alreadyRecorded,true,
   "Same Table request safely repeats with no new round, ignoring forged browser total/payment");
  const modifiedTable=await denied(page,{slug,kind:"table",order:{
   id:tId,tableCode:"T01",tableToken,
   items:[{menuId:"meal",qty:2,price:1,name:"forged"}],totalAmount:1,
   paymentStatus:"paid",status:"paid",
  }});
  assert.equal(modifiedTable.ok,false,"Modified Table cart cannot overwrite the original bill");
  assert.equal((await shop.collection("tables").doc("T01").get()).data().currentRound,1);
  const forged=await denied(page,{
   tenantId,id:"p33forged"+id,order:{
    id:"p33forged"+id,tenantId,shopId:tenantId,orderType:"takeaway",
    status:"pending",paymentStatus:"paid",items:validTakeaway.items,
    totalAmount:1,customerName:"Guest",queueNo:"FORGED",pickupStatus:"waiting",
   },
  },true);
  assert.equal(forged.ok,false,
   "Unauthenticated guest cannot bypass canonical menu/total/payment via direct Firestore");
  await shop.update({revenueShareSuspended:true});
  await page.locator("[data-public-store-access-suspended]").waitFor({timeout:12000});
  const blocked=await denied(page,{slug,kind:"takeaway",order:{
   ...validTakeaway,id:"p33blocked"+id,
  }});
  assert.equal(blocked.ok,false,"Suspended Tenant cannot accept new public Takeaway");
  const suspendedDirect=await denied(page,{
   tenantId,id:"p33direct"+id,order:{
    id:"p33direct"+id,tenantId,shopId:tenantId,orderType:"table",
    tableCode:"T01",tableToken,items:validTakeaway.items,totalAmount:65,
    status:"pending",paymentStatus:"unpaid",
   },
  },true);
  assert.equal(suspendedDirect.ok,false,"Suspended tenant cannot be written from public browser");
  await shop.update({revenueShareSuspended:false});
  await page.locator(".delivery-pos").waitFor({timeout:12000});
  await page.goto(origin+"/s/"+slug+"/order?table=T01&token="+tableToken);
  await page.locator(".store-branded-hero").waitFor({timeout:15000});
  await page.getByText("Table 1").first().waitFor({timeout:15000});
  await shop.collection("tables").doc("T01").update({orderToken:"rotated-new-session"});
  await page.waitForFunction(()=>!document.querySelector(".cart-bar button:not([disabled])"),
    {timeout:15000});
  const stale=await denied(page,{slug,kind:"table",order:{
   id:"p33stale"+id,tableCode:"T01",tableToken,items:validTakeaway.items,totalAmount:65,
   status:"pending",paymentStatus:"unpaid",
  }});
  assert.equal(stale.ok,false,"Source table session revocation blocked by current Firestore data");
  assert.deepEqual(errors,[]);
 }catch(err){console.error("P33_GUEST_BROWSER_DIAG",err?.stack||String(err));throw err;}
 finally{
  await Promise.allSettled(contexts.map(ctx=>ctx.close()));
  await browser.close();await vite.close();
 }
});
