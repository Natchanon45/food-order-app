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
 process.env.FUNCTIONS_EMULATOR!=="true")
 throw Error("P16_SIGNED_CHROME_REQUIRES_ISOLATED_DEMO_EMULATORS");
if(!getApps().length)initializeApp({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),auth=getAuth();
const id=randomUUID().slice(0,8),uid="p16-browser-super-"+id;
const email="p16-browser-"+id+"@example.test",password="EmulatorOnlyPassword1234!";
const tenantId=randomUUID(),name="P16 Test Wallet "+id,tenant=db.collection("tenants").doc(tenantId);
const walletRef=tenant.collection("settings").doc("lalamoveWallet");
const topups=tenant.collection("lalamoveWalletTopups");
const proof={provider:"slip2go",status:"manual_review",reason:"slip2go_bank_error",
 code:"200502",fallbackAllowed:true,amountMatched:null};
const row=(topupId,more={})=>({
 amount:500,currency:"THB",status:"pending",paymentChannel:"01004",
 verificationProvider:"slip2go",verificationStatus:"manual_review",
 ocr:proof,createdAt:Timestamp.fromDate(new Date("2026-11-24T09:00:00Z")),
 slip:{path:`tenants/${tenantId}/lalamove-wallet-topups/${topupId}/receipt.png`,mime:"image/png"},...more,
});
async function waitDoc(ref,condition){
 for(let n=0;n<70;n++){
  const r=(await ref.get()).data();
  if(condition(r))return r;
  await new Promise(resolve=>setTimeout(resolve,170));
 }
 assert.fail("Wallet canonical write did not appear");
}
test("P1.5 Source unified Wallet signed Chrome: 4 widths, safe approval/rejection, independent Sandbox",{
 timeout:170000,
},async()=>{
 await auth.createUser({uid,email,password,emailVerified:true});
 await Promise.all([
  db.collection("users").doc(uid).set({uid,email,displayName:"P16 Superadmin",
   role:"super_admin",active:true}),
  tenant.set({id:tenantId,name,slug:"p16-wallet-"+id,active:true,businessType:"both",
   firstActivatedAt:"2026-10-18T03:00:00Z",
   subscriptionExpiresAt:"2027-11-17T16:59:59Z",
   planCode:"yearly",billingMode:"subscription",revenueShareEnabled:false,
   lalamove:{accountMode:"fod_central",fodCentralApproved:true}}),
  tenant.collection("settings").doc("lalamove").set({accountMode:"fod_central",fodCentralApproved:true}),
  walletRef.set({balance:75,currency:"THB"}),
  topups.doc("p16-browser-technical").set(row("p16-browser-technical")),
  topups.doc("p16-browser-appeal").set(row("p16-browser-appeal",{
    verificationStatus:"appeal_pending",
  })),
  topups.doc("p16-browser-mismatch").set(row("p16-browser-mismatch",{
    verificationStatus:"mismatch",
    ocr:{...proof,status:"mismatch",reason:"amount_not_matched",
      code:"200402",fallbackAllowed:false,amountMatched:false},
  })),
 ]);
 const app=await createServer({configFile:false,root:resolve("react-app"),
  plugins:[react()],resolve:{alias:[{find:"@",replacement:resolve("react-app/src")}]},
  publicDir:resolve("public"),server:{host:"127.0.0.1",port:0},clearScreen:false});
 await app.listen();
 const origin="http://127.0.0.1:"+app.httpServer.address().port;
 const browser=await chromium.launch({channel:"chrome",headless:true});
 const context=await browser.newContext({viewport:{width:390,height:950},reducedMotion:"reduce"});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?
  route.continue():route.abort());
 try{
  await page.goto(origin+"/login?next="+encodeURIComponent("/admin/tenants"));
  await page.locator("#email").waitFor({timeout:20000});
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#loginForm button[type=submit]").click();
  await page.waitForURL("**/admin/tenants",{timeout:30000});
  const card=page.locator(`[data-tenant-control="${tenantId}"]`);
  await card.waitFor({timeout:30000});
  await card.locator(".tenant-control-expand-btn").click();
  await card.getByRole("button",{name:"Lalamove Wallet"}).click();
  const dialog=page.locator("#lalamoveWalletDialog");
  try{await dialog.waitFor({state:"visible",timeout:10000});}
  catch(error){
    const diag=await page.evaluate(()=>({
      url:location.href,
      dialogs:[...document.querySelectorAll("dialog")].map(x=>({
        id:x.id,open:x.open,display:getComputedStyle(x).display,
        hasParent:!!x.parentElement,
      })),
      walletNode:!!document.getElementById("lalamoveWalletDialog"),
      panelCount:document.querySelectorAll("[data-tenant-control]").length,
      alertTexts:[...document.querySelectorAll("[role=alert]")].slice(0,5).map(e=>e.textContent.slice(0,150)),
      walletButtons:[...document.querySelectorAll("button")].filter(e=>e.textContent.includes("Lalamove Wallet")).map(e=>({outer:e.outerHTML.slice(0,250)})),
    }));
    console.error("P16_BROWSER_DIAG",JSON.stringify({diag,errors}));
    throw error;
  }
  await dialog.locator('[data-wallet-topup-approve="p16-browser-technical"]').waitFor({timeout:20000});
  assert.equal(await dialog.locator('[data-wallet-topup-approve="p16-browser-appeal"]').count(),0);
  assert.equal(await dialog.locator('[data-wallet-topup-approve="p16-browser-mismatch"]').count(),0);
  assert.equal(await dialog.locator('[data-wallet-topup-reject="p16-browser-appeal"]').count(),1);
  assert.equal(await dialog.locator(".tenant-wallet-sandbox-separate").count(),1);
  assert.equal(await dialog.locator(".wallet-history-channel").count(),3);
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:950});
   const overflow=await dialog.evaluate(el=>Math.max(0,
    el.getBoundingClientRect().right-window.innerWidth));
   assert.ok(overflow<=3,`Wallet dialog escapes viewport width ${width} by ${overflow}`);
  }
  await page.setViewportSize({width:390,height:950});
  await dialog.locator('[data-wallet-topup-approve="p16-browser-technical"]').click();
  await page.locator("#sweetDialogConfirm").click();
  await waitDoc(topups.doc("p16-browser-technical"),row=>row?.status==="approved");
  assert.equal((await walletRef.get()).data().balance,575);
  await dialog.locator('[data-wallet-topup-reject="p16-browser-mismatch"]').waitFor({timeout:20000});
  await dialog.locator('[data-wallet-topup-reject="p16-browser-mismatch"]').click();
  await page.locator("#sweetDialogInput").fill("Wrong amount and recipient");
  await page.locator("#sweetDialogConfirm").click();
  await waitDoc(topups.doc("p16-browser-mismatch"),row=>row?.status==="rejected");
  assert.equal((await walletRef.get()).data().balance,575);
  await dialog.locator("[data-wallet-refresh]").click();
  await dialog.locator('[data-wallet-topup-reject="p16-browser-appeal"]').waitFor({timeout:20000});
  assert.equal((await walletRef.get()).data().balance,575);
  await dialog.getByText("Stripe Sandbox — เครดิตทดสอบแยกบัญชี").waitFor({timeout:20000});
  assert.equal(errors.length,0,`Unexpected browser errors: ${errors.join("; ")}`);
 }finally{await context.close();await browser.close();await app.close();}
});
