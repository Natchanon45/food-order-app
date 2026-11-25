import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";
test("P3.4 Source checkout review modal retains readonly cart, recipient choice, focus and safe confirm on 320/390/768/1440",{
 timeout:100000,
},async()=>{
 const root=resolve("react-app"),dir=await mkdtemp(resolve(root,"p34-checkout-review-fixture-"));
 let browser,server;
 try{
  await writeFile(resolve(dir,"index.html"),'<!doctype html><html lang="th"><head><meta charset="utf-8">'+
   '<meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<link rel="stylesheet" href="/parity/css/app.css"></head><body><div id="root"></div>'+
   '<script type="module" src="/src/dev-test-bridge/p34-checkout-review-preview.jsx"></script></body></html>');
  server=await createServer({configFile:false,root,plugins:[react()],
   resolve:{alias:[{find:"@",replacement:resolve(root,"src")}]},
   publicDir:resolve("public"),server:{host:"127.0.0.1",port:0}});
  await server.listen();browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:960},reducedMotion:"reduce"});
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?
     r.continue():r.abort());
   try{
    await page.goto("http://127.0.0.1:"+server.httpServer.address().port+
      "/"+basename(dir)+"/index.html");
    await page.locator("#open-review").click();
    const modal=page.getByRole("dialog",{name:"สรุปคำสั่งซื้อ"});
    await modal.waitFor();
    assert.equal(await modal.getAttribute("aria-modal"),"true");
    assert.equal(await page.locator("#deliveryReviewItems .cart-row").count(),2);
    assert.equal(await page.locator("#deliveryReviewItems button:disabled").count(),4);
    assert.equal(await page.locator("#deliveryReviewItems input[readonly]").count(),2);
    assert.equal(await modal.locator('input[name="reviewPaymentMethod"]:checked').getAttribute("value"),"promptpay");
    assert.ok((await modal.textContent()).includes("140.00"));
    assert.equal(await page.locator("#confirmCheckoutOrder").isEnabled(),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2),
      "No horizontal overflow at "+width);
    await page.keyboard.press("Escape");
    await modal.waitFor({state:"detached"});
    assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),"");
    await page.locator("#open-review").click();
    await page.locator("#confirmCheckoutOrder").click();
    assert.equal(await page.locator("#confirmed-count").innerText(),"1");
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});
