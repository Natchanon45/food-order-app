import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("merchant three-channel Telegram settings: encrypted-token input UX, save revision, test saved credentials, mobile width",async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p1-tenant-telegram-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"client.js"),"export const functions={};");
  await writeFile(resolve(dir,"functions.js"),`
    const purposes=["admin_store","cashier_delivery","kitchen_delivery"];
    let states=Object.fromEntries(purposes.map(p=>[p,{purpose:p,enabled:false,chatId:"",tokenConfigured:false,tokenMasked:"",revision:"0"}]));
    window.__testSends=[];window.__testWrites=[];
    export const httpsCallable=(_,name)=>async data=>{
      if(name==="getTenantTelegramSettings")return {data:{ok:true,storageReady:true,channels:Object.values(states)}};
      if(name==="saveTenantTelegramSettings"){
        if(data.expectedRevision!==states[data.purpose].revision)throw Error("REVISION_CONFLICT");
        if(data.enabled&&!data.botToken&&!states[data.purpose].tokenConfigured)throw Error("NO_TOKEN");
        const revision="11111111-1111-4111-8111-"+String(window.__testWrites.length+1).padStart(12,"0");
        states[data.purpose]={purpose:data.purpose,enabled:data.enabled,chatId:data.chatId,
          tokenConfigured:!data.clearToken&&(Boolean(data.botToken)||states[data.purpose].tokenConfigured),
          tokenMasked:!data.clearToken?"••••aaaa":"",revision};
        window.__testWrites.push({...data});
        return {data:{ok:true,item:states[data.purpose]}};
      }
      if(name==="testTenantTelegramSettings"){
        const saved=states[data.purpose];
        if(!saved.enabled||!saved.tokenConfigured)throw Error("DISABLED");
        window.__testSends.push({purpose:data.purpose,chatId:saved.chatId});
        return {data:{ok:true,sent:true}};
      }
      if(name.includes("PlatformTelegram"))throw Error("WRONG_SCOPE");
      throw Error("NO_SUCH_CALLABLE");
    };`);
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";import{createRoot}from"react-dom/client";import{TelegramSettingsPanel}from"@/components/TelegramSettingsPanel";
    createRoot(document.getElementById("root")).render(<main style={{padding:12,maxWidth:980,margin:"auto"}}><TelegramSettingsPanel scope="tenant"/></main>);`);
  server=await createServer({configFile:false,root,plugins:[react()],resolve:{alias:[
   {find:"@/firebase/client",replacement:resolve(dir,"client.js")},
   {find:"firebase/functions",replacement:resolve(dir,"functions.js")},
   {find:"@",replacement:resolve(root,"src")},
  ]},server:{host:"127.0.0.1",port:0},publicDir:false});
  await server.listen();browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto("http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html");
    const channels=page.locator("[data-telegram-channel]");
    await channels.first().waitFor();
    assert.equal(await channels.count(),3);
    const first=channels.first();
    assert.equal(await first.getByLabel("Telegram Bot Token").getAttribute("type"),"password");
    await first.locator('input[type="checkbox"]').first().check();
    await first.getByLabel("Telegram Bot Token").fill("123456789:"+("a".repeat(35)));
    await first.getByLabel("Chat ID").fill("-1001234567890");
    await first.getByRole("button",{name:"บันทึกช่องทาง"}).click();
    await first.getByText("ตั้งค่า Token แล้ว",{exact:false}).waitFor();
    assert.equal(await first.getByLabel("Telegram Bot Token").inputValue(),"");
    const writes=await page.evaluate(()=>window.__testWrites);
    assert.equal(writes[0].purpose,"admin_store");assert.equal(writes[0].expectedRevision,"0");
    await first.getByRole("button",{name:"ส่งข้อความทดสอบ"}).click();
    await page.waitForFunction(()=>window.__testSends.length===1);
    const sends=await page.evaluate(()=>window.__testSends);
    assert.equal(sends[0].purpose,"admin_store");assert.equal(sends[0].chatId,"-1001234567890");
    // Make sure no token is ever mirrored into the UI after save.
    assert.ok(!(await page.locator("body").innerText()).includes("123456789:"+("a".repeat(35))));
    await first.getByLabel("ลบ Bot Token ที่บันทึกไว้ (ปิดช่องทางนี้)").check();
    await first.getByRole("button",{name:"บันทึกช่องทาง"}).click();
    await first.getByText("กรอก Token จาก @BotFather",{exact:false}).waitFor();
    assert.equal(await first.getByRole("button",{name:"ส่งข้อความทดสอบ"}).isDisabled(),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth)<=width+2);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
test("admin panel mounts tenant Telegram while platform settings keep separate callable path",async()=>{
 const admin=await readFile("react-app/src/pages/AdminPage.jsx","utf8");
 const panel=await readFile("react-app/src/components/TelegramSettingsPanel.jsx","utf8");
 const rules=await readFile("firestore.rules","utf8");
 assert.match(admin,/<TelegramSettingsPanel key=\{tenant\?\.id\} scope="tenant" onActiveCountChange=\{setTelegramActiveCount\} \/>/);
 assert.match(panel,/getTenantTelegramSettings/);assert.match(panel,/getPlatformTelegramSettings/);
 assert.match(panel,/expectedRevision:current.revision/);
 assert.match(rules,/match \/telegramChannels\/\{channelId\} \{ allow read, write: if false/);
 assert.match(rules,/match \/telegramOutbox\/\{eventId\} \{ allow read, write: if false/);
});
