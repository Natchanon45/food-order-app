import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID,randomBytes,createHash} from "node:crypto";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,getApps}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8189"||
 process.env.VITE_USE_FIREBASE_EMULATORS!=="true"||
 process.env.VITE_HYBRID_DEMO_PAYMENT_E2E!=="true"||
 process.env.VITE_DEMO_FIRESTORE_EMULATOR_PORT!=="8189")
 throw Error("P34_CORRECTION_DEMO_ONLY");
if(!getApps().length)initializeApp({
 projectId:"demo-penguin-hybrid",storageBucket:"demo-penguin-hybrid.appspot.com",
});
const db=getFirestore(),nonce=randomUUID().slice(0,9);
const tenantId="p34-tenant-"+nonce,orderId="p34-order-"+nonce;
const secret=randomBytes(32).toString("hex");
const orderRef=db.collection("tenants").doc(tenantId).collection("orders").doc(orderId);
const credentialKey="penguin:delivery:correction:v1:"+tenantId+":"+orderId;
const samplePng=Buffer.from(
 "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Z9ox/0AAAAASUVORK5CYII=",
 "base64");
test("P3.4 real anonymous Chrome customer original bill correction, Firebase Storage and signed transaction",{
 timeout:170000,
},async()=>{
 await db.collection("tenants").doc(tenantId).set({
  id:tenantId,slug:tenantId,name:"P34 Demo Shop",active:true,
  businessType:"restaurant_cafe",subscriptionStatus:"active",
  businessUnits:["order_delivery"],
 });
 await orderRef.set({
  id:orderId,tenantId,shopId:tenantId,orderType:"delivery",
  paymentMethod:"promptpay",paymentStatus:"pending_verification",
  status:"pending",slipCheckStatus:"manual_review",
  totalAmount:150,subtotalAmount:120,deliveryFee:30,
  customerCorrectionCapabilityDigest:createHash("sha256").update(secret).digest("hex"),
  paymentCorrectionRevision:0,paymentSlipPath:"",
  createdAt:FieldValue.serverTimestamp(),
 });
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p34-correction-fixture-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<style>body{font:14px Arial,sans-serif;margin:0}</style></head><body><div id="root"></div>'+
   '<script type="module" src="/src/dev-test-bridge/p34-delivery-correction-preview.jsx"></script></body></html>');
  server=await createServer({configFile:false,root,plugins:[react()],
   resolve:{alias:[{find:"@",replacement:resolve(root,"src")}]},
   publicDir:resolve("public"),server:{host:"127.0.0.1",port:0},clearScreen:false});
  await server.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const ctx=await browser.newContext({viewport:{width:390,height:950},reducedMotion:"reduce"});
  const page=await ctx.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(({tenantId,orderId,secret,key})=>{
   window.__p34Fixture={tenantId,orderId};
   try{sessionStorage.setItem(key,secret);}catch{}
  },{tenantId,orderId,secret,key:credentialKey});
  await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?
   r.continue():r.abort());
  await page.goto("http://127.0.0.1:"+server.httpServer.address().port+
   "/"+basename(dir)+"/index.html",{waitUntil:"domcontentloaded"});
  const panel=page.locator('[data-customer-correction="available"]');
  await panel.waitFor({timeout:30000});
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:960});
   assert.ok((await panel.boundingBox())?.width>170);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2));
  }
  const allowed=await page.evaluate(({tenantId,orderId,secret})=>
   window.__p34CorrectionTest.state({tenantId,orderId,capability:secret}),
   {tenantId,orderId,secret});
  assert.equal(allowed.ownershipVerified,true);
  assert.equal(allowed.canUploadNewSlip,true);
  assert.equal(allowed.canRequestCODReview,false);
  const wrong=await page.evaluate(async({tenantId,orderId})=>{
   try{
    await window.__p34CorrectionTest.state({
     tenantId,orderId,capability:"b".repeat(64)});
    return true;
   }catch{return false;}
  },{tenantId,orderId});
  assert.equal(wrong,false,"Without exact capability no public correction rights");
  await page.locator("#customerCorrectionSlip").setInputFiles({
   name:"original-bank-slip.png",mimeType:"image/png",buffer:samplePng,
  });
  await page.locator("#customerRetrySlipProgress").waitFor({timeout:12000});
  await page.getByRole("button",{name:"ส่งสลิปต้นฉบับให้ร้านตรวจสอบ"})
   .waitFor({timeout:22000});
  assert.equal(await page.getByRole("progressbar").getAttribute("aria-valuenow"),"100");
  assert.equal((await orderRef.get()).data().paymentSlipPath,"",
   "Staged Storage bytes alone cannot mutate customer payment or order");
  await page.getByRole("button",{name:"ส่งสลิปต้นฉบับให้ร้านตรวจสอบ"}).click();
  await page.getByText("รับสลิปต้นฉบับเพื่อรอเจ้าหน้าที่ตรวจสอบแล้ว ยังไม่ถือว่าชำระเงินสำเร็จ")
   .waitFor({timeout:30000});
  const saved=(await orderRef.get()).data();
  assert.equal(saved.paymentStatus,"pending_verification");
  assert.equal(saved.status,"pending");
  assert.equal(saved.slipCheckStatus,"manual_review");
  assert.equal(saved.paymentCorrectionRevision,1);
  assert.equal(saved.paymentReviewRequired,true);
  assert.ok(saved.paymentSlipPath.startsWith("tenants/"+tenantId+"/payment-slips/"+orderId+"/"));
  assert.ok(!JSON.stringify(saved).includes(secret),"Never store plain capability in public GET");
  assert.equal((await db.collection("tenants").doc(tenantId)
    .collection("deliveryPaymentCorrectionAudit").get()).size,1);
  assert.equal((await db.collection("deliveryCustomerCorrectionSlipHashes").get()).size,1);
  const replay=await page.evaluate(({tenantId,orderId,secret,slipPath})=>
   window.__p34CorrectionTest.submit({
    tenantId,orderId,capability:secret,slipPath,
   }),{tenantId,orderId,secret,slipPath:saved.paymentSlipPath});
  assert.equal(replay.alreadySubmitted,true,"Repeating same POST cannot duplicate review claim");
  const mismatch=await page.evaluate(async({tenantId,orderId,secret,slipPath})=>{
   try{
    await window.__p34CorrectionTest.submit({
     tenantId,orderId,capability:secret,slipPath:slipPath+"-invalid.jpg",
    });return true;
   }catch{return false;}
  },{tenantId,orderId,secret,slipPath:saved.paymentSlipPath});
  assert.equal(mismatch,false,"Wrong storage proof must never be accepted");
  assert.equal((await db.collection("tenants").doc(tenantId)
    .collection("deliveryPaymentCorrectionAudit").get()).size,1);
  await orderRef.update({paymentStatus:"paid",slipCheckStatus:"verified_by_provider"});
  const finished=await page.evaluate(({tenantId,orderId,secret})=>
   window.__p34CorrectionTest.state({tenantId,orderId,capability:secret}),
   {tenantId,orderId,secret});
  assert.equal(finished.canUploadNewSlip,false,"Paid order never accepts fresh correction");
  assert.equal((await orderRef.get()).data().paymentStatus,"paid");
  assert.deepEqual(errors,[]);
  await ctx.close();
 }catch(error){
  console.error("P34_CORRECTION_BROWSER_DIAG",error?.stack||String(error));
  throw error;
 }finally{
  await browser?.close();await server?.close();
  await rm(dir,{recursive:true,force:true});
 }
});

test("P3.4 real public callable refuses missing or forged checkout evidence and keeps technical fallback unpaid", {timeout:30000},async()=>{
 const shop=db.collection("tenants").doc(tenantId+"-intake");
 const id="p34-intake-"+nonce;
 const ref=shop.collection("orders").doc(id);
 const proofRef=shop.collection("deliverySlipChecks").doc(id);
 await shop.set({active:true,businessType:"restaurant_cafe",subscriptionStatus:"active"});
 await shop.collection("settings").doc("store").set({deliveryPromptPayEnabled:true});
 const order={id,orderType:"delivery",status:"pending",paymentStatus:"paid",
  recipientName:"Demo",recipientPhone:"0800000000",deliveryAddress:"Demo only",
  deliveryProvider:"self",deliveryLatitude:13.75,deliveryLongitude:100.5,
  paymentMethod:"promptpay",slipCheckStatus:"manual_review",paymentReviewRequired:false,
  paymentSlipPath:"tenants/"+shop.id+"/payment-slips/"+id+"/demo.png",
  items:[{menuId:"demo-menu",name:"Demo",price:120,qty:1}],
  subtotalAmount:120,deliveryFee:30,totalAmount:150};
 const call=async payload=>{
  const response=await fetch("http://127.0.0.1:5001/demo-penguin-hybrid/asia-southeast1/submitPublicDeliveryOrder",
   {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:{tenantId:shop.id,order:payload}})});
  return {status:response.status,body:await response.json()};
 };
 const missing=await call(order);
 assert.equal(missing.body.error?.message,"DELIVERY_SLIP_PROOF_NOT_CONFIRMED");
 assert.equal((await ref.get()).exists,false);
 // Synthetic provider record exclusively in the isolated demo Emulator.
 const proof={tenantId:shop.id,orderId:id,status:"manual_review",provider:"slip2go",
  slipPath:order.paymentSlipPath,amountCents:15000,foodCents:12000,feeCents:3000,
  itemsSignature:JSON.stringify([{id:"demo-menu",qty:1,priceCents:12000}]),
  checkedAt:FieldValue.serverTimestamp(),providerAttempted:true,manualReviewEligible:true,
  manualReviewEvidence:{provider:"slip2go",status:"manual_review",reason:"slip2go_unavailable",fallbackAllowed:true}};
 await proofRef.set({...proof,amountCents:14900});
 assert.equal((await call(order)).body.error?.message,"DELIVERY_SLIP_PROOF_NOT_CONFIRMED");
 assert.equal((await ref.get()).exists,false);
 await proofRef.set(proof);
 assert.equal((await call({...order,slipCheckStatus:"matched"})).body.error?.message,"DELIVERY_SLIP_PROOF_NOT_CONFIRMED");
 assert.equal((await ref.get()).exists,false);
 const accepted=await call(order);
 assert.equal(accepted.status,200,JSON.stringify(accepted.body));
 const saved=(await ref.get()).data();
 assert.equal(saved.paymentStatus,"pending_verification");
 assert.equal(saved.paymentReviewRequired,true);
 assert.equal(saved.slipCheckStatus,"manual_review");
 assert.equal(saved.kitchenReleasedAt,undefined);
 assert.match(accepted.body.result.paymentCorrectionCapability,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(saved).includes(accepted.body.result.paymentCorrectionCapability));
});
