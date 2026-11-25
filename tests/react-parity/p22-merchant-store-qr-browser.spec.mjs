import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("P2.2 real Chrome Source one-frame Y crop, local PNG QR and offline download at 320/390/768/1440",{
 timeout:130000,
},async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p22-store-qr-fixture-"));
 let server,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<link rel="stylesheet" href="/parity/css/admin-store-branding.css">'+
   '<style>*{box-sizing:border-box}body{margin:0;font:14px Arial,sans-serif}main{max-width:1100px;margin:0 auto;padding:12px}.card{margin-bottom:12px;padding:12px}.admin-card-collapsed>.admin-card-body{display:none}</style>'+
   '</head><body class="admin-vr-page"><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"fixture.jsx"),await readFile(resolve("tests/react-parity/fixtures/p22-merchant-store-qr.jsx")));
  server=await createServer({configFile:false,root,plugins:[react()],
   resolve:{alias:[{find:"@",replacement:resolve(root,"src")}]},
   publicDir:resolve(root,"public"),server:{host:"127.0.0.1",port:0}});
  await server.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:970},reducedMotion:"reduce",acceptDownloads:true});
   const errors=[],foreign=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("request",r=>{if(new URL(r.url()).hostname!=="127.0.0.1")foreign.push(r.url());});
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto("http://127.0.0.1:"+server.httpServer.address().port+"/"+basename(dir)+"/index.html");
    const stage=page.locator("[data-cover-focus-stage]");
    await stage.waitFor({timeout:14000});
    await page.waitForFunction(()=>document.querySelector("[data-cover-focus-stage] img")?.naturalHeight===1200);
    assert.equal(await page.locator("[data-cover-focus-stage]").count(),1);
    assert.equal(await page.locator(".admin-store-branding-preview.is-cover img").count(),0);
    assert.equal(await page.locator(".admin-store-branding-preview.is-logo img").count(),1);
    assert.equal(await stage.getAttribute("aria-orientation"),"vertical");
    assert.equal(await stage.locator("img").evaluate(img=>getComputedStyle(img).objectFit),"cover");
    const box=await stage.boundingBox(),initial=Number(await stage.getAttribute("aria-valuenow"));
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2+Math.min(36,box.height/3),{steps:5});
    await page.mouse.up();
    const after=Number(await stage.getAttribute("aria-valuenow"));
    assert.ok(after<initial,"drag image down decreases Y at "+width+": "+initial+" -> "+after);
    const stored=JSON.parse(await page.locator("#focusValues").innerText());
    assert.equal(stored.x,50);
    assert.equal(Math.round(stored.y),after);
    await stage.focus();
    await page.keyboard.press("ArrowDown");
    assert.ok(Number(await stage.getAttribute("aria-valuenow"))>after);
    await page.locator("[data-cover-focus-reset]").click();
    assert.equal(Number(await stage.getAttribute("aria-valuenow")),50);
    for(const id of ["deliveryQr","takeawayQr"]){
     const card=page.locator("#"+id+"Section");
     await card.waitFor();
     assert.ok((await card.getAttribute("class")).includes("admin-card-collapsed"));
     await card.locator(".admin-card-toggle").click();
     const image=page.locator("#"+id+"Image");
     await image.waitFor();
     await page.waitForFunction(selector=>{
      const e=document.querySelector(selector);return e?.complete&&e?.naturalWidth>0;
     },"#"+id+"Image");
     const src=await image.getAttribute("src");
     assert.ok(src.startsWith("data:image/png;base64,"),id+" must use local PNG");
     const signature=await image.evaluate(async element=>{
      const bytes=new Uint8Array(await (await fetch(element.src)).arrayBuffer());
      return [...bytes.slice(0,8)];
     });
     assert.deepEqual(signature,[137,80,78,71,13,10,26,10]);
     assert.ok((await card.locator('input[id$="Link"]').inputValue()).includes("/s/p22-demo-shop/"));
    }
    const dl=await Promise.all([
      page.waitForEvent("download",{timeout:12000}),
      page.locator("#deliveryQrSection button[id^=download]").click(),
    ]);
    assert.match(dl[0].suggestedFilename(),/delivery-qr-p22-demo-shop\.png$/);
    await dl[0].delete();
    // Browser HEADLESS cannot certify an OS physical printer. Test the actual
    // application's print HTML generator and exact offline PNG payload instead.
    if(width===390){
     const html=await page.evaluate(async()=>{
      const module=await import("/src/components/AdminDeliveryQr.jsx");
      const paper=document.querySelector("#deliveryQrPreview .delivery-qr-paper");
      return module.printHtml(paper,"QR เดลิเวอรี่");
     });
     assert.match(html,/PENGUIN/);
     assert.match(html,/data:image\/png;base64,/);
     assert.match(html,/delivery-qr-paper/);
     assert.match(html,/@page\{size:80mm 128mm/);
    }
    assert.deepEqual(foreign,[]);
    assert.deepEqual(errors,[]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=2,
      "horizontal overflow at "+width);
    await page.locator('[data-store-brand-remove="cover"]').click();
    await stage.locator("img").waitFor({state:"detached",timeout:5000});
    assert.equal(await stage.locator("img").count(),0);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
