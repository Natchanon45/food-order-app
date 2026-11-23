import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import {managedEmailVerificationPending,accountEmailGuardPath,
 accountEmailHome} from "../../react-app/src/auth/accountEmailPolicy.mjs";

test("only opted-in unverified accounts require gating; safe protected paths and role homes",()=>{
 assert.equal(managedEmailVerificationPending({emailVerificationRequired:true},
  {emailVerified:false}),true);
 assert.equal(managedEmailVerificationPending({emailVerificationRequired:true},
  {emailVerified:true}),false);
 assert.equal(managedEmailVerificationPending({emailVerificationRequired:false},
  {emailVerified:false}),false);
 assert.equal(managedEmailVerificationPending({role:"owner"},
  {emailVerified:false}),false);
 for(const route of ["/","/platform","/platform/owners","/admin/users","/kitchen",
  "/pos/sales","/cashier","/reports/hybrid-billing","/super-admin/saas-setup"])
  assert.equal(accountEmailGuardPath(route),true,route);
 for(const route of ["/verify-account","/login","/register","/s/demo/delivery",
  "/privacy","/terms","/waiting-queue/customer","/pos/customer-display"])
  assert.equal(accountEmailGuardPath(route),false,route);
 assert.equal(accountEmailHome({role:"owner"}),"/admin");
 assert.equal(accountEmailHome({role:"cashier"}),"/cashier");
 assert.equal(accountEmailHome({role:"kitchen"}),"/kitchen");
 assert.equal(accountEmailHome({role:"super_admin"}),"/platform");
});
test("login, App, AuthProvider, TenantProvider and server canonical user agree on verification gate",()=>{
 const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
 const page=read("react-app/src/pages/AccountEmailVerificationPage.jsx");
 const login=read("react-app/src/pages/LoginPage.jsx");
 const auth=read("react-app/src/auth/authFlow.js");
 const provider=read("react-app/src/auth/AuthProvider.jsx");
 const tenant=read("react-app/src/tenant/TenantProvider.jsx");
 const app=read("react-app/src/app/App.jsx");
 const rules=read("firestore.rules");
 const storageRules=read("storage.rules");
 const invitation=read("react-app/src/auth/managedAccountInvitation.js");
 const ownerPage=read("react-app/src/pages/PlatformOwnersPage.jsx");
 const staffPage=read("react-app/src/pages/AdminUsersPage.jsx");
 assert.match(storageRules,/function provisionedEmailAllowed\(\)/);
 assert.match(storageRules,/request.auth.token.get\('email_verified', false\) == true/);
 assert.match(invitation,/sendPasswordResetEmail\(auth,target,\{url,handleCodeInApp:false\}\)/);
 assert.match(invitation,/deliveryConfirmed:false/);
 assert.match(ownerPage,/data-owner-invite=\{tenant.id\}/);
 assert.match(staffPage,/data-mobile-staff-invite=\{user.uid\}/);
 assert.match(staffPage,/data-staff-invite=\{user.uid\}/);
 for(const source of [
  read("functions/staff-admin.js"),
  read("functions/tenant-owner-operation.js"),
  read("functions/tenant-provision.js")])
  assert.match(source,/emailVerificationRequired:true/);
 assert.match(auth,/if \(managedEmailVerificationPending\(profile,user\)\)/);
 assert.match(login,/if\(profile.emailVerificationPending===true\)/);
 assert.match(provider,/onIdTokenChanged\(/);
 assert.match(tenant,/managedEmailVerificationPending\(profile,auth.user\)/);
 assert.match(app,/function ManagedEmailGuard/);
 assert.match(app,/<Route path="\/verify-account" element=\{<AccountEmailVerificationPage/);
 assert.match(rules,/function provisionedEmailAllowed\(\)/);
 assert.match(rules,/request.auth.token.get\('email_verified', false\) == true/);
 assert.match(rules,/request.auth.uid == userId\) \|\| superAdminRole\(\)/);
 assert.match(page,/sendEmailVerification\(signed,\{url,handleCodeInApp:false\}\)/);
 assert.match(page,/await reload\(signed\)/);
 assert.match(page,/await getIdToken\(signed,true\)/);
 assert.doesNotMatch(page,/useEffect\(/,"no implicit email send on mount");
 const routes=read("tools/sync-react-entrypoints.py");
 assert.match(routes,/public\/verify-account\/index.html/);
});
test("real React verification page never sends on render, only on click; responsive at 320/390/768/1440",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p13d-verification-browser-"));
 let server,browser;
 try{
  const write=(name,value)=>writeFile(resolve(dir,name),value);
  await write("index.html",
   '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await write("auth.js",`
   export const useAuth=()=>({status:"ready",user:window.__verifyMock.user,
    profile:{uid:"p13d-account",role:"owner",active:true,emailVerificationRequired:true,
     email:"owner@example.test",tenantId:"p13d-shop"}});`);
  await write("firebase.js",`export const auth={get currentUser(){return window.__verifyMock.user;}};`);
  await write("sdk.js",`
   export async function reload(user){window.__verifyMock.reloads+=1;
    if(window.__verifyMock.verifyOnReload)user.emailVerified=true;}
   export async function getIdToken(user,force){window.__verifyMock.tokenRefreshes+=1;
    if(!force)throw Error("TOKEN_NOT_FORCED");return "demo-token";}
   export async function sendEmailVerification(user,settings){
    if(!user||user.uid!=="p13d-account")throw Error("UNEXPECTED_USER");
    if(!settings.url.endsWith("/verify-account"))throw Error("INVALID_RETURN_PATH");
    window.__verifyMock.sent+=1;
   }
   export async function signOut(){window.__verifyMock.signouts+=1;}
  `);
  await write("fixture.jsx",`
   import React from "react";
   import{createRoot}from"react-dom/client";
   import{MemoryRouter}from"react-router-dom";
   import{AccountEmailVerificationPage}from"@/pages/AccountEmailVerificationPage";
   window.__verifyMock={user:{uid:"p13d-account",email:"owner@example.test",
     emailVerified:false},sent:0,reloads:0,tokenRefreshes:0,
     signouts:0,verifyOnReload:false};
   createRoot(document.getElementById("root")).render(
    <MemoryRouter><AccountEmailVerificationPage/></MemoryRouter>);`);
  const alias=[
   {find:"@/auth/AuthProvider",replacement:resolve(dir,"auth.js")},
   {find:"@/firebase/client",replacement:resolve(dir,"firebase.js")},
   {find:"firebase/auth",replacement:resolve(dir,"sdk.js")},
   {find:"@",replacement:resolve(root,"src")},
  ];
  server=await createServer({configFile:false,root,
   cacheDir:resolve(dir,".vite-cache"),plugins:[react()],
   resolve:{alias},server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const url="http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html";
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[];page.on("pageerror",e=>errors.push(String(e)));
   try{
    await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?
      route.continue():route.abort());
    await page.goto(url);
    await page.locator("[data-managed-email-verification]").waitFor();
    assert.equal(await page.evaluate(()=>window.__verifyMock.sent),0);
    assert.equal(await page.locator("[data-send-account-verification]").isDisabled(),false);
    assert.ok(await page.locator("[data-check-account-verification]").isVisible());
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=2,"horizontal overflow at "+width+": "+overflow);
    await page.locator("[data-check-account-verification]").click();
    await page.getByText("ระบบยังไม่พบสถานะยืนยันอีเมลจาก Firebase").waitFor();
    assert.equal(await page.evaluate(()=>window.__verifyMock.sent),0);
    await page.locator("[data-send-account-verification]").click();
    await page.getByText("ส่งคำขอผ่าน Firebase Authentication แล้ว").waitFor();
    assert.equal(await page.evaluate(()=>window.__verifyMock.sent),1);
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
