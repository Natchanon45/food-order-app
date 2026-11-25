import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";

test("P2.3 Chrome RegisterPage reserves before email, blocks stale prices, auto-activates verified Owner and supports cross-browser resume",{
 timeout:155000,
},async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p23-register-fixture-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"fixture.jsx"),
   'import React from "react";import {createRoot} from "react-dom/client";import {BrowserRouter} from "react-router-dom";import {RegisterPage} from "@/pages/RegisterPage";createRoot(document.getElementById("root")).render(<BrowserRouter><RegisterPage/></BrowserRouter>);');
  await writeFile(resolve(dir,"client.js"),`
export const auth={currentUser:null};
const scenario=new URLSearchParams(location.search).get("scenario");
if(scenario==="verified"||scenario==="unverified")
 auth.currentUser={uid:"owner-p23",email:"owner@example.test",emailVerified:scenario==="verified"};
`);
  await writeFile(resolve(dir,"native.js"),`
import {auth} from "./client.js";
const listeners=new Set();
export const onAuthStateChanged=(_,fn)=>{
 listeners.add(fn);queueMicrotask(()=>fn(auth.currentUser));
 return ()=>listeners.delete(fn);
};
export const reload=async()=>{};
export const getIdToken=async()=>"demo-native-token";
export async function signInWithEmailAndPassword(authInstance,email,password){
 if(!email||!password)throw Error("INVALID_CREDENTIALS");
 const user={uid:"owner-p23",email,emailVerified:true};
 authInstance.currentUser=user;
 for(const fn of [...listeners])queueMicrotask(()=>fn(user));
 return {user};
}
`);
  await writeFile(resolve(dir,"flow.js"),`
window.__p23Events=[];
const events=window.__p23Events;
export const ensureSignupUser=async(email)=>{
 events.push("auth");return {user:{uid:"owner-p23",email}};
};
export const requestSignup=async()=>{events.push("reserve");return {ok:true}};
export const sendSignupVerification=async()=>{events.push("email");return {alreadyVerified:false}};
export const resendSignupVerification=async()=>{events.push("resend");return {alreadyVerified:false}};
export const activateSignup=async()=>{events.push("activate");return {slug:"p23-demo-shop"}};
`);
  await writeFile(resolve(dir,"pricing.js"),`
export const loadPublicSubscriptionPricing=async()=>{
 const source=new URLSearchParams(location.search).get("scenario")==="fallback"
  ?"fallback":"remote";
 const config={monthlyPrice:590,deliveryThreshold:10000,
  deliveryShareRate:5,monthlySlipQuota:37,vatRate:7,vatMode:"inclusive",annualMonths:12};
 return {source,config,pricing:{monthly:{payable:590},
  annual:{payable:5900,configured:5900,regularConfigured:7080}}};
};
export const formatSubscriptionMoney=v=>String(v??"");
`);
  await writeFile(resolve(dir,"i18n.js"),
   'const t=(key)=>key;export const useI18n=()=>({t,locale:"th",intlLocale:"th-TH"});');
  await writeFile(resolve(dir,"component.jsx"),
   'import React from "react";export const LocaleSwitcher=()=>null;export const ParityFooter=()=>null;export const PageReadyOverlay=()=>null;');
  await writeFile(resolve(dir,"parity.js"),'export const useParityPage=()=>true;');
  const component=resolve(dir,"component.jsx");
  server=await createServer({configFile:false,root,plugins:[react()],
   resolve:{alias:[
    {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
    {find:"firebase/auth",replacement:resolve(dir,"native.js")},
    {find:"@/auth/authFlow",replacement:resolve(dir,"flow.js")},
    {find:"@/data/subscriptionPricing",replacement:resolve(dir,"pricing.js")},
    {find:"@/i18n/I18nProvider",replacement:resolve(dir,"i18n.js")},
    {find:"@/hooks/useParityPage",replacement:resolve(dir,"parity.js")},
    {find:"@/components/LocaleSwitcher",replacement:component},
    {find:"@/components/ParityFooter",replacement:component},
    {find:"@/components/PageReadyOverlay",replacement:component},
    {find:"@",replacement:resolve(root,"src")},
   ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const host="http://127.0.0.1:"+server.httpServer.address().port;
  const open=async(width,query)=>{
   const page=await browser.newPage({viewport:{width,height:930},reducedMotion:"reduce"});
   const errors=[];page.on("pageerror",error=>errors.push(error.message));
   await page.route("**/*",r=>{
    const u=new URL(r.request().url());
    if(u.hostname!=="127.0.0.1")return r.abort();
    if(u.pathname==="/login")return r.fulfill({
     status:200,contentType:"text/html",body:"<!doctype html><body>LOGIN DESTINATION</body>",
    });
    return r.continue();
   });
   await page.goto(host+"/"+basename(dir)+"/index.html"+query);
   return {page,errors};
  };
  const fillSignup=async page=>{
   await page.locator("#registerForm").waitFor();
   await page.locator('input[name="businessType"][value="restaurant_cafe"]').check();
   await page.locator('input[name="planCode"][value="yearly"]').check();
   await page.locator("#ownerName").fill("P23 Browser Owner");
   await page.locator("#phone").fill("0812345678");
   await page.locator("#email").fill("owner@example.test");
   await page.locator("#orderDeliveryShopName").fill("ร้านทดสอบ");
   await page.locator("#slug").fill("p23-demo-shop");
   await page.locator("#secretA").fill("Demo-Owner-Password123!");
   await page.locator("#secretB").fill("Demo-Owner-Password123!");
   await page.locator("#termsAccepted").check();
  };
  for(const width of [320,390,768,1440]){
   const {page,errors}=await open(width,"?scenario=remote");
   try{
    await page.locator("#registrationServiceTerms").waitFor();
    assert.match(await page.locator("#registrationServiceTerms").innerText(),/37/);
    await fillSignup(page);
    await page.locator("#submitRegister").click();
    await page.locator("#verifyBox").waitFor();
    const events=await page.evaluate(()=>window.__p23Events);
    assert.deepEqual(events,["auth","reserve","email"],"signup reservation must precede email at "+width);
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
  {
   const {page,errors}=await open(390,"?scenario=fallback");
   try{
    await fillSignup(page);
    await page.locator("#submitRegister").click();
    await page.locator("#registerStatus").waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__p23Events),[]);
    assert.notEqual(await page.locator("#registerStatus").textContent(),"");
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
  for(const [scenario,expected] of [["verified",true],["unverified",false]]){
   const {page,errors}=await open(390,"?scenario="+scenario+"&verify=1");
   try{
    if(expected){
     await page.waitForURL(url=>url.pathname==="/login",{timeout:11000});
    }else{
     await page.locator("#verifyBox").waitFor();
     await page.waitForTimeout(300);
    }
    // Auto-activation requires the actual native Firebase Auth state, not
    // the untrusted verify=1 query parameter.
    const events=await page.evaluate(()=>window.__p23Events||[]);
    if(!expected)assert.equal(events.includes("activate"),false);
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
  {
   const {page,errors}=await open(320,"?scenario=cross&verify=1");
   try{
    await page.locator("#resumePendingSignup").waitFor({state:"attached"});
    await page.locator("#resumePendingEmail").fill("owner@example.test");
    await page.locator("#resumePendingPassword").fill("Only-Local-Demo123!");
    await page.locator("#resumePendingSignup button[type=submit]").click();
    await page.waitForURL(url=>url.pathname==="/login",{timeout:12000});
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
