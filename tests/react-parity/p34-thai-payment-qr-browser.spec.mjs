import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename,join} from "node:path";
import {tmpdir} from "node:os";
import {execFileSync} from "node:child_process";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
import {generatePromptPayPayload} from "../../react-app/src/utils/promptPay.js";
const cases=[["0812345678",219],["1234567890123",268.15]];
test("P3.4 Source Thai QR high DPI PNG exact native scan, safe observation hides real QR",{
 timeout:180000,
},async()=>{
 const root=resolve("react-app"),fixture=await mkdtemp(resolve(root,"p34-qr-fixture-")),
  dir=await mkdtemp(join(tmpdir(),"penguin-thai-qr-")),decoder=join(dir,"qr-vision");
 let server,browser;
 try{
  await writeFile(join(fixture,"index.html"),
   '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<style>body{margin:0;padding:12px;font:14px Arial}</style></head><body><div id="root"></div>'+
   '<script type="module" src="/src/dev-test-bridge/p34-thai-payment-preview.jsx"></script></body></html>');
  server=await createServer({configFile:false,root,plugins:[react()],
   resolve:{alias:[{find:"@",replacement:resolve(root,"src")}]},
   publicDir:resolve("public"),server:{host:"127.0.0.1",port:0},clearScreen:false});
  await server.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const files=[],expected=[];
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:width<=390?2:1});
   const errors=[],foreign=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:"))foreign.push(r.url());});
   await page.route("**/*",r=>r.request().url().startsWith("http://127.0.0.1:")?r.continue():r.abort());
   try{
    await page.goto("http://127.0.0.1:"+server.httpServer.address().port+
      "/"+basename(fixture)+"/index.html",{waitUntil:"domcontentloaded"});
    for(const [i,[id,amount]] of cases.entries()){
     const card=page.locator('[data-case="'+i+'"] [data-thai-payment-qr]');
     const png=card.locator("[data-thai-payment-card-image]");
     await png.waitFor({timeout:15000});
     const data=await png.evaluate(async el=>{
      await el.decode();
      const r=el.getBoundingClientRect();
      return {w:el.naturalWidth,h:el.naturalHeight,ratio:r.width/r.height,
       scroll:document.documentElement.scrollWidth,viewport:innerWidth,
       src:el.getAttribute("src")||"",rendering:getComputedStyle(el).imageRendering};
     });
     assert.equal(data.w,1320);assert.equal(data.h,1398);
     assert.ok(Math.abs(data.ratio-440/466)<.01);
     assert.ok(data.scroll<=data.viewport+2,
      "horizontal scroll at "+width+": "+data.scroll+">"+data.viewport);
     assert.equal(data.rendering,"auto");
     assert.ok(data.src.startsWith("data:image/png;base64,"));
     const path=join(dir,width+"-"+i+".png");
     await card.screenshot({path});
     expected.push(generatePromptPayPayload(id,amount));
     files.push(path);
    }
    await page.locator('[data-observation="active"] [data-thai-payment-qr]').waitFor();
    await page.locator("#detect").click();
    await page.locator('[data-observation="masked"] [data-thai-payment-progress]').waitFor();
    assert.equal(await page.locator('[data-observation="masked"] img').count(),0);
    await page.reload();
    await page.locator('[data-observation="masked"] [data-thai-payment-progress]').waitFor();
    assert.equal(await page.locator('[data-observation="masked"] img').count(),0);
    assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);
   }finally{await page.close();}
  }
  const compiler=execFileSync("xcrun",["-f","swiftc"],{encoding:"utf8"}).trim();
  const sdk=execFileSync("xcrun",["--show-sdk-path"],{encoding:"utf8"}).trim();
  // Mac mini Xcode 27 SDK's default toolchain triple cannot load Swift
  // standard library; an explicit supported deployment target works.
  execFileSync(compiler,["-target","arm64-apple-macosx15.0","-sdk",sdk,
    "tests/react-parity/p34-thai-payment-qr-decode.swift","-o",decoder],
   {timeout:90000,encoding:"utf8"});
  const decoded=execFileSync(decoder,files,{timeout:30000,encoding:"utf8"})
   .trim().split(/\r?\n/);
  assert.deepEqual(decoded,expected,"All actual Source-composed PNGs must decode exact unchanged PromptPay payload");
 }finally{
  await browser?.close();await server?.close();
  await rm(fixture,{recursive:true,force:true});await rm(dir,{recursive:true,force:true});
 }
});
