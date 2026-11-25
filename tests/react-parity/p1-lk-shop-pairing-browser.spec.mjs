import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("Source PG Notify room picker, QR, device revoke, platform isolation, mobile layout and blocked APK at four widths",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-lkshop-ui-fixture-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"functions.js"),`
   window.__lkCalls=[];
   window.__lkDevices=[{id:"kitchen-123456789",name:"Kitchen iPad",
    platform:"ios",pushReady:false,role:"kitchen_delivery",scope:"tenant",lastSeen:null}];
   window.__lkPilotEnabled=true;
   const make=(room,scope)=>({
    ok:true,purpose:room,scope,expiresInSeconds:300,
    qrPayload:"lkshop://pair?v=1&server="+encodeURIComponent("https://penguin-food.web.app")+
      "&code="+"a".repeat(64),mobileGoApiCompatible:false,appBuildVerified:false,
   });
   export const httpsCallable=(_,name)=>async data=>{
    window.__lkCalls.push({name,data});
    if(!window.__lkPilotEnabled)throw Error("LK_SHOP_PILOT_NOT_ENABLED");
    if(name==="getLKShopPairingDevices")
     return {data:{ok:true,scope:data.scope,
      devices:data.scope==="tenant"?window.__lkDevices:[],
      pushServerConfigured:false,mobileGoApiCompatible:false,appBuildVerified:false}};
    if(name==="issueLKShopPairingChallenge")
     return {data:make(data.purpose,data.scope)};
    if(name==="revokeLKShopPairingDevice"){
     window.__lkDevices=window.__lkDevices.filter(x=>x.id!==data.deviceId);
     return {data:{ok:true,revoked:true}};
    }
    throw Error("UNEXPECTED_CALLABLE:"+name);
   };`);
  await writeFile(resolve(dir,"firebase.js"),"export const functions={};");
  await writeFile(resolve(dir,"sweet.js"),"export const sweetConfirm=async()=>true;");
  await writeFile(resolve(dir,"lk-shop-pairing.css"),
   await readFile("react-app/src/ui/lk-shop-pairing.css","utf8"));
  await writeFile(resolve(dir,"lk-shop-public-downloads.css"),
   await readFile("react-app/public/parity/css/home-source-wrapper.css","utf8"));
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";
   import{createRoot}from"react-dom/client";
   import "./lk-shop-pairing.css";import "./lk-shop-public-downloads.css";
   import {LKShopPairingPanel}from"@/components/LKShopPairingPanel";
   import {PublicAppDownloads}from"@/components/PublicAppDownloads";
   const platform=new URLSearchParams(location.search).has("platform");
   createRoot(document.getElementById("root")).render(<main id="publicLanding" style={{maxWidth:850,
     margin:"12px auto",padding:"0 12px"}}>
    <LKShopPairingPanel scope={platform?"platform":"tenant"}/>
    <PublicAppDownloads/>
   </main>);`);
  vite=await createServer({configFile:false,root,
   cacheDir:resolve(dir,".vite-cache"),plugins:[react()],
   resolve:{alias:[
    {find:"@/firebase/client",replacement:resolve(dir,"firebase.js")},
    {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
    {find:"@/components/sweetDialog",replacement:resolve(dir,"sweet.js")},
    {find:"@/ui/lk-shop-pairing.css",replacement:resolve(dir,"lk-shop-pairing.css")},
    {find:"@/ui/lk-shop-public-downloads.css",replacement:resolve(dir,"lk-shop-public-downloads.css")},
    {find:"@",replacement:resolve(root,"src")},
   ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+basename(dir)+"/index.html";
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:950}});
   const errors=[];page.on("pageerror",err=>errors.push(String(err)));
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?
      r.continue():r.abort());
    await page.goto(url);
    await page.getByText("Kitchen iPad").waitFor();
    const tenant=page.locator("#adminLKShopPairing");
    assert.equal(await tenant.locator('input[type="radio"]').count(),3);
    assert.equal(await tenant.getByRole("button",{name:/สร้าง QR/}).isDisabled(),true);
    await tenant.getByText("ห้องครัว",{exact:true}).first().click();
    await tenant.getByRole("button",{name:/สร้าง QR/}).click();
    const qr=tenant.locator(".lk-shop-qr");
    await qr.getByText(/ใช้ได้ครั้งเดียว/).waitFor({timeout:12000});
    assert.equal(await qr.locator('img[src^="data:image/svg+xml"]').count(),1);
    assert.ok((await qr.locator("img").getAttribute("src")).length>1000);
    assert.equal(await tenant.locator(".lk-shop-device").count(),1);
    await tenant.getByRole("button",{name:"ยกเลิกการจับคู่ Kitchen iPad"}).click();
    await tenant.getByText("ยังไม่มีอุปกรณ์ที่เชื่อมต่อ").waitFor();
    assert.equal(await qr.count(),0);
    const calls=await page.evaluate(()=>window.__lkCalls);
    assert.equal(calls.filter(x=>x.name==="issueLKShopPairingChallenge").length,1);
    assert.equal(calls.find(x=>x.name==="issueLKShopPairingChallenge").data.purpose,"kitchen_delivery");
    assert.equal(calls.some(x=>x.data.tenantId||x.data.role),false);
    const downloads=page.locator("#publicAppDownloads");
    assert.equal(await downloads.getByRole("button",{name:/APK ยังไม่พร้อม/}).isDisabled(),true);
    assert.equal(await downloads.locator('a[href*=".apk"]').count(),0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,"PG Notify mobile overflow "+width+": "+overflow);
    assert.deepEqual(errors,[]);
    // Missing native app cannot be represented as successfully configured.
    await page.evaluate(()=>{window.__lkPilotEnabled=false});
    await tenant.getByRole("button",{name:"รีเฟรช"}).click();
    await tenant.getByText("ระบบจับคู่ PG Notify ของ Firebase ยังไม่ได้เปิดทดสอบ").waitFor();
    assert.equal(await tenant.locator("img").count(),0);
   }finally{await page.close();}
   const platform=await browser.newPage({viewport:{width,height:900}});
   try{
    await platform.goto(url+"?platform=1");
    const panel=platform.locator("#platformLKShopPairing");
    await panel.getByText("ห้องแจ้งเตือนส่วนกลาง",{exact:true}).first().waitFor();
    assert.equal(await panel.locator('input[type="radio"]').count(),1);
    assert.equal(await panel.locator('input[value="cashier_delivery"]').count(),0);
    await panel.getByRole("button",{name:/สร้าง QR/}).click();
    await panel.locator(".lk-shop-qr img").waitFor();
    const calls=await platform.evaluate(()=>window.__lkCalls);
    assert.ok(calls.some(x=>x.name==="issueLKShopPairingChallenge"&&
      x.data.scope==="platform"&&x.data.purpose==="superadmin_slip_manual"));
   }finally{await platform.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});
test("Admin, Platform and Home mount a Source-consistent PG Notify module without fake native APK readiness",async()=>{
 const admin=await readFile("react-app/src/pages/AdminPage.jsx","utf8");
 const platform=await readFile("react-app/src/pages/PlatformContactPage.jsx","utf8");
 const home=await readFile("react-app/src/pages/HomePage.jsx","utf8");
 const panel=await readFile("react-app/src/components/LKShopPairingPanel.jsx","utf8");
 const download=await readFile("react-app/src/components/PublicAppDownloads.jsx","utf8");
 const functions=await readFile("functions/index.js","utf8");
 const rules=await readFile("firestore.rules","utf8");
 const hosting=await readFile("firebase.json","utf8");
 assert.match(admin,/storeLKShopGroup/);
 assert.match(admin,/LKShopPairingPanel key=\{tenant\?\.id\} scope="tenant"/);
 assert.match(platform,/platformContactLKShopPanel/);
 assert.match(platform,/LKShopPairingPanel scope="platform"/);
 assert.match(home,/<PublicAppDownloads\s*\/>/);
 assert.match(download,/disabled aria-disabled="true"/);
 assert.doesNotMatch(download,/\.apk"/);
 for(const fn of ["getLKShopPairingDevices","issueLKShopPairingChallenge","revokeLKShopPairingDevice"]){
  assert.match(panel,new RegExp(fn));
 }
 assert.match(hosting,/\/api\/lk-shop\/\*\*/);
 assert.match(functions,/lkShopDeviceGateway/);
 assert.match(rules,/match \/lkShopPairChallenges/);
 assert.match(rules,/match \/lkShopDevices/);
});
