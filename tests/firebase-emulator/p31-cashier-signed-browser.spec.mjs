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
const {getAuth}=require("firebase-admin/auth");
const {getFirestore}=require("firebase-admin/firestore");
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099" ||
  process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8189" ||
  process.env.VITE_USE_FIREBASE_EMULATORS!=="true" ||
  process.env.VITE_HYBRID_DEMO_PAYMENT_E2E!=="true" ||
  process.env.VITE_DEMO_FIRESTORE_EMULATOR_PORT!=="8189" ||
  process.env.FUNCTIONS_EMULATOR!=="true")
 throw Error("P31_SIGNED_FIREBASE_DEMO_ONLY");
if(!getApps().length)initializeApp({projectId:project});
const db=getFirestore(),adminAuth=getAuth(),id=randomUUID().slice(0,10);
const tenantId="p31-shop-"+id,otherTenantId="p31-other-"+id;
const ownerUid="p31-owner-"+id,otherUid="p31-foreign-"+id, kitchenUid="p31-kitchen-"+id;
const password="LocalCashierEmulatorOnly123!";
const shop=db.collection("tenants").doc(tenantId), orders=shop.collection("orders");
async function addUser(uid,tenant,role){
 const email=uid+"@example.test";
 await Promise.all([
  adminAuth.createUser({uid,email,password,emailVerified:true}),
  db.collection("users").doc(uid).set({uid,email,role,active:true,tenantId:tenant,
   businessUnits:["order_delivery"],emailVerificationRequired:false}),
 ]);
}
async function login(browser,origin,uid){
 const context=await browser.newContext({viewport:{width:390,height:950},
  reducedMotion:"reduce"});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?
   route.continue():route.abort());
 await page.goto(origin+"/login?next=%2Fcashier");
 await page.locator("#email").waitFor({timeout:25000});
 await page.locator("#email").fill(uid+"@example.test");
 await page.locator("#password").fill(password);
 await page.locator("#loginForm button[type=submit]").click();
 try {
  await page.waitForURL(uid===kitchenUid?"**/kitchen":"**/cashier",{timeout:15000});
 }catch(error){
  console.error("P31_BROWSER_DIAG",JSON.stringify({step:"login",
   url:page.url(),errors,body:(await page.locator("body").innerText()).slice(0,1000)}));
  throw error;
 }
 await page.addScriptTag({type:"module",url:origin+"/src/dev-test-bridge/p31-signed-callable.js"});
 await page.waitForFunction(()=>typeof window.__p31SignedCall==="function");
 return {page,context,errors};
}
async function signed(page,name,data){
 return page.evaluate(async ({name,data})=>window.__p31SignedCall(name,data),{name,data});
}
async function rejection(page,name,data){
 return page.evaluate(async({name,data})=>{
  try{await window.__p31SignedCall(name,data);return {ok:true};}
  catch(error){return {ok:false,code:error.code||"",message:error.message||"",
   details:error.details||{}};}
 },{name,data});
}
const order=(type,method,status="pending",extra={})=>({
 tenantId,orderType:type,paymentMethod:method,paymentStatus:"unpaid",
 status,totalAmount:120,items:[{name:"rice",qty:2,price:60}],
 createdAt:"2026-11-25T09:00:00+07:00",...extra,
});
const op=(s)=>"p31-"+s+"-"+id;
test("P3.1 native signed Firebase Callables: cash receipt idempotency, table atomicity, paid pickup, protected cancellation, tenant isolation, desktop/mobile source UI",{
 timeout:185000,
},async()=>{
 await Promise.all([
  addUser(ownerUid,tenantId,"owner"),
  addUser(otherUid,otherTenantId,"owner"),
  addUser(kitchenUid,tenantId,"kitchen"),
  shop.set({id:tenantId,slug:"p31-"+id,name:"P31 Shop",active:true,
   businessUnits:["order_delivery"],subscriptionStatus:"active",
   subscriptionExpiresAt:"2028-11-25T00:00:00Z"}),
  db.collection("tenants").doc(otherTenantId).set({
   id:otherTenantId,slug:"p31-foreign-"+id,name:"Other P31 Shop",
   active:true,businessUnits:["order_delivery"],subscriptionStatus:"active",
   subscriptionExpiresAt:"2028-11-25T00:00:00Z"}),
 ]);
 const batch=db.batch();
 const data={
  "cash-takeaway":order("takeaway","cash"),
  "paid-pickup":order("takeaway","cash","ready",
   {paymentStatus:"paid",billNo:"B261125-00021",pickupStatus:"ready"}),
  "unpaid-pickup":order("takeaway","cash","ready"),
  "cancel-eligible":order("takeaway","cash"),
  "cash-table-1":order("table","cash","pending",
   {tableToken:"p31-table-"+id,tableCode:"T01",totalAmount:60}),
  "cash-table-2":order("table","cash","pending",
   {tableToken:"p31-table-"+id,tableCode:"T01",totalAmount:40}),
  "promptpay":order("delivery","promptpay","pending",
   {bankTransferReviewFlow:"notification_first",paymentReviewRequired:true,
    paymentSlipPath:"tenants/"+tenantId+"/slips/test.png",billNo:"B261125-00022",
    deliveryProvider:"lalamove",recipientName:"Customer",recipientPhone:"0800000000",
    deliveryAddress:"Demo",deliveryZoneLabel:"Demo"}),
  "reserved-lalamove":order("delivery","cash","pending",{
    deliveryProvider:"lalamove",
    lalamoveDispatchReservation:{id:"provider-post-unknown",state:"reserved",
      quotationId:"q-test-only",startedAt:"2026-11-25T09:00:00+07:00"},
  }),
  "uncertain-lalamove":order("delivery","cash","pending",
   {deliveryProvider:"lalamove",billNo:"B261125-00023",
    lalamoveDispatchAttemptState:"confirmation_unknown",
    recipientName:"Customer",recipientPhone:"0800000000",deliveryAddress:"Demo"}),
  "cancel-kitchen":order("takeaway","cash","accepted",
   {items:[{name:"rice",served:false,cooking:true}]}),
 };
 for(const [key,row] of Object.entries(data))batch.set(orders.doc(key),row);
 await batch.commit();
 const app=await createServer({configFile:false,root:resolve("react-app"),
  plugins:[react()],resolve:{alias:[{find:"@",replacement:resolve("react-app/src")}]},
  publicDir:resolve("public"),server:{host:"127.0.0.1",port:0},clearScreen:false});
 await app.listen();
 const origin="http://127.0.0.1:"+app.httpServer.address().port;
 const browser=await chromium.launch({channel:"chrome",headless:true});
 const contexts=[];
 try{
  const session=await login(browser,origin,ownerUid);
  contexts.push(session.context);const page=session.page;
  try {
   await page.locator("[data-telegram-order-id]").first().waitFor({timeout:15000});
  }catch(error){
   console.error("P31_BROWSER_DIAG",JSON.stringify({step:"delivery-feed",
    url:page.url(),errors:session.errors,
    body:(await page.locator("body").innerText()).slice(0,1200)}));
   throw error;
  }
  assert.equal(await page.locator('[data-telegram-order-id="promptpay"] .delivery-staff-bill').count(),1,
   "Signed Source delivery heading shows bill/payment separately");
  assert.equal(await page.locator('[data-cancel-order="uncertain-lalamove"]').count(),0,
   "Unknown active courier job does not render whole-order cancel");
  assert.equal(await page.locator('[data-cancel-order="promptpay"]').count(),1,
   "Pending bank evidence cancellation is visible until signed backend rejection");
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   const h=await page.locator('[data-telegram-order-id="promptpay"] .delivery-staff-heading').boundingBox();
   const card=await page.locator('[data-telegram-order-id="promptpay"]').boundingBox();
   assert.ok(h&&card&&h.x>=card.x-3&&h.x+h.width<=card.x+card.width+3,
    "Staff delivery heading must fit card width "+width);
  }
  const base={tenantId,kind:"order",orderIds:["cash-takeaway"],operationId:op("cash-takeaway")};
  const denied=await rejection(page,"cashierRecordCashReceipt",
   {...base,orderIds:["promptpay"],operationId:op("bank")});
  assert.equal(denied.ok,false,"Unverified bank transfer may NOT be marked paid by Cashier");
  assert.equal((await orders.doc("promptpay").get()).data().paymentStatus,"unpaid");
  const beforePickup=await rejection(page,"cashierPickupAction",
   {tenantId,orderId:"unpaid-pickup",action:"handover"});
  assert.equal(beforePickup.ok,false,"Unpaid Takeaway cannot be handed over");
  const first=await signed(page,"cashierRecordCashReceipt",base);
  assert.equal(first.confirmed,true);
  assert.equal(first.alreadyRecorded,false);
  assert.equal((await orders.doc("cash-takeaway").get()).data().paymentStatus,"paid");
  const repeat=await signed(page,"cashierRecordCashReceipt",base);
  assert.equal(repeat.alreadyRecorded,true,"Uncertain cash receipt response is idempotent");
  const differentOp=await rejection(page,"cashierRecordCashReceipt",
   {...base,operationId:op("cash-double-attempt")});
  assert.equal(differentOp.ok,false,
   "A different operation ID cannot falsely confirm an already-paid cash order");
  assert.equal((await shop.collection("cashierActionAudit").where(
   "action","==","cashier_cash_physically_received").get()).size,1);
  const pickup=await signed(page,"cashierPickupAction",
   {tenantId,orderId:"paid-pickup",action:"handover"});
  assert.equal(pickup.item.pickupStatus,"picked_up");
  assert.equal(pickup.item.paymentStatus,"paid");
  assert.equal((await orders.doc("paid-pickup").get()).data().paymentStatus,"paid");
  const pickupRepeat=await signed(page,"cashierPickupAction",
   {tenantId,orderId:"paid-pickup",action:"handover"});
  assert.equal(pickupRepeat.alreadyCompleted,true);
  const partial=await rejection(page,"cashierRecordCashReceipt",
   {tenantId,kind:"table",orderIds:["cash-table-1"],operationId:op("partial-table")});
  assert.equal(partial.ok,false,"Cannot settle partial unpaid table rounds");
  assert.equal((await orders.doc("cash-table-1").get()).data().paymentStatus,"unpaid");
  const table=await signed(page,"cashierRecordCashReceipt",
   {tenantId,kind:"table",orderIds:["cash-table-1","cash-table-2"],operationId:op("table")});
  assert.equal(table.confirmed,true);
  assert.equal(table.total,100);
  assert.equal((await orders.doc("cash-table-2").get()).data().paymentStatus,"paid");
  for(const id of ["promptpay","uncertain-lalamove","reserved-lalamove","cash-table-1","paid-pickup","cancel-kitchen"]){
   const denied=await rejection(page,"cashierCancelOrderSafely",{tenantId,orderId:id});
   assert.equal(denied.ok,false,"Cannot cancel evidence, active provider, paid, or kitchen "+id);
  }
  const cancel=await signed(page,"cashierCancelOrderSafely",
   {tenantId,orderId:"cancel-eligible"});
  assert.equal(cancel.item.status,"cancelled");
  const cancelRepeat=await signed(page,"cashierCancelOrderSafely",
   {tenantId,orderId:"cancel-eligible"});
  assert.equal(cancelRepeat.alreadyCancelled,true);
  const foreign=await login(browser,origin,otherUid);
  contexts.push(foreign.context);
  const otherDenied=await rejection(foreign.page,"cashierRecordCashReceipt",
   {...base,operationId:op("other")});
  assert.equal(otherDenied.ok,false,"Foreign Owner may not receive another Tenant cash");
  const kitchen=await login(browser,origin,kitchenUid);
  contexts.push(kitchen.context);
  const kitchenDenied=await rejection(kitchen.page,"cashierCancelOrderSafely",
   {tenantId,orderId:"cancel-eligible"});
  assert.equal(kitchenDenied.ok,false,"Kitchen has no cashier financial rights");
  assert.deepEqual(session.errors,[]);
  assert.deepEqual(foreign.errors,[]);
  assert.deepEqual(kitchen.errors,[]);
 }finally{
  await Promise.allSettled(contexts.map(x=>x.close()));
  await browser.close();await app.close();
 }
});
