import { chromium } from "@playwright/test";
import { deliveryReceiptItemLabel, deliveryReceiptPaymentLabel, deliveryReceiptZoneLabel } from "../../react-app/src/utils/deliveryReceiptPresentation.js";

const base = process.env.DELIVERY_TEST_BASE_URL || "http://127.0.0.1:5099";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
let failed = false;
try {
 for (const width of [320, 390, 440, 768, 1280]) {
   const ctx = await browser.newContext({ viewport: { width, height: 956 }, isMobile: width <= 440, hasTouch: width <= 440 });
   const page = await ctx.newPage();
   const errors=[];
   page.on("pageerror", e=>errors.push(e.message));
   await page.goto(base + "/s/saas-test-shop/delivery", {waitUntil:"domcontentloaded",timeout:20000});
   await page.addStyleTag({url:base + "/react/parity/css/receipt-layout.css"});
   await page.addStyleTag({url:base + "/react/parity/css/delivery-success-tracking.css"});
   const specimen = {
     pending: deliveryReceiptPaymentLabel({paymentStatus:"pending_verification",paymentMethod:"promptpay"}, key=>key === "delivery.success.payment.pending_verification" ? "ชำระเงินแล้ว รอร้านตรวจสอบ" : key),
     provider: deliveryReceiptZoneLabel({deliveryProvider:"lalamove",deliveryZoneLabel:"Lalamove"},key=>key === "delivery.success.receipt.lalamove_delivery" ? "จัดส่งโดย Lalamove" : key),
     food: deliveryReceiptItemLabel({name:"ตำข้าวโพดไข่เค็ม",qty:1}),
     longFood: deliveryReceiptItemLabel({name:"ตำข้าวโพดไข่เค็ม" + "ปรุงพิเศษ".repeat(21),qty:1}),
   };
   const view = await page.evaluate(sample => {
     document.body.classList.add("delivery-success-page");
     const receipt = document.createElement("section");
     receipt.className="receipt";
     receipt.id="receiptLayoutFixture";
     receipt.style.cssText="width:min(100%,450px);margin:10px auto;padding:12px;box-sizing:border-box;background:white;";
     const pay = document.createElement("div");pay.id="fixturePayment";pay.textContent=sample.pending;
     const zone = document.createElement("div");zone.id="fixtureProvider";zone.textContent=sample.provider;
     const table=document.createElement("table");table.className="receipt-items receipt-items-3col";
     table.innerHTML = "<thead><tr><th>รายการ</th><th class='receipt-unit'>ราคา</th><th class='receipt-line-total'>รวม</th></tr></thead><tbody id='receiptItems'><tr><td class='receipt-item-name'><div class='receipt-item-line'><span class='receipt-item-text' id='fixtureFood'></span></div></td><td class='receipt-unit'>60.00</td><td class='receipt-line-total'>60.00</td></tr><tr><td class='receipt-item-name'><div class='receipt-item-line'><span class='receipt-item-text' id='fixtureLong'></span></div></td><td class='receipt-unit'>60.00</td><td class='receipt-line-total'>60.00</td></tr></tbody>";
     table.querySelector("#fixtureFood").textContent=sample.food;
     table.querySelector("#fixtureLong").textContent=sample.longFood;
     receipt.append(pay,zone,table);document.body.append(receipt);
     const R=el=>el.getBoundingClientRect();
     const food=receipt.querySelector("#fixtureFood"),long=receipt.querySelector("#fixtureLong"),card=R(receipt);
     const sty=getComputedStyle(long);
     return {receiptWidth:Math.round(card.width),food:food.textContent,
      payment:pay.textContent, provider:zone.textContent, overflow:receipt.scrollWidth-receipt.clientWidth,
      pageOverflow:document.documentElement.scrollWidth-innerWidth,
      longClip:sty.webkitLineClamp, longOverflow:sty.overflow,longHeight:Math.round(R(long).height)};
   },specimen);
   const ok=view.food==="ตำข้าวโพดไข่เค็ม x 1"
     && view.payment==="ชำระเงินแล้ว รอร้านตรวจสอบ"
     && view.provider==="จัดส่งโดย Lalamove"
     && view.overflow<=2&&view.pageOverflow<=2
     && view.longOverflow==="visible" && view.longHeight>24 && errors.length===0;
   console.log("RECEIPT_506_"+width+"_"+(ok?"PASS":"FAIL"),JSON.stringify(view));
   if(!ok) failed=true;
   await ctx.close();
 }
} catch(error){console.log("RECEIPT_506_SMOKE_ERROR",String(error));failed=true}
finally{await browser.close()}
if(failed)process.exitCode=1;else console.log("RECEIPT_506_ALL_VIEWPORTS_PASS");
