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
 throw Error("P15_SIGNED_BROWSER_REQUIRES_ISOLATED_DEMO_EMULATORS");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),nativeAuth=getAuth();
const suffix=randomUUID().slice(0,8),uid="p15-super-"+suffix;
const email="p15-super-"+suffix+"@example.test",password="EmulatorOnlyPassword1234!";
const receiverRef=db.collection("platformPrivateSettings").doc("receiptReceiver");
const legacyRef=db.collection("platformPrivateSettings").doc("slipVerification");
const priceRef=db.collection("platformSettings").doc("subscriptionPricing");

async function waitDocument(ref,predicate){
 for(let i=0;i<80;i++){
  const data=(await ref.get()).data();
  if(predicate(data))return data;
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 assert.fail("Canonical Firestore document was not confirmed");
}
test("P1 new Source signed Chrome: retired quota, disabled collection rail, central receiver with PromptPay and immutable legacy",{
 timeout:135000,
},async()=>{
 await Promise.all([
  nativeAuth.createUser({uid,email,password,emailVerified:true}),
  db.collection("users").doc(uid).set({uid,email,role:"super_admin",active:true}),
  priceRef.set({
   monthlyPrice:620,deliveryThreshold:10000,deliveryShareRate:5,
   monthlySlipQuota:135,annualMonths:12,discountType:"amount",
   discountValue:1180,vatMode:"inclusive",vatRate:7,
   deliveryThresholdVersions:[],
  }),
  legacyRef.set({
   provider:"google_vision",slip2GoSecret:"legacy-dummy-secret-not-for-use",
   receiverAccountType:"01004",receiverAccountNumber:"1234567890",
   receiverNameTh:"ผู้รับเดิม",receiverNameEn:"Old Receiver",
  }),
 ]);
 const originalLegacy=(await legacyRef.get()).data();
 const app=await createServer({
  configFile:false,root:resolve("react-app"),plugins:[react()],
  resolve:{alias:[{find:"@",replacement:resolve("react-app/src")}]},
  publicDir:resolve("public"),
  server:{host:"127.0.0.1",port:0},clearScreen:false,
 });
 await app.listen();
 const origin="http://127.0.0.1:"+app.httpServer.address().port;
 const browser=await chromium.launch({channel:"chrome",headless:true});
 const context=await browser.newContext({viewport:{width:390,height:950},
  reducedMotion:"reduce"});
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",err=>errors.push(String(err)));
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?
   route.continue():route.abort());
 try{
  await page.goto(origin+"/login?next="+encodeURIComponent("/platform/pricing"));
  await page.locator("#email").waitFor({timeout:20000});
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#loginForm button[type=submit]").click();
  await page.waitForURL("**/platform/pricing",{timeout:30000});
  await page.locator("#pricingMonthlyPrice").waitFor({timeout:20000});
  assert.equal(await page.locator("#pricingMonthlySlipQuota").count(),0,
   "Latest Source retired the old Slip2Go quota editor");
  await page.locator("#pricingReset").click();
  await page.locator("#pricingSave").click();
  const newPrice=await waitDocument(priceRef,r=>r?.monthlyPrice===590);
  assert.equal(newPrice.monthlySlipQuota,135,"Retired quota remains immutable on Premium reset");
  assert.equal(newPrice.deliveryThreshold,10000);
  await page.locator("#platformCollectionSettings").waitFor({timeout:15000});
  assert.equal(await page.locator("#platformCollectionSettings").getAttribute("data-collection-readonly"),"true");
  assert.equal(await page.locator("input[name=platformCollectionMethod]:disabled").count(),2);
  assert.equal(await page.getByRole("button",{name:"บันทึกช่องทางรับเงิน"}).isDisabled(),true);
  assert.equal((await receiverRef.get()).exists,false);

  await page.goto(origin+"/platform#platformReceiverSettings");
  await page.locator("#platformReceiptRecipientForm").waitFor({timeout:30000});
  await page.locator("#platformReceiptReceiverAccountNumber").waitFor();
  assert.equal(await page.locator("#platformReceiptReceiverAccountNumber").inputValue(),"1234567890");
  assert.equal(await page.locator("#platformSlipVerificationForm").count(),0);
  assert.equal(await page.locator("#testPlatformSlip2GoButton").count(),0);
  assert.equal(await page.locator("#platformSlip2GoSecret").count(),0);
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:950});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=3,"receiver page overflows "+width+"px by "+overflow);
  }
  await page.setViewportSize({width:390,height:950});
  await page.locator("#platformReceiptReceiverAccountNumber").fill("2233445566");
  await page.locator("#platformReceiptReceiverNameTH").fill("บริษัทตรวจสอบ");
  await page.locator("#platformReceiptPromptPayType").selectOption("phone");
  await page.locator("#platformReceiptPromptPayId").fill("0812345678");
  await page.locator("#savePlatformReceiptRecipientButton").click();
  await page.locator("#sweetDialogConfirm").click();
  const saved=await waitDocument(receiverRef,r=>r?.revision===1);
  assert.equal(saved.receiver.accountNumber,"2233445566");
  assert.equal(saved.receiver.promptPayType,"phone");
  assert.equal(saved.receiver.promptPayId,"0812345678");
  assert.equal(saved.updatedBy,uid);
  assert.deepEqual((await legacyRef.get()).data(),originalLegacy,
   "Old Slip2Go config is never overwritten by the central receiver");
  assert.equal((await priceRef.get()).data().monthlySlipQuota,135);
  await page.reload();
  await page.locator("#platformReceiptReceiverAccountNumber").waitFor({timeout:30000});
  assert.equal(await page.locator("#platformReceiptReceiverAccountNumber").inputValue(),"2233445566");
  assert.equal(await page.locator("#platformReceiptPromptPayId").inputValue(),"0812345678");
  assert.deepEqual(errors,[]);
 }finally{await context.close();await browser.close();await app.close();}
});
