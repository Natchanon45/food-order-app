import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("P2.3 actual Chrome LoginPage never routes Owner/Admin/Cashier to forbidden next pages",{
 timeout:145000,
},async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p23-login-fixture-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"fixture.jsx"),'import React from "react";import {createRoot} from "react-dom/client";import {BrowserRouter} from "react-router-dom";import {LoginPage} from "@/pages/LoginPage";createRoot(document.getElementById("root")).render(<BrowserRouter><LoginPage/></BrowserRouter>);');
  await writeFile(resolve(dir,"auth.js"),`const profiles={
 owner:{role:"owner",businessUnits:["order_delivery","retail_pos"]},
 retail:{role:"owner",businessUnits:["retail_pos"]},
 cashier:{role:"cashier",businessUnits:["order_delivery"]},
 kitchen:{role:"kitchen",businessUnits:["order_delivery"]},
 admin:{role:"admin",businessUnits:["order_delivery"]},
 super:{role:"super_admin",businessUnits:[]},
 revoked:{role:"owner",businessUnits:[]},
 manager:{role:"manager",businessUnits:["order_delivery"]},
 posadmin:{role:"admin",businessUnits:["retail_pos"]},
 pending:{role:"owner",emailVerificationPending:true,businessUnits:["order_delivery"]},
};
export const ROLE_HOME={super_admin:"/platform",owner:"/pos",admin:"/pos",cashier:"/pos",kitchen:"/kitchen",manager:"/"};
export const authenticateStaff=async email=>profiles[String(email).split("@")[0]]||Promise.reject(Error("AUTH_DENIED"));`);
  await writeFile(resolve(dir,"session.js"),'export const clearRetailPosSession=()=>{};export const prepareRetailPosSession=async()=>({ok:true});');
  await writeFile(resolve(dir,"i18n.js"),'const t=k=>k;export const useI18n=()=>({t,locale:"th",intlLocale:"th-TH"});');
  await writeFile(resolve(dir,"components.jsx"),'import React from "react";export const LocaleSwitcher=()=>null;export const ParityFooter=()=>null;export const PageReadyOverlay=()=>null;');
  await writeFile(resolve(dir,"parity.js"),'export const useParityPage=()=>true;');
  const component=resolve(dir,"components.jsx");
  server=await createServer({configFile:false,root,plugins:[react()],
   resolve:{alias:[
    {find:"@/auth/authFlow",replacement:resolve(dir,"auth.js")},
    {find:"@/auth/retailPosSession",replacement:resolve(dir,"session.js")},
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
  const cases=[
   ["owner","/admin/users","/admin/users"],
   ["admin","/admin/users","/admin"],
   ["cashier","/admin","/cashier"],
   ["kitchen","/cashier","/kitchen"],
   ["super","/platform/pricing","/platform/pricing"],
   ["super","/admin/users","/platform"],
   ["retail","/cashier/quick-order","/pos"],
   ["revoked","/admin","/"],
   ["owner","/admin/unknown","/pos"],
   ["owner","//evil.example","/pos"],
   ["owner","/react/admin/users","/admin/users"],
   ["posadmin","/pos/users","/pos"],
   ["manager","/cashier","/cashier"],
   ["pending","/admin","/verify-account"],
  ];
  let index=0;
  for(const [role,next,dest] of cases){
   const width=[320,390,768,1440][index++%4];
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:"reduce"});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   try{
    const destinations=new Set(cases.map(([,,d])=>d));
    await page.route("**/*",route=>{
     const u=new URL(route.request().url());
     if(u.hostname!=="127.0.0.1")return route.abort();
     if(destinations.has(u.pathname))return route.fulfill({
       status:200,contentType:"text/html",body:"<!doctype html><body>DESTINATION</body>"});
     return route.continue();
    });
    await page.goto(host+"/"+basename(dir)+"/index.html?next="+encodeURIComponent(next));
    await page.locator("#email").fill(role+"@example.test");
    await page.locator("#password").fill("Only-Demo123!");
    await page.locator("#loginButton").click();
    await page.waitForURL(url=>url.pathname===dest,{timeout:14000});
    assert.equal(new URL(page.url()).pathname,dest);
    assert.deepEqual(errors,[],role+" "+next);
   }finally{await page.close();}
  }
 }finally{
  await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});
 }
});
