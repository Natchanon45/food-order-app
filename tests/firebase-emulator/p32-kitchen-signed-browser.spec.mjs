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
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid" ||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8189" ||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099" ||
 process.env.VITE_USE_FIREBASE_EMULATORS!=="true" ||
 process.env.VITE_HYBRID_DEMO_PAYMENT_E2E!=="true" ||
 process.env.VITE_DEMO_FIRESTORE_EMULATOR_PORT!=="8189" ||
 process.env.FUNCTIONS_EMULATOR!=="true")
 throw Error("P32_SIGNED_DEMO_EMULATOR_ONLY");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),adminAuth=getAuth(),id=randomUUID().slice(0,10);
const tenantId="p32-kitchen-"+id,foreignId="p32-foreign-"+id;
const kitchenUid="p32-kitchen-user-"+id,ownerUid="p32-owner-"+id;
const foreignUid="p32-foreign-user-"+id,cashierUid="p32-cashier-"+id;
const password="P32LocalEmulatorOnly123!";
const shop=db.collection("tenants").doc(tenantId),orders=shop.collection("orders");
const cancellationTableToken="p32-cancel-table-"+id;
const order=(type,status,payment,extra={})=>({
 orderType:type,status,paymentStatus:payment,paymentMethod:"cash",tenantId,
 totalAmount:100,subtotalAmount:100,
 items:[{menuId:"menu-old",name:"Rice",price:100,qty:1,cancelled:false}],
 createdAt:"2026-11-25T09:00:00+07:00",...extra,
});
async function addUser(uid,tenant,role){
 const email=uid+"@example.test";
 await Promise.all([
  adminAuth.createUser({uid,email,password,emailVerified:true}),
  db.collection("users").doc(uid).set({uid,email,role,tenantId:tenant,
   active:true,businessUnits:["order_delivery"],emailVerificationRequired:false}),
 ]);
}
async function login(browser,origin,uid,role){
 const context=await browser.newContext({viewport:{width:390,height:940},
  reducedMotion:"reduce"});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?
  route.continue():route.abort());
 const home=role==="cashier"?"cashier":"kitchen";
 await page.goto(origin+"/login?next=%2F"+home);
 await page.locator("#email").waitFor({timeout:25000});
 await page.locator("#email").fill(uid+"@example.test");
 await page.locator("#password").fill(password);
 await page.locator("#loginForm button[type=submit]").click();
 await page.waitForURL("**/"+home,{timeout:25000});
 await page.addScriptTag({type:"module",url:origin+"/src/dev-test-bridge/p32-signed-kitchen.js"});
 await page.waitForFunction(()=>typeof window.__p32SignedKitchen==="function");
 return {page,context,errors};
}
const op=name=>"p32-"+name+"-"+id;
const req=(orderId,action,revision,status,paymentStatus,options={})=>({
 tenantId,orderId,action,operationId:op(action+"-"+orderId+"-"+revision),
 expectedRevision:revision,expectedStatus:status,expectedPaymentStatus:paymentStatus,
 ...options,
});
const signed=(page,args)=>page.evaluate(data=>window.__p32SignedKitchen(data),args);
const denied=(page,args,direct=false)=>page.evaluate(async data=>{
 try{
  if(data.direct)await window.__p32DirectKitchenWrite(data.input);
  else await window.__p32SignedKitchen(data.input);
  return {ok:true};
 }catch(e){return {ok:false,code:e.code||"",message:e.message||"",
  details:e.details||{}};}
},{input:args,direct});
test("P3.2 signed Kitchen Firebase: CAS, real menu price, paid ledger, courier reservation, role & tenant, browser widths",{
 timeout:180000,
},async()=>{
 await Promise.all([
  addUser(kitchenUid,tenantId,"kitchen"),
  addUser(ownerUid,tenantId,"owner"),
  addUser(foreignUid,foreignId,"kitchen"),
  addUser(cashierUid,tenantId,"cashier"),
  shop.set({id:tenantId,slug:"p32-"+id,name:"P32 Restaurant",
   businessUnits:["order_delivery"],active:true,subscriptionStatus:"active",
   subscriptionExpiresAt:"2028-11-25T00:00:00Z"}),
  db.collection("tenants").doc(foreignId).set({
   id:foreignId,slug:"p32-foreign-"+id,name:"Foreign Restaurant",
   businessUnits:["order_delivery"],active:true,subscriptionStatus:"active",
   subscriptionExpiresAt:"2028-11-25T00:00:00Z"}),
 ]);
 const batch=db.batch();
 for(const [id,price] of [["menu-old",100],["menu-new",70]])
  batch.set(shop.collection("menus").doc(id),
   {name:id==="menu-old"?"Rice":"Soup",price,active:true});
 const fixtures={
  "cancel-table":order("table","pending","unpaid",
   {tableCode:"T03",tableToken:cancellationTableToken}),
  "paid-table":order("table","pending","paid",
   {tableCode:"T01",tableToken:"p32-table-"+id,paidAt:"2026-11-25T10:00:00+07:00"}),
  "unpaid-table":order("table","accepted","unpaid",
   {tableCode:"T02",tableToken:"p32-unpaid-"+id}),
  "paid-delivery":order("delivery","accepted","paid",
   {totalAmount:250,subtotalAmount:200,deliveryFee:50,
    deliveryProvider:"self",paymentMethod:"promptpay",
    paidAt:"2026-11-25T10:10:00+07:00",recipientName:"Customer",
    recipientPhone:"0800000000",deliveryAddress:"Test Address",
    billNo:"B261125-00040"}),
  "cancel-paid-takeaway":order("takeaway","accepted","paid",
   {paidAt:"2026-11-25T10:30:00+07:00",billNo:"B261125-00041"}),
  "courier-cancelled":order("delivery","pending","paid",
   {deliveryProvider:"lalamove",lalamoveOrderId:"confirmed-rejected-job",
    lalamoveOrderStatus:"CANCELED",billNo:"B261125-00043"}),
  "courier-reserved":order("delivery","ready","paid",
   {deliveryProvider:"lalamove",lalamoveDispatchReservation:{id:"reserved-before-post"},
    recipientName:"Courier",billNo:"B261125-00042"}),
  "unverified-slip":order("delivery","pending","pending_verification",
   {deliveryProvider:"lalamove",paymentMethod:"promptpay",
    paymentSlipPath:"tenants/"+tenantId+"/slips/synthetic.png"}),
  "cod-disabled":order("delivery","pending","unpaid",
   {deliveryProvider:"lalamove",paymentMethod:"cod"}),
 };
 for(const [key,row] of Object.entries(fixtures))batch.set(orders.doc(key),row);
 batch.set(shop.collection("tables").doc("T03"),{
  code:"T03",name:"Table 3",active:true,status:"occupied",
  orderToken:cancellationTableToken,currentRound:1,
  orderIds:["cancel-table"],sessionStartedAt:"2026-11-25T09:00:00+07:00",
 });
 await batch.commit();
 const app=await createServer({configFile:false,root:resolve("react-app"),
  plugins:[react()],resolve:{alias:[{find:"@",replacement:resolve("react-app/src")}]},
  publicDir:resolve("public"),server:{host:"127.0.0.1",port:0},clearScreen:false});
 await app.listen();
 const origin="http://127.0.0.1:"+app.httpServer.address().port;
 const browser=await chromium.launch({channel:"chrome",headless:true});
 const contexts=[];
 try{
  const k=await login(browser,origin,kitchenUid,"kitchen");
  contexts.push(k.context);
  const page=k.page;
  await page.locator('[data-telegram-order-id="paid-delivery"]').waitFor({timeout:30000});
  assert.equal(await page.locator('[data-telegram-order-id="paid-delivery"] .delivery-staff-bill').count(),1);
  assert.equal(await page.locator('[data-cancel-order="courier-reserved"]').count(),0);
  assert.equal(await page.locator('[data-telegram-order-id="cod-disabled"]').count(),0);
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   const card=await page.locator('[data-telegram-order-id="paid-delivery"]').boundingBox();
   const heading=await page.locator('[data-telegram-order-id="paid-delivery"] .delivery-staff-heading').boundingBox();
   assert.ok(card&&heading&&heading.x>=card.x-3&&
    heading.x+heading.width<=card.x+card.width+3,"Source Kitchen delivery header fits "+width);
  }
  const noDirect=await denied(page,{tenantId,orderId:"paid-table",patch:{status:"cancelled"}},true);
  assert.equal(noDirect.ok,false,"Kitchen-only staff must not update order from browser");
  const bank=await denied(page,req("unverified-slip","status",0,"pending",
   "pending_verification",{status:"accepted"}));
  assert.equal(bank.ok,false,"Bank slip awaiting confirmation never admits cooking");
  const cod=await denied(page,req("cod-disabled","status",0,"pending","unpaid",{status:"accepted"}));
  assert.equal(cod.ok,false,"Disabled COD cannot admit kitchen");
  const courier=await denied(page,req("courier-reserved","cancel_order",0,"ready","paid"));
  assert.equal(courier.ok,false,"Firebase reserve-before-provider-POST blocks cancellation");
  const first=req("paid-table","status",0,"pending","paid",{status:"accepted"});
  const accepted=await signed(page,first);
  assert.equal(accepted.item.status,"accepted");
  assert.equal(accepted.item.kitchenRevision,1);
  const replay=await signed(page,first);
  assert.equal(replay.alreadyRecorded,true);
  const stale=await denied(page,req("paid-table","status",0,"pending","paid",{status:"accepted",
   operationId:op("different-request")}));
  assert.equal(stale.ok,false,"CAS blocks stale independent Kitchen request");
  for(const [revision,before,status] of [[1,"accepted","cooking"],[2,"cooking","ready"]]){
   const row=await signed(page,req("paid-table","status",revision,before,"paid",{status}));
   assert.equal(row.item.status,status);
  }
  const served=await signed(page,req("paid-table","serve_item",3,"ready","paid",{index:0}));
  assert.equal(served.item.status,"paid");
  assert.equal(served.item.items[0].served,true);
  assert.equal((await orders.doc("paid-table").get()).data().paidAt,"2026-11-25T10:00:00+07:00");
  const edit=await signed(page,req("unpaid-table","edit_item",0,"accepted","unpaid",
   {index:0,menuId:"menu-new",qty:1,note:"Customer requested soup",price:0}));
  assert.equal(edit.item.totalAmount,70,"Server uses tenant menu's canonical price not browser price");
  assert.equal(edit.item.originalTotalAmount,100);
  assert.equal(edit.item.items[0].originalLineTotal,100);
  const wrongPaidSnapshot=await denied(page,req("unpaid-table","status",1,
   "accepted","paid",{status:"cooking"}));
  assert.equal(wrongPaidSnapshot.ok,false,
   "Old cashier payment view cannot advance a newly unpaid kitchen order");
  const noNote=await denied(page,req("unpaid-table","edit_item",1,
   "accepted","unpaid",{index:0,menuId:"menu-old",qty:3,note:""}));
  assert.equal(noNote.ok,false,"Changed menu/quantity requires a signed reason");
  const paidEdit=await signed(page,req("paid-delivery","edit_item",0,"accepted","paid",
   {index:0,menuId:"menu-new",qty:1,note:"Change to soup"}));
  assert.equal(paidEdit.item.totalAmount,250,"Signed paid amount never overwritten by Kitchen edit");
  assert.equal(paidEdit.item.paymentStatus,"paid");
  assert.equal(paidEdit.item.kitchenFinanceReviewRequired,true);
  assert.equal(paidEdit.item.kitchenRevisedTotals.totalAmount,120);
  await page.locator('[data-telegram-order-id="paid-delivery"] .kitchen-finance-review')
   .waitFor({timeout:15000});
  const cancelledPaid=await signed(page,req("cancel-paid-takeaway","cancel_order",0,"accepted","paid"));
  assert.equal(cancelledPaid.item.status,"cancelled");
  assert.equal(cancelledPaid.item.totalAmount,100);
  assert.equal(cancelledPaid.item.paymentStatus,"paid");
  assert.equal(cancelledPaid.item.kitchenFinanceReviewRequired,true);
  const safeRetry=await signed(page,req("courier-cancelled","status",0,
   "pending","paid",{status:"accepted"}));
  assert.equal(safeRetry.item.status,"accepted",
   "A definitively cancelled courier job permits normal Kitchen progression");
  const kitchenAudit=await shop.collection("kitchenActionAudit").get();
  assert.equal(kitchenAudit.size,8,"Every successful kitchen mutation has an immutable signed audit");
  const tableCancelled=await signed(page,req(
   "cancel-table","cancel_order",0,"pending","unpaid"));
  assert.equal(tableCancelled.item.status,"cancelled");
  const tableSettlement=await page.evaluate(data=>window.__p32SignedTableSettlement(data),
   {tenantId,orderId:"cancel-table"});
  assert.equal(tableSettlement.closed,true,
   "A cancelled final Table round can release the Table through signed settlement");
  assert.equal((await shop.collection("tables").doc("T03").get()).data().status,
   "available","Table must not stay occupied after last round is cancelled");
  const foreign=await login(browser,origin,foreignUid,"kitchen");
  contexts.push(foreign.context);
  const cross=await denied(foreign.page,req("paid-table","cancel_order",4,"paid","paid"));
  assert.equal(cross.ok,false,"Another Kitchen Tenant cannot mutate current shop");
  const cashier=await login(browser,origin,cashierUid,"cashier");
  contexts.push(cashier.context);
  const cashierDeny=await denied(cashier.page,req("paid-delivery","cancel_order",1,"accepted","paid"));
  assert.equal(cashierDeny.ok,false,"Cashier cannot impersonate Kitchen financial edits");
  const owner=await login(browser,origin,ownerUid,"kitchen");
  contexts.push(owner.context);
  const own=await signed(owner.page,req("unpaid-table","status",1,"accepted","unpaid",{status:"cooking"}));
  assert.equal(own.item.status,"cooking");
  await shop.update({subscriptionStatus:"suspended"});
  const suspended=await denied(page,req("paid-delivery","status",1,"accepted","paid",
   {status:"cooking"}));
  assert.equal(suspended.ok,false,"Suspended Tenant cannot make new Kitchen mutations");
  await shop.update({subscriptionStatus:"active"});
  for(const session of [k,foreign,cashier,owner])assert.deepEqual(session.errors,[]);
 }catch(error){
  console.error("P32_BROWSER_DIAG",error?.stack||String(error));
  throw error;
 }finally{
  await Promise.allSettled(contexts.map(x=>x.close()));
  await browser.close();await app.close();
 }
});
