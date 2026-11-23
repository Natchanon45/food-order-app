import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {resolve} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import {createRequire} from "node:module";
import {initializeApp as clientInit,deleteApp} from "firebase/app";
import {getAuth as clientGetAuth,connectAuthEmulator,applyActionCode} from "firebase/auth";

const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {getApps,initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore}=require("firebase-admin/firestore");

// No real providers or external email can be used by this runner.
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
  process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"||
  process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8189"||
  process.env.FUNCTIONS_EMULATOR!=="true"||
  process.env.VITE_USE_FIREBASE_EMULATORS!=="true"||
  process.env.VITE_HYBRID_DEMO_PAYMENT_E2E!=="true"||
  process.env.VITE_DEMO_FIRESTORE_EMULATOR_PORT!=="8189")
 throw Error("P13F_BROWSER_UAT_REQUIRES_EXPLICIT_LOOPBACK_DEMO_EMULATORS");

if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const auth=getAuth(),db=getFirestore(),suffix=randomUUID().slice(0,8);
const tenantId="p13f-shop-"+suffix;
const accountPassword="EmulatorOnlyPwd-2026-"+suffix;
const identities={
 superadmin:{uid:"p13f-super-"+suffix,email:"qa-super-"+suffix+"@example.test",
  role:"super_admin",verified:true,managed:false},
 owner:{uid:"p13f-owner-"+suffix,email:"qa-owner-"+suffix+"@example.test",
  role:"owner",verified:false,managed:true},
 cashier:{uid:"p13f-cashier-"+suffix,email:"qa-cashier-"+suffix+"@example.test",
  role:"cashier",verified:false,managed:true},
};
const SAMPLE_INVOICE_CENTS=54321;

async function seed(){
 await db.collection("tenants").doc(tenantId).set({
  id:tenantId,slug:"qa-"+suffix,name:"P1.3 QA Sandbox",
  ownerUid:identities.owner.uid,active:true,onboardingRequired:false,
  businessType:"both",businessUnits:["order_delivery","retail_pos"],
  subscriptionStatus:"active",planCode:"yearly",
  firstActivatedAt:"2026-10-18T00:00:00.000Z",
  trialStartsAt:"2026-10-18T00:00:00.000Z",
  trialEndsAt:"2026-11-17T00:00:00.000Z",
  subscriptionExpiresAt:"2027-11-17T00:00:00.000Z",
  m7InvoiceUnpaidCents:SAMPLE_INVOICE_CENTS,
 });
 await db.collection("platformSettings").doc("publicContact").set({
  enabled:true,heading:"Sandbox Support",description:"Emulator only",
  emailEnabled:true,emailLabel:"QA mail",email:"test@example.test",
  phoneEnabled:false,lineEnabled:false,messengerEnabled:false,
 });
 await db.collection("platformSettings").doc("googleCustomerLogin").set({
  enabled:false,clientId:"",tokenTtlDays:30,
 });
 for(const actor of Object.values(identities)){
  await auth.createUser({uid:actor.uid,email:actor.email,
   displayName:"QA "+actor.role,password:accountPassword,
   disabled:false,emailVerified:actor.verified});
  const data={uid:actor.uid,email:actor.email,displayName:"QA "+actor.role,
   role:actor.role,active:true,
   ...(actor.role==="super_admin"?{}:{
    tenantId,tenantSlug:"qa-"+suffix,tenantName:"P1.3 QA Sandbox",
    businessScope:"both",businessUnit:"both",
    ...(actor.managed?{emailVerificationRequired:true}:{})
   })};
  await db.collection("users").doc(actor.uid).set(data);
  if(actor.role!=="super_admin")
   await db.collection("tenants").doc(tenantId).collection("memberships")
    .doc(actor.uid).set(data);
 }
}

async function createRealBrowser(){
 const projectRoot=resolve("react-app");
 const vite=await createServer({
  configFile:false,root:projectRoot,plugins:[react()],
  resolve:{alias:[{find:"@",replacement:resolve(projectRoot,"src")}]},
  publicDir:resolve("public"),
  server:{host:"127.0.0.1",port:0,strictPort:false},
  clearScreen:false,
 });
 await vite.listen();
 const browser=await chromium.launch({channel:"chrome",headless:true});
 const origin="http://127.0.0.1:"+vite.httpServer.address().port;
 return {vite,browser,origin};
}

async function emulatedEmailCodes(email,requestType="VERIFY_EMAIL"){
 const endpoint="http://127.0.0.1:9099/emulator/v1/projects/demo-penguin-hybrid/oobCodes";
 const result=await fetch(endpoint);
 assert.equal(result.ok,true,"Only local Auth Emulator OOB codes may be consumed");
 const payload=await result.json();
 return (payload.oobCodes||[]).filter(row=>row.email===email&&
   row.requestType===requestType);
}
async function redeemLocalVerification(code){
 const app=clientInit({projectId:"demo-penguin-hybrid",
  apiKey:"demo-api-key",authDomain:"demo-penguin-hybrid.firebaseapp.com",
  appId:"1:123:web:"+randomUUID()},
  "p13f-action-redeemer-"+randomUUID());
 try{
  const signed=clientGetAuth(app);
  connectAuthEmulator(signed,"http://127.0.0.1:9099",{disableWarnings:true});
  await applyActionCode(signed,code);
 }finally{await deleteApp(app);}
}

async function pageFor(browser,origin,{width=1280,height=900}={}){
 const ctx=await browser.newContext({viewport:{width,height},reducedMotion:"reduce"});
 const page=await ctx.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 await page.route("**/*",route=>{
  const url=new URL(route.request().url());
  // No DNS/external provider, no mail or production Firebase, no third-party CDN.
  if(url.hostname==="127.0.0.1")return route.continue();
  return route.abort();
 });
 return {page,ctx,errors,origin};
}

async function logIn({page,origin},actor,next){
 await page.goto(origin+"/login?next="+encodeURIComponent(next));
 await page.locator("#email").waitFor({timeout:20_000});
 await page.locator("#email").fill(actor.email);
 await page.locator("#password").fill(accountPassword);
 await page.locator("#loginForm button[type=submit]").click();
}

test("real full PENGUIN React browser: Superadmin Contact & Google, Owner and Cashier verification, tenant billing immutable",{
 timeout:115_000,
},async()=>{
 await seed();
 const original=(await db.collection("tenants").doc(tenantId).get()).data();
 const {vite,browser,origin}=await createRealBrowser();
 try{
  const admin=await pageFor(browser,origin,{width:1280});
  try{
   await logIn(admin,identities.superadmin,"/platform/contact");
   await admin.page.waitForURL("**/platform/contact",{timeout:30_000});
   await admin.page.locator("#platformContactPublicTitle").waitFor({timeout:30_000});
   await admin.page.locator('[aria-controls="platformContactPublicPanel"]').click();
   await admin.page.locator("#contactHeading").waitFor();
   assert.equal(await admin.page.locator("#contactHeading").inputValue(),"Sandbox Support");
   await admin.page.locator("#contactHeading").fill("Emulator QA Saved Contact");
   await admin.page.locator("#saveContactButton").click();
   let saved=null;
   for(let attempt=0;attempt<60;attempt++){
    saved=(await db.collection("platformSettings").doc("publicContact").get()).data();
    if(saved?.heading==="Emulator QA Saved Contact")break;
    await new Promise(resolve=>setTimeout(resolve,150));
   }
   const view=await admin.page.locator("#contactFormStatus").evaluate(el=>({
    message:el.textContent,type:el.getAttribute("data-type"),
   }));
   assert.equal(saved.heading,"Emulator QA Saved Contact",
    "Contact real browser save not committed; visible UI status: "+JSON.stringify(view));
   await admin.page.locator('[aria-controls="platformContactGooglePanel"]').click();
   await admin.page.locator("#googleCustomerClientId").waitFor();
   assert.equal(await admin.page.locator("#googleCustomerLoginEnabled").isChecked(),false);
   const google=(await db.collection("platformSettings").doc("googleCustomerLogin").get()).data();
   assert.equal(google.enabled,false);
   await admin.page.locator("#googleCustomerTokenTtlDays").fill("14");
   await admin.page.locator("#saveGoogleLoginSettings").click();
   let googleSaved=null;
   for(let attempt=0;attempt<60;attempt++){
    googleSaved=(await db.collection("platformSettings").doc("googleCustomerLogin").get()).data();
    if(googleSaved?.tokenTtlDays===14)break;
    await new Promise(resolve=>setTimeout(resolve,150));
   }
   assert.equal(googleSaved?.tokenTtlDays,14,
    "Google customer config must have an independent Firestore read-after-write");
   assert.equal(googleSaved?.enabled,false,"Sandbox must never enable Google provider");
   // LK Shop remains disabled in the demo: no QR capability or device pairing.
   assert.equal(await admin.page.locator('#platformContactLKShopPanel').isHidden(),true);
   await admin.page.locator('[aria-controls="platformContactLKShopPanel"]').click();
   await admin.page.locator("#platformLKShopPairing").waitFor();
   await admin.page.getByText("ระบบจับคู่ LK Shop ของ Firebase ยังไม่ได้เปิดทดสอบ").waitFor({
    timeout:15_000,
   });
   assert.equal(await admin.page.locator("#platformLKShopPairing img").count(),0);
   assert.equal(await admin.page.locator("html").count(),1);
  }finally{await admin.ctx.close();}
  for(const role of ["owner","cashier"]){
   const candidate=await pageFor(browser,origin,{width:390,height:844});
   try{
    await logIn(candidate,identities[role],role==="owner"?"/admin/users":"/cashier");
    await candidate.page.waitForURL("**/verify-account",{timeout:30_000});
    await candidate.page.locator("[data-managed-email-verification]").waitFor();
    assert.equal(await candidate.page.locator("[data-send-account-verification]").isVisible(),true);
    const overflow=await candidate.page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,role+" verification page overflow "+overflow);
    await candidate.page.locator("[data-check-account-verification]").click();
    await candidate.page.getByText("ระบบยังไม่พบสถานะยืนยันอีเมลจาก Firebase",{exact:false}).waitFor();
    // Real browser button -> Firebase Auth Emulator OOB -> recipient redeems
    // one-time verification code -> browser refreshes its own native ID token.
    assert.equal((await emulatedEmailCodes(identities[role].email)).length,0);
    await candidate.page.locator("[data-send-account-verification]").click();
    await candidate.page.getByText("ส่งคำขอผ่าน Firebase Authentication แล้ว",{
      exact:false,
    }).waitFor();
    const codes=await emulatedEmailCodes(identities[role].email);
    assert.equal(codes.length,1,"Only one local provider code is generated on click");
    await redeemLocalVerification(codes[0].oobCode);
    assert.equal((await auth.getUser(identities[role].uid)).emailVerified,true);
    await candidate.page.locator("[data-check-account-verification]").click();
    await candidate.page.waitForURL(role==="owner"?"**/admin":"**/cashier",{timeout:35_000});
    assert.equal(await candidate.page.locator("[data-managed-email-verification]").count(),0);
    // The same Firebase session now has a refreshed native verified token.
    const own=await auth.getUser(identities[role].uid);
    assert.equal(own.emailVerified,true);
    if(role==="owner"){
     await candidate.page.goto(origin+"/admin/users");
     await candidate.page.locator("#openCreateUserModal").waitFor({timeout:25_000});
     await candidate.page.locator("#userCount").waitFor();
     assert.equal(await candidate.page.locator("[data-admin-users-tenant-error]").count(),0);
    }else{
     await candidate.page.goto(origin+"/platform/contact");
     await candidate.page.waitForURL(url=>url.pathname==="/",{timeout:20_000});
     assert.equal(await candidate.page.locator("#platformContactPublicTitle").count(),0,
      "Cashier may not see Superadmin platform settings");
    }
   }finally{await candidate.ctx.close();}
  }
  const after=(await db.collection("tenants").doc(tenantId).get()).data();
  assert.deepEqual(after,original,"Auth/Contact actions may not touch first trial, expiry or invoices");
 }finally{await browser.close();await vite.close();}
});
