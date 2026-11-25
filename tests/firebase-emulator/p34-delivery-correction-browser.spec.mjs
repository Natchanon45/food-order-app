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

test("P3.4 notification-first demo creates only canonical unpaid order without slip", {timeout:40000},async()=>{
 const tenant="p34-notify-"+nonce,id="p34-notify-order-"+nonce,menuId="p34-notify-menu-"+nonce;
 const shop=db.collection("tenants").doc(tenant);
 const ref=shop.collection("orders").doc(id);
 await shop.set({active:true,businessType:"restaurant_cafe",subscriptionStatus:"active",businessUnits:["order_delivery"]});
 await shop.collection("settings").doc("store").set({
  deliveryProvider:"self",deliveryPromptPayEnabled:true,storeLatitude:13.75,storeLongitude:100.5,
  bankName:"SCB",bankAccountName:"DEMO ONLY",bankAccountNumber:"0000000000",promptPayId:"0800000000",
  deliveryFeeOptions:[{id:"nearby",label:"Near",fee:30,maxDistanceKm:5}]
 });
 await shop.collection("menus").doc(menuId).set({name:"Canonical Demo Food",price:120,active:true});
 const order={id,orderType:"delivery",paymentMethod:"promptpay",paymentStatus:"paid",status:"accepted",
  bankTransferReviewFlow:"notification_first",paymentRecipientId:"0800000000",
  recipientName:"Demo",recipientPhone:"0800000000",deliveryAddress:"Demo",
  deliveryProvider:"self",deliveryLatitude:13.76,deliveryLongitude:100.51,
  deliveryZone:"nearby",deliveryZoneLabel:"FORGED",deliveryBaseFee:30,deliveryFee:30,
  deliveryFeeDiscount:0,subtotalAmount:120,totalAmount:150,
  items:[{menuId,name:"FORGED",price:120,qty:1}],lalamoveCodEnabled:true};
 const call=async (name,data)=>{
  const response=await fetch("http://127.0.0.1:5001/demo-penguin-hybrid/asia-southeast1/"+name,
   {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data})});
  return {status:response.status,body:await response.json()};
 };
 const submit=(o=order,tenantId=tenant)=>call("submitPublicDeliveryOrder",{tenantId,order:o});
 assert.equal((await submit(order,"ordinary-demo-tenant")).body.error?.message,"DELIVERY_NOTIFICATION_DISABLED");
 assert.equal((await submit()).body.error?.message,"DELIVERY_NOTIFICATION_ROUTE_REQUIRED");
 assert.equal((await ref.get()).exists,false);
 const key=[tenant,"13.75000","100.50000","13.76000","100.51000"].join("_");
 await db.collection("deliveryRouteCache").doc(key).set({tenantId:tenant,
  origin:{latitude:13.75,longitude:100.5},destination:{latitude:13.76,longitude:100.51},
  distanceMeters:2000,duration:"300s",updatedAt:FieldValue.serverTimestamp()});
 assert.equal((await submit({...order,totalAmount:149})).body.error?.message,"DELIVERY_NOTIFICATION_TOTAL_CHANGED");
 assert.equal((await submit({...order,paymentRecipientId:"0899999999"})).body.error?.message,"DELIVERY_NOTIFICATION_RECEIVER_CHANGED");
 assert.equal((await ref.get()).exists,false);
 const accepted=await submit();
 assert.equal(accepted.status,200,JSON.stringify(accepted.body));
 const receipt=accepted.body.result, saved=(await ref.get()).data();
 assert.equal(receipt.bankTransferReviewFlow,"notification_first");
 assert.equal(saved.paymentStatus,"pending_verification");
 assert.equal(saved.status,"pending");
 assert.equal(saved.paymentSlipPath,"");
 assert.equal(saved.items[0].name,"Canonical Demo Food");
 assert.equal(saved.deliveryZoneLabel,"Near");
 assert.equal(saved.lalamoveCodEnabled,undefined);
 assert.equal(saved.kitchenReleasedAt,undefined);
 assert.match(receipt.paymentCorrectionCapability,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(saved).includes(receipt.paymentCorrectionCapability));
 const rights=await call("getPublicDeliveryCorrectionState",{tenantId:tenant,orderId:id,capability:receipt.paymentCorrectionCapability});
 assert.equal(rights.body.result?.canUploadNewSlip,true);
 assert.equal(rights.body.result?.paymentVerified,false);
 assert.equal((await submit()).body.error?.message,"DELIVERY_ORDER_ALREADY_EXISTS");
 assert.equal((await ref.get()).data().paymentStatus,"pending_verification");
});

test("P3.4 demo bank evidence transaction records one receipt and global reference without payment mutation", {timeout:30000},async()=>{
 const {generateKeyPairSync,sign}=await import("node:crypto");
 const {VERSION,PROVIDER,bytes,accountFingerprint}=require("./delivery-bank-reconcile-policy");
 const {__test:{record}}=require("./delivery-bank-reconcile");
 const {receiverRevision,receiverState}=require("./payment-companion-receiver");
 const {fingerprint,flags}=require("./delivery-notification-match-policy");
 const {digest}=require("./payment-companion-policy");
 const tenantId="p34-notify-bank-"+nonce,orderId="p34-bank-order-"+nonce;
 const tenant=db.collection("tenants").doc(tenantId),root=db.collection("paymentCompanionTenants").doc(tenantId);
 const settings=tenant.collection("settings").doc("store"),orderRef=tenant.collection("orders").doc(orderId);
 const now=Date.now(),created=now-120000,iso=ms=>new Date(ms).toISOString();
 await tenant.set({active:true,businessType:"restaurant_cafe",subscriptionStatus:"active"});
 await settings.set({bankName:"SCB",bankAccountName:"DEMO ONLY",bankAccountNumber:"0000000000",promptPayId:"0800000000"});
 const store=await settings.get(),revision=receiverRevision(store);
 const link={enabled:true,revision,bankCode:"scb",accountLast4:"0000",confirmedAtMs:created-1000};
 const deviceId="demo-bank-device-"+nonce,eventId=digest("demo-event-"+nonce),notificationId=digest(deviceId+":"+eventId);
 const notice={id:notificationId,eventId,deviceId,source:"line_scb_connect",receiverRevision:revision,receiverSuffix:"X-0000",
  verificationStatus:"unverified",amountSatang:15000,bankMs:created+10000,observedMs:created+11000,receivedMs:created+12000};
 const observationFingerprint=fingerprint(notice);
 const audit={tenantId,orderId,notificationId,amountSatang:15000,receiverRevision:revision,observationFingerprint,status:"recorded_unverified",...flags};
 const order={tenantId,orderType:"delivery",bankTransferReviewFlow:"notification_first",paymentMethod:"promptpay",
  paymentStatus:"pending_verification",status:"pending",totalAmount:150,paymentReceiverRevision:revision,
  paymentRecipientId:"0800000000",createdAt:new Date(created)};
 const {publicKey,privateKey}=generateKeyPairSync("ed25519"),keyId="demo-bank-key";
 const payload={tenantId,orderId,notificationId,receiverRevision:revision,accountFingerprint:accountFingerprint(store,receiverState(store,link,true)),
  transactionReference:"demo-bank-reference-"+nonce,amountSatang:15000,currency:"THB",direction:"credit",postingStatus:"posted",postedAt:iso(notice.bankMs)};
 const envelope={version:VERSION,providerId:PROVIDER,keyId,payload};
 envelope.signatureBase64=sign(null,bytes(envelope),privateKey).toString("base64");
 const evidenceId=digest("demo-bank-evidence-"+nonce),referenceHash=digest(payload.transactionReference);
 const receiptRef=root.collection("notificationFirstBankPreflights").doc(orderId);
 const referenceRef=db.collection("deliveryDemoBankReferenceClaims").doc(referenceHash);
 // Synthetic server-owned fixtures exclusively under this isolated demo runner.
 await Promise.all([orderRef.set(order),root.set({receiver:link}),root.collection("devices").doc(deviceId).set({enabled:true}),
  root.collection("notices").doc(notificationId).set(notice),root.collection("notificationFirstReviews").doc(orderId).set(audit),
  root.collection("reviewClaims").doc(notificationId).set({orderId,notificationId,flow:"notification_first"}),
  root.collection("notificationFirstObservationClaims").doc(observationFingerprint).set({orderId,notificationId}),
  db.collection("deliveryDemoBankEvidence").doc(evidenceId).set({tenantId,orderId,environment:"demo",envelope}),
  db.collection("deliveryDemoBankKeys").doc("registry").set({providers:{[PROVIDER]:{[keyId]:{
   enabled:true,publicKeyPem:publicKey.export({type:"spki",format:"pem"}),
   fingerprintSha256:createHash("sha256").update(publicKey.export({type:"spki",format:"der"})).digest("hex"),
   validFrom:iso(created-60000),validUntil:iso(now+3600000),revokedAt:null,registeredBy:"demo-registrar",reviewedBy:"demo-reviewer"}}}})]);
 const context={tenantId,tenant,root,uid:"demo-test-actor",role:"cashier"};
 const run=()=>db.runTransaction(tx=>record(db,tx,context,{orderId,evidenceId}));
 const results=await Promise.all([run(),run()]);
 assert.equal(results.filter(r=>r.alreadyRecorded===false).length,1);
 assert.equal(results.filter(r=>r.alreadyRecorded===true).length,1);
 for(const r of results){assert.equal(r.paymentVerified,false);assert.equal(r.settlementAllowed,false);}
 assert.equal((await receiptRef.get()).data().status,"demo_evidence_preflight_passed");
 assert.equal((await referenceRef.get()).data().orderId,orderId);
 assert.equal((await orderRef.get()).data().paymentStatus,"pending_verification");
 assert.equal((await orderRef.get()).data().kitchenReleasedAt,undefined);
 assert.equal((await db.collection("platformSlipUsedReferences").doc(referenceHash).get()).exists,false);
});
