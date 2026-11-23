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
const {getFirestore}=require("firebase-admin/firestore");

if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8189"||
 process.env.VITE_USE_FIREBASE_EMULATORS!=="true"||
 process.env.VITE_HYBRID_DEMO_PAYMENT_E2E!=="true"||
 process.env.VITE_DEMO_FIRESTORE_EMULATOR_PORT!=="8189"||
 process.env.FUNCTIONS_EMULATOR!=="true")
 throw Error("P14_BROWSER_REQUIRES_LOCAL_DEMO_FIREBASE_EMULATORS_ONLY");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),nativeAuth=getAuth(),suffix=randomUUID().slice(0,8);
const superId="p14-super-"+suffix,ownerId="p14-owner-"+suffix,tenantId="p14-shop-"+suffix;
const email="p14-super-"+suffix+"@example.test",ownerEmail="p14-owner-"+suffix+"@example.test";
const password="EmulatorOnlyPassword1234!";
const targetId="ff897699-de82-4370-a360-35b22cc74c85";
const priceRef=db.collection("platformSettings").doc("subscriptionPricing");
const basePricing={
 planId:"premium",currency:"THB",monthlyPrice:590,deliveryThreshold:10000,
 deliveryShareRate:5,monthlySlipQuota:100,annualMonths:12,
 discountType:"amount",discountValue:1180,vatMode:"inclusive",vatRate:7,
 deliveryThresholdVersions:[],
};
async function seed(){
 await Promise.all([
 nativeAuth.createUser({uid:superId,email,password,emailVerified:true}),
 nativeAuth.createUser({uid:ownerId,email:ownerEmail,password,emailVerified:true}),
 db.collection("users").doc(superId).set({uid:superId,email,role:"super_admin",active:true}),
 db.collection("users").doc(ownerId).set({
  uid:ownerId,email:ownerEmail,role:"owner",tenantId,active:true,
 }),
 db.collection("tenants").doc(tenantId).set({
  id:tenantId,slug:"p14-"+suffix,name:"Local P14 test",active:true,
  businessType:"both",businessUnits:["retail_pos","order_delivery"],
  firstActivatedAt:"2026-10-18",trialEndsAt:"2026-11-17",
  subscriptionExpiresAt:"2027-11-17",unpaidInvoiceCents:43210,
 }),
 priceRef.set(basePricing),
 ]);
}
async function newPage(browser,origin,width=390){
 const context=await browser.newContext({viewport:{width,height:950},reducedMotion:"reduce"});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",error=>errors.push(String(error)));
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?
  route.continue():route.abort());
 return {context,page,errors,origin};
}
async function signIn(session,actorEmail,next){
 await session.page.goto(session.origin+"/login?next="+encodeURIComponent(next));
 await session.page.locator("#email").waitFor({timeout:20_000});
 await session.page.locator("#email").fill(actorEmail);
 await session.page.locator("#password").fill(password);
 await session.page.locator("#loginForm button[type=submit]").click();
}
async function waitDocument(ref,predicate){
 let result;
 for(let i=0;i<80;i++){
  result=(await ref.get()).data();
  if(predicate(result))return result;
  await new Promise(done=>setTimeout(done,130));
 }
 assert.fail("Timed out waiting for canonical Firestore document: "+
  JSON.stringify({monthlyPrice:result?.monthlyPrice,deliveryThreshold:result?.deliveryThreshold}));
}
test("P1.4 actual signed Chrome: Superadmin pricing save/preview, immutable baseline, SaaS inspection-only, Owner denied",{
 timeout:110_000,
},async()=>{
 await seed();
 const originalTenant=(await db.collection("tenants").doc(tenantId).get()).data();
 const vite=await createServer({configFile:false,root:resolve("react-app"),
  plugins:[react()],resolve:{alias:[{find:"@",replacement:resolve("react-app/src")}]},
  publicDir:resolve("public"),server:{host:"127.0.0.1",port:0},clearScreen:false});
 let browser;
 await vite.listen();
 const origin="http://127.0.0.1:"+vite.httpServer.address().port;
 try{
  browser=await chromium.launch({channel:"chrome",headless:true});
  const superadmin=await newPage(browser,origin,390);
  try{
   await signIn(superadmin,email,"/platform/pricing");
   await superadmin.page.waitForURL("**/platform/pricing",{timeout:30_000});
   await superadmin.page.locator("#pricingMonthlyPrice").waitFor();
   await superadmin.page.locator("#deliveryThresholdBaselineAmount").waitFor();
   assert.equal(await superadmin.page.locator("#pricingMonthlyPrice").inputValue(),"590");
   assert.equal(await superadmin.page.locator("#pricingDeliveryThreshold").inputValue(),"10000");
   assert.equal(await superadmin.page.locator("#pricingDeliveryThreshold").getAttribute("readonly"),"");
   assert.equal(await superadmin.page.locator("#pricingDeliveryThreshold").getAttribute("aria-readonly"),"true");
   assert.equal(await superadmin.page.locator("#deliveryThresholdBaselineAmount").inputValue(),"10000");
   assert.equal(await superadmin.page.locator("#saveScheduledDeliveryThreshold").isDisabled(),true);
   assert.equal(await superadmin.page.locator("#platformThresholdSchedule").isVisible(),true);
   // Test the actual React page and CSS, not a simplified pricing fixture.
   for(const width of [320,390,768,1440]){
    await superadmin.page.setViewportSize({width,height:950});
    const geometry=await superadmin.page.evaluate(()=>{
     const card=document.querySelector(".platform-pricing-form-card").getBoundingClientRect();
     const preview=document.querySelector(".platform-pricing-preview-card").getBoundingClientRect();
     return {overflow:document.documentElement.scrollWidth-innerWidth,
       cardWidth:card.width,previewWidth:preview.width,
       cardBottom:card.bottom,previewTop:preview.top,
       cardTop:card.top};
    });
    assert.ok(geometry.overflow<=2,width+"px actual pricing horizontal overflow "+geometry.overflow);
    assert.ok(geometry.cardWidth>0&&geometry.previewWidth>0,width+"px cards missing");
    if(width<=840)assert.ok(geometry.previewTop>=geometry.cardBottom-1,
      width+"px preview overlaps settings");
    else assert.ok(Math.abs(geometry.cardTop-geometry.previewTop)<=2,
      width+"px settings and preview not horizontally aligned");
   }
   await superadmin.page.setViewportSize({width:390,height:950});
   await superadmin.page.locator("#pricingMonthlyPrice").fill("650");
   await superadmin.page.locator("#pricingMonthlyPrice").dispatchEvent("input");
   await superadmin.page.locator("#pricingSave").click();
   const saved=await waitDocument(priceRef,data=>data?.monthlyPrice===650);
   assert.equal(saved.deliveryThreshold,10000,"Pricing edits may not rewrite immutable Delivery cap");
   assert.deepEqual(saved.deliveryThresholdVersions,[]);
   assert.equal(saved.monthlySlipQuota,100);
   await superadmin.page.goto(origin+"/platform/pricing");
   await superadmin.page.locator("#pricingMonthlyPrice").waitFor({timeout:30_000});
   assert.equal(await superadmin.page.locator("#pricingMonthlyPrice").inputValue(),"650");

   // P1.4 financial safety: deliberately discard the *successful* HTTPS
   // response AFTER the Firebase Callable has committed. Browser must lock
   // further writes until an independent refresh confirms canonical state.
   let lostReplies=0;
   const lostReplyRoute=async route=>{
    if(route.request().method()!=="POST")return route.continue();
    const committed=await route.fetch();
    assert.equal(committed.ok(),true,"Server must have committed before losing reply");
    lostReplies++;
    await route.abort("failed");
   };
   await superadmin.page.route("**/updateSubscriptionPricing",lostReplyRoute);
   await superadmin.page.locator("#pricingMonthlyPrice").fill("700");
   await superadmin.page.locator("#pricingSave").click();
   const afterLostReply=await waitDocument(priceRef,data=>data?.monthlyPrice===700);
   assert.equal(afterLostReply.deliveryThreshold,10000);
   await superadmin.page.getByText("ไม่สามารถยืนยันราคาที่บันทึกกับ Firebase ได้",{
    exact:false,
   }).waitFor({timeout:15_000});
   assert.equal(await superadmin.page.locator("#pricingSave").isDisabled(),true,
    "Never allow duplicate save after a lost response");
   assert.equal(lostReplies,1,"No automatic duplicate Pricing request is allowed");
   await superadmin.page.unroute("**/updateSubscriptionPricing",lostReplyRoute);
   await superadmin.page.reload();
   await superadmin.page.locator("#pricingMonthlyPrice").waitFor({timeout:30_000});
   assert.equal(await superadmin.page.locator("#pricingMonthlyPrice").inputValue(),"700",
    "Fresh independent read confirms the original committed state");
   assert.equal(await superadmin.page.locator("#pricingSave").isDisabled(),false,
    "A new page read may release the old ambiguous-operation lock");

   await superadmin.page.goto(origin+"/super-admin/saas-setup");
   await superadmin.page.locator("#startMigration").waitFor({timeout:30_000});
   for(const width of [320,390,768,1440]){
    await superadmin.page.setViewportSize({width,height:950});
    const overflow=await superadmin.page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,width+"px actual SaaS inspection horizontal overflow "+overflow);
   }
   await superadmin.page.setViewportSize({width:390,height:950});
   assert.equal(await superadmin.page.locator("#startMigration").isDisabled(),true);
   assert.equal(await superadmin.page.locator("#overwriteData").count(),0);
   assert.equal(await superadmin.page.locator("#menuCount").innerText(),"-");
   assert.equal(await superadmin.page.locator("#settingCount").innerText(),"-");
   assert.equal(await superadmin.page.locator("#saasInspectionNotice").isVisible(),true);
   assert.equal((await db.collection("tenants").doc(targetId).get()).exists,false);

   const targetRef=db.collection("tenants").doc(targetId);
   await targetRef.set({id:targetId,slug:"tuahere-somtam",name:"Target inspection",
    active:false,firstActivatedAt:"2026-08-01",invoiceUnpaidCents:9000});
   await targetRef.collection("menus").doc("p14-demo-"+suffix).set({name:"QA menu"});
   await targetRef.collection("settings").doc("store").set({businessType:"restaurant_cafe"});
   await superadmin.page.locator("#refreshMigration").click();
   await superadmin.page.getByText("1 รายการ").waitFor({timeout:15_000});
   assert.equal(await superadmin.page.locator("#startMigration").isDisabled(),true);
   assert.equal(await superadmin.page.locator("#tableCount").innerText(),"0 โต๊ะ");
   assert.equal((await targetRef.get()).data().invoiceUnpaidCents,9000);
   assert.deepEqual(superadmin.errors,[]);
  }finally{await superadmin.context.close();}
  const owner=await newPage(browser,origin,390);
  try{
   await signIn(owner,ownerEmail,"/platform/pricing");
   await owner.page.waitForURL(url=>url.pathname!=="/login"&&
    url.pathname!=="/platform/pricing",{timeout:25_000});
   await owner.page.goto(origin+"/super-admin/saas-setup");
   await owner.page.waitForURL(url=>url.pathname==="/",{timeout:25_000});
   assert.equal(await owner.page.locator("#startMigration").count(),0);
   assert.equal(await owner.page.locator("#pricingSave").count(),0);
   assert.deepEqual(owner.errors,[]);
  }finally{await owner.context.close();}
  assert.deepEqual((await db.collection("tenants").doc(tenantId).get()).data(),originalTenant,
   "Pricing edits or SaaS inspection must not change subscription dates or invoices");
 }finally{
  if(browser)await browser.close();
  await vite.close();
 }
});
