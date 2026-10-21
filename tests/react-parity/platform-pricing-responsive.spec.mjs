import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const css = readFileSync("react-app/public/parity/css/platform-pricing-page.css", "utf8");

function fixture() {
  const icons = ["bi-calendar-month","bi-truck","bi-percent","bi-calendar2-range",
    "bi-tag","bi-cash-coin","bi-receipt","bi-calculator"];
  const names = [
    "ราคาปกติต่อเดือน (บาท)","เกณฑ์ยอด Delivery สะสมต่อเดือน (บาท)",
    "ส่วนแบ่ง Platform จากยอด Delivery (%)","จำนวนเดือนสำหรับแพ็กเกจรายปี",
    "รูปแบบส่วนลดรายปี","มูลค่าส่วนลด","รูปแบบ VAT","VAT (%)"
  ];
  const controls = icons.map((icon,i)=> `<label><span class="platform-pricing-field-label"><i class="bi ${icon}"></i><span>${names[i]}</span></span><input value="${i===1?10000:i===2?5:590}"></label>`).join("");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body class="platform-pricing-page">
    <header style="display:flex;align-items:center;padding:12px">
      <a class="platform-pricing-back btn" id="back"><i class="bi bi-arrow-left"></i><span>กลับระบบกลาง</span></a>
    </header>
    <main class="platform-pricing-shell">
      <section class="hero platform-pricing-hero">
        <span class="platform-pricing-hero-icon"><i class="bi bi-gem"></i></span>
        <div class="platform-pricing-hero-content"><h1>ตั้งราคา Premium</h1><p>กำหนดราคา ส่วนลด และ VAT จากส่วนกลาง</p></div>
      </section>
      <section class="platform-pricing-grid">
        <form class="card platform-pricing-form-card">
          <div class="section-title platform-pricing-section-heading">
            <span class="platform-pricing-heading-icon"><i class="bi bi-sliders2"></i></span>
            <div><h2>Premium</h2><p>จัดการราคาสมาชิกและเงื่อนไข Delivery</p></div>
          </div>
          <div class="platform-pricing-fields">${controls}</div>
          <div class="field-help platform-pricing-info-note">
            <i class="bi bi-info-circle"></i>
            <p>คิดเฉพาะยอดสินค้าผ่าน Delivery ที่ชำระแล้ว ไม่รวมค่าส่ง เมื่อยอดสะสมรายเดือนเกินเกณฑ์ จะเริ่มคิดส่วนแบ่ง</p>
          </div>
          <div class="platform-pricing-actions">
            <button class="btn platform-pricing-reset" type="button" id="reset"><i class="bi bi-arrow-counterclockwise"></i><span>คืนค่าเริ่มต้น</span></button>
            <button class="btn btn-primary platform-pricing-save" type="button" id="save"><i class="bi bi-floppy"></i><span>บันทึก</span></button>
          </div>
        </form>
        <aside class="card platform-pricing-preview-card">
          <div class="section-title platform-pricing-section-heading">
            <span class="platform-pricing-heading-icon"><i class="bi bi-eye"></i></span>
            <div><h2>ตัวอย่างราคาที่ลูกค้าเห็น</h2><p>Live customer-facing price preview</p></div>
          </div>
          <p class="platform-pricing-monthly"><i class="bi bi-calendar-check"></i><span>รายเดือน</span><strong>590 ฿</strong></p>
          <div class="platform-pricing-price-hero"><small>รายปี</small><span class="platform-pricing-strike">7,080 ฿</span>
          <span class="platform-pricing-final">5,900 ฿</span><span class="platform-pricing-vat-label">ไม่คิด VAT</span></div>
          <div class="platform-pricing-breakdown"><div><span>ราคาเต็ม</span><strong>7,080 ฿</strong></div>
          <div><span>ส่วนลด</span><strong>- 1,180 ฿</strong></div><div><span>ยอดชำระจริง</span><strong>5,900 ฿</strong></div></div>
        </aside>
      </section>
    </main></body></html>`;
}
test("Premium pricing responsive grids, buttons, labels and icons retain geometry at all screen sizes", async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  });
  try {
    for (const width of [320,360,375,390,430,580,768,840,1024,1280,1440,1920]) {
      const page = await browser.newPage({ viewport: {width, height:900}, deviceScaleFactor:1});
      try {
        await page.setContent(fixture());
        await page.addStyleTag({content: `*{box-sizing:border-box}body{margin:0;font-family:Arial,"Noto Sans Thai",sans-serif}
           .btn{cursor:pointer;border:0}.section-title{display:flex;align-items:center}.platform-pricing-page{min-width:0}`});
        await page.addStyleTag({content:css});
        const rects = await page.evaluate(() => {
          const bbox = sel => {
            const el=document.querySelector(sel);
            const r=el.getBoundingClientRect();
            return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
          };
          const buttons=["#back","#reset","#save"].map(selector=>{
            const el=document.querySelector(selector);
            const box=el.getBoundingClientRect();
            const icon=el.querySelector("i").getBoundingClientRect();
            const txt=el.querySelector("span").getBoundingClientRect();
            return {selector,offsetY:Math.abs(icon.y+icon.height/2-(box.y+box.height/2)),
              gap:txt.x-icon.right, h:box.height, right:box.right};
          });
          const grid=getComputedStyle(document.querySelector(".platform-pricing-grid"));
          const fields=getComputedStyle(document.querySelector(".platform-pricing-fields"));
          return {scroll:document.documentElement.scrollWidth,
            gridColumns:grid.gridTemplateColumns.trim().split(" ").length,
            fieldColumns:fields.gridTemplateColumns.trim().split(" ").length,
            form:bbox(".platform-pricing-form-card"), preview:bbox(".platform-pricing-preview-card"),
            hero:bbox(".platform-pricing-hero"),actions:bbox(".platform-pricing-actions"),
            controls:[...document.querySelectorAll(".platform-pricing-fields input")].map(el=>el.getBoundingClientRect().height),
            labels:[...document.querySelectorAll(".platform-pricing-field-label .bi")].map(el=>el.getBoundingClientRect().width),
            buttons};
        });
        assert.ok(rects.scroll<=width+1,`${width}px has horizontal page overflow: ${rects.scroll}`);
        assert.ok(rects.form.width>0&&rects.preview.width>0,`${width}px card missing`);
        assert.ok(rects.hero.right<=width+1,`${width}px hero off screen`);
        assert.equal(rects.gridColumns,width<=840?1:2,`${width}px main column count`);
        assert.equal(rects.fieldColumns,width<=580?1:2,`${width}px form field column count`);
        for(const inputH of rects.controls) assert.ok(inputH>=46,`${width}px input too short: ${inputH}`);
        for(const labelW of rects.labels) assert.ok(labelW>=17,`${width}px label icon collapsed: ${labelW}`);
        for(const button of rects.buttons) {
          assert.ok(button.offsetY<=1.1,`${width}px ${button.selector} icon not centered vertically: ${button.offsetY}`);
          assert.ok(button.gap>=7.5,`${width}px ${button.selector} icon and text too close: ${button.gap}`);
          assert.ok(button.h>=36,`${width}px ${button.selector} short button`);
          assert.ok(button.right<=width+1,`${width}px ${button.selector} offscreen`);
        }
        if(width<=840)assert.ok(rects.preview.y>=rects.form.bottom-1,`${width}px cards overlap`);
        else assert.ok(Math.abs(rects.preview.y-rects.form.y)<2,`${width}px columns not aligned`);
      } finally {await page.close();}
    }
  } finally {await browser.close();}
});
