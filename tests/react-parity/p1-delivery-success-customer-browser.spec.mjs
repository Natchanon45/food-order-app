import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,readFile} from "node:fs/promises";
import {resolve,basename} from "node:path";
import {createServer} from "vite";
import react from "@vitejs/plugin-react";
import {chromium} from "playwright";

test("Delivery Success uses newest Source top-action/green-card layout, Firebase QR guards, 4 viewport sizes", async()=>{
 const root=resolve("react-app");
 const dir=await mkdtemp(resolve(root,"p1-delivery-success-source-ui-fixture-"));
 let vite,browser;
 try{
  await writeFile(resolve(dir,"index.html"),
   '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./fixture.jsx"></script></body></html>');
  await writeFile(resolve(dir,"router.jsx"),`import React from "react";
   export const Link=({to,children,...props})=><a href={to} {...props}>{children}</a>;
   export const useParams=()=>({slug:"demo-kitchen"});`);
  const locale=JSON.parse(await readFile("react-app/src/i18n/parity-translations.json","utf8")).th;
  await writeFile(resolve(dir,"i18n.js"),`const texts=${JSON.stringify(locale)};
  const t=(key,values={})=>key.split(".").reduce((obj,k)=>obj?.[k],texts) || key;
  export const useI18n=()=>({t,formatNumber:(n,opts)=>
   new Intl.NumberFormat("th-TH",opts).format(n)});`);
  await writeFile(resolve(dir,"hook.js"),`import{useEffect}from"react";
   export const useParityPage=({bodyClass})=>{useEffect(()=>{document.body.className=bodyClass},[bodyClass]);return true;};`);
  await writeFile(resolve(dir,"components.jsx"),`import React from"react";
   export const PageReadyOverlay=()=> <div role="status">loading</div>;
   export const PublicStorefrontHeader=({title,action})=>
    <header className="app-header">
     <div className="brand"><strong>PG</strong><span>{title}</span></div>
     {action}<div className="app-locale-switcher">TH</div>
    </header>;
   export const PublicStorefrontFooter=()=> <footer>Footer</footer>;
   export const showStorefrontToast=()=>{};
   export const CompanionConfirmedQr=()=> <section data-firebase-confirmed-qr>
    QR PromptPay จาก Firebase · สถานะจากเซิร์ฟเวอร์
   </section>;`);
  await writeFile(resolve(dir,"store.js"),`
    const base={id:"order-customer-987654",billNo:"B261123-00045",
     paymentMethod:"promptpay",paymentStatus:"paid",status:"accepted",
     items:[{menuId:"m1",name:"ข้าวไข่เจียว",qty:1,price:70}],totalAmount:90,
     subtotalAmount:70,deliveryFee:20,recipientName:"Customer",
     recipientPhone:"0XXXXXXXXX",deliveryAddress:"Bangkok, Thailand",
     createdAt:"2026-11-23T04:10:00Z",updatedAt:"2026-11-23T04:10:00Z"};
    let listener;let current=base;
    window.__emit=(updates)=>{current={...base,...updates};listener?.(current);};
    window.__initialOrder=base;
    export const resolvePublicTenant=async slug=>({id:"tenant-demo",slug});
    export const getPublicStoreSettings=async()=>({shopName:"PENGUIN",shopAddress:"Bangkok, Thailand"});
    export const getPublicOrder=async()=>current;
    export const watchPublicOrder=(_tenant,_id,cb)=>{listener=cb;return()=>{listener=null};};
   `);
  await writeFile(resolve(dir,"qr.js"),`export const qrDataUrl=()=> "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E";`);
  await writeFile(resolve(dir,"customer-actions.css"),
   await readFile("public/react/parity/css/delivery-success-customer-actions.css","utf8"));
  await writeFile(resolve(dir,"fixture.jsx"),`import React from "react";
    import "../public/parity/css/app.css";
    import "../public/parity/css/receipt-layout.css";
    import "../public/parity/css/order-delivery-workspace-theme.css";
    import "../public/parity/css/delivery-success-tracking.css";
    import "./customer-actions.css";
    import{createRoot}from"react-dom/client";
    import{DeliverySuccessPage}from"@/pages/DeliverySuccessPage";
    createRoot(document.getElementById("root")).render(<DeliverySuccessPage/>);`);
  const aliases=[
   {find:"react-router-dom",replacement:resolve(dir,"router.jsx")},
   {find:"@/i18n/I18nProvider",replacement:resolve(dir,"i18n.js")},
   {find:"@/hooks/useParityPage",replacement:resolve(dir,"hook.js")},
   {find:"@/components/PageReadyOverlay",replacement:resolve(dir,"components.jsx")},
   {find:"@/components/PublicStorefront",replacement:resolve(dir,"components.jsx")},
   {find:"@/components/CompanionConfirmedQr",replacement:resolve(dir,"components.jsx")},
   {find:"@/data/publicStorefrontData",replacement:resolve(dir,"store.js")},
   {find:"@/utils/localQr",replacement:resolve(dir,"qr.js")},
   {find:"@",replacement:resolve(root,"src")},
  ];
  vite=await createServer({configFile:false,root,
   cacheDir:resolve(dir,".vite-cache"),plugins:[react()],
   resolve:{alias:aliases},
   server:{host:"127.0.0.1",port:0},publicDir:false});
  await vite.listen();
  browser=await chromium.launch({channel:"chrome",headless:true});
  const url="http://127.0.0.1:"+vite.httpServer.address().port+"/"+
   basename(dir)+"/index.html?order=order-customer-987654";
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:920}});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   try{
    await page.route("**/*",r=>new URL(r.request().url()).hostname===
      "127.0.0.1"?r.continue():r.abort());
    await page.goto(url);
    const green=page.locator("#customerQROrderReceived");
    const toolbar=page.locator(".receipt-toolbar.delivery-receipt-actions");
    await green.getByText("ชำระผ่าน PromptPay QR").waitFor();
    assert.equal(await page.locator("#orderAgainLink").count(),0);
    assert.equal(await toolbar.locator("#verifyLatestLink").count(),1);
    assert.equal(await toolbar.locator("#saveImageButton").count(),1);
    assert.equal(await toolbar.locator("#orderAgainMobileLink").count(),1);
    assert.equal(await toolbar.locator("svg").count(),3);
    assert.equal(await page.locator("#customerReceipt").count(),1);
    assert.equal(await page.locator("#customerStripePaymentStatus").count(),0);
    assert.equal(await page.locator("[data-sandbox-badge]").count(),0);
    assert.equal(await green.getAttribute("data-paid"),"true");
    assert.equal(await page.getByText("เลขที่บิล B261123-00045").count(),1);
    const layout=await page.evaluate(()=>{
     const ids=[".receipt-toolbar.delivery-receipt-actions",
       "#customerQROrderReceived","#deliveryTrackingCard"];
     const rects=ids.map(s=>document.querySelector(s)?.getBoundingClientRect());
     const buttons=[...document.querySelectorAll(".delivery-receipt-actions > *")]
       .map(el=>el.getBoundingClientRect());
     return {
      topOrder:rects[0].top < rects[1].top && rects[1].top < rects[2].top,
      widths:buttons.map(x=>x.width),outer:rects.map(x=>x.width),
      overflow:document.documentElement.scrollWidth - innerWidth,
      toolCount:buttons.length,
      offenders:[...document.querySelectorAll("body *")].map(el=>({
       selector:el.id||el.className?.baseVal||el.className||el.tagName,
       right:Math.round(el.getBoundingClientRect().right),
       scroll:el.scrollWidth,client:el.clientWidth,
      })).filter(x=>x.right>innerWidth+3).sort((a,b)=>b.right-a.right).slice(0,8),
     };
    });
    assert.equal(layout.topOrder,true,JSON.stringify(layout));
    assert.equal(layout.toolCount,3);
    assert.ok(Math.max(...layout.widths)-Math.min(...layout.widths)<=1.5,
      "3 actions unequal width: "+JSON.stringify(layout));
    assert.ok(Math.max(...layout.outer)-Math.min(...layout.outer)<=1.5,
      "3 cards unequal width: "+JSON.stringify(layout));
    assert.ok(layout.overflow<=2,"horizontal overflow "+width+": "+JSON.stringify(layout));

    // Kitchen admission and pending PromptPay may acknowledge the order,
    // but must never claim bank Paid or show a green Paid method badge.
    await page.evaluate(()=>window.__emit({
      paymentStatus:"pending_verification",paymentQrMode:"confirmed_order_5m",
      status:"accepted",companionKitchenRelease:{status:"admitted_unverified"}}));
    await green.getByText("PromptPay QR · รอตรวจสอบยอด").waitFor();
    assert.equal(await green.getAttribute("data-paid"),"false");

    // Pending QR with no trusted kitchen admission hides receipt/buttons,
    // still shows Firebase's original QR widget.
    await page.evaluate(()=>window.__emit({
      paymentStatus:"pending_verification",paymentQrMode:"confirmed_order_5m",
      status:"pending",companionKitchenRelease:null}));
    await page.locator("[data-firebase-confirmed-qr]").waitFor();
    assert.equal(await green.count(),0);
    assert.equal(await toolbar.count(),0);
    assert.equal(await page.locator("#customerReceipt").count(),0);

    // Stripe pending/failed uses amber/red separate card, not green Paid.
    await page.evaluate(()=>window.__emit({
      paymentMethod:"stripe_connect",paymentStatus:"unpaid",status:"pending",
      paymentQrMode:null,companionKitchenRelease:null}));
    await page.locator("#customerStripePaymentStatus[data-payment-state=pending]").waitFor();
    assert.equal(await green.count(),0);
    assert.equal(await page.locator("#customerReceipt").count(),0);
    assert.equal(await page.getByRole("button",{name:/กลับไปชำระรายการเดิม/}).count(),0);
    await page.evaluate(()=>window.__emit({
      paymentMethod:"stripe_connect",paymentStatus:"failed",status:"pending"}));
    await page.locator("#customerStripePaymentStatus[data-payment-state=failed]").waitFor();
    assert.equal(await green.count(),0);

    // A subsequently server-supplied Paid state triggers the same green
    // card only then. Environment marker is display-only.
    await page.evaluate(()=>window.__emit({
      paymentMethod:"stripe_connect",paymentStatus:"paid",status:"accepted"}));
    await green.getByText("ชำระผ่าน Stripe").waitFor();
    assert.equal(await green.getAttribute("data-paid"),"true");
    assert.equal(await page.locator("[data-sandbox-badge]").count(),1);
    assert.equal(await page.locator("#customerStripePaymentStatus").count(),0);

    // COD admission has success order card, explicitly unpaid method.
    await page.evaluate(()=>window.__emit({
      paymentMethod:"cod",paymentStatus:"unpaid",status:"accepted"}));
    await green.getByText(/เก็บเงินปลายทาง · ยังไม่ชำระ/).waitFor();
    assert.equal(await green.getAttribute("data-paid"),"false");
    assert.equal(await page.locator("[data-sandbox-badge]").count(),0);
    assert.deepEqual(errors,[],"browser exceptions");
   }finally{await page.close();}
  }
 }finally{await browser?.close();await vite?.close();await rm(dir,{recursive:true,force:true});}
});

test("Firebase success page retains existing server-backed QR/receipt behavior and the new Source-only visual controls", async()=>{
 const jsx=await readFile("react-app/src/pages/DeliverySuccessPage.jsx","utf8");
 const css=await readFile("public/react/parity/css/delivery-success-customer-actions.css","utf8");
 assert.match(jsx,/CompanionConfirmedQr tenant=\{tenant\} order=\{order\}/);
 assert.match(jsx,/watchPublicOrder\(nextTenant, orderId/);
 assert.match(jsx,/deliveryReceiptPaymentLabel\(order, t\)/);
 assert.match(jsx,/deliveryReceiptItemLabel\(item\)/);
 assert.match(jsx,/deliverySuccessCustomerState\(order/);
 assert.match(jsx,/delivery-success-customer-actions\.css/);
 for(const id of ["orderAgainMobileLink","verifyLatestLink","saveImageButton",
   "customerQROrderReceived","customerStripePaymentStatus"])
  assert.ok(jsx.includes('id="'+id+'"'),id);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/\.customer-payment-badge-sandbox/);
 assert.match(css,/#customerStripePaymentStatus\[data-payment-state="failed"\]/);
 assert.doesNotMatch(jsx,/startStripeConnectDeliveryCheckout|resumeStripe/);
});
